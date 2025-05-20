import {
  ParsedResume,
  ConfidenceField,
  ResumeParserOptions,
  PersonalInfo,
  Skill,
  WorkExperience,
  Education,
  Project,
  Certification,
  Language,
  DateRange
} from '../types/resume'
import {generatePrompt} from '../prompts/resumePrompts'
import {parseResumeWithAI, validateResumeWithAI, retryExtractionIfNeeded} from './openai'

/**
 * Helper function to create a confidence field with a value and confidence score
 */
function createConfidenceField<T>(
  value: T,
  confidence: number,
  standardization: string | null = null
): ConfidenceField<T> {
  return {
    value,
    confidence,
    standardization
  }
}

/**
 * Extract structured data from resume text with confidence scoring
 * 
 * @param resumeText Plain text of the resume
 * @param options Optional parsing configuration
 * @returns Structured resume data with confidence scores
 */
export async function extractResumeData(
  resumeText: string,
  options?: ResumeParserOptions
): Promise<ParsedResume> {
  try {
    console.log('Extracting data from resume text...')

    // Apply configuration options
    const confidenceThreshold = options?.confidenceThreshold || 0.3
    const standardizationEnabled = options?.standardizationEnabled !== false // Default to true

    // Step 1: Initial extraction with OpenAI
    console.log('Step 1: Performing initial extraction with OpenAI')
    let extractedData = await parseResumeWithAI(resumeText, options)

    if (!extractedData) {
      throw new Error('Failed to extract data from resume')
    }

    // Step 2: Retry extraction if initial results have issues
    console.log('Step 2: Checking extraction quality and retrying if needed')
    extractedData = await retryExtractionIfNeeded(extractedData, resumeText)

    // Step 3: Validate and standardize the data if enabled
    let processedData = extractedData
    if (standardizationEnabled) {
      console.log('Step 3: Validating and standardizing extracted data')
      processedData = await validateResumeWithAI(extractedData)
    }

    // Step 4: Post-process the data (apply confidence thresholds, fill missing calculations)
    console.log('Step 4: Post-processing and final validation')
    const result = postProcessResumeData(processedData, confidenceThreshold)

    // Log completion status and confidence
    if (result.overallConfidence >= 0.7) {
      console.log('Resume extraction completed successfully with high confidence:', result.overallConfidence)
    } else if (result.overallConfidence >= 0.5) {
      console.log('Resume extraction completed with moderate confidence:', result.overallConfidence)
    } else {
      console.log('Resume extraction completed with low confidence:', result.overallConfidence)
      console.log('Missing fields:', result.missingFields)
    }

    return result

  } catch (error) {
    console.error('Error extracting resume data:', error)
    throw new Error(`Failed to extract resume data: ${(error as Error).message}`)
  }
}

/**
 * Post-process resume data after AI extraction and validation
 *
 * @param data Extracted and validated resume data
 * @param confidenceThreshold Minimum confidence threshold for fields
 * @returns Finalized resume data
 */
