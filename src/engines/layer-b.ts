/**
 * Layer B: Structural Consistency Validation
 * 
 * Performs immediate "physical law" checks on DCF assumptions.
 */

import type {
    DCFInputs,
    DCFResult,
    StructuralCheck,
    ExtendedFinancialData
} from '@/types'
import { calculateImpliedGrowth } from './dcf-engine'
import { getIndustryBenchmark, getIndustryThresholds } from '@/data/industryBenchmarks'

/**
 * Run structural consistency checks
 */
export function runStructuralCheck(
    inputs: DCFInputs,
    result: DCFResult,
    financialData: ExtendedFinancialData
): StructuralCheck {
    const warnings: string[] = []

    // -----------------------------------------
    // 1. Growth Consistency Check
    // Growth ≈ Reinvestment Rate × ROIC
    // -----------------------------------------

    // Calculate average assumed growth
    const avgAssumedGrowth = inputs.drivers.reduce((sum, d) => sum + d.revenueGrowth, 0) /
        inputs.drivers.length

    // Use actual historical ROIC from financial data (more accurate than proxy)
    // Keep raw value; flag extremes via warning
    const actualROIC = Number.isFinite(financialData.historicalROIC)
        ? financialData.historicalROIC
        : 0

    const benchmark = getIndustryBenchmark(financialData.industry, financialData.sector)
    const thresholds = getIndustryThresholds(benchmark)
    const lowerExtreme = Math.min(-0.10, benchmark.afterTaxROIC - 0.30)
    if (actualROIC > thresholds.roicError || actualROIC < lowerExtreme) {
        warnings.push(`历史ROIC(${(actualROIC * 100).toFixed(1)}%)偏离行业常态，可能存在行业特例`)
    }

    // Calculate average driver values for reinvestment rate
    const avgOpMargin = inputs.drivers.reduce((sum, d) => sum + d.operatingMargin, 0) /
        inputs.drivers.length
    const avgTaxRate = inputs.drivers.reduce((sum, d) => sum + d.taxRate, 0) /
        inputs.drivers.length

    // Calculate reinvestment rate
    const avgCapex = inputs.drivers.reduce((sum, d) => sum + d.capexPercent, 0) /
        inputs.drivers.length
    const avgDA = inputs.drivers.reduce((sum, d) => sum + d.daPercent, 0) /
        inputs.drivers.length
    const avgWC = inputs.drivers.reduce((sum, d) => sum + d.wcChangePercent, 0) /
        inputs.drivers.length

    const netNopatMargin = avgOpMargin * (1 - avgTaxRate)
    const reinvestmentRate = netNopatMargin > 0
        ? (avgCapex - avgDA + avgWC) / netNopatMargin
        : 0

    // Calculate implied growth using actual ROIC
    const impliedGrowth = calculateImpliedGrowth(actualROIC, reinvestmentRate)
    const growthDeviation = Math.abs(avgAssumedGrowth - impliedGrowth)
    const growthIsValid = growthDeviation < 0.05 // Within 5% tolerance

    if (!growthIsValid) {
        if (avgAssumedGrowth > impliedGrowth) {
            warnings.push(`增长率(${(avgAssumedGrowth * 100).toFixed(1)}%)高于隐含增长(${(impliedGrowth * 100).toFixed(1)}%)，需要更高的再投资或ROIC`)
        } else {
            warnings.push(`增长率(${(avgAssumedGrowth * 100).toFixed(1)}%)低于隐含增长(${(impliedGrowth * 100).toFixed(1)}%)，可能过于保守`)
        }
    }

    // -----------------------------------------
    // 2. CapEx/D&A Ratio Check
    // Should approach 1.0 in steady state
    // -----------------------------------------

    const lastDriver = inputs.drivers[inputs.drivers.length - 1]

    const lastCapex = lastDriver.capexPercent
    const lastDA = lastDriver.daPercent
    const capexDARatio = lastDA > 0 ? lastCapex / lastDA : 0
    const capexDATarget = 1.0
    const capexDAReasonable = capexDARatio >= 0.8 && capexDARatio <= 1.5

    if (!capexDAReasonable) {
        if (capexDARatio < 0.8) {
            warnings.push(`CapEx/折旧比(${capexDARatio.toFixed(2)})过低，长期将导致资产萎缩`)
        } else {
            warnings.push(`CapEx/折旧比(${capexDARatio.toFixed(2)})过高，隐含持续高增长投资`)
        }
    }

    // -----------------------------------------
    // 3. FCF to Net Income Quality Check
    // -----------------------------------------

    const lastProjection = result.projections[result.projections.length - 1]
    const fcfToNI = lastProjection.nopat > 0
        ? lastProjection.fcf / lastProjection.nopat
        : 0

    // Industry-typical range: 0.6 - 1.2
    const fcfIndustryRange: [number, number] = [0.6, 1.2]
    const fcfReasonable = fcfToNI >= fcfIndustryRange[0] && fcfToNI <= fcfIndustryRange[1]

    if (!fcfReasonable) {
        if (fcfToNI < fcfIndustryRange[0]) {
            warnings.push(`FCF/NOPAT比率(${(fcfToNI * 100).toFixed(0)}%)过低，现金转化效率差`)
        } else {
            warnings.push(`FCF/NOPAT比率(${(fcfToNI * 100).toFixed(0)}%)异常高，检查折旧和资本开支假设`)
        }
    }

    // -----------------------------------------
    // 4. Terminal Value Percentage Check
    // -----------------------------------------

    if (result.terminalValuePercent > 80) {
        warnings.push(`终值占比(${result.terminalValuePercent.toFixed(0)}%)过高，估值高度依赖远期假设`)
    }

    // -----------------------------------------
    // 5. WACC vs Terminal Growth Check
    // -----------------------------------------

    if (inputs.terminalGrowthRate >= inputs.wacc) {
        warnings.push(`终值增长率(${(inputs.terminalGrowthRate * 100).toFixed(1)}%)不能大于等于WACC(${(inputs.wacc * 100).toFixed(1)}%)`)
    }

    if (inputs.terminalGrowthRate > 0.04) {
        warnings.push(`终值增长率(${(inputs.terminalGrowthRate * 100).toFixed(1)}%)超过长期GDP增速，需要强有力解释`)
    }

    return {
        growthConsistency: {
            impliedGrowth,
            assumedGrowth: avgAssumedGrowth,
            deviation: growthDeviation,
            isValid: growthIsValid
        },
        capexDARatio: {
            current: capexDARatio,
            target: capexDATarget,
            isReasonable: capexDAReasonable
        },
        fcfQuality: {
            fcfToNI,
            industryRange: fcfIndustryRange,
            isReasonable: fcfReasonable
        },
        hasWarnings: warnings.length > 0,
        warnings
    }
}
