import { z } from '@hono/zod-openapi'

export const DriverOverrideSchema = z.object({
    year: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).openapi({ example: 2 }),
    revenueGrowth: z.number().optional(),
    operatingMargin: z.number().optional(),
    taxRate: z.number().optional(),
    daPercent: z.number().optional(),
    capexPercent: z.number().optional(),
    wcChangePercent: z.number().optional(),
    grossMargin: z.number().optional()
}).openapi('DriverOverride')

export const DCFOverridesSchema = z.object({
    wacc: z.number().optional(),
    terminalGrowthRate: z.number().optional(),
    steadyStateROIC: z.number().optional(),
    fadeYears: z.number().int().optional(),
    fadeStartGrowth: z.number().optional(),
    fadeStartROIC: z.number().optional(),
    explicitPeriodYears: z.number().int().min(1).max(5).optional(),
    baseRevenue: z.number().optional(),
    baseNetIncome: z.number().optional(),
    drivers: z.array(DriverOverrideSchema).optional()
}).openapi('DCFOverrides')

export const MonteCarloOverridesSchema = z.object({
    iterations: z.number().int().positive().optional(),
    params: z.record(z.any()).optional()
}).openapi('MonteCarloOverrides')

export const AgentValuationOverridesSchema = z.object({
    dcf: DCFOverridesSchema.optional(),
    monteCarlo: MonteCarloOverridesSchema.optional()
}).openapi('AgentValuationOverrides')

export const ValuationRequestSchema = z.object({
    symbol: z.string().min(1).openapi({ example: 'AAPL' }),
    overrides: AgentValuationOverridesSchema.optional(),
    options: z.object({
        includeDistribution: z.boolean().optional().default(false)
    }).optional()
}).openapi('ValuationRequest')

const MethodResultSchema = z.object({
    dcf: z.any(),
    layerB: z.any(),
    monteCarlo: z.any()
})

export const ValuationResponseSchema = z.object({
    meta: z.object({
        requestId: z.string(),
        symbol: z.string(),
        companyName: z.string(),
        generatedAt: z.string(),
        apiVersion: z.string(),
        coreVersion: z.string()
    }),
    effectiveInputs: z.object({
        dcfInputs: z.any(),
        monteCarloByMethod: z.object({
            perpetuity: z.any(),
            roicDriven: z.any(),
            fade: z.any()
        })
    }),
    results: z.object({
        perpetuity: MethodResultSchema,
        roicDriven: MethodResultSchema,
        fade: MethodResultSchema
    }),
    validation: z.object({
        layerC: z.any()
    }),
    warnings: z.array(z.string())
}).openapi('ValuationResponse')

export const ErrorResponseSchema = z.object({
    error: z.object({
        code: z.string(),
        message: z.string(),
        requestId: z.string(),
        details: z.any().optional()
    })
}).openapi('ErrorResponse')

export type ValuationRequest = z.infer<typeof ValuationRequestSchema>
