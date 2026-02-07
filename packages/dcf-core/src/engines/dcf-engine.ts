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
} from '../types'

/**
 * Calculate DCF valuation
 */
export function calculateDCF(
    inputs: DCFInputs,
    financialData: ExtendedFinancialData
): DCFResult {
    const projections: YearProjection[] = []
    let prevRevenue = inputs.baseRevenue  // 记录前一年营收，用于计算 ΔRevenue

    // Calculate explicit period projections
    for (let year = 1; year <= inputs.explicitPeriodYears; year++) {
        const driver = inputs.drivers[year - 1]

        // Project revenue
        const revenue = prevRevenue * (1 + driver.revenueGrowth)

        // 计算营收变动 (用于 WC 计算)
        const deltaRevenue = revenue - prevRevenue

        // Calculate operating income
        const operatingIncome = revenue * driver.operatingMargin

        // Calculate NOPAT (Net Operating Profit After Tax)
        const nopat = operatingIncome * (1 - driver.taxRate)

        // Calculate FCF components
        const da = revenue * driver.daPercent
        const capex = revenue * driver.capexPercent
        // ΔWC = wcChangePercent × ΔRevenue (与历史计算口径一致)
        const wcChange = deltaRevenue * driver.wcChangePercent

        // FCF = NOPAT + D&A - CapEx - ΔWC
        const fcf = nopat + da - capex - wcChange

        // 更新前一年营收
        prevRevenue = revenue

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
            // Fade Model: 从高增长/高ROIC 渐退到稳态
            // 设定：从显式期末开始，渐退到 ROIC_end 和 g_end
            let fadePV = 0
            let fadeNopat = lastProjection.nopat

            // 起始和结束参数
            const gStart = inputs.fadeStartGrowth       // 渐退期起始增长率
            const gEnd = inputs.terminalGrowthRate      // 永续增长率
            const roicStart = inputs.fadeStartROIC      // 渐退期起始 ROIC
            const roicEnd = inputs.steadyStateROIC      // 稳态 ROIC

            for (let y = 1; y <= inputs.fadeYears; y++) {
                // 线性渐退因子：从 1 渐退到 0
                const fadeFactor = 1 - y / inputs.fadeYears

                // 当年增长率：从 gStart 渐退到 gEnd
                const yearGrowth = gEnd + (gStart - gEnd) * fadeFactor

                // 当年 ROIC：从 roicStart 渐退到 roicEnd  
                const yearROIC = roicEnd + (roicStart - roicEnd) * fadeFactor

                // 再投资率 = g / ROIC (确保 ROIC > 0)
                const yearReinvestment = yearROIC > 0.001
                    ? yearGrowth / yearROIC
                    : 0

                // NOPAT 增长
                fadeNopat = fadeNopat * (1 + yearGrowth)

                // FCF = NOPAT × (1 - 再投资率)
                const yearFCF = fadeNopat * (1 - yearReinvestment)

                // 折现累加
                fadePV += yearFCF / Math.pow(1 + inputs.wacc, inputs.explicitPeriodYears + y)
            }

            // 渐退期结束后：永久稳态
            // NOPAT_{T+1} = NOPAT_T × (1 + g_end)
            const postFadeNopat = fadeNopat * (1 + gEnd)

            // 稳态再投资率 = g_end / ROIC_end
            const postFadeReinvestment = roicEnd > 0.001 ? gEnd / roicEnd : 0

            // 稳态 FCF = NOPAT × (1 - 再投资率)
            const postFadeFCF = postFadeNopat * (1 - postFadeReinvestment)

            // 终值 = 稳态 FCF / (WACC - g_end)
            const postFadeTV = postFadeFCF / (inputs.wacc - gEnd)

            // 折现到渐退期末（T = n + fadeYears）
            const postFadePV = postFadeTV / Math.pow(1 + inputs.wacc, inputs.explicitPeriodYears + inputs.fadeYears)

            // 终值 = 渐退期现值 + 渐退后终值现值（还原到期末时点用于统一计算）
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

    // Implied EV/FCFF (企业价值倍数，因为 ttmFCF = FCFF)
    const impliedEVtoFCF = financialData.ttmFCF > 0
        ? enterpriseValue / financialData.ttmFCF
        : 0

    return {
        enterpriseValue,
        equityValue,
        fairValuePerShare,
        explicitPeriodPV,
        terminalValuePV,
        terminalValuePercent: (terminalValuePV / enterpriseValue) * 100,
        impliedPE,
        impliedEVtoFCF,
        projections
    }
}

/**
 * Calculate ROIC from financial data (using book value invested capital)
 * ROIC = NOPAT / Invested Capital
 * Invested Capital = Total Equity + Total Debt - Excess Cash (账面值口径)
 * 使用账面值避免市值波动导致的自反馈偏差
 */
export function calculateROIC(financialData: ExtendedFinancialData, taxRate: number): number {
    const nopat = financialData.ttmOperatingIncome * (1 - taxRate)

    // 账面值口径的投入资本 = 股东权益 + 总负债 - 现金
    // 这等价于 Operating Assets - Operating Liabilities
    const investedCapital = financialData.totalEquity +
        financialData.totalDebt -
        financialData.totalCash

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
