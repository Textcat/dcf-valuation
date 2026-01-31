/**
 * Unit tests for effective tax rate calculation
 */
import { describe, it, expect } from 'vitest'

// ============================================================
// Helper function to test (extracted logic from fmp.ts)
// ============================================================

interface IncomeData {
    incomeTaxExpense: number
    incomeBeforeTax: number
}

/**
 * Calculate effective tax rate from annual income data
 * @param annualData Array of annual income statements (most recent first)
 * @param defaultRate Default rate if no valid data (default: 0.21)
 * @returns Effective tax rate clamped to 5%-45%
 */
export function calculateEffectiveTaxRate(
    annualData: IncomeData[],
    defaultRate: number = 0.21
): number {
    if (!annualData || annualData.length === 0) {
        return defaultRate
    }

    const taxRates: number[] = []

    for (const yr of annualData) {
        const taxExpense = yr.incomeTaxExpense ?? 0
        const preTaxIncome = yr.incomeBeforeTax ?? 0

        // Only include if pre-tax income is positive (valid tax rate)
        if (preTaxIncome > 0 && taxExpense >= 0) {
            const rate = taxExpense / preTaxIncome
            // Sanity check: tax rate should be between 0% and 60%
            if (rate >= 0 && rate <= 0.60) {
                taxRates.push(rate)
            }
        }
    }

    if (taxRates.length === 0) {
        return defaultRate
    }

    // Average of valid tax rates
    const avgRate = taxRates.reduce((sum, r) => sum + r, 0) / taxRates.length

    // Clamp to reasonable range: 5% - 45%
    return Math.max(0.05, Math.min(0.45, avgRate))
}

// ============================================================
// Tests
// ============================================================

describe('calculateEffectiveTaxRate', () => {
    it('returns default rate for empty data', () => {
        expect(calculateEffectiveTaxRate([])).toBe(0.21)
        expect(calculateEffectiveTaxRate([], 0.25)).toBe(0.25)
    })

    it('calculates average tax rate from valid data', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 20, incomeBeforeTax: 100 }, // 20%
            { incomeTaxExpense: 25, incomeBeforeTax: 100 }, // 25%
            { incomeTaxExpense: 15, incomeBeforeTax: 100 }, // 15%
        ]
        // Average: (20 + 25 + 15) / 3 = 20%
        expect(calculateEffectiveTaxRate(data)).toBeCloseTo(0.20, 2)
    })

    it('ignores years with negative pre-tax income (losses)', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 20, incomeBeforeTax: 100 }, // 20%
            { incomeTaxExpense: -5, incomeBeforeTax: -50 }, // Loss year - ignored
            { incomeTaxExpense: 30, incomeBeforeTax: 100 }, // 30%
        ]
        // Average: (20 + 30) / 2 = 25%
        expect(calculateEffectiveTaxRate(data)).toBe(0.25)
    })

    it('ignores years with negative tax expense (tax benefit)', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 20, incomeBeforeTax: 100 }, // 20%
            { incomeTaxExpense: -10, incomeBeforeTax: 100 }, // Tax benefit - ignored
            { incomeTaxExpense: 30, incomeBeforeTax: 100 }, // 30%
        ]
        // Average: (20 + 30) / 2 = 25%
        expect(calculateEffectiveTaxRate(data)).toBe(0.25)
    })

    it('ignores years with tax rate > 60%', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 20, incomeBeforeTax: 100 }, // 20%
            { incomeTaxExpense: 70, incomeBeforeTax: 100 }, // 70% - too high, ignored
            { incomeTaxExpense: 30, incomeBeforeTax: 100 }, // 30%
        ]
        // Average: (20 + 30) / 2 = 25%
        expect(calculateEffectiveTaxRate(data)).toBe(0.25)
    })

    it('clamps low tax rates to minimum 5%', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 2, incomeBeforeTax: 100 }, // 2%
            { incomeTaxExpense: 3, incomeBeforeTax: 100 }, // 3%
        ]
        // Average: 2.5% -> clamped to 5%
        expect(calculateEffectiveTaxRate(data)).toBe(0.05)
    })

    it('clamps high tax rates to maximum 45%', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 50, incomeBeforeTax: 100 }, // 50%
            { incomeTaxExpense: 55, incomeBeforeTax: 100 }, // 55%
        ]
        // Average: 52.5% -> clamped to 45%
        expect(calculateEffectiveTaxRate(data)).toBe(0.45)
    })

    it('returns default rate if all years are invalid', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: -5, incomeBeforeTax: -50 }, // Loss
            { incomeTaxExpense: 0, incomeBeforeTax: -100 }, // Loss
        ]
        expect(calculateEffectiveTaxRate(data)).toBe(0.21)
    })

    it('handles zero tax expense correctly', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 0, incomeBeforeTax: 100 }, // 0% tax
            { incomeTaxExpense: 10, incomeBeforeTax: 100 }, // 10% tax
        ]
        // Average: 5% -> at minimum bound
        expect(calculateEffectiveTaxRate(data)).toBe(0.05)
    })

    it('handles typical US company (AAPL-like)', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 16.7, incomeBeforeTax: 100 },
            { incomeTaxExpense: 14.5, incomeBeforeTax: 100 },
            { incomeTaxExpense: 18.2, incomeBeforeTax: 100 },
        ]
        // Average: ~16.5%
        const rate = calculateEffectiveTaxRate(data)
        expect(rate).toBeCloseTo(0.165, 2)
    })

    it('handles typical China company (BABA-like)', () => {
        const data: IncomeData[] = [
            { incomeTaxExpense: 24, incomeBeforeTax: 100 },
            { incomeTaxExpense: 26, incomeBeforeTax: 100 },
            { incomeTaxExpense: 25, incomeBeforeTax: 100 },
        ]
        // Average: 25%
        expect(calculateEffectiveTaxRate(data)).toBe(0.25)
    })
})

