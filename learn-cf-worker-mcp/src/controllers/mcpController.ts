
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js"
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js"

import {OpenAPIHono} from '@hono/zod-openapi'
import {ResumeParserRequestSchema} from "../schemas/resumeSchemas"
import {extractResumeData} from "../utils/resumeParser"
import {toFetchResponse, toReqRes} from 'fetch-to-node'
import {z} from "zod"

const mcpController = new OpenAPIHono()


// Map to store transports by session ID
const transports: {[sessionId: string]: StreamableHTTPServerTransport} = {}

mcpController.post(async (c) => {
    const {req, res} = toReqRes(c.req.raw)
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
    })
    const server = new McpServer({
        name: "mcp-server",
        version: "1.0.0"
    })


    server.tool('parse-resume', 'Parse given resume text', {
        resumeText: z.string().describe('Resume text to parse'),
        options: z.object({
            confidenceThreshold: z.number().describe(
                'Minimum confidence score threshold (0-1)'
            ).default(0.3),
            standardizationEnabled: z.boolean().describe('Whether to standardize terminology').default(true),
            extractSummary: z.boolean().describe('Whether to extract and analyze the resume summary').default(true),
            sectionPriorities: z.array(z.string()).describe('Sections to prioritize in extraction').default([]),
            extractLanguages: z.boolean().describe('Whether to extract language proficiencies').default(true)
        })
    }, async ({resumeText, options}: {resumeText: string, options: any}) => {
        console.error({resume: resumeText, options})
        const parsedResume = await extractResumeData(resumeText, options)
        return {
            success: true,
            data: parsedResume
        }
    })
    // Connect to the MCP server
    await server.connect(transport)


    // Handle the request
    await transport.handleRequest(req, res, await c.req.json())
    res.on('close', () => {
        console.log('Request closed')
        transport.close()
        server.close()
    })
    return toFetchResponse(res)
})

// mcpController.get(c => {
//     console.log('Received GET MCP request')
//     return c.json({
//         jsonrpc: "2.0",
//         error: {
//             code: -32000,
//             message: "Method not allowed."
//         },
//         id: null
//     }, 405)
// })
// mcpController.delete(c => {
//     console.log('Received GET MCP request')
//     return c.json({
//         jsonrpc: "2.0",
//         error: {
//             code: -32000,
//             message: "Method not allowed."
//         },
//         id: null
//     }, 405)
// })


export default mcpController