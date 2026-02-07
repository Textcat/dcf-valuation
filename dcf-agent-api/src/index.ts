import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { stringify } from 'yaml'
import { valuationRoute, handleValuation } from './routes/valuation'
import { HttpError } from './errors'
import type { WorkerBindings } from './types'

const app = new OpenAPIHono<{ Bindings: WorkerBindings }>()

app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
        title: 'DCF Agent API',
        version: '1.0.0',
        description: 'Aggregated DCF valuation API for AI agents'
    }
})

app.openapi(valuationRoute, handleValuation)

const healthRoute = createRoute({
    method: 'get',
    path: '/healthz',
    responses: {
        200: {
            description: 'Health check',
            content: {
                'application/json': {
                    schema: z.object({ ok: z.boolean(), service: z.string() })
                }
            }
        }
    }
})

app.openapi(healthRoute, (c) => c.json({ ok: true, service: 'dcf-agent-api' }))

app.get('/openapi.yaml', async (c) => {
    const openapi = app.getOpenAPI31Document({
        openapi: '3.1.0',
        info: {
            title: 'DCF Agent API',
            version: '1.0.0'
        }
    })

    return c.text(stringify(openapi), 200, {
        'content-type': 'application/yaml; charset=utf-8'
    })
})

app.onError((err, c) => {
    const requestId = crypto.randomUUID()

    if (err instanceof HttpError) {
        return c.json({
            error: {
                code: err.code,
                message: err.message,
                requestId,
                details: err.details
            }
        }, err.status)
    }

    return c.json({
        error: {
            code: 'internal_error',
            message: err instanceof Error ? err.message : 'Unknown error',
            requestId
        }
    }, 500)
})

export default app
