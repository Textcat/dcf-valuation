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
} from '../types'
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

function sampleLogNormalFromZ(mean: number, stdDev: number, z: number): number {
    const variance = stdDev * stdDev
    const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean))
    const sigma = Math.sqrt(Math.log(1 + variance / (mean * mean)))
    return Math.exp(mu + sigma * z)
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function isSymmetricMatrix(matrix: number[][]): boolean {
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix.length; j++) {
            if (matrix[i][j] !== matrix[j][i]) return false
        }
    }
    return true
}

function choleskyDecomposition(matrix: number[][]): number[][] | null {
    const n = matrix.length
    const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            let sum = matrix[i][j]
            for (let k = 0; k < j; k++) {
                sum -= L[i][k] * L[j][k]
            }
            if (i === j) {
                if (sum <= 0) return null
                L[i][j] = Math.sqrt(sum)
            } else {
                if (L[j][j] === 0) return null
                L[i][j] = sum / L[j][j]
            }
        }
    }

    return L
}

function buildCorrelationCholesky(matrix: number[][]): number[][] {
    const n = matrix.length
    const identity = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    )

    if (n === 0) return identity
    if (!isSymmetricMatrix(matrix)) return identity

    let working = matrix.map(row => row.slice())
    let L = choleskyDecomposition(working)
    let jitter = 1e-4

    while (!L && jitter <= 1e-2) {
        for (let i = 0; i < n; i++) {
            working[i][i] += jitter
        }
        L = choleskyDecomposition(working)
        jitter *= 2
    }

    return L || identity
}

