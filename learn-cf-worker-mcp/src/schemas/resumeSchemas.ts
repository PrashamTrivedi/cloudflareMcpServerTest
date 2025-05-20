import {z} from '@hono/zod-openapi'
import {ZodObject, ZodType, ZodTypeAny} from "zod"

/**
 * Transforms a Zod schema into a format suitable for OpenAI by:
 * - Adding additionalProperties: false to all objects
 * - Making all fields required
 * - Removing validation constraints that OpenAI might struggle with
 *
 * Specifically removes:
 * - For strings: minLength, maxLength, pattern, format (min, max, regex, email, url, etc.)
 * - For numbers: minimum, maximum, multipleOf (min, max, multipleOf, int, etc.)
 * - For objects: patternProperties, unevaluatedProperties, propertyNames, etc.
 * - For arrays: minItems, maxItems, uniqueItems (min, max, length, nonempty, etc.)
 *
 * @param schema The original Zod schema to transform
 * @returns A new Zod schema with modified properties
 */
export function transformSchemaForOpenAI<T extends ZodType>(schema: T): T {
  // Helper to process each schema type
  function processSchema(schema: ZodTypeAny): ZodTypeAny {
    // Handle different schema types
    if (schema instanceof z.ZodObject) {
      const shape = schema._def.shape()
      const newShape: Record<string, ZodTypeAny> = {}

      // Process each field in the object
      for (const [key, value] of Object.entries(shape)) {
        newShape[key] = processSchema(value)
      }

      // Create new object schema with additionalProperties: false and all fields required
      return z.object(newShape).openapi({
        // Preserve description and example if they exist
        ...(schema._def.openapi ? {
          description: schema._def.openapi.description,
          example: schema._def.openapi.example
        } : {}),
        // Always add additionalProperties: false
        additionalProperties: false,
      })
    }
    else if (schema instanceof z.ZodArray) {
      // Process array items, removing all array constraints
      // This removes: minItems, maxItems, uniqueItems validation
      return z.array(processSchema(schema._def.type)).openapi({
        // Preserve description and example if they exist
        ...(schema._def.openapi ? {
          description: schema._def.openapi.description,
          example: schema._def.openapi.example
        } : {})
      })
    }
    else if (schema instanceof z.ZodString) {
      // Remove ALL string validations (min, max, regex, email, url, etc.)
      return z.string().openapi({
        // Preserve description and example if they exist
        ...(schema._def.openapi ? {
          description: schema._def.openapi.description,
          example: schema._def.openapi.example
        } : {})
      })
    }
    else if (schema instanceof z.ZodNumber) {
      // Remove ALL number validations (min, max, multipleOf, int, etc.)
      return z.number().openapi({
        // Preserve description and example if they exist
        ...(schema._def.openapi ? {
          description: schema._def.openapi.description,
          example: schema._def.openapi.example
        } : {})
      })
    }
    else if (schema instanceof z.ZodBoolean) {
      // Preserve boolean as is
      return z.boolean().openapi({
        // Preserve description and example if they exist
        ...(schema._def.openapi ? {
          description: schema._def.openapi.description,
          example: schema._def.openapi.example
        } : {})
      })
    }
    else if (schema instanceof z.ZodNullable) {
      // Handle nullable fields
      return z.nullable(processSchema(schema.unwrap()))
    }
    else if (schema instanceof z.ZodOptional) {
      // Make optional fields required
      return processSchema(schema.unwrap())
    }
    else if (schema instanceof z.ZodEnum || schema instanceof z.ZodLiteral) {
      // Preserve enums and literals but without additional constraints
      // Convert them to strings for maximum compatibility
      return z.string().openapi({
        // Preserve description and example if they exist
        ...(schema._def.openapi ? {
          description: schema._def.openapi.description,
          example: schema._def.openapi.example
        } : {})
      })
    }
    else if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
      // For unions, just convert to the first type for simplicity
      // This is a simplification that might lose some information
      // but ensures OpenAI has a concrete type to work with
      return processSchema(schema._def.options[0])
    }

    // Return other schema types unchanged
    return schema
  }

  return processSchema(schema) as T
}

