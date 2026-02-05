import { fetchExtendedFinancialData, fetchWACCInputs, calculateCostOfDebt } from '../src/services/fmp'
import { calculateDCF } from '../src/engines/dcf-engine'
import { createDefaultMonteCarloParams, runMonteCarloSimulation } from '../src/engines/monte-carlo'
import type { DCFInputs, ValueDrivers } from '../src/types'

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`
}

function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`
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

async function buildInputs(symbol: string): Promise<{ inputs: DCFInputs; data: NonNullable<Awaited<ReturnType<typeof fetchExtendedFinancialData>>> } | null> {
    const data = await fetchExtendedFinancialData(symbol)
    if (!data) return null

    const waccInputs = await fetchWACCInputs()
    const costOfEquity = waccInputs.riskFreeRate + data.beta * waccInputs.marketRiskPremium
    const costOfDebt = calculateCostOfDebt(data.interestExpense, data.totalDebt)
    const totalCapital = data.marketCap + data.totalDebt
    const equityWeight = totalCapital > 0 ? data.marketCap / totalCapital : 0.8
    const debtWeight = 1 - equityWeight
    const taxRate = data.effectiveTaxRate
    const calculatedWACC = equityWeight * costOfEquity + debtWeight * costOfDebt * (1 - taxRate)
    const wacc = clamp(calculatedWACC, 0.06, 0.15)

    const baseRevenue = data.latestAnnualRevenue > 0 ? data.latestAnnualRevenue : data.ttmRevenue
    const baseNetIncome = data.latestAnnualNetIncome > 0 ? data.latestAnnualNetIncome : data.ttmNetIncome
    const dcfInputs = createDefaultDCFInputs(symbol, baseRevenue, baseNetIncome)
    dcfInputs.wacc = wacc
    dcfInputs.steadyStateROIC = data.historicalROIC

    dcfInputs.drivers.forEach((d) => {
        if (data.grossMargin > 0) d.grossMargin = data.grossMargin
        if (data.operatingMargin > 0) d.operatingMargin = data.operatingMargin
        d.taxRate = data.effectiveTaxRate
        d.daPercent = data.historicalDAPercent
        d.capexPercent = data.historicalCapexPercent
        d.wcChangePercent = data.historicalWCChangePercent
    })

    const explicitYears = Math.min(dcfInputs.explicitPeriodYears, dcfInputs.drivers.length)
    const estimates = data.analystEstimates.slice(0, explicitYears)
    if (estimates.length > 0 && dcfInputs.baseRevenue > 0) {
        let prevRevenue = dcfInputs.baseRevenue
        for (let i = 0; i < explicitYears; i++) {
            const est = estimates[i]
            let growth: number | null = null
            if (est && est.revenueAvg > 0 && prevRevenue > 0) {
                growth = (est.revenueAvg / prevRevenue) - 1
                prevRevenue = est.revenueAvg
            } else if (i > 0) {
                growth = dcfInputs.drivers[i - 1].revenueGrowth * 0.9
                prevRevenue = prevRevenue * (1 + growth)
            }
            if (growth != null && isFinite(growth)) {
                dcfInputs.drivers[i].revenueGrowth = growth
            }
        }
        const lastIdx = Math.min(explicitYears, dcfInputs.drivers.length) - 1
        if (lastIdx >= 0) {
            dcfInputs.fadeStartGrowth = dcfInputs.drivers[lastIdx].revenueGrowth
        }
    } else if (data.analystEstimates.length >= 2) {
        const fy1Rev = data.analystEstimates[0].revenueAvg
        const fy2Rev = data.analystEstimates[1].revenueAvg
        if (fy1Rev > 0 && fy2Rev > 0) {
            const growth = (fy2Rev / fy1Rev) - 1
            dcfInputs.drivers[0].revenueGrowth = growth
            dcfInputs.drivers[1].revenueGrowth = growth * 0.9
            dcfInputs.drivers[2].revenueGrowth = growth * 0.8
            dcfInputs.drivers[3].revenueGrowth = growth * 0.7
            dcfInputs.drivers[4].revenueGrowth = growth * 0.6
            dcfInputs.fadeStartGrowth = growth * 0.6
        }
    }

    dcfInputs.fadeStartROIC = data.historicalROIC

    return { inputs: dcfInputs, data }
}

