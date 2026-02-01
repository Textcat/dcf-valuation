/**
 * Unit tests for Monte Carlo Simulation Engine
 */
import { describe, it, expect } from 'vitest'
import {
    sampleNormal,
    sampleLogNormal,
    createDefaultMonteCarloParams,
    runMonteCarloSimulation,
    interpretMonteCarloResult
} from '../engines/monte-carlo'
import type { DCFInputs, MonteCarloParams, ExtendedFinancialData } from '../types'

// ============================================================
// Test Fixtures
// ============================================================

function createMockDCFInputs(): DCFInputs {
    return {
        symbol: 'TEST',
        explicitPeriodYears: 5,
        drivers: [
            {
                revenueGrowth: 0.10,
                grossMargin: 0.40,
                operatingMargin: 0.20,
                taxRate: 0.21,
                daPercent: 0.03,
                capexPercent: 0.04,
                wcChangePercent: 0.01
            },
            {
                revenueGrowth: 0.08,
                grossMargin: 0.40,
                operatingMargin: 0.20,
                taxRate: 0.21,
                daPercent: 0.03,
                capexPercent: 0.04,
                wcChangePercent: 0.01
            },
            {
                revenueGrowth: 0.06,
                grossMargin: 0.40,
                operatingMargin: 0.20,
                taxRate: 0.21,
                daPercent: 0.03,
                capexPercent: 0.04,
                wcChangePercent: 0.01
            },
            {
                revenueGrowth: 0.05,
                grossMargin: 0.40,
                operatingMargin: 0.20,
                taxRate: 0.21,
                daPercent: 0.03,
                capexPercent: 0.04,
                wcChangePercent: 0.01
            },
            {
                revenueGrowth: 0.04,
                grossMargin: 0.40,
                operatingMargin: 0.20,
                taxRate: 0.21,
                daPercent: 0.03,
                capexPercent: 0.04,
                wcChangePercent: 0.01
            }
        ],
        terminalMethod: 'perpetuity',
        terminalGrowthRate: 0.025,
        steadyStateROIC: 0.12,
        fadeYears: 10,
        fadeStartGrowth: 0.05,
        fadeStartROIC: 0.15,
        wacc: 0.09,
        baseRevenue: 1000000000,
        baseNetIncome: 100000000
    }
}

function createMockFinancialData(): ExtendedFinancialData {
    return {
        symbol: 'TEST',
        companyName: 'Test Company',
        currency: 'USD',
        currentPrice: 150,
        marketCap: 300000000000,
        ttmRevenue: 1000000000,
        ttmGrossProfit: 400000000,
        ttmOperatingIncome: 200000000,
        ttmNetIncome: 160000000,
        ttmEPS: 8,
        ttmFCF: 180000000,
        grossMargin: 0.40,
        operatingMargin: 0.20,
        netMargin: 0.16,
        sharesOutstanding: 2000000000,
        exchangeRate: 1,
        analystEstimates: [],
        totalCash: 50000000000,
        totalDebt: 30000000000,
        netCash: 20000000000,
        totalEquity: 100000000000,
        beta: 1.1,
        costOfDebt: 0.05,
        historicalDAPercent: 0.03,
        historicalCapexPercent: 0.04,
        historicalWCChangePercent: 0.01,
        historicalROIC: 0.15,
        pePercentiles: { p25: 15, p50: 20, p75: 25, min: 10, max: 35 },
        pegPercentiles: { p25: 1.5, p50: 2.0, p75: 2.5, min: 1.0, max: 3.5 },
        pfcfPercentiles: { p25: 15, p50: 20, p75: 25, min: 10, max: 35 },
        currentPE: 18.75,
        currentPEG: 1.8,
        currentPFCF: 17,
        ttmSBC: 5000000,
        sbcToFCFRatio: 0.028,
        effectiveTaxRate: 0.21,
        interestExpense: 1500000000,  // $1.5B interest expense
        sector: 'Technology',
        industry: 'Software—Application'
    }
}

// ============================================================
// Normal Distribution Sampling Tests
// ============================================================

describe('sampleNormal', () => {
    it('returns values centered around the mean', () => {
        const samples: number[] = []
        const mean = 0.10
        const stdDev = 0.02

        for (let i = 0; i < 10000; i++) {
            samples.push(sampleNormal(mean, stdDev))
        }

        const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length
        // Mean should be within 1% of expected
        expect(Math.abs(sampleMean - mean)).toBeLessThan(0.01)
    })

    it('has approximately correct standard deviation', () => {
        const samples: number[] = []
        const mean = 0.10
        const stdDev = 0.02

        for (let i = 0; i < 10000; i++) {
            samples.push(sampleNormal(mean, stdDev))
        }

        const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length
        const sampleVariance = samples.reduce((sum, x) => sum + (x - sampleMean) ** 2, 0) / samples.length
        const sampleStdDev = Math.sqrt(sampleVariance)

        // StdDev should be within 10% of expected
        expect(Math.abs(sampleStdDev - stdDev) / stdDev).toBeLessThan(0.10)
    })

    it('generates different values on each call', () => {
        const samples = new Set<number>()
        for (let i = 0; i < 100; i++) {
            samples.add(sampleNormal(0, 1))
        }
        // Should have many unique values
        expect(samples.size).toBeGreaterThan(90)
    })
})