// Generic confidence field schema
const ConfidenceFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.number().min(0).max(1).openapi({
      description: 'Confidence score between 0 and 1',
      example: 0.95
    }),
    standardization: z.string().nullable().openapi({
      description: 'Notes about any standardization applied',
      example: 'Standardized from "JS" to "JavaScript"'
    })
  })

// Date range schema
const DateRangeSchema = z.object({
  startDate: ConfidenceFieldSchema(z.string().nullable()),
  endDate: ConfidenceFieldSchema(z.string().nullable()),
  durationInMonths: ConfidenceFieldSchema(z.number().nullable()),
  current: ConfidenceFieldSchema(z.boolean())
}).openapi('DateRange')

// Request schema
export const ResumeParserRequestSchema = z.object({
  resumeText: z.string().min(1).openapi({
    description: 'The raw text of the resume to parse',
    example: 'John Doe\nSoftware Engineer\n...'
  }),
  options: z.object({
    confidenceThreshold: z.number().min(0).max(1).optional().openapi({
      description: 'Minimum confidence score threshold (0-1)',
      example: 0.5
    }),
    standardizationEnabled: z.boolean().optional().openapi({
      description: 'Whether to standardize terminology',
      example: true
    }),
    extractSummary: z.boolean().optional().openapi({
      description: 'Whether to extract and analyze the resume summary',
      example: true
    }),
    sectionPriorities: z.array(z.string()).optional().openapi({
      description: 'Sections to prioritize in extraction',
      example: ['skills', 'workExperience']
    }),
    extractLanguages: z.boolean().optional().openapi({
      description: 'Whether to extract language proficiencies',
      example: true
    })
  }).optional().openapi({
    description: 'Parser configuration options'
  })
}).openapi('ResumeParserRequest')

// Personal info schema
const PersonalInfoSchema = z.object({
  name: ConfidenceFieldSchema(z.string()),
  email: ConfidenceFieldSchema(z.string()),
  phone: ConfidenceFieldSchema(z.string()),
  location: ConfidenceFieldSchema(z.string().nullable()),
  linkedin: ConfidenceFieldSchema(z.string().nullable()),
  github: ConfidenceFieldSchema(z.string().nullable()),
  website: ConfidenceFieldSchema(z.string().nullable()),
  summary: ConfidenceFieldSchema(z.string().nullable())
}).openapi('PersonalInfo')

// Skill schema
const SkillSchema = z.object({
  name: ConfidenceFieldSchema(z.string()),
  category: ConfidenceFieldSchema(z.string().nullable()),
  proficiency: ConfidenceFieldSchema(z.string().nullable()),
  yearsOfExperience: ConfidenceFieldSchema(z.number().nullable())
}).openapi('Skill')

// Work experience schema
const WorkExperienceSchema = z.object({
  company: ConfidenceFieldSchema(z.string()),
  title: ConfidenceFieldSchema(z.string()),
  location: ConfidenceFieldSchema(z.string().nullable()),
  dates: DateRangeSchema,
  responsibilities: ConfidenceFieldSchema(z.array(z.string())),
  technologies: ConfidenceFieldSchema(z.array(z.string())),
  achievements: ConfidenceFieldSchema(z.array(z.string()))
}).openapi('WorkExperience')

// Education schema
const EducationSchema = z.object({
  institution: ConfidenceFieldSchema(z.string()),
  degree: ConfidenceFieldSchema(z.string()),
  field: ConfidenceFieldSchema(z.string()),
  dates: DateRangeSchema,
  gpa: ConfidenceFieldSchema(z.string().nullable()),
  coursework: ConfidenceFieldSchema(z.array(z.string()).nullable()),
  achievements: ConfidenceFieldSchema(z.array(z.string()).nullable())
}).openapi('Education')

// Project schema
const ProjectSchema = z.object({
  name: ConfidenceFieldSchema(z.string()),
  description: ConfidenceFieldSchema(z.string()),
  technologies: ConfidenceFieldSchema(z.array(z.string())),
  urls: ConfidenceFieldSchema(z.array(z.string()).nullable()),
  dates: ConfidenceFieldSchema(DateRangeSchema.nullable()),
  role: ConfidenceFieldSchema(z.string().nullable())
}).openapi('Project')

