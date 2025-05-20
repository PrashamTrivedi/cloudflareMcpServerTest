import {OpenAI} from "openai"
import {ParsedResume, ResumeParserOptions, ConfidenceField, DateRange} from "../types/resume"
import {generatePrompt} from "../prompts/resumePrompts"
import {OpenAICompatibleResumeSchema, ParsedResumeSchema} from "../schemas/resumeSchemas"
import {z} from "@hono/zod-openapi"
import {zodResponseFormat} from "openai/helpers/zod"
import {env} from "cloudflare:workers"

/**
 * Parse resume text using OpenAI and return structured data
 *
 * @param resumeText The plain text of the resume to parse
 * @param options Optional parsing configuration
 * @returns Structured resume data with confidence scores
 */
export async function parseResumeWithAI(
  resumeText: string,
  options?: ResumeParserOptions
): Promise<ParsedResume> {
  try {
    // Input validation
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text is too short or empty")
    }

    // Initialize OpenAI client (uses API key from environment in ValTown)
    const openai = new OpenAI({
      apiKey: await env['OPENAI_API_KEY'].get()
    })

    // Get extraction prompt
    const extractPrompt = generatePrompt('extract')

    // Configure extraction based on options
    const extractionFocus = options?.sectionPriorities?.length
      ? `\n\nPay special attention to extracting these sections with high accuracy: ${options.sectionPriorities.join(', ')}.`
      : ''

    const extractLanguages = options?.extractLanguages === false
      ? '\n\nSkip extracting language proficiencies as they are not required.'
      : ''

    const extractSummary = options?.extractSummary === false
      ? '\n\nSkip extracting and analyzing the resume summary as it is not required.'
      : '\n\nEnsure you extract and analyze the resume summary to understand the candidate\'s self-presentation.'

    // Create enhanced system prompt with specific instructions
    const systemPrompt = `You are an expert resume parsing AI specifically trained to extract structured data from resumes with high precision.

Your goal is to analyze the resume text and extract information following these principles:
1. Extract ALL relevant information into the specified JSON structure
2. Assign appropriate confidence scores to each field (0-1)
3. Provide standardization notes when you normalize or transform data
4. NEVER invent or hallucinate data not present in the resume
5. For missing data, use null values with confidence scores of 0
6. Categorize skills appropriately and identify proficiency levels when present
7. For work experience, separate responsibilities from achievements
8. Standardize job titles and technology names to common industry terms
9. Detect and extract project information with associated technologies
10. Look for education details with specific degree names and institutions

${extractionFocus}${extractLanguages}${extractSummary}`

    console.log("Calling OpenAI API for initial extraction...")


    // Call OpenAI API with enhanced system prompt and structured output schema
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: extractPrompt + "\n\nResume Text:\n" + resumeText}
      ],
      response_format: zodResponseFormat(OpenAICompatibleResumeSchema, 'parsedResume')
    })

    try {
      // Parse and validate the response
      const responseContent = completion.choices[0]?.message?.parsed

      if (!responseContent) {
        throw new Error("Empty response from OpenAI")
      }

      // Convert simplified schema format to full ParsedResume format
      return convertToParsedResume(responseContent)
    } catch (error) {

      console.error("JSON parsing error:", error)
      throw new Error("Failed to parse OpenAI response as valid JSON")
    }
  } catch (error) {
    console.error("OpenAI parsing error:", error)
    // Provide specific error message based on the error type
    if ((error as Error).message.includes("429")) {
      throw new Error("OpenAI rate limit exceeded. Please try again later.")
    } else if ((error as Error).message.includes("401") || (error as Error).message.includes("403")) {
      throw new Error("Authentication error with OpenAI API. Check your API key.")
    } else {
      throw new Error("Failed to parse resume with OpenAI: " + (error as Error).message)
    }
  }
}

/**
 * Validate extracted data using OpenAI
 *
 * @param data The extracted resume data to validate
 * @returns Validated resume data with confidence scores
 */