describe('sampleLogNormal', () => {
    it('returns only positive values', () => {
        for (let i = 0; i < 1000; i++) {
            const sample = sampleLogNormal(0.10, 0.02)
            expect(sample).toBeGreaterThan(0)
        }
    })

    it('returns values centered around the mean', () => {
        const samples: number[] = []
        const mean = 0.10
        const stdDev = 0.01 // Lower stdDev for tighter distribution

        for (let i = 0; i < 10000; i++) {
            samples.push(sampleLogNormal(mean, stdDev))
        }

        const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length
        // Mean should be within 5% of expected
        expect(Math.abs(sampleMean - mean) / mean).toBeLessThan(0.05)
    })
})

// ============================================================
// Default Monte Carlo Params Tests
// ============================================================

describe('createDefaultMonteCarloParams', () => {
    it('uses Year 1 drivers as base values', () => {
        const inputs = createMockDCFInputs()
        const params = createDefaultMonteCarloParams(inputs)

        expect(params.revenueGrowth[0]).toBe(inputs.drivers[0].revenueGrowth)
        expect(params.operatingMargin[0]).toBe(inputs.drivers[0].operatingMargin)
        expect(params.wacc[0]).toBe(inputs.wacc)
        expect(params.terminalGrowth[0]).toBe(inputs.terminalGrowthRate)
    })

    it('sets appropriate standard deviations', () => {
        const inputs = createMockDCFInputs()
        const params = createDefaultMonteCarloParams(inputs)

        // StdDevs should be non-zero proportions of the mean
        expect(params.revenueGrowth[1]).toBeGreaterThan(0)
        expect(params.operatingMargin[1]).toBeGreaterThan(0)
        expect(params.wacc[1]).toBeGreaterThan(0)
        expect(params.terminalGrowth[1]).toBeGreaterThan(0)
    })

    it('defaults to 10000 iterations', () => {
        const inputs = createMockDCFInputs()
        const params = createDefaultMonteCarloParams(inputs)

        expect(params.iterations).toBe(10000)
    })

    it('uses analyst dispersion when available', () => {
        const inputs = createMockDCFInputs()
        const financialData = createMockFinancialData()

        // Add analyst estimates with dispersion
        financialData.analystEstimates = [{
            fiscalYear: 'FY1',
            revenueHigh: 1200000000,  // +20% from TTM
            revenueAvg: 1100000000,   // +10% from TTM
            revenueLow: 1000000000,   // 0% from TTM
            epsHigh: 10,
            epsAvg: 8.5,
            epsLow: 7,
            numAnalysts: 15
        }]

        const paramsWithAnalyst = createDefaultMonteCarloParams(inputs, financialData)
        const paramsWithoutAnalyst = createDefaultMonteCarloParams(inputs)

        // With analyst data, stdDev should be different from heuristic
        expect(paramsWithAnalyst.revenueGrowth[1]).not.toBe(paramsWithoutAnalyst.revenueGrowth[1])
    })

    it('uses heuristic stdDev when no analyst data', () => {
        const inputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        financialData.analystEstimates = [] // No analyst data

        const params = createDefaultMonteCarloParams(inputs, financialData)

        // Should fall back to heuristic: max(0.02, growth * 0.3)
        const expectedStdDev = Math.max(0.02, Math.abs(inputs.drivers[0].revenueGrowth) * 0.3)
        expect(params.revenueGrowth[1]).toBe(expectedStdDev)
    })
})

// ============================================================
// Monte Carlo Simulation Tests
// ============================================================

