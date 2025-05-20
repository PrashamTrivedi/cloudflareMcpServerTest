import {OpenAPIHono} from '@hono/zod-openapi'
import {cors} from 'hono/cors'
import {logger} from 'hono/logger'
import {swaggerUI} from '@hono/swagger-ui'
import {errorHandler} from './middleware/errorHandler'
import resumeRouter from './controllers/resumeController'
import healthRouter from './controllers/healthController'
import mcpController from "./controllers/mcpController"

// Create OpenAPIHono app
const app = new OpenAPIHono()

// Global middleware
app.use('*', logger())
app.use('*', async (c, next) => {
	const appId = c.req.header('x-app-id')
	const path = c.req.path
	console.log({appId, path})
	if (!appId && c.req.path.includes("/api/")) {
		return c.json({
			message: "Not a valid application, please contact me@prashamhtrivedi.in"
		}, 401)
	} else {
		await next()
	}
})
app.use('*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
	exposeHeaders: ['Content-Length'],
	maxAge: 600,
	credentials: true,
}))

// Unwrap Hono errors to see original error details
app.onError((err, c) => {
	return errorHandler(err, c)
})

// Mount routers
app.route('/', healthRouter)
app.route('/api', resumeRouter)
app.route('/mcp', mcpController)

// OpenAPI documentation
app.doc('/doc', {
	openapi: '3.0.0',
	info: {
		title: 'Resume Parser API',
		version: '1.0.0',
		description: 'API for parsing resumes and extracting structured data with confidence scoring'
	},
	servers: [
		{
			url: "http://localhost:8787",
			description: "Local server"
		},
		{
			url: 'https://learn-cf-worker-mcp.prash2488-cf.workers.dev/',
			description: 'Resume Praser APIs'
		}
	]
})

// Use the middleware to serve Swagger UI at /api-doc
app.get('/api-doc', swaggerUI({url: '/doc'}))

// Not found handler
app.notFound((c) => {
	return c.json({
		success: false,
		error: {
			message: 'Resource not found',
			code: 'NOT_FOUND',
		}
	}, 404)
})

// This is the entry point for HTTP vals
export default app