export async function validateResumeWithAI(data: ParsedResume): Promise<ParsedResume> {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: await env['OPENAI_API_KEY'].get()
    })

    // Get validation prompt
    const validationPrompt = generatePrompt('validate')

    // Enhanced system prompt for validation
    const systemPrompt = `You are an expert resume data validator specialized in standardizing and improving extracted resume data.

Your task is to analyze the provided JSON resume data and:
1. Validate all fields for correctness and consistency
2. Standardize terminology such as:
   - Convert degree abbreviations to full forms (e.g., "BS" → "Bachelor of Science")
   - Normalize job titles to industry standard terms (e.g., "Dev" → "Developer", "SWE" → "Software Engineer")
   - Standardize technology names (e.g., "JS" → "JavaScript", "React.js" → "React")
   - Format dates consistently in YYYY-MM format when possible
3. Cross-reference information for inconsistencies:
   - Skills mentioned in experience but missing from skills section
   - Date overlaps or impossible timelines
   - Educational degrees that don't align with stated institutions
4. Update confidence scores based on your validation:
   - Increase scores for validated fields
   - Decrease scores for fields with detected issues
5. Add standardization notes for any changes you make

DO NOT remove or invent data - only standardize, correct, and validate what is provided.
Always return the complete JSON structure with your improvements.`

    console.log("Calling OpenAI API for validation and standardization...")


    // Call OpenAI API with enhanced validation
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: validationPrompt + "\n\nResume Data:\n" + JSON.stringify(data)}
      ],
      response_format: zodResponseFormat(OpenAICompatibleResumeSchema, 'validResume')
    })

    // Parse and validate the response
    try {
      const responseContent = completion.choices[0]?.message?.parsed

      if (!responseContent) {
        throw new Error("Empty validation response from OpenAI")
      }

      // Convert simplified schema format to full ParsedResume format
      return convertToParsedResume(responseContent)
    } catch (error) {
      console.error("Validation JSON parsing error:", error)
      console.warn("Using original data due to validation error")
      return data // Return original data if validation fails
    }
  } catch (error) {
    console.error("OpenAI validation error:", error)
    console.warn("Using original data due to validation API error")
    // Return original data if validation API call fails
    return data
  }
}

/**
 * Helper function to check if OpenAI extraction result is valid
 * and retry if necessary with a different prompt strategy
 *
 * @param data Initial extraction result
 * @param resumeText Original resume text
 * @returns Fixed data or the original data
 */
export async function retryExtractionIfNeeded(data: ParsedResume, resumeText: string): Promise<ParsedResume> {
  try {
    // Check for common extraction issues
    const hasEmptyRequiredFields = !data.personalInfo?.name?.value ||
      !data.personalInfo?.email?.value ||
      data.skills.length === 0 ||
      data.workExperience.length === 0

    const hasLowConfidence = data.overallConfidence < 0.5

    // If no major issues, return the data as is
    if (!hasEmptyRequiredFields && !hasLowConfidence) {
      console.log("All good! Returning the data for next step")
      return data
    }

    console.log("Initial extraction had issues, attempting retry with different strategy...")

    const openai = new OpenAI({
      apiKey: await env['OPENAI_API_KEY'].get()
    })

    // Create a simplified extraction prompt focused on missing data
    const systemPrompt = `You are an expert resume parser. The initial extraction of this resume had issues.
Please focus on extracting these critical elements:

1. Personal information (especially name, email, phone)
2. Skills and technologies with appropriate categories
3. Work experience with clear company names, titles, and dates
4. Education details with institutions and degrees

Maintain the exact same JSON format as the original extraction.
Do NOT invent information not present in the resume.`


    // Call OpenAI API with retry strategy
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {role: "system", content: systemPrompt},
        {
          role: "user", content: `Here is the resume text. Extract the missing information and produce a complete JSON result:

Resume:
${resumeText}

Current extraction (with issues):
${JSON.stringify(data, null, 2)}

Please provide a complete and corrected JSON response following the exact same schema.` }
      ],
      response_format: zodResponseFormat(OpenAICompatibleResumeSchema, 'retriedResume')
    })

    // Parse and return the response
    try {
      const responseContent = completion.choices[0]?.message?.parsed

      // Convert simplified schema format to full ParsedResume format
      return convertToParsedResume(responseContent)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Retry Zod validation error:", error.format())
        return data
      }
      console.error("Retry JSON parsing error:", error)
      return data // Return original data if parsing fails
    }
  } catch (error) {
    console.error("Retry extraction error:", error)
    return data // Return original data if retry fails
  }
}

