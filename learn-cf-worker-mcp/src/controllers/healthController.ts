import {OpenAPIHono} from '@hono/zod-openapi'
import {createRoute} from '@hono/zod-openapi'
import {z} from '@hono/zod-openapi'

const healthRouter = new OpenAPIHono()

// Define the health response schema
const HealthResponseSchema = z.object({
  status: z.string().openapi({
    example: 'ok'
  }),
  version: z.string().openapi({
    example: '1.0.0'
  }),
  timestamp: z.string().openapi({
    example: new Date().toISOString()
  }),
  service: z.string().openapi({
    example: 'resume-parser-api'
  })
}).openapi('HealthResponse')

// Create the health check route
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health Check',
  description: 'Health check endpoint to verify API is operational',
  responses: {
    200: {
      description: 'API is operational',
      content: {
        'application/json': {
          schema: HealthResponseSchema
        }
      }
    }
  }
})

// Register the route
healthRouter.openapi(healthRoute, (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    service: 'resume-parser-api'
  })
})

export default healthRouter