// ============================================================
// ROIC Calculation Tests
// ============================================================

interface ROICInputs {
    operatingIncome: number
    effectiveTaxRate: number
    totalEquity: number
    totalDebt: number
    totalCash: number
}

/**
 * Calculate ROIC using effective tax rate
 */
export function calculateROIC(inputs: ROICInputs): number {
    const nopat = inputs.operatingIncome * (1 - inputs.effectiveTaxRate)
    const investedCapital = inputs.totalEquity + inputs.totalDebt - inputs.totalCash

    if (investedCapital <= 0) return 0

    const roic = nopat / investedCapital

    // Clamp to reasonable range (5% - 50%)
    return Math.max(0.05, Math.min(0.50, roic))
}

describe('calculateROIC', () => {
    it('calculates ROIC correctly with standard inputs', () => {
        const inputs: ROICInputs = {
            operatingIncome: 100,
            effectiveTaxRate: 0.25,
            totalEquity: 400,
            totalDebt: 200,
            totalCash: 100
        }
        // NOPAT = 100 * (1 - 0.25) = 75
        // Invested Capital = 400 + 200 - 100 = 500
        // ROIC = 75 / 500 = 0.15 = 15%
        expect(calculateROIC(inputs)).toBe(0.15)
    })

    it('uses effective tax rate instead of hardcoded 21%', () => {
        const baseInputs = {
            operatingIncome: 100,
            totalEquity: 400,
            totalDebt: 200,
            totalCash: 100
        }

        // With 21% tax rate
        const roic21 = calculateROIC({ ...baseInputs, effectiveTaxRate: 0.21 })
        // NOPAT = 100 * 0.79 = 79, ROIC = 79/500 = 0.158

        // With 10% tax rate (like some tax-advantaged companies)
        const roic10 = calculateROIC({ ...baseInputs, effectiveTaxRate: 0.10 })
        // NOPAT = 100 * 0.90 = 90, ROIC = 90/500 = 0.18

        expect(roic10).toBeGreaterThan(roic21)
        expect(roic10).toBeCloseTo(0.18, 2)
        expect(roic21).toBeCloseTo(0.158, 2)
    })

    it('clamps ROIC to minimum 5%', () => {
        const inputs: ROICInputs = {
            operatingIncome: 10,
            effectiveTaxRate: 0.25,
            totalEquity: 5000,
            totalDebt: 500,
            totalCash: 100
        }
        // NOPAT = 10 * 0.75 = 7.5
        // Invested Capital = 5400
        // ROIC = 7.5 / 5400 = 0.14% -> clamped to 5%
        expect(calculateROIC(inputs)).toBe(0.05)
    })

    it('clamps ROIC to maximum 50%', () => {
        const inputs: ROICInputs = {
            operatingIncome: 500,
            effectiveTaxRate: 0.20,
            totalEquity: 200,
            totalDebt: 100,
            totalCash: 50
        }
        // NOPAT = 500 * 0.80 = 400
        // Invested Capital = 250
        // ROIC = 400 / 250 = 160% -> clamped to 50%
        expect(calculateROIC(inputs)).toBe(0.50)
    })

    it('returns 0 for negative invested capital', () => {
        const inputs: ROICInputs = {
            operatingIncome: 100,
            effectiveTaxRate: 0.25,
            totalEquity: 100,
            totalDebt: 50,
            totalCash: 200 // More cash than equity + debt
        }
        // Invested Capital = 100 + 50 - 200 = -50
        expect(calculateROIC(inputs)).toBe(0)
    })
})
