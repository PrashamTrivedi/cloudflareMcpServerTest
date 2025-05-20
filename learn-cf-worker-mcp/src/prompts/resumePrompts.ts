/**
 * Generate prompts for different resume parsing operations
 * 
 * @param type The type of prompt to generate
 * @returns The prompt text
 */
export function generatePrompt(type: 'extract' | 'validate' | 'confidence'): string {
  switch (type) {
    case 'extract':
      return `Extract structured data from the following resume with HIGH PRECISION.


IMPORTANT GUIDELINES:
1. Confidence scores range from 0 to 1, where:
   - 0.9-1.0: Very high confidence (clear, unambiguous data)
   - 0.7-0.9: High confidence (likely correct, but could have minor issues)
   - 0.5-0.7: Medium confidence (possibly correct, but some uncertainty)
   - 0.3-0.5: Low confidence (significant uncertainty)
   - 0.0-0.3: Very low confidence (likely incorrect or missing data)

2. Standardization notes should be provided whenever you transform or normalize the data, such as:
   - Converting abbreviations to full forms (e.g., "BS" → "Bachelor of Science")
   - Normalizing job titles (e.g., "Dev" → "Developer")
   - Standardizing technology names (e.g., "JS" → "JavaScript")
   - Date format standardization
   - If no standardization was performed, use null

3. For missing or unavailable data:
   - Use null for string fields that are missing
   - Use empty array [] for array fields that are missing
   - Use 0 as the confidence score for missing fields
   - Add the field path to missingFields array (e.g., "personalInfo.website")

4. For dates:
   - Use ISO format (YYYY-MM) whenever possible
   - Mark current positions with current: true and null endDate
   - Calculate durationInMonths when possible

5. For skills:
   - Infer categories when possible (e.g., "Programming Languages", "Tools", "Frameworks")
   - Infer proficiency when mentioned ("Beginner", "Intermediate", "Advanced", "Expert")
   - Detect years of experience when mentioned

6. For work experience:
   - Extract technologies used in each role when mentioned
   - Separate responsibilities from achievements when possible
   - Standardize job titles to industry norms

7. DO NOT fabricate or assume information not present in the resume. If information is missing, use null with a confidence score of 0.

8. The overallConfidence score should be a weighted average of all fields, giving more weight to critical fields like name, contact info, work experience, and education.

9. The detectedSections array should list all major sections found in the resume (e.g., personal_information, skills, experience, education, etc.).`;
      
    case 'validate':
      return `Validate the following resume data for consistency, accuracy, and standardization.

For each field in the data:
1. Check for inconsistencies and validate format
2. Standardize terminology where appropriate:
   - Degree names (e.g., "BS" → "Bachelor of Science", "MS" → "Master of Science")
   - Job titles (e.g., "SWE" → "Software Engineer", "PM" → "Product Manager")
   - Technology names (e.g., "JS" → "JavaScript", "TS" → "TypeScript")
   - Institution names (e.g., "NYU" → "New York University")
3. Validate dates:
   - Ensure date ranges are logical (start before end)
   - Verify that duration calculations are accurate
   - Check for overlapping or inconsistent date ranges
4. Look for contradictions:
   - Skills mentioned in work experience but not in skills section
   - Technologies that don't match the responsibilities
   - Date inconsistencies between sections
5. Update confidence scores:
   - Increase confidence for validated fields
   - Decrease confidence for fields with detected issues
   - Add standardization notes when changes are made

Return the validated and standardized data in the exact same format, including:
- All confidence scores updated based on validation
- Standardization notes added for any changes made
- Overall confidence score recalculated
- Missing fields list updated if additional missing fields are found

If you detect serious inconsistencies or potential fabrications, mark those fields with lower confidence scores and add appropriate standardization notes.`;
      
    case 'confidence':
      return `Analyze the following resume data and calculate confidence scores for each field.

Confidence scoring criteria by field type:

1. Personal Information:
   - Name: Check for full name vs. partial, common formats
   - Email: Validate format, check for standard patterns
   - Phone: Validate format, check country code presence
   - Location: Check for specificity (city/state/country)
   - Social/Web: Validate URL formats and completeness

2. Skills:
   - Compare against known technology/skill names
   - Check for specificity (general vs. specific skills)
   - Look for proficiency indicators
   - Consider consistency with work experience

3. Work Experience:
   - Validate company names against known entities
   - Check job title standardization
   - Verify date formats and calculations
   - Evaluate responsibility descriptions (specific vs. vague)
   - Look for quantifiable achievements
   - Check for technology mentions that match skills

4. Education:
   - Validate institution names
   - Check degree nomenclature standardization
   - Verify field of study specificity
   - Validate date formats and ranges
   - Check GPA format and range
   - Evaluate coursework relevance

5. Projects & Certifications:
   - Evaluate description specificity
   - Check URL validity
   - Verify technology consistency with skills
   - Validate certification issuers
   - Check date formats and validity

Rate each field on a scale from 0 to 1, where:
- 0.9-1.0: Very high confidence (clear, unambiguous data)
- 0.7-0.9: High confidence (likely correct, but could have minor issues)
- 0.5-0.7: Medium confidence (possibly correct, but some uncertainty)
- 0.3-0.5: Low confidence (significant uncertainty)
- 0.0-0.3: Very low confidence (likely incorrect or missing data)

For any field where confidence is below 0.7, include specific reasons in the standardization notes.

Return the data with confidence scores added to each field and an overall confidence score that is a weighted average of all fields.`;
      
    default:
      return '';
  }
}