function printSummary(symbol: string, inputs: DCFInputs, perpetuity: number, roic: number, fade: number) {
    console.log(`\n${symbol.toUpperCase()} 估值摘要`)
    console.log(`- WACC: ${formatPercent(inputs.wacc)}`)
    console.log(`- 终值增长率 g: ${formatPercent(inputs.terminalGrowthRate)}`)
    console.log(`- 稳态 ROIC: ${formatPercent(inputs.steadyStateROIC)}`)
    console.log(`- Fade 年数: ${inputs.fadeYears}`)
    console.log(`- Fade 起始增长率: ${formatPercent(inputs.fadeStartGrowth)}`)
    console.log(`- Fade 起始 ROIC: ${formatPercent(inputs.fadeStartROIC)}`)
    console.log(`- 公允价值 (Perpetuity): ${formatCurrency(perpetuity)}`)
    console.log(`- 公允价值 (ROIC-driven): ${formatCurrency(roic)}`)
    console.log(`- 公允价值 (Fade): ${formatCurrency(fade)}`)
}

function printMonteCarloSummary(label: string, fairValue: number, p10: number, p50: number, p90: number) {
    const inRange = fairValue >= p10 && fairValue <= p90
    console.log(`- ${label} Monte Carlo P10-P90: ${formatCurrency(p10)} ~ ${formatCurrency(p90)} (P50: ${formatCurrency(p50)})`)
    console.log(`  ↳ DCF 点估值 ${formatCurrency(fairValue)} ${inRange ? '位于' : '不在'} P10-P90 区间内`)
}

async function run(symbols: string[]) {
    if (symbols.length === 0) {
        console.log('Usage: npm run valuation -- UNH NVDA')
        console.log('Optional: --iterations 5000')
        return
    }

    let iterations = 5000
    const parsedSymbols: string[] = []
    for (let i = 0; i < symbols.length; i++) {
        const arg = symbols[i]
        if (arg === '--iterations') {
            const next = Number(symbols[i + 1])
            if (Number.isFinite(next) && next > 0) {
                iterations = Math.floor(next)
                i++
                continue
            }
        }
        parsedSymbols.push(arg)
    }

    for (const symbol of parsedSymbols) {
        const result = await buildInputs(symbol)
        if (!result) {
            console.log(`\n${symbol.toUpperCase()} 数据获取失败`)
            continue
        }
        const { inputs, data } = result

        const perpetuityResult = calculateDCF(
            { ...inputs, terminalMethod: 'perpetuity' },
            data
        )
        const roicDrivenResult = calculateDCF(
            { ...inputs, terminalMethod: 'roic-driven' },
            data
        )
        const fadeResult = calculateDCF(
            { ...inputs, terminalMethod: 'fade' },
            data
        )

        printSummary(
            symbol,
            inputs,
            perpetuityResult.fairValuePerShare,
            roicDrivenResult.fairValuePerShare,
            fadeResult.fairValuePerShare
        )

        const methods: Array<{ label: string; method: DCFInputs['terminalMethod']; fairValue: number }> = [
            { label: 'Perpetuity', method: 'perpetuity', fairValue: perpetuityResult.fairValuePerShare },
            { label: 'ROIC-driven', method: 'roic-driven', fairValue: roicDrivenResult.fairValuePerShare },
            { label: 'Fade', method: 'fade', fairValue: fadeResult.fairValuePerShare }
        ]

        for (const { label, method, fairValue } of methods) {
            const params = createDefaultMonteCarloParams({ ...inputs, terminalMethod: method }, data)
            params.iterations = iterations
            const mcResult = runMonteCarloSimulation(params, { ...inputs, terminalMethod: method }, data)
            if (mcResult.valueDistribution.length === 0) {
                console.log(`- ${label} Monte Carlo: 未生成有效结果`)
            } else {
                printMonteCarloSummary(label, fairValue, mcResult.p10, mcResult.p50, mcResult.p90)
            }
        }
    }
}

run(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
})