function sampleCorrelatedNormals(cholesky: number[][]): number[] {
    const n = cholesky.length
    const z = Array.from({ length: n }, () => randomStandardNormal())
    const out = Array(n).fill(0)

    for (let i = 0; i < n; i++) {
        let sum = 0
        for (let k = 0; k <= i; k++) {
            sum += cholesky[i][k] * z[k]
        }
        out[i] = sum
    }

    return out
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
    // Base values from driver path
    const growthPath = inputs.drivers.map(d => d.revenueGrowth)
    const marginPath = inputs.drivers.map(d => d.operatingMargin)
    const year1 = inputs.drivers[0]

    // Default heuristic values
    const growthStdFloor = 0.002
    const growthStdRel = 0.35
    const marginStdFloor = 0.002
    const marginStdRel = 0.20
    let revenueGrowthStdDev = Math.max(growthStdFloor, Math.abs(year1.revenueGrowth) * growthStdRel)
    let marginStdDev = Math.max(marginStdFloor, Math.abs(year1.operatingMargin) * marginStdRel)

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
            const growthStdCeil = Math.max(growthStdFloor, Math.abs(year1.revenueGrowth) * 0.8)
            revenueGrowthStdDev = Math.max(growthStdFloor, Math.min(growthStdCeil, impliedStdDev))
        }

        // EPS dispersion can inform margin volatility
        if (fy1.epsHigh > 0 && fy1.epsLow > 0 && fy1.epsAvg > 0) {
            const epsRange = (fy1.epsHigh - fy1.epsLow) / fy1.epsAvg
            // EPS volatility is roughly proportional to margin volatility
            const impliedMarginStdDev = (epsRange / 4) * year1.operatingMargin
            const marginStdCeil = Math.max(marginStdFloor, Math.abs(year1.operatingMargin) * 0.8)
            marginStdDev = Math.max(marginStdFloor, Math.min(marginStdCeil, impliedMarginStdDev))
        }
    }

    return {
        iterations: 10000,
        growth: {
            means: growthPath,
            stdDev: revenueGrowthStdDev,
            min: -0.15,
            max: 0.30,
            yearCorrelation: 0.5,
            meanReversion: 0.35
        },
        operatingMargin: {
            means: marginPath,
            stdDev: marginStdDev,
            min: 0.01,
            max: 0.60,
            yearCorrelation: 0.5,
            meanReversion: 0.35
        },
        wacc: {
            mean: inputs.wacc,
            stdDev: Math.max(0.0015, Math.abs(inputs.wacc) * 0.15),
            min: 0.02,
            max: 0.20,
            distribution: 'lognormal'
        },
        terminalGrowth: {
            mean: inputs.terminalGrowthRate,
            stdDev: Math.max(0.001, Math.abs(inputs.terminalGrowthRate) * 0.2),
            min: 0,
            max: 0.06
        },
        correlation: {
            variables: ['growth', 'margin', 'wacc', 'terminalGrowth'],
            matrix: [
                [1, 0.35, -0.20, 0.45],
                [0.35, 1, -0.15, 0.25],
                [-0.20, -0.15, 1, -0.10],
                [0.45, 0.25, -0.10, 1]
            ]
        },
        terminalModel: {
            minWaccSpread: 0.005,
            roicDriven: {
                steadyStateROIC: {
                    mean: inputs.steadyStateROIC,
                    stdDev: Math.max(0.005, Math.abs(inputs.steadyStateROIC) * 0.25),
                    min: 0.03,
                    max: 0.50
                },
                maxReinvestmentRate: 0.80
            },
            fade: {
                fadeYears: {
                    mean: inputs.fadeYears,
                    stdDev: Math.max(1, Math.abs(inputs.fadeYears) * 0.2),
                    min: 3,
                    max: 20
                },
                fadeStartGrowth: {
                    mean: inputs.fadeStartGrowth,
                    stdDev: Math.max(0.005, Math.abs(inputs.fadeStartGrowth) * 0.2),
                    min: 0,
                    max: 0.40
                },
                fadeStartROIC: {
                    mean: inputs.fadeStartROIC,
                    stdDev: Math.max(0.005, Math.abs(inputs.fadeStartROIC) * 0.2),
                    min: 0.03,
                    max: 0.60
                }
            }
        }
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
    const cholesky = buildCorrelationCholesky(params.correlation.matrix)
    const growthMeans = params.growth.means.length > 0
        ? params.growth.means
        : baseInputs.drivers.map(d => d.revenueGrowth)
    const marginMeans = params.operatingMargin.means.length > 0
        ? params.operatingMargin.means
        : baseInputs.drivers.map(d => d.operatingMargin)
    const maxAttempts = 25
    const dynamicBoundK = 3

    const dynamicBounds = (mean: number, stdDev: number, hardMin: number, hardMax: number) => {
        const min = Math.max(hardMin, mean - dynamicBoundK * stdDev)
        const max = Math.min(hardMax, mean + dynamicBoundK * stdDev)
        if (min <= max) {
            return { min, max }
        }
        const fallback = clamp(mean, hardMin, hardMax)
        return { min: fallback, max: fallback }
    }

    for (let i = 0; i < params.iterations; i++) {
        let attempt = 0
        let modifiedInputs: DCFInputs | null = null

        while (attempt < maxAttempts && !modifiedInputs) {
            attempt++

            const correlated = sampleCorrelatedNormals(cholesky)
            const growthZ = correlated[0] ?? randomStandardNormal()
            const marginZ = correlated[1] ?? randomStandardNormal()
            const waccZ = correlated[2] ?? randomStandardNormal()
            const terminalGrowthZ = correlated[3] ?? randomStandardNormal()
            const growthShock = growthZ * params.growth.stdDev
            const marginShock = marginZ * params.operatingMargin.stdDev
            const waccShock = waccZ
            const terminalGrowthShock = terminalGrowthZ * params.terminalGrowth.stdDev

            const growthPath: number[] = []
            const firstGrowthBounds = dynamicBounds(
                growthMeans[0],
                params.growth.stdDev,
                params.growth.min,
                params.growth.max
            )
            let prevGrowth = clamp(
                growthMeans[0] + growthShock,
                firstGrowthBounds.min,
                firstGrowthBounds.max
            )
            let prevShock = params.growth.stdDev > 0 ? growthShock / params.growth.stdDev : 0
            growthPath.push(prevGrowth)

            const yearCorr = clamp(params.growth.yearCorrelation, -0.9, 0.9)
            const meanReversion = clamp(params.growth.meanReversion, 0, 1)
            const shockScale = Math.sqrt(1 - yearCorr * yearCorr)

            for (let y = 1; y < baseInputs.explicitPeriodYears; y++) {
                const mean = growthMeans[Math.min(y, growthMeans.length - 1)]
                const bounds = dynamicBounds(mean, params.growth.stdDev, params.growth.min, params.growth.max)
                const shock = yearCorr * prevShock + shockScale * randomStandardNormal()
                const blended = mean + (prevGrowth - mean) * (1 - meanReversion) + shock * params.growth.stdDev
                const nextGrowth = clamp(blended, bounds.min, bounds.max)
                growthPath.push(nextGrowth)
                prevGrowth = nextGrowth
                prevShock = shock
            }

            const marginPath: number[] = []
            const firstMarginBounds = dynamicBounds(
                marginMeans[0],
                params.operatingMargin.stdDev,
                params.operatingMargin.min,
                params.operatingMargin.max
            )
            let prevMargin = clamp(
                marginMeans[0] + marginShock,
                firstMarginBounds.min,
                firstMarginBounds.max
            )
            let prevMarginShock = params.operatingMargin.stdDev > 0 ? marginShock / params.operatingMargin.stdDev : 0
            marginPath.push(prevMargin)

            const marginYearCorr = clamp(params.operatingMargin.yearCorrelation, -0.9, 0.9)
            const marginMeanReversion = clamp(params.operatingMargin.meanReversion, 0, 1)
            const marginShockScale = Math.sqrt(1 - marginYearCorr * marginYearCorr)

            for (let y = 1; y < baseInputs.explicitPeriodYears; y++) {
                const mean = marginMeans[Math.min(y, marginMeans.length - 1)]
                const bounds = dynamicBounds(mean, params.operatingMargin.stdDev, params.operatingMargin.min, params.operatingMargin.max)
                const shock = marginYearCorr * prevMarginShock + marginShockScale * randomStandardNormal()
                const blended = mean + (prevMargin - mean) * (1 - marginMeanReversion) + shock * params.operatingMargin.stdDev
                const nextMargin = clamp(blended, bounds.min, bounds.max)
                marginPath.push(nextMargin)
                prevMargin = nextMargin
                prevMarginShock = shock
            }

            const sampledWaccRaw = params.wacc.distribution === 'lognormal'
                ? sampleLogNormalFromZ(params.wacc.mean, params.wacc.stdDev, waccShock)
                : params.wacc.mean + params.wacc.stdDev * waccShock
            const waccBounds = dynamicBounds(
                params.wacc.mean,
                params.wacc.stdDev,
                params.wacc.min,
                params.wacc.max
            )
            const sampledWacc = clamp(sampledWaccRaw, waccBounds.min, waccBounds.max)

            const terminalGrowthBounds = dynamicBounds(
                params.terminalGrowth.mean,
                params.terminalGrowth.stdDev,
                params.terminalGrowth.min,
                params.terminalGrowth.max
            )
            const sampledTerminalGrowth = clamp(
                params.terminalGrowth.mean + terminalGrowthShock,
                terminalGrowthBounds.min,
                terminalGrowthBounds.max
            )

            const roicBounds = dynamicBounds(
                params.terminalModel.roicDriven.steadyStateROIC.mean,
                params.terminalModel.roicDriven.steadyStateROIC.stdDev,
                params.terminalModel.roicDriven.steadyStateROIC.min,
                params.terminalModel.roicDriven.steadyStateROIC.max
            )
            const steadyStateROIC = clamp(
                sampleNormal(
                    params.terminalModel.roicDriven.steadyStateROIC.mean,
                    params.terminalModel.roicDriven.steadyStateROIC.stdDev
                ),
                roicBounds.min,
                roicBounds.max
            )

            const fadeYearsBounds = dynamicBounds(
                params.terminalModel.fade.fadeYears.mean,
                params.terminalModel.fade.fadeYears.stdDev,
                params.terminalModel.fade.fadeYears.min,
                params.terminalModel.fade.fadeYears.max
            )
            const fadeYears = Math.round(clamp(
                sampleNormal(
                    params.terminalModel.fade.fadeYears.mean,
                    params.terminalModel.fade.fadeYears.stdDev
                ),
                fadeYearsBounds.min,
                fadeYearsBounds.max
            ))

            const fadeGrowthBounds = dynamicBounds(
                params.terminalModel.fade.fadeStartGrowth.mean,
                params.terminalModel.fade.fadeStartGrowth.stdDev,
                params.terminalModel.fade.fadeStartGrowth.min,
                params.terminalModel.fade.fadeStartGrowth.max
            )
            const fadeStartGrowth = clamp(
                sampleNormal(
                    params.terminalModel.fade.fadeStartGrowth.mean,
                    params.terminalModel.fade.fadeStartGrowth.stdDev
                ),
                fadeGrowthBounds.min,
                fadeGrowthBounds.max
            )

            const fadeRoicBounds = dynamicBounds(
                params.terminalModel.fade.fadeStartROIC.mean,
                params.terminalModel.fade.fadeStartROIC.stdDev,
                params.terminalModel.fade.fadeStartROIC.min,
                params.terminalModel.fade.fadeStartROIC.max
            )
            const fadeStartROIC = clamp(
                sampleNormal(
                    params.terminalModel.fade.fadeStartROIC.mean,
                    params.terminalModel.fade.fadeStartROIC.stdDev
                ),
                fadeRoicBounds.min,
                fadeRoicBounds.max
            )

            if (sampledWacc - sampledTerminalGrowth < params.terminalModel.minWaccSpread) continue

            if (baseInputs.terminalMethod === 'roic-driven' || baseInputs.terminalMethod === 'fade') {
                if (steadyStateROIC <= 0) continue
                const reinvestmentRate = sampledTerminalGrowth / steadyStateROIC
                if (reinvestmentRate < 0 || reinvestmentRate > params.terminalModel.roicDriven.maxReinvestmentRate) continue
            }

            if (baseInputs.terminalMethod === 'fade') {
                if (fadeStartGrowth < sampledTerminalGrowth) continue
                if (fadeStartROIC < steadyStateROIC) continue
            }

            modifiedInputs = {
                ...baseInputs,
                wacc: sampledWacc,
                terminalGrowthRate: sampledTerminalGrowth,
                steadyStateROIC,
                fadeYears,
                fadeStartGrowth,
                fadeStartROIC,
                drivers: baseInputs.drivers.map((driver, idx) => ({
                    ...driver,
                    revenueGrowth: growthPath[Math.min(idx, growthPath.length - 1)],
                    operatingMargin: marginPath[Math.min(idx, marginPath.length - 1)]
                }))
            }
        }

        // Run DCF calculation
        try {
            if (modifiedInputs) {
                const result = calculateDCF(modifiedInputs, financialData)
                if (isFinite(result.fairValuePerShare) && result.fairValuePerShare > 0) {
                    values.push(result.fairValuePerShare)
                }
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