/**
 * Convert simplified OpenAI schema format to full ParsedResume format with confidence fields
 * @param simplified Simplified resume data returned from OpenAI
 * @returns Fully structured resume data with confidence fields
 */
function convertToParsedResume(simplified: any): ParsedResume {
  if (!simplified) return simplified

  // Helper to create confidence field
  function createConfidenceField<T>(value: T, confidence = 0.5): ConfidenceField<T> {
    return {
      value,
      confidence,
      standardization: null
    }
  }

  // Helper to create date range with confidence fields
  function createDateRangeWithConfidence(dates: any): DateRange {
    if (!dates) {
      return {
        startDate: createConfidenceField(null),
        endDate: createConfidenceField(null),
        durationInMonths: createConfidenceField(null),
        current: createConfidenceField(false)
      }
    }

    return {
      startDate: createConfidenceField(dates.startDate),
      endDate: createConfidenceField(dates.endDate),
      durationInMonths: createConfidenceField(null), // Will be calculated in post-processing
      current: createConfidenceField(dates.current || false)
    }
  }

  // Create full ParsedResume structure with confidence fields
  const result: ParsedResume = {
    personalInfo: {
      name: createConfidenceField(simplified.personalInfo.name),
      email: createConfidenceField(simplified.personalInfo.email),
      phone: createConfidenceField(simplified.personalInfo.phone),
      location: createConfidenceField(simplified.personalInfo.location),
      linkedin: createConfidenceField(simplified.personalInfo.linkedin),
      github: createConfidenceField(simplified.personalInfo.github),
      website: createConfidenceField(simplified.personalInfo.website),
      summary: createConfidenceField(simplified.personalInfo.summary)
    },
    skills: (simplified.skills || []).map((skill: any) => ({
      name: createConfidenceField(skill.name),
      category: createConfidenceField(skill.category),
      proficiency: createConfidenceField(skill.proficiency),
      yearsOfExperience: createConfidenceField(skill.yearsOfExperience)
    })),
    workExperience: (simplified.workExperience || []).map((exp: any) => ({
      company: createConfidenceField(exp.company),
      title: createConfidenceField(exp.title),
      location: createConfidenceField(exp.location),
      dates: createDateRangeWithConfidence(exp.dates),
      responsibilities: createConfidenceField(exp.responsibilities || []),
      technologies: createConfidenceField(exp.technologies || []),
      achievements: createConfidenceField(exp.achievements || [])
    })),
    education: (simplified.education || []).map((edu: any) => ({
      institution: createConfidenceField(edu.institution),
      degree: createConfidenceField(edu.degree),
      field: createConfidenceField(edu.field),
      dates: createDateRangeWithConfidence(edu.dates),
      gpa: createConfidenceField(edu.gpa),
      coursework: createConfidenceField(edu.coursework),
      achievements: createConfidenceField(edu.achievements)
    })),
    projects: (simplified.projects || []).map((proj: any) => ({
      name: createConfidenceField(proj.name),
      description: createConfidenceField(proj.description),
      technologies: createConfidenceField(proj.technologies || []),
      urls: createConfidenceField(proj.urls),
      dates: createConfidenceField(null), // Simplified schema removed this for complexity reduction
      role: createConfidenceField(proj.role)
    })),
    certifications: (simplified.certifications || []).map((cert: any) => ({
      name: createConfidenceField(cert.name),
      issuer: createConfidenceField(cert.issuer),
      date: createConfidenceField(cert.date),
      expiryDate: createConfidenceField(cert.expiryDate),
      id: createConfidenceField(cert.id)
    })),
    languages: (simplified.languages || []).map((lang: any) => ({
      name: createConfidenceField(lang.name),
      proficiency: createConfidenceField(lang.proficiency)
    })),
    overallConfidence: simplified.overallConfidence || 0.7,
    missingFields: simplified.missingFields || [],
    detectedSections: simplified.detectedSections || []
  }

  return result
}