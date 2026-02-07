import type { DCFInputs, ExtendedFinancialData, ValueDrivers } from './types'

export interface WACCInputs {
    riskFreeRate: number
    marketRiskPremium: number
    countryRiskPremium: number
}

export interface PrefillAudit {
    costOfEquity: number
    costOfDebt: number
    equityWeight: number
    debtWeight: number
    effectiveTaxRate: number
    calculatedWacc: number
    finalWacc: number
    warnings: string[]
}

export interface PrefillResult {
    dcfInputs: DCFInputs
    audit: PrefillAudit
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function createDefaultDrivers(): ValueDrivers {
    return {
        revenueGrowth: 0.10,
        grossMargin: 0.40,
        operatingMargin: 0.20,
        taxRate: 0.21,
        daPercent: 0.03,
        capexPercent: 0.04,
        wcChangePercent: 0.01
    }
}

function createDefaultDCFInputs(symbol: string, baseRevenue: number, baseNetIncome: number): DCFInputs {
    return {
        symbol,
        explicitPeriodYears: 5,
        drivers: Array(5).fill(null).map(() => createDefaultDrivers()),
        terminalMethod: 'perpetuity',
        terminalGrowthRate: 0.03,
        steadyStateROIC: 0.12,
        fadeYears: 10,
        fadeStartGrowth: 0.10,
        fadeStartROIC: 0.20,
        wacc: 0.10,
        baseRevenue,
        baseNetIncome
    }
}

export function calculateCostOfDebt(interestExpense: number, totalDebt: number): number {
    if (totalDebt <= 0 || interestExpense < 0) {
        return 0.06
    }

    const costOfDebt = interestExpense / totalDebt
    if (costOfDebt < 0.02) return 0.04
    if (costOfDebt > 0.15) return 0.10

    return costOfDebt
}

export function createPrefilledDCFInputs(
    symbol: string,
    financialData: ExtendedFinancialData,
    waccInputs: WACCInputs
): PrefillResult {
    const warnings: string[] = []
    const normalizedSymbol = symbol.toUpperCase()

    const costOfEquity = waccInputs.riskFreeRate + financialData.beta * waccInputs.marketRiskPremium
    const costOfDebt = calculateCostOfDebt(financialData.interestExpense, financialData.totalDebt)
    const totalCapital = financialData.marketCap + financialData.totalDebt
    const equityWeight = totalCapital > 0 ? financialData.marketCap / totalCapital : 0.8
    const debtWeight = 1 - equityWeight
    const effectiveTaxRate = Number.isFinite(financialData.effectiveTaxRate)
        ? financialData.effectiveTaxRate
        : 0.21

    const calculatedWacc = equityWeight * costOfEquity + debtWeight * costOfDebt * (1 - effectiveTaxRate)
    if (!Number.isFinite(calculatedWacc)) {
        warnings.push('Calculated WACC is not finite, fallback to default value')
    }

    const finalWacc = Number.isFinite(calculatedWacc)
        ? clamp(calculatedWacc, 0.06, 0.15)
        : 0.10

    const baseRevenue = financialData.latestAnnualRevenue > 0
        ? financialData.latestAnnualRevenue
        : financialData.ttmRevenue
    const baseNetIncome = financialData.latestAnnualNetIncome > 0
        ? financialData.latestAnnualNetIncome
        : financialData.ttmNetIncome

    const dcfInputs = createDefaultDCFInputs(normalizedSymbol, baseRevenue, baseNetIncome)
    dcfInputs.wacc = finalWacc
    dcfInputs.steadyStateROIC = financialData.historicalROIC

    dcfInputs.drivers.forEach((driver) => {
        if (financialData.grossMargin > 0) driver.grossMargin = financialData.grossMargin
        if (financialData.operatingMargin > 0) driver.operatingMargin = financialData.operatingMargin
        driver.taxRate = effectiveTaxRate
        driver.daPercent = financialData.historicalDAPercent
        driver.capexPercent = financialData.historicalCapexPercent
        driver.wcChangePercent = financialData.historicalWCChangePercent
    })

    const explicitYears = Math.min(dcfInputs.explicitPeriodYears, dcfInputs.drivers.length)
    const estimates = financialData.analystEstimates.slice(0, explicitYears)

    if (estimates.length > 0 && dcfInputs.baseRevenue > 0) {
        let prevRevenue = dcfInputs.baseRevenue
        for (let i = 0; i < explicitYears; i++) {
            const estimate = estimates[i]
            let growth: number | null = null
            if (estimate && estimate.revenueAvg > 0 && prevRevenue > 0) {
                growth = estimate.revenueAvg / prevRevenue - 1
                prevRevenue = estimate.revenueAvg
            } else if (i > 0) {
                growth = dcfInputs.drivers[i - 1].revenueGrowth * 0.9
                prevRevenue = prevRevenue * (1 + growth)
            }

            if (growth != null && Number.isFinite(growth)) {
                dcfInputs.drivers[i].revenueGrowth = growth
            }
        }

        const lastIdx = Math.min(explicitYears, dcfInputs.drivers.length) - 1
        if (lastIdx >= 0) {
            dcfInputs.fadeStartGrowth = dcfInputs.drivers[lastIdx].revenueGrowth
        }
    } else if (financialData.analystEstimates.length >= 2) {
        const fy1Revenue = financialData.analystEstimates[0].revenueAvg
        const fy2Revenue = financialData.analystEstimates[1].revenueAvg
        if (fy1Revenue > 0 && fy2Revenue > 0) {
            const growth = fy2Revenue / fy1Revenue - 1
            dcfInputs.drivers[0].revenueGrowth = growth
            dcfInputs.drivers[1].revenueGrowth = growth * 0.9
            dcfInputs.drivers[2].revenueGrowth = growth * 0.8
            dcfInputs.drivers[3].revenueGrowth = growth * 0.7
            dcfInputs.drivers[4].revenueGrowth = growth * 0.6
            dcfInputs.fadeStartGrowth = growth * 0.6
        }
    }

    dcfInputs.fadeStartROIC = financialData.historicalROIC

    return {
        dcfInputs,
        audit: {
            costOfEquity,
            costOfDebt,
            equityWeight,
            debtWeight,
            effectiveTaxRate,
            calculatedWacc,
            finalWacc,
            warnings
        }
    }
}
