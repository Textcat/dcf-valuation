import type { Context } from 'hono'
import { createRoute, z } from '@hono/zod-openapi'
import { HttpError } from '../errors'
import { assertAgentAuthorized } from '../services/auth'
import { fetchExtendedFinancialData, fetchWACCInputs } from '../services/fmp'
import { runValuation } from '../services/valuation-orchestrator'
import {
    ErrorResponseSchema,
    ValuationRequestSchema,
    ValuationResponseSchema,
    type ValuationRequest
} from '../schemas/valuation'
import type { WorkerBindings } from '../types'

export const valuationRoute = createRoute({
    method: 'post',
    path: '/v1/valuation',
    request: {
        headers: z.object({
            'x-agent-key': z.string().optional().openapi({
                description: 'Agent authentication key'
            })
        }),
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: ValuationRequestSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Aggregated valuation response',
            content: {
                'application/json': {
                    schema: ValuationResponseSchema
                }
            }
        },
        400: {
            description: 'Bad request',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema
                }
            }
        },
        401: {
            description: 'Unauthorized',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema
                }
            }
        },
        404: {
            description: 'Symbol not found',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema
                }
            }
        },
        422: {
            description: 'Unprocessable entity',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema
                }
            }
        },
        500: {
            description: 'Internal error',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema
                }
            }
        }
    }
})

export async function handleValuation(c: Context<{ Bindings: WorkerBindings }>) {
    const requestId = crypto.randomUUID()

    try {
        assertAgentAuthorized(c.req.header('x-agent-key') ?? null, c.env)

        const body = (c.req as unknown as { valid: (target: 'json') => ValuationRequest }).valid('json')
        const symbol = body.symbol?.trim().toUpperCase()
        if (!symbol) {
            throw new HttpError(400, 'invalid_request', 'symbol is required')
        }

        const fmpApiKey = c.env.FMP_API_KEY
        if (!fmpApiKey) {
            throw new HttpError(500, 'missing_config', 'FMP_API_KEY is not configured')
        }

        const [financialData, waccInputs] = await Promise.all([
            fetchExtendedFinancialData(symbol, fmpApiKey),
            fetchWACCInputs(fmpApiKey)
        ])

        if (!financialData) {
            throw new HttpError(404, 'symbol_not_found', `No financial data found for symbol ${symbol}`)
        }

        const response = runValuation({
            symbol,
            financialData,
            waccInputs,
            overrides: body.overrides,
            includeDistribution: body.options?.includeDistribution ?? false,
            requestId
        })

        return c.json(response, 200)
    } catch (err) {
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
    }
}
