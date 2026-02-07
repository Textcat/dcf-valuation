import {
    calculateDCF,
    calculateMarketImplied,
    createDefaultMonteCarloParams,
    createPrefilledDCFInputs,
    runMonteCarloSimulation,
    runStructuralCheck,
    type DCFInputs,
    type ExtendedFinancialData,
    type MonteCarloParams,
    type MonteCarloResult,
    type StructuralCheck,
    type DCFResult,
    type MarketImplied,
    type WACCInputs
} from '@dcf/core'
import { HttpError } from '../errors'

const API_VERSION = 'v1'
const CORE_VERSION = '0.1.0'
const DEFAULT_MONTE_CARLO_ITERATIONS = 3000
const MAX_MONTE_CARLO_ITERATIONS = 20000
const MIN_WACC_TERMINAL_SPREAD = 0.005

type MethodKey = 'perpetuity' | 'roicDriven' | 'fade'

type TerminalMethod = DCFInputs['terminalMethod']

export interface DriverOverride {
    year: 1 | 2 | 3 | 4 | 5
    revenueGrowth?: number
    operatingMargin?: number
    taxRate?: number
    daPercent?: number
    capexPercent?: number
    wcChangePercent?: number
    grossMargin?: number
}

export interface AgentValuationOverrides {
    dcf?: {
        wacc?: number
        terminalGrowthRate?: number
        steadyStateROIC?: number
        fadeYears?: number
        fadeStartGrowth?: number
        fadeStartROIC?: number
        explicitPeriodYears?: number
        baseRevenue?: number
        baseNetIncome?: number
        drivers?: DriverOverride[]
    }
    monteCarlo?: {
        iterations?: number
        params?: DeepPartial<MonteCarloParams>
    }
}

export interface RunValuationInput {
    symbol: string
    financialData: ExtendedFinancialData
    waccInputs: WACCInputs
    overrides?: AgentValuationOverrides
    includeDistribution?: boolean
    requestId: string
}

export interface MethodValuationResult {
    dcf: DCFResult
    layerB: StructuralCheck
    monteCarlo: MonteCarloResult
}

export interface AgentValuationResponse {
    meta: {
        requestId: string
        symbol: string
        companyName: string
        generatedAt: string
        apiVersion: string
        coreVersion: string
    }
    effectiveInputs: {
        dcfInputs: DCFInputs
        monteCarloByMethod: {
            perpetuity: MonteCarloParams
            roicDriven: MonteCarloParams
            fade: MonteCarloParams
        }
    }
    results: {
        perpetuity: MethodValuationResult
        roicDriven: MethodValuationResult
        fade: MethodValuationResult
    }
    validation: {
        layerC: MarketImplied
    }
    warnings: string[]
}

type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Array<infer U>
        ? Array<DeepPartial<U>>
        : T[K] extends object
            ? DeepPartial<T[K]>
            : T[K]
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value)
    }
    return JSON.parse(JSON.stringify(value)) as T
}

function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
    if (!patch) return base

    if (!isObject(base) || !isObject(patch)) {
        return patch as T
    }

    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue

        const existing = out[key]
        if (Array.isArray(value)) {
            out[key] = value
        } else if (isObject(existing) && isObject(value)) {
            out[key] = deepMerge(existing, value)
        } else {
            out[key] = value
        }
    }
    return out as T
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function ensureFiniteNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new HttpError(422, 'invalid_override', `Override field ${fieldName} must be a finite number`)
    }
    return value
}

function applyDriverOverrides(inputs: DCFInputs, overrides: DriverOverride[], warnings: string[]): void {
    for (const patch of overrides) {
        const index = patch.year - 1
        const driver = inputs.drivers[index]
        if (!driver) {
            warnings.push(`Ignored driver override for year=${patch.year}; out of range`)
            continue
        }

        const entries = Object.entries(patch) as Array<[keyof DriverOverride, unknown]>
        for (const [key, value] of entries) {
            if (key === 'year' || value === undefined) continue
            const numeric = ensureFiniteNumber(value, `drivers[year=${patch.year}].${key}`)
            if (key === 'revenueGrowth') driver.revenueGrowth = numeric
            if (key === 'operatingMargin') driver.operatingMargin = numeric
            if (key === 'taxRate') driver.taxRate = numeric
            if (key === 'daPercent') driver.daPercent = numeric
            if (key === 'capexPercent') driver.capexPercent = numeric
            if (key === 'wcChangePercent') driver.wcChangePercent = numeric
            if (key === 'grossMargin') driver.grossMargin = numeric
        }
    }
}