function postProcessResumeData(data: any, confidenceThreshold: number = 0.3): ParsedResume {
  try {
    // Ensure we have all required sections with at least empty arrays
    const processed: ParsedResume = {
      personalInfo: data.personalInfo || createDefaultPersonalInfo(),
      skills: data.skills || [],
      workExperience: data.workExperience || [],
      education: data.education || [],
      projects: data.projects || [],
      certifications: data.certifications || [],
      languages: data.languages || [],
      overallConfidence: data.overallConfidence || 0,
      missingFields: data.missingFields || [],
      detectedSections: data.detectedSections || []
    }

    // Calculate missing durations in work experience
    processed.workExperience = processed.workExperience.map(exp => {
      if (exp.dates) {
        // Calculate duration if not already provided
        if (!exp.dates.durationInMonths.value && exp.dates.startDate.value) {
          const startDate = new Date(exp.dates.startDate.value)
          const endDate = exp.dates.endDate.value ? new Date(exp.dates.endDate.value) : new Date()

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const months = calculateMonthsBetween(startDate, endDate)
            exp.dates.durationInMonths = createConfidenceField(months, 0.8)
          }
        }
      }
      return exp
    })

    // Perform similar calculations for education dates
    processed.education = processed.education.map(edu => {
      if (edu.dates) {
        if (!edu.dates.durationInMonths.value && edu.dates.startDate.value) {
          const startDate = new Date(edu.dates.startDate.value)
          const endDate = edu.dates.endDate.value ? new Date(edu.dates.endDate.value) : new Date()

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const months = calculateMonthsBetween(startDate, endDate)
            edu.dates.durationInMonths = createConfidenceField(months, 0.8)
          }
        }
      }
      return edu
    })

    // Calculate updated overall confidence score
    const confidenceValues: number[] = []

    // Add personal info confidences
    Object.values(processed.personalInfo).forEach(field => {
      if (field && typeof field.confidence === 'number') {
        confidenceValues.push(field.confidence)
      }
    })

    // Add skills confidences
    processed.skills.forEach(skill => {
      confidenceValues.push(skill.name.confidence)
    })

    // Add work experience confidences (weighted higher)
    processed.workExperience.forEach(exp => {
      confidenceValues.push(exp.company.confidence * 1.5)
      confidenceValues.push(exp.title.confidence * 1.5)
    })

    // Add education confidences (weighted higher)
    processed.education.forEach(edu => {
      confidenceValues.push(edu.institution.confidence * 1.5)
      confidenceValues.push(edu.degree.confidence * 1.5)
    })

    // Calculate average confidence
    if (confidenceValues.length > 0) {
      processed.overallConfidence = confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length
    } else {
      processed.overallConfidence = 0
    }

    // Round to 2 decimal places
    processed.overallConfidence = Math.round(processed.overallConfidence * 100) / 100

    // Update missing fields by checking all required fields
    const updatedMissingFields: string[] = []

    // Check personal info required fields
    const requiredPersonalFields = ['name', 'email', 'phone']
    requiredPersonalFields.forEach(field => {
      const value = (processed.personalInfo as any)[field]?.value
      if (!value || (processed.personalInfo as any)[field].confidence < confidenceThreshold) {
        updatedMissingFields.push(`personalInfo.${field}`)
      }
    })

    // Skills, work experience, education must have at least one entry
    if (processed.skills.length === 0) {
      updatedMissingFields.push('skills')
    }

    if (processed.workExperience.length === 0) {
      updatedMissingFields.push('workExperience')
    }

    if (processed.education.length === 0) {
      updatedMissingFields.push('education')
    }

    processed.missingFields = updatedMissingFields

    return processed
  } catch (error) {
    console.error('Error in post-processing resume data:', error)
    // Return original data if post-processing fails
    return data as ParsedResume
  }
}

/**
 * Create a default personal info object with empty fields
 */
function createDefaultPersonalInfo(): PersonalInfo {
  return {
    name: createConfidenceField('', 0),
    email: createConfidenceField('', 0),
    phone: createConfidenceField('', 0),
    location: createConfidenceField(null, 0),
    linkedin: createConfidenceField(null, 0),
    github: createConfidenceField(null, 0),
    website: createConfidenceField(null, 0),
    summary: createConfidenceField(null, 0)
  }
}

/**
 * Calculate months between two dates
 */
function calculateMonthsBetween(startDate: Date, endDate: Date): number {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())
}


/**
 * Calculate confidence score for a field based on various factors
 * 
 * @param value The field value
 * @param fieldType The type of field being scored
 * @param context Additional context for scoring
 * @returns Confidence score between 0 and 1
 */
export function calculateConfidence(
  value: any,
  fieldType: string,
  context?: Record<string, any>
): number {
  // In the real implementation, this would calculate confidence based on:
  // - Field completion/presence
  // - Format validity
  // - Consistency with other fields
  // - Pattern matching against known formats
  // - Etc.

  // For now, return a placeholder score
  if (!value) return 0
  return 0.8
}

/**
 * Detect and standardize common terminology
 * 
 * @param value The original value
 * @param fieldType The type of field to standardize
 * @returns Standardized value and standardization notes
 */
export function standardizeTerminology(
  value: string,
  fieldType: 'degree' | 'jobTitle' | 'skill' | 'language' | string
): {standardized: string; notes: string | null} {
  // This would contain logic to standardize different types of fields
  // For example, converting "BS" to "Bachelor of Science"

  // For now, return the original value
  return {standardized: value, notes: null}
}

/**
 * Add confidence scores to all fields in the resume data
 * 
 * @param data Raw resume data without confidence scores
 * @returns Resume data with confidence scores added
 */
export function addConfidenceScores(data: any): ParsedResume {
  // This function would iterate through the resume data and add
  // confidence scores to each field based on various factors

  // For now, return a placeholder response
  return data as ParsedResume
}