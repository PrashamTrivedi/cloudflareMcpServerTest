import {Context} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {ZodError} from 'zod'

// Interface for structured error responses
interface ErrorResponse {
  success: false
  error: {
    message: string
    code: string
    details?: unknown
  }
}

export const errorHandler = (err: Error | HTTPException | ZodError, c: Context) => {
  console.error('Error occurred:', err)

  let message = 'Internal Server Error'
  let status = 500
  let code = 'INTERNAL_ERROR'
  let details = undefined

  // Handle HTTPException (Hono's built-in error)
  if (err instanceof HTTPException) {
    message = err.message
    status = err.status
    code = `HTTP_${status}`
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError || err.name === 'ZodError') {
    message = 'Invalid request data'
    status = 400
    code = 'VALIDATION_ERROR'
    details = err instanceof ZodError ? err.format() : err
  }
  // Handle validation errors
  else if (err.name === 'ValidationError') {
    message = 'Validation Error'
    status = 400
    code = 'VALIDATION_ERROR'
    details = err.cause
  }

  // Create structured error response
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      ...(details && {details}),
    },
  }

  // Log error details
  console.error({
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    status,
  })

  return c.json(response, status)
}