import {OpenAPIHono} from '@hono/zod-openapi'
import {createRoute} from '@hono/zod-openapi'
import {extractResumeData} from '../utils/resumeParser'
import {
  ResumeParserRequest,
  ParseResumeResponse,
  ParsedResume
} from '../types/resume'
import {
  ResumeParserRequestSchema,
  ParsedResumeSchema,
  ParseResumeResponseSchema,
  ErrorResponseSchema,
  HeadersSchema
} from '../schemas/resumeSchemas'


const resumeRouter = new OpenAPIHono()


// Define the parse resume route
const parseResumeRoute = createRoute({
  method: 'post',
  path: '/parse',
  tags: ['Resume'],

  summary: 'Parse Resume',
  description: 'Parse resume text and extract structured data with confidence scoring',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResumeParserRequestSchema
        }
      },

      required: true,
      description: 'Resume text and parsing options'
    },
    headers: HeadersSchema
  },
  responses: {
    200: {
      description: 'Resume parsed successfully',
      content: {
        'application/json': {
          schema: ParseResumeResponseSchema
        }
      }
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

// Register the route
resumeRouter.openapi(parseResumeRoute, async (c) => {
  try {
    // Extract request body with validation
    const {resumeText, options} = c.req.valid('json')

    // Extract resume data with confidence scoring
    const parsedResume = await extractResumeData(resumeText, options)

    // Return parsed response
    return c.json<ParseResumeResponse>({
      success: true,
      data: parsedResume
    })

  } catch (error) {
    console.error('Resume parsing error:', error)

    return c.json<ParseResumeResponse>({
      success: false,
      error: {
        message: 'Failed to parse resume',
        code: 'PARSING_ERROR',
        details: (error as Error).message
      }
    }, 500)
  }
})


export default resumeRouter