function applyDcfOverrides(baseInputs: DCFInputs, overrides: AgentValuationOverrides['dcf'], warnings: string[]): DCFInputs {
    const inputs = clone(baseInputs)
    if (!overrides) return inputs

    const numberFields: Array<keyof NonNullable<AgentValuationOverrides['dcf']>> = [
        'wacc',
        'terminalGrowthRate',
        'steadyStateROIC',
        'fadeYears',
        'fadeStartGrowth',
        'fadeStartROIC',
        'explicitPeriodYears',
        'baseRevenue',
        'baseNetIncome'
    ]

    for (const field of numberFields) {
        const value = overrides[field]
        if (value === undefined) continue
        const numeric = ensureFiniteNumber(value, String(field))
        switch (field) {
            case 'wacc':
                inputs.wacc = clamp(numeric, 0.02, 0.30)
                break
            case 'terminalGrowthRate':
                inputs.terminalGrowthRate = clamp(numeric, -0.05, 0.15)
                break
            case 'steadyStateROIC':
                inputs.steadyStateROIC = clamp(numeric, 0.001, 1)
                break
            case 'fadeYears':
                inputs.fadeYears = Math.round(clamp(numeric, 1, 30))
                break
            case 'fadeStartGrowth':
                inputs.fadeStartGrowth = clamp(numeric, -0.05, 0.50)
                break
            case 'fadeStartROIC':
                inputs.fadeStartROIC = clamp(numeric, 0.001, 1)
                break
            case 'explicitPeriodYears':
                inputs.explicitPeriodYears = Math.round(clamp(numeric, 1, inputs.drivers.length))
                break
            case 'baseRevenue':
                inputs.baseRevenue = Math.max(0, numeric)
                break
            case 'baseNetIncome':
                inputs.baseNetIncome = numeric
                break
        }
    }

    if (overrides.drivers && overrides.drivers.length > 0) {
        applyDriverOverrides(inputs, overrides.drivers, warnings)
    }

    if (inputs.terminalGrowthRate >= inputs.wacc) {
        const adjusted = inputs.wacc - MIN_WACC_TERMINAL_SPREAD
        warnings.push(
            `terminalGrowthRate (${inputs.terminalGrowthRate.toFixed(4)}) was reduced to ${adjusted.toFixed(4)} to enforce wacc - g >= ${MIN_WACC_TERMINAL_SPREAD.toFixed(3)}`
        )
        inputs.terminalGrowthRate = adjusted
    }

    if (inputs.terminalMethod === 'fade' && inputs.fadeStartGrowth < inputs.terminalGrowthRate) {
        warnings.push('fadeStartGrowth was raised to terminalGrowthRate to keep fade assumptions valid')
        inputs.fadeStartGrowth = inputs.terminalGrowthRate
    }

    if (inputs.explicitPeriodYears < 1 || inputs.explicitPeriodYears > inputs.drivers.length) {
        throw new HttpError(422, 'invalid_override', 'explicitPeriodYears is out of supported range')
    }

    return inputs
}

function applyMonteCarloOverrides(
    baseParams: MonteCarloParams,
    overrides: AgentValuationOverrides['monteCarlo'],
    warnings: string[]
): MonteCarloParams {
    const params = clone(baseParams)
    params.iterations = DEFAULT_MONTE_CARLO_ITERATIONS

    if (!overrides) {
        return params
    }

    if (overrides.iterations !== undefined) {
        const requested = ensureFiniteNumber(overrides.iterations, 'monteCarlo.iterations')
        if (requested > MAX_MONTE_CARLO_ITERATIONS) {
            warnings.push(`monteCarlo.iterations clamped from ${requested} to ${MAX_MONTE_CARLO_ITERATIONS}`)
        }
        params.iterations = Math.round(clamp(requested, 1, MAX_MONTE_CARLO_ITERATIONS))
    }

    if (overrides.params) {
        return deepMerge(params, overrides.params)
    }

    return params
}

function maybeStripDistribution(result: MonteCarloResult, includeDistribution: boolean): MonteCarloResult {
    if (includeDistribution) {
        return result
    }
    return {
        ...result,
        valueDistribution: []
    }
}

export function runValuation(input: RunValuationInput): AgentValuationResponse {
    const {
        symbol,
        financialData,
        waccInputs,
        overrides,
        includeDistribution = false,
        requestId
    } = input

    const prefilled = createPrefilledDCFInputs(symbol, financialData, waccInputs)
    const warnings: string[] = [...prefilled.audit.warnings]

    const effectiveDcfInputs = applyDcfOverrides(prefilled.dcfInputs, overrides?.dcf, warnings)

    const methods: Array<{ key: MethodKey; terminalMethod: TerminalMethod }> = [
        { key: 'perpetuity', terminalMethod: 'perpetuity' },
        { key: 'roicDriven', terminalMethod: 'roic-driven' },
        { key: 'fade', terminalMethod: 'fade' }
    ]

    const results = {
        perpetuity: {} as MethodValuationResult,
        roicDriven: {} as MethodValuationResult,
        fade: {} as MethodValuationResult
    }

    const monteCarloByMethod = {
        perpetuity: {} as MonteCarloParams,
        roicDriven: {} as MonteCarloParams,
        fade: {} as MonteCarloParams
    }

    for (const method of methods) {
        const methodInputs: DCFInputs = {
            ...effectiveDcfInputs,
            terminalMethod: method.terminalMethod
        }

        const dcf = calculateDCF(methodInputs, financialData)
        const layerB = runStructuralCheck(methodInputs, dcf, financialData)

        const defaultMcParams = createDefaultMonteCarloParams(methodInputs, financialData)
        const monteCarloParams = applyMonteCarloOverrides(defaultMcParams, overrides?.monteCarlo, warnings)
        const monteCarloResult = runMonteCarloSimulation(monteCarloParams, methodInputs, financialData)

        monteCarloByMethod[method.key] = monteCarloParams
        results[method.key] = {
            dcf,
            layerB,
            monteCarlo: maybeStripDistribution(monteCarloResult, includeDistribution)
        }
    }

    const layerC = calculateMarketImplied(financialData, effectiveDcfInputs.wacc, effectiveDcfInputs)

    return {
        meta: {
            requestId,
            symbol: financialData.symbol,
            companyName: financialData.companyName,
            generatedAt: new Date().toISOString(),
            apiVersion: API_VERSION,
            coreVersion: CORE_VERSION
        },
        effectiveInputs: {
            dcfInputs: effectiveDcfInputs,
            monteCarloByMethod
        },
        results,
        validation: {
            layerC
        },
        warnings
    }
}
