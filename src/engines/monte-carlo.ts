/**
 * Monte Carlo Simulation Engine
 * 
 * Generates probability-weighted value distributions by sampling
 * key DCF drivers from normal distributions.
 */

import type {
    DCFInputs,
    MonteCarloParams,
    MonteCarloResult,
    ExtendedFinancialData
} from '@/types'
import { calculateDCF } from './dcf-engine'

// ============================================================
// Random Number Generation
// ============================================================

/**
 * Box-Muller transform to generate standard normal random numbers
 * Returns two independent standard normal variates
 */
function boxMuller(): [number, number] {
    let u1 = 0
    let u2 = 0

    // Avoid log(0)
    while (u1 === 0) u1 = Math.random()
    while (u2 === 0) u2 = Math.random()

    const magnitude = Math.sqrt(-2.0 * Math.log(u1))
    const angle = 2.0 * Math.PI * u2

    return [
        magnitude * Math.cos(angle),
        magnitude * Math.sin(angle)
    ]
}

// Cache for second Box-Muller value
let spareNormal: number | null = null

/**
 * Generate a single standard normal random number
 */
function randomStandardNormal(): number {
    if (spareNormal !== null) {
        const result = spareNormal
        spareNormal = null
        return result
    }

    const [z1, z2] = boxMuller()
    spareNormal = z2
    return z1
}

/**
 * Sample from a normal distribution with given mean and standard deviation
 */
export function sampleNormal(mean: number, stdDev: number): number {
    return mean + stdDev * randomStandardNormal()
}

/**
 * Sample from a log-normal distribution
 * Useful for parameters that must be positive (e.g., WACC)
 */
export function sampleLogNormal(mean: number, stdDev: number): number {
    // Convert to log-space parameters
    const variance = stdDev * stdDev
    const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean))
    const sigma = Math.sqrt(Math.log(1 + variance / (mean * mean)))

    return Math.exp(mu + sigma * randomStandardNormal())
}

// ============================================================
// Monte Carlo Simulation
// ============================================================

/**
 * Create Monte Carlo parameters using analyst estimate dispersion when available
 * 
 * For revenue growth, we use the analyst consensus range:
 * - stdDev ≈ (revenueHigh - revenueLow) / (4 × revenueAvg)
 * - This assumes High/Low represent ~95% CI (±2σ)
 * 
 * Falls back to heuristic percentages when analyst data is unavailable.
 */
export function createDefaultMonteCarloParams(
    inputs: DCFInputs,
    financialData?: ExtendedFinancialData
): MonteCarloParams {
    // Base values from Year 1 drivers
    const year1 = inputs.drivers[0]

    // Default heuristic values
    let revenueGrowthStdDev = Math.max(0.02, Math.abs(year1.revenueGrowth) * 0.3)
    let marginStdDev = Math.max(0.02, year1.operatingMargin * 0.2)

    // Use analyst dispersion if available
    if (financialData?.analystEstimates && financialData.analystEstimates.length > 0) {
        const fy1 = financialData.analystEstimates[0]

        // Revenue growth dispersion from analyst estimates
        // High-Low range ≈ 4σ (95% CI assumption)
        if (fy1.revenueHigh > 0 && fy1.revenueLow > 0 && fy1.revenueAvg > 0) {
            const revenueRange = fy1.revenueHigh - fy1.revenueLow
            const impliedGrowthRange = revenueRange / financialData.ttmRevenue
            // Range represents ~4σ, so σ ≈ range/4
            const impliedStdDev = impliedGrowthRange / 4
            // Clamp to reasonable bounds
            revenueGrowthStdDev = Math.max(0.01, Math.min(0.15, impliedStdDev))
        }

        // EPS dispersion can inform margin volatility
        if (fy1.epsHigh > 0 && fy1.epsLow > 0 && fy1.epsAvg > 0) {
            const epsRange = (fy1.epsHigh - fy1.epsLow) / fy1.epsAvg
            // EPS volatility is roughly proportional to margin volatility
            const impliedMarginStdDev = epsRange / 4 * year1.operatingMargin
            marginStdDev = Math.max(0.01, Math.min(0.10, impliedMarginStdDev))
        }
    }

    return {
        iterations: 10000,
        // Revenue growth: use analyst-derived or heuristic stdDev
        revenueGrowth: [year1.revenueGrowth, revenueGrowthStdDev],
        // Operating margin: use EPS-derived or heuristic stdDev  
        operatingMargin: [year1.operatingMargin, marginStdDev],
        // WACC: ±1% absolute stdDev (market-driven, less company-specific)
        wacc: [inputs.wacc, 0.01],
        // Terminal growth: ±0.5% absolute stdDev (conservative)
        terminalGrowth: [inputs.terminalGrowthRate, inputs.terminalGrowthRate * 0.2]
    }
}

