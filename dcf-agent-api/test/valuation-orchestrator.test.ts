import { describe, expect, it } from 'vitest'
import type { ExtendedFinancialData } from '@dcf/core'
import { runValuation } from '../src/services/valuation-orchestrator'

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
        grossMargin: 0.4,
        operatingMargin: 0.2,
        netMargin: 0.16,
        sharesOutstanding: 2000000000,
        exchangeRate: 1,
        analystEstimates: [
            {
                fiscalYear: 'FY1',
                epsLow: 7,
                epsAvg: 8,
                epsHigh: 9,
                revenueLow: 1020000000,
                revenueAvg: 1080000000,
                revenueHigh: 1160000000,
                numAnalysts: 20
            },
            {
                fiscalYear: 'FY2',
                epsLow: 8,
                epsAvg: 9,
                epsHigh: 10,
                revenueLow: 1090000000,
                revenueAvg: 1150000000,
                revenueHigh: 1240000000,
                numAnalysts: 18
            }
        ],
        latestAnnualRevenue: 950000000,
        latestAnnualNetIncome: 150000000,
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
        pegPercentiles: { p25: 1.5, p50: 2, p75: 2.5, min: 1, max: 3.5 },
        pfcfPercentiles: { p25: 15, p50: 20, p75: 25, min: 10, max: 35 },
        currentPE: 18.75,
        currentPEG: 1.8,
        currentPFCF: 17,
        ttmSBC: 5000000,
        sbcToFCFRatio: 0.028,
        effectiveTaxRate: 0.21,
        interestExpense: 1500000000,
        sector: 'Technology',
        industry: 'Software—Application'
    }
}

describe('runValuation', () => {
    it('returns all three terminal methods', () => {
        const response = runValuation({
            symbol: 'TEST',
            financialData: createMockFinancialData(),
            waccInputs: { riskFreeRate: 0.045, marketRiskPremium: 0.05, countryRiskPremium: 0 },
            includeDistribution: false,
            requestId: 'req-1'
        })

        expect(response.results.perpetuity.dcf.fairValuePerShare).toBeGreaterThan(0)
        expect(response.results.roicDriven.dcf.fairValuePerShare).toBeGreaterThan(0)
        expect(response.results.fade.dcf.fairValuePerShare).toBeGreaterThan(0)
        expect(response.results.perpetuity.monteCarlo.valueDistribution.length).toBe(0)
    })

    it('applies overrides and keeps distribution when requested', () => {
        const response = runValuation({
            symbol: 'TEST',
            financialData: createMockFinancialData(),
            waccInputs: { riskFreeRate: 0.045, marketRiskPremium: 0.05, countryRiskPremium: 0 },
            includeDistribution: true,
            requestId: 'req-2',
            overrides: {
                dcf: {
                    wacc: 0.11,
                    drivers: [{ year: 2, operatingMargin: 0.25 }]
                },
                monteCarlo: {
                    iterations: 2500
                }
            }
        })

        expect(response.effectiveInputs.dcfInputs.wacc).toBeCloseTo(0.11, 6)
        expect(response.effectiveInputs.dcfInputs.drivers[1].operatingMargin).toBeCloseTo(0.25, 6)
        expect(response.results.perpetuity.monteCarlo.valueDistribution.length).toBeGreaterThan(0)
    })

    it('clamps excessive monte carlo iterations', () => {
        const response = runValuation({
            symbol: 'TEST',
            financialData: createMockFinancialData(),
            waccInputs: { riskFreeRate: 0.045, marketRiskPremium: 0.05, countryRiskPremium: 0 },
            includeDistribution: false,
            requestId: 'req-3',
            overrides: {
                monteCarlo: {
                    iterations: 999999
                }
            }
        })

        expect(response.effectiveInputs.monteCarloByMethod.perpetuity.iterations).toBe(20000)
        expect(response.warnings.some(w => w.includes('clamped'))).toBe(true)
    })
})
