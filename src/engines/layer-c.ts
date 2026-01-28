/**
 * Layer C: Market Implied Assumptions (Reverse DCF)
 * 
 * Calculates what the market is implying about future growth/margins
 * based on the current stock price.
 */

import type { MarketImplied, ExtendedFinancialData } from '@/types'

/**
 * Calculate market implied assumptions by reverse engineering
 * from the current stock price.
 */
export function calculateMarketImplied(
    financialData: ExtendedFinancialData,
    wacc: number
): MarketImplied {
    const {
        currentPrice,
        sharesOutstanding,
        ttmFCF,
        ttmOperatingIncome,
        ttmRevenue,
        netCash
    } = financialData

    // Current market cap adjusted for net cash = Enterprise Value
    const marketCap = currentPrice * sharesOutstanding
    const enterpriseValue = marketCap - netCash

    // -----------------------------------------
    // 1. Implied Growth Rate (from FCF yield)
    // -----------------------------------------

    // Using Gordon Growth rearranged:
    // EV = FCF(1+g) / (WACC - g)
    // Solving for g: g = (EV * WACC - FCF) / (EV + FCF)

    let impliedGrowthRate = 0
    if (ttmFCF > 0 && enterpriseValue > 0) {
        impliedGrowthRate = (enterpriseValue * wacc - ttmFCF) / (enterpriseValue + ttmFCF)
        // Clamp to reasonable range
        impliedGrowthRate = Math.max(-0.1, Math.min(0.3, impliedGrowthRate))
    }

    // -----------------------------------------
    // 2. Implied Steady State Margin
    // -----------------------------------------

    // Assume current FCF margin needs to grow to justify price
    // FCF Yield = FCF / EV
    // Implied FCF = EV * (WACC - g)
    // Implied Margin = Implied FCF / Projected Revenue

    const fcfYield = ttmFCF > 0 ? ttmFCF / enterpriseValue : 0
    const currentOpMargin = ttmRevenue > 0 ? ttmOperatingIncome / ttmRevenue : 0

    // If current FCF yield < WACC - implied_growth, market expects margin expansion
    const requiredFCFYield = Math.max(0, wacc - impliedGrowthRate)
    const impliedMarginMultiple = requiredFCFYield > 0 && fcfYield > 0
        ? requiredFCFYield / fcfYield
        : 1

    const impliedSteadyStateMargin = currentOpMargin * impliedMarginMultiple

    // -----------------------------------------
    // 3. Implied ROIC
    // -----------------------------------------

    // ROIC = Growth / Reinvestment Rate
    // Assume typical reinvestment rate of 30-50%
    const assumedReinvestmentRate = 0.4
    const impliedROIC = impliedGrowthRate > 0
        ? impliedGrowthRate / assumedReinvestmentRate
        : currentOpMargin * 0.8 * 2 // Fallback: margin * (1-tax) * asset turnover

    // -----------------------------------------
    // 4. Implied Fade Speed
    // -----------------------------------------

    // Estimate how quickly excess returns need to fade
    // Higher PE implies slower fade (market believes moat is durable)
    const currentPE = financialData.currentPE
    const industryPE = 20 // Benchmark
    const fadeSpeedMultiplier = currentPE > 0 ? industryPE / currentPE : 1
    // Fade speed: 1 = immediate, 0 = never
    const impliedFadeSpeed = Math.max(0.1, Math.min(1, fadeSpeedMultiplier))

    // -----------------------------------------
    // 5. Feasibility Checks
    // -----------------------------------------

    // Industry max margins (tech = 40%, other = 25%)
    const industryMaxMargin = 0.35
    const marginExceedsIndustryMax = impliedSteadyStateMargin > industryMaxMargin

    // Historical max ROIC
    const historicalMaxROIC = 0.30
    const roicExceedsHistoricalMax = impliedROIC > historicalMaxROIC

    // Historical growth frequency (% of companies that achieved this)
    // Rough estimate based on implied growth rate
    let growthExceedsHistoricalFrequency = false
    if (impliedGrowthRate > 0.15) {
        growthExceedsHistoricalFrequency = true // <20% of companies sustain >15% growth
    }

    // -----------------------------------------
    // 6. Historical Frequency Estimate
    // -----------------------------------------

    // Estimate % of companies that achieved these metrics
    let historicalFrequency = 50 // Start at 50%

    if (impliedGrowthRate > 0.20) historicalFrequency -= 30
    else if (impliedGrowthRate > 0.15) historicalFrequency -= 20
    else if (impliedGrowthRate > 0.10) historicalFrequency -= 10

    if (impliedROIC > 0.25) historicalFrequency -= 20
    else if (impliedROIC > 0.20) historicalFrequency -= 10

    if (impliedSteadyStateMargin > 0.30) historicalFrequency -= 15
    else if (impliedSteadyStateMargin > 0.25) historicalFrequency -= 10

    historicalFrequency = Math.max(1, historicalFrequency)

    return {
        impliedGrowthRate,
        impliedSteadyStateMargin,
        impliedROIC,
        impliedFadeSpeed,
        feasibility: {
            marginExceedsIndustryMax,
            roicExceedsHistoricalMax,
            growthExceedsHistoricalFrequency
        },
        historicalFrequency
    }
}

/**
 * Format market implied assumptions for display
 */
export function formatMarketImplied(implied: MarketImplied): string[] {
    const lines: string[] = []

    lines.push(`隐含增长率: ${(implied.impliedGrowthRate * 100).toFixed(1)}%`)
    lines.push(`隐含稳态利润率: ${(implied.impliedSteadyStateMargin * 100).toFixed(1)}%`)
    lines.push(`隐含ROIC: ${(implied.impliedROIC * 100).toFixed(1)}%`)
    lines.push(`达成概率估计: ${implied.historicalFrequency}%`)

    return lines
}
