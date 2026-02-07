/**
 * Layer C: Market Implied Assumptions (Reverse DCF)
 * 
 * Calculates what the market is implying about future growth/margins
 * based on the current stock price.
 * 
 * Uses Damodaran industry benchmarks for feasibility checks.
 */

import type { MarketImplied, ExtendedFinancialData, DCFInputs } from '../types'
import {
    getIndustryBenchmark,
    getIndustryThresholds,
    getDamodaranIndustryName
} from '../data/industryBenchmarks'

/**
 * Calculate market implied assumptions by reverse engineering
 * from the current stock price.
 */
function computeReinvestmentRate(inputs: DCFInputs): number | null {
    if (!inputs.drivers || inputs.drivers.length === 0) return null

    const lastDriver = inputs.drivers[inputs.drivers.length - 1]
    const lastNetNopatMargin = lastDriver.operatingMargin * (1 - lastDriver.taxRate)
    const lastReinvestmentRate = lastNetNopatMargin > 0
        ? (lastDriver.capexPercent - lastDriver.daPercent + lastDriver.wcChangePercent) / lastNetNopatMargin
        : NaN

    if (Number.isFinite(lastReinvestmentRate) && lastReinvestmentRate > 0) {
        return lastReinvestmentRate
    }

    const avgOpMargin = inputs.drivers.reduce((sum, d) => sum + d.operatingMargin, 0) / inputs.drivers.length
    const avgTaxRate = inputs.drivers.reduce((sum, d) => sum + d.taxRate, 0) / inputs.drivers.length
    const avgCapex = inputs.drivers.reduce((sum, d) => sum + d.capexPercent, 0) / inputs.drivers.length
    const avgDA = inputs.drivers.reduce((sum, d) => sum + d.daPercent, 0) / inputs.drivers.length
    const avgWC = inputs.drivers.reduce((sum, d) => sum + d.wcChangePercent, 0) / inputs.drivers.length

    const avgNetNopatMargin = avgOpMargin * (1 - avgTaxRate)
    const avgReinvestmentRate = avgNetNopatMargin > 0
        ? (avgCapex - avgDA + avgWC) / avgNetNopatMargin
        : NaN

    return Number.isFinite(avgReinvestmentRate) && avgReinvestmentRate > 0
        ? avgReinvestmentRate
        : null
}

export function calculateMarketImplied(
    financialData: ExtendedFinancialData,
    wacc: number,
    inputs: DCFInputs
): MarketImplied {
    const {
        currentPrice,
        sharesOutstanding,
        ttmFCF,
        ttmOperatingIncome,
        ttmRevenue,
        netCash,
        sector,
        industry
    } = financialData

    // Current market cap adjusted for net cash = Enterprise Value
    const marketCap = currentPrice * sharesOutstanding
    const enterpriseValue = marketCap - netCash

    // Get industry-specific benchmarks
    const benchmark = getIndustryBenchmark(industry, sector)
    const thresholds = getIndustryThresholds(benchmark)

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
    // Prefer company-specific reinvestment rate from DCF inputs; fallback to 40%
    const assumedReinvestmentRate = computeReinvestmentRate(inputs) ?? 0.4
    const impliedROIC = impliedGrowthRate > 0 && assumedReinvestmentRate > 0
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
    // 5. Feasibility Checks (Industry-specific)
    // -----------------------------------------

    // Use dynamic thresholds from Damodaran benchmarks
    // marginError = P90 equivalent (~2x industry median)
    const marginExceedsIndustryMax = impliedSteadyStateMargin > thresholds.marginError

    // roicError = P90 equivalent (~2x industry median)
    const roicExceedsHistoricalMax = impliedROIC > thresholds.roicError

    // Historical growth frequency (% of companies that achieved this)
    // Rough estimate based on implied growth rate
    let growthExceedsHistoricalFrequency = false
    if (impliedGrowthRate > 0.15) {
        growthExceedsHistoricalFrequency = true // <20% of companies sustain >15% growth
    }

    // -----------------------------------------
    // 6. Historical Frequency Estimate (Industry-aware)
    // -----------------------------------------

    // Estimate % of companies that achieved these metrics
    // Start at 50%, apply penalties based on deviation from industry norms
    let historicalFrequency = 50

    // Growth penalties (unchanged, as growth is more universal)
    if (impliedGrowthRate > 0.20) historicalFrequency -= 30
    else if (impliedGrowthRate > 0.15) historicalFrequency -= 20
    else if (impliedGrowthRate > 0.10) historicalFrequency -= 10

    // ROIC penalties (relative to industry)
    // Compare to industry-specific thresholds instead of fixed values
    if (impliedROIC > thresholds.roicError) historicalFrequency -= 25
    else if (impliedROIC > thresholds.roicWarning) historicalFrequency -= 15
    else if (impliedROIC > benchmark.afterTaxROIC * 1.2) historicalFrequency -= 5

    // Margin penalties (relative to industry)
    if (impliedSteadyStateMargin > thresholds.marginError) historicalFrequency -= 20
    else if (impliedSteadyStateMargin > thresholds.marginWarning) historicalFrequency -= 10
    else if (impliedSteadyStateMargin > benchmark.operatingMargin * 1.2) historicalFrequency -= 5

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
export function formatMarketImplied(
    implied: MarketImplied,
    financialData?: ExtendedFinancialData
): string[] {
    const lines: string[] = []

    lines.push(`隐含增长率: ${(implied.impliedGrowthRate * 100).toFixed(1)}%`)
    lines.push(`隐含稳态利润率: ${(implied.impliedSteadyStateMargin * 100).toFixed(1)}%`)
    lines.push(`隐含ROIC: ${(implied.impliedROIC * 100).toFixed(1)}%`)
    lines.push(`达成概率估计: ${implied.historicalFrequency}%`)

    // Add industry context if available
    if (financialData?.sector || financialData?.industry) {
        const industryName = getDamodaranIndustryName(
            financialData.industry,
            financialData.sector
        )
        const benchmark = getIndustryBenchmark(
            financialData.industry,
            financialData.sector
        )
        lines.push(``)
        lines.push(`行业基准 (${industryName}):`)
        lines.push(`  - 行业利润率中位数: ${(benchmark.operatingMargin * 100).toFixed(1)}%`)
        lines.push(`  - 行业ROIC中位数: ${(benchmark.afterTaxROIC * 100).toFixed(1)}%`)
    }

    return lines
}