/**
 * Run Monte Carlo simulation
 * 
 * This is a synchronous version suitable for small iteration counts
 * or for use within a Web Worker.
 */
export function runMonteCarloSimulation(
    params: MonteCarloParams,
    baseInputs: DCFInputs,
    financialData: ExtendedFinancialData
): MonteCarloResult {
    const values: number[] = []

    for (let i = 0; i < params.iterations; i++) {
        // Sample from distributions
        const sampledRevenueGrowth = sampleNormal(
            params.revenueGrowth[0],
            params.revenueGrowth[1]
        )
        const sampledOperatingMargin = Math.max(0.01, sampleNormal(
            params.operatingMargin[0],
            params.operatingMargin[1]
        ))
        const sampledWacc = Math.max(0.01, sampleNormal(
            params.wacc[0],
            params.wacc[1]
        ))
        const sampledTerminalGrowth = Math.max(0, Math.min(
            sampledWacc - 0.01, // Terminal growth must be < WACC
            sampleNormal(params.terminalGrowth[0], params.terminalGrowth[1])
        ))

        // Create modified inputs with sampled values
        const modifiedInputs: DCFInputs = {
            ...baseInputs,
            wacc: sampledWacc,
            terminalGrowthRate: sampledTerminalGrowth,
            drivers: baseInputs.drivers.map((driver, idx) => ({
                ...driver,
                // Apply sampled growth to Year 1, decay for subsequent years
                revenueGrowth: idx === 0
                    ? sampledRevenueGrowth
                    : driver.revenueGrowth * (sampledRevenueGrowth / baseInputs.drivers[0].revenueGrowth),
                // Apply sampled margin uniformly
                operatingMargin: sampledOperatingMargin
            }))
        }

        // Run DCF calculation
        try {
            const result = calculateDCF(modifiedInputs, financialData)
            if (isFinite(result.fairValuePerShare) && result.fairValuePerShare > 0) {
                values.push(result.fairValuePerShare)
            }
        } catch {
            // Skip failed iterations (e.g., negative values, division by zero)
        }
    }

    // Sort values for percentile calculation
    values.sort((a, b) => a - b)

    // Calculate statistics
    const n = values.length
    if (n === 0) {
        // Return empty result if all iterations failed
        return {
            valueDistribution: [],
            p10: 0,
            p25: 0,
            p50: 0,
            p75: 0,
            p90: 0,
            mean: 0,
            stdDev: 0,
            currentPricePercentile: 0
        }
    }

    // Percentile helper
    const percentile = (p: number): number => {
        const index = Math.floor(p * (n - 1))
        const fraction = p * (n - 1) - index
        if (index + 1 < n) {
            return values[index] + fraction * (values[index + 1] - values[index])
        }
        return values[index]
    }

    // Calculate mean
    const mean = values.reduce((sum, v) => sum + v, 0) / n

    // Calculate standard deviation
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)

    // Calculate current price percentile
    const currentPrice = financialData.currentPrice
    const countBelow = values.filter(v => v < currentPrice).length
    const currentPricePercentile = (countBelow / n) * 100

    return {
        valueDistribution: values,
        p10: percentile(0.10),
        p25: percentile(0.25),
        p50: percentile(0.50),
        p75: percentile(0.75),
        p90: percentile(0.90),
        mean,
        stdDev,
        currentPricePercentile
    }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get upside/downside interpretation
 */
export function interpretMonteCarloResult(
    result: MonteCarloResult,
    currentPrice: number
): {
    upsideP50: number      // % upside to median value
    upsideP75: number      // % upside to P75
    downsideP25: number    // % downside to P25
    riskRewardRatio: number // Upside/Downside ratio
    interpretation: string
} {
    const upsideP50 = ((result.p50 - currentPrice) / currentPrice) * 100
    const upsideP75 = ((result.p75 - currentPrice) / currentPrice) * 100
    const downsideP25 = ((currentPrice - result.p25) / currentPrice) * 100

    // Avoid division by zero
    const riskRewardRatio = downsideP25 > 0 ? upsideP75 / downsideP25 : 0

    let interpretation: string
    if (result.currentPricePercentile < 25) {
        interpretation = '当前价格处于估值分布的低位区间，可能被低估'
    } else if (result.currentPricePercentile > 75) {
        interpretation = '当前价格处于估值分布的高位区间，可能被高估'
    } else if (result.currentPricePercentile > 40 && result.currentPricePercentile < 60) {
        interpretation = '当前价格接近估值分布的中位数，定价合理'
    } else {
        interpretation = '当前价格处于估值分布的中间区间'
    }

    return {
        upsideP50,
        upsideP75,
        downsideP25,
        riskRewardRatio,
        interpretation
    }
}
