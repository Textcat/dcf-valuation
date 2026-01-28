/**
 * DCF Calculation Engine
 * 
 * Calculates enterprise value using discounted cash flow methodology.
 */

import type {
    DCFInputs,
    DCFResult,
    YearProjection,
    ExtendedFinancialData
} from '@/types'

/**
 * Calculate DCF valuation
 */
export function calculateDCF(
    inputs: DCFInputs,
    financialData: ExtendedFinancialData
): DCFResult {
    const projections: YearProjection[] = []
    let revenue = inputs.baseRevenue

    // Calculate explicit period projections
    for (let year = 1; year <= inputs.explicitPeriodYears; year++) {
        const driver = inputs.drivers[year - 1]

        // Project revenue
        revenue = revenue * (1 + driver.revenueGrowth)

        // Calculate operating income
        const operatingIncome = revenue * driver.operatingMargin

        // Calculate NOPAT (Net Operating Profit After Tax)
        const nopat = operatingIncome * (1 - driver.taxRate)

        // Calculate FCF components
        const da = revenue * driver.daPercent
        const capex = revenue * driver.capexPercent
        const wcChange = revenue * driver.wcChangePercent

        // FCF = NOPAT + D&A - CapEx - ΔWC
        const fcf = nopat + da - capex - wcChange

        // Discount factor
        const discountFactor = Math.pow(1 + inputs.wacc, year)
        const presentValue = fcf / discountFactor

        projections.push({
            year,
            revenue,
            operatingIncome,
            nopat,
            fcf,
            discountFactor,
            presentValue
        })
    }

    // Calculate explicit period PV
    const explicitPeriodPV = projections.reduce((sum, p) => sum + p.presentValue, 0)

    // Calculate terminal value
    let terminalValue: number
    const lastProjection = projections[projections.length - 1]

    switch (inputs.terminalMethod) {
        case 'perpetuity':
            // Gordon Growth Model: TV = FCF(1+g) / (WACC - g)
            terminalValue = (lastProjection.fcf * (1 + inputs.terminalGrowthRate)) /
                (inputs.wacc - inputs.terminalGrowthRate)
            break

        case 'roic-driven':
            // ROIC-driven terminal value
            // g = Reinvestment Rate × ROIC
            // Reinvestment Rate = g / ROIC
            const reinvestmentRate = inputs.terminalGrowthRate / inputs.steadyStateROIC
            const steadyStateNOPAT = lastProjection.nopat * (1 + inputs.terminalGrowthRate)
            const terminalFCF = steadyStateNOPAT * (1 - reinvestmentRate)
            terminalValue = terminalFCF / (inputs.wacc - inputs.terminalGrowthRate)
            break

        case 'fade':
            // Fade model - excess returns decay over fadeYears
            let fadePV = 0
            let fadeNopat = lastProjection.nopat
            const excessROIC = inputs.steadyStateROIC - inputs.wacc

            for (let y = 1; y <= inputs.fadeYears; y++) {
                // Decay excess ROIC linearly
                const yearROIC = inputs.steadyStateROIC - (excessROIC * y / inputs.fadeYears)
                const yearGrowth = inputs.terminalGrowthRate * (1 - y / inputs.fadeYears)

                fadeNopat = fadeNopat * (1 + yearGrowth)
                const yearReinvestment = yearGrowth / Math.max(yearROIC, 0.01)
                const yearFCF = fadeNopat * (1 - yearReinvestment)

                fadePV += yearFCF / Math.pow(1 + inputs.wacc, inputs.explicitPeriodYears + y)
            }

            // After fade, perpetuity at WACC (no excess returns)
            const postFadeNopat = fadeNopat * (1 + inputs.terminalGrowthRate)
            const postFadeTV = postFadeNopat / (inputs.wacc - inputs.terminalGrowthRate)
            const postFadePV = postFadeTV / Math.pow(1 + inputs.wacc, inputs.explicitPeriodYears + inputs.fadeYears)

            terminalValue = (fadePV + postFadePV) * Math.pow(1 + inputs.wacc, inputs.explicitPeriodYears)
            break

        default:
            terminalValue = 0
    }

    // Discount terminal value to present
    const terminalValuePV = terminalValue / Math.pow(1 + inputs.wacc, inputs.explicitPeriodYears)

    // Enterprise value
    const enterpriseValue = explicitPeriodPV + terminalValuePV

    // Equity value
    const equityValue = enterpriseValue + financialData.netCash

    // Fair value per share
    const fairValuePerShare = financialData.sharesOutstanding > 0
        ? equityValue / financialData.sharesOutstanding
        : 0

    // Implied metrics
    const impliedPE = financialData.ttmEPS > 0
        ? fairValuePerShare / financialData.ttmEPS
        : 0

    const impliedPFCF = financialData.ttmFCF > 0
        ? equityValue / financialData.ttmFCF
        : 0

    return {
        enterpriseValue,
        equityValue,
        fairValuePerShare,
        explicitPeriodPV,
        terminalValuePV,
        terminalValuePercent: (terminalValuePV / enterpriseValue) * 100,
        impliedPE,
        impliedPFCF,
        projections
    }
}

/**
 * Calculate ROIC from financial data
 */
export function calculateROIC(financialData: ExtendedFinancialData, taxRate: number): number {
    const nopat = financialData.ttmOperatingIncome * (1 - taxRate)
    const investedCapital = financialData.totalDebt +
        (financialData.marketCap - financialData.netCash) // Equity proxy

    return investedCapital > 0 ? nopat / investedCapital : 0
}

/**
 * Calculate reinvestment rate
 */
export function calculateReinvestmentRate(
    capex: number,
    depreciation: number,
    wcChange: number,
    nopat: number
): number {
    if (nopat <= 0) return 0
    const netReinvestment = capex - depreciation + wcChange
    return netReinvestment / nopat
}

/**
 * Calculate implied growth rate from ROIC and reinvestment
 */
export function calculateImpliedGrowth(roic: number, reinvestmentRate: number): number {
    return roic * reinvestmentRate
}