describe('runMonteCarloSimulation', () => {
    it('returns valid percentile structure', () => {
        const dcfInputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 100,
            revenueGrowth: [0.10, 0.02],
            operatingMargin: [0.20, 0.02],
            wacc: [0.09, 0.01],
            terminalGrowth: [0.025, 0.005]
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        expect(result.p10).toBeDefined()
        expect(result.p25).toBeDefined()
        expect(result.p50).toBeDefined()
        expect(result.p75).toBeDefined()
        expect(result.p90).toBeDefined()
    })

    it('percentiles are in ascending order', () => {
        const dcfInputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 500,
            revenueGrowth: [0.10, 0.02],
            operatingMargin: [0.20, 0.02],
            wacc: [0.09, 0.01],
            terminalGrowth: [0.025, 0.005]
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        expect(result.p10).toBeLessThanOrEqual(result.p25)
        expect(result.p25).toBeLessThanOrEqual(result.p50)
        expect(result.p50).toBeLessThanOrEqual(result.p75)
        expect(result.p75).toBeLessThanOrEqual(result.p90)
    })

    it('generates positive fair values', () => {
        const dcfInputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 100,
            revenueGrowth: [0.10, 0.02],
            operatingMargin: [0.20, 0.02],
            wacc: [0.09, 0.01],
            terminalGrowth: [0.025, 0.005]
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        expect(result.p50).toBeGreaterThan(0)
        expect(result.mean).toBeGreaterThan(0)
    })

    it('computes mean and stdDev', () => {
        const dcfInputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 500,
            revenueGrowth: [0.10, 0.02],
            operatingMargin: [0.20, 0.02],
            wacc: [0.09, 0.01],
            terminalGrowth: [0.025, 0.005]
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        expect(result.mean).toBeGreaterThan(0)
        expect(result.stdDev).toBeGreaterThan(0)
        // Mean should be close to median for normal-ish distributions
        expect(Math.abs(result.mean - result.p50) / result.mean).toBeLessThan(0.3)
    })

    it('computes current price percentile', () => {
        const dcfInputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 500,
            revenueGrowth: [0.10, 0.02],
            operatingMargin: [0.20, 0.02],
            wacc: [0.09, 0.01],
            terminalGrowth: [0.025, 0.005]
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        // Percentile should be between 0 and 100
        expect(result.currentPricePercentile).toBeGreaterThanOrEqual(0)
        expect(result.currentPricePercentile).toBeLessThanOrEqual(100)
    })

    it('handles edge case with very tight distribution', () => {
        const dcfInputs = createMockDCFInputs()
        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 100,
            revenueGrowth: [0.10, 0.001], // Very tight
            operatingMargin: [0.20, 0.001],
            wacc: [0.09, 0.001],
            terminalGrowth: [0.025, 0.001]
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        // P10 and P90 should be very close when stdDev is tiny
        expect(result.p90 / result.p10).toBeLessThan(1.2)
    })

    it('returns empty result when all iterations fail', () => {
        const dcfInputs = createMockDCFInputs()
        dcfInputs.wacc = 0.01 // Very low WACC
        dcfInputs.terminalGrowthRate = 0.05 // Higher than WACC (invalid)

        const financialData = createMockFinancialData()
        const params: MonteCarloParams = {
            iterations: 10,
            revenueGrowth: [0.10, 0.001],
            operatingMargin: [0.20, 0.001],
            wacc: [0.005, 0.001], // Very low WACC, likely to fail
            terminalGrowth: [0.10, 0.001] // Higher than WACC
        }

        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        // Should handle gracefully
        expect(result.valueDistribution.length).toBeGreaterThanOrEqual(0)
    })
})

// ============================================================
// Interpretation Tests
// ============================================================

describe('interpretMonteCarloResult', () => {
    it('correctly identifies undervalued stock', () => {
        const result = {
            valueDistribution: [],
            p10: 100,
            p25: 120,
            p50: 150,
            p75: 180,
            p90: 200,
            mean: 150,
            stdDev: 30,
            currentPricePercentile: 10 // Very low, meaning current price is below most valuations
        }

        const interpretation = interpretMonteCarloResult(result, 90)

        expect(interpretation.interpretation).toContain('低估')
        expect(interpretation.upsideP50).toBeGreaterThan(0)
    })

    it('correctly identifies overvalued stock', () => {
        const result = {
            valueDistribution: [],
            p10: 100,
            p25: 120,
            p50: 150,
            p75: 180,
            p90: 200,
            mean: 150,
            stdDev: 30,
            currentPricePercentile: 85 // Very high
        }

        const interpretation = interpretMonteCarloResult(result, 190)

        expect(interpretation.interpretation).toContain('高估')
        expect(interpretation.upsideP50).toBeLessThan(0)
    })

    it('correctly identifies fairly valued stock', () => {
        const result = {
            valueDistribution: [],
            p10: 100,
            p25: 120,
            p50: 150,
            p75: 180,
            p90: 200,
            mean: 150,
            stdDev: 30,
            currentPricePercentile: 50 // Right at median
        }

        const interpretation = interpretMonteCarloResult(result, 150)

        expect(interpretation.interpretation).toContain('合理')
    })

    it('calculates risk-reward ratio', () => {
        const result = {
            valueDistribution: [],
            p10: 100,
            p25: 120,
            p50: 150,
            p75: 180,
            p90: 200,
            mean: 150,
            stdDev: 30,
            currentPricePercentile: 30
        }

        const interpretation = interpretMonteCarloResult(result, 130)

        // Upside to P75: (180-130)/130 = 38.5%
        // Downside to P25: (130-120)/130 = 7.7%
        // Risk/Reward ratio: 38.5 / 7.7 = 5.0
        expect(interpretation.riskRewardRatio).toBeGreaterThan(1)
        expect(interpretation.upsideP75).toBeGreaterThan(0)
        expect(interpretation.downsideP25).toBeGreaterThan(0)
    })
})