// Certification schema
const CertificationSchema = z.object({
  name: ConfidenceFieldSchema(z.string()),
  issuer: ConfidenceFieldSchema(z.string().nullable()),
  date: ConfidenceFieldSchema(z.string().nullable()),
  expiryDate: ConfidenceFieldSchema(z.string().nullable()),
  id: ConfidenceFieldSchema(z.string().nullable())
}).openapi('Certification')

// Language schema
const LanguageSchema = z.object({
  name: ConfidenceFieldSchema(z.string()),
  proficiency: ConfidenceFieldSchema(z.string().nullable())
}).openapi('Language')

// Parsed resume schema
export const ParsedResumeSchema = z.object({
  personalInfo: PersonalInfoSchema,
  skills: z.array(SkillSchema),
  workExperience: z.array(WorkExperienceSchema),
  education: z.array(EducationSchema),
  projects: z.array(ProjectSchema),
  certifications: z.array(CertificationSchema),
  languages: z.array(LanguageSchema),
  overallConfidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
  detectedSections: z.array(z.string())
}).openapi('ParsedResume')

// Response schema
export const ParseResumeResponseSchema = z.object({
  success: z.boolean(),
  data: ParsedResumeSchema.optional(),
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.unknown().optional()
  }).optional()
}).openapi('ParseResumeResponse')

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.unknown().optional()
  })
}).openapi('ErrorResponse')
//Simplified ConfidenceFieldSchema
export const SimplifiedConfidenceFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.describe("The original value passed, keep this as it is."),
    confidence: z.number().describe("A confidence score between 0 to 1 about clarity and standardise termwords, 0 is for not clear and not standard and 1 is for clear and standard terms. Abbreviations are not standard"),
    standardization: z.string().describe("If the value has confidence > 0.8 keep pass the original value as is, Otherwise pass in following format, suitable for tooltip: UpdatedStandardValue=ReasonBehindUpdation")
  })
// Create a simplified schema for OpenAI with fewer parameters
// This addresses the 100 parameter limit in OpenAI's response_format
export const SimplifiedResumeSchema = z.object({
  personalInfo: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string().nullable(),
    linkedin: z.string().nullable(),
    github: z.string().nullable(),
    website: z.string().nullable(),
    summary: z.string().nullable()
  }),
  skills: z.array(z.object({
    name: SimplifiedConfidenceFieldSchema(z.string()),
    category: SimplifiedConfidenceFieldSchema(z.string().nullable()),
    proficiency: SimplifiedConfidenceFieldSchema(z.string().nullable()),
    yearsOfExperience: z.number().nullable()
  })),
  workExperience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    location: z.string().nullable(),
    dates: z.object({
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      current: z.boolean()
    }),
    responsibilities: z.array(z.string()),
    technologies: z.array(z.string()),
    achievements: z.array(z.string())
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: SimplifiedConfidenceFieldSchema(z.string()),
    field: SimplifiedConfidenceFieldSchema(z.string()),
    dates: z.object({
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      current: z.boolean()
    }),
    gpa: z.string().nullable(),
    coursework: z.array(z.string()).nullable(),
    achievements: z.array(z.string()).nullable()
  })),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    technologies: SimplifiedConfidenceFieldSchema((z.array(z.string()))),
    urls: z.array(z.string()).nullable(),
    role: SimplifiedConfidenceFieldSchema(z.string().nullable())
  })),
  certifications: z.array(z.object({
    name: SimplifiedConfidenceFieldSchema(z.string()),
    issuer: SimplifiedConfidenceFieldSchema(z.string().nullable()),
    date: z.string().nullable(),
    expiryDate: z.string().nullable(),
    id: z.string().nullable()
  })),
  languages: z.array(z.object({
    name: SimplifiedConfidenceFieldSchema(z.string()),
    proficiency: SimplifiedConfidenceFieldSchema(z.string().nullable())
  })),
  overallConfidence: z.number(),
  missingFields: z.array(z.string()),
  detectedSections: z.array(z.string())
})

export const HeadersSchema = z.object({
  'x-app-id': z.string().openapi({
    example: '123456'
  })
})

// Example of how to use the transformSchemaForOpenAI function:
// This creates a version of SimplifiedResumeSchema that's suitable for OpenAI
export const OpenAICompatibleResumeSchema = transformSchemaForOpenAI(SimplifiedResumeSchema)
