import { describe, expect, it } from 'vitest'
import type { ExtendedFinancialData } from '../types'
import { createPrefilledDCFInputs } from '../prefill'

function mockData(): ExtendedFinancialData {
    return {
        symbol: 'TEST',
        companyName: 'Test Co',
        currency: 'USD',
        currentPrice: 100,
        marketCap: 100000000000,
        ttmRevenue: 1000000000,
        ttmGrossProfit: 400000000,
        ttmOperatingIncome: 200000000,
        ttmNetIncome: 150000000,
        ttmEPS: 5,
        ttmFCF: 120000000,
        grossMargin: 0.4,
        operatingMargin: 0.2,
        netMargin: 0.15,
        sharesOutstanding: 200000000,
        exchangeRate: 1,
        analystEstimates: [],
        latestAnnualRevenue: 1100000000,
        latestAnnualNetIncome: 160000000,
        totalCash: 10000000000,
        totalDebt: 4000000000,
        netCash: 6000000000,
        totalEquity: 50000000000,
        beta: 1.2,
        costOfDebt: 0.05,
        historicalDAPercent: 0.03,
        historicalCapexPercent: 0.04,
        historicalWCChangePercent: 0.01,
        historicalROIC: 0.14,
        pePercentiles: { p25: 15, p50: 20, p75: 25, min: 10, max: 30 },
        pegPercentiles: { p25: 1, p50: 1.5, p75: 2, min: 0.5, max: 3 },
        pfcfPercentiles: { p25: 10, p50: 15, p75: 20, min: 8, max: 30 },
        currentPE: 20,
        currentPEG: 1.5,
        currentPFCF: 18,
        ttmSBC: 5000000,
        sbcToFCFRatio: 0.04,
        effectiveTaxRate: 0.2,
        interestExpense: 200000000,
        sector: 'Technology',
        industry: 'Software—Application'
    }
}

describe('createPrefilledDCFInputs', () => {
    it('builds 5-year defaults and calculated WACC', () => {
        const out = createPrefilledDCFInputs('test', mockData(), {
            riskFreeRate: 0.045,
            marketRiskPremium: 0.05,
            countryRiskPremium: 0
        })

        expect(out.dcfInputs.symbol).toBe('TEST')
        expect(out.dcfInputs.drivers.length).toBe(5)
        expect(out.dcfInputs.wacc).toBeGreaterThanOrEqual(0.06)
        expect(out.dcfInputs.wacc).toBeLessThanOrEqual(0.15)
    })
})
