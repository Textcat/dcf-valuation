import type {
    AnalystEstimate,
    ExtendedFinancialData,
    Percentiles,
    WACCInputs
} from '@dcf/core'

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'
const WACC_CACHE_DURATION_MS = 60 * 60 * 1000

let cachedWaccInputs: { key: string; value: WACCInputs; timestamp: number } | null = null

interface FMPProfile {
    symbol: string
    companyName: string
    price: number
    marketCap: number
    currency: string
    beta: number
    sector: string
    industry: string
}

interface FMPIncomeStatement {
    date: string
    reportedCurrency: string
    revenue: number
    grossProfit: number
    operatingIncome: number
    netIncome: number
    weightedAverageShsOutDil: number
    incomeTaxExpense: number
    incomeBeforeTax: number
    interestExpense: number
}

interface FMPCashFlowStatement {
    date: string
    freeCashFlow: number
    depreciationAndAmortization: number
    capitalExpenditure: number
    changeInWorkingCapital: number
    stockBasedCompensation: number
}

interface FMPBalanceSheet {
    totalStockholdersEquity: number
    totalDebt: number
    cashAndCashEquivalents: number
}

interface FMPAnalystEstimate {
    date: string
    revenueLow: number
    revenueAvg: number
    revenueHigh: number
    epsLow: number
    epsAvg: number
    epsHigh: number
    numAnalystsEps: number
}

interface FMPKeyMetrics {
    peRatio: number
    priceToFreeCashFlowsRatio: number
    freeCashFlowYield: number
}

interface FMPTreasuryRate {
    year10: number
}

interface FMPMarketRiskPremium {
    country: string
    totalEquityRiskPremium: number
}

function toNum(val: unknown): number {
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (typeof val === 'string') {
        const parsed = parseFloat(val)
        if (Number.isFinite(parsed)) return parsed
    }
    return 0
}

function toDateMs(dateStr?: string | null): number {
    if (!dateStr) return 0
    const ms = Date.parse(dateStr)
    return Number.isFinite(ms) ? ms : 0
}

function buildUrl(endpoint: string, params: Record<string, string | number>, apiKey: string): string {
    const url = new URL(`${FMP_BASE_URL}/${endpoint}`)
    url.searchParams.set('apikey', apiKey)
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value))
    }
    return url.toString()
}

async function fetchAndValidate<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (data && typeof data === 'object' && 'Error Message' in data) {
            return null
        }
        return data as T
    } catch {
        return null
    }
}

function calculatePercentiles(values: number[], clampMin: number, clampMax: number): Percentiles {
    const filtered = values
        .filter(v => v > 0 && Number.isFinite(v))
        .map(v => Math.min(Math.max(v, clampMin), clampMax))
        .sort((a, b) => a - b)

    if (filtered.length === 0) {
        return { p25: 0, p50: 0, p75: 0, min: 0, max: 0 }
    }

    const getPercentile = (arr: number[], p: number): number => {
        const idx = Math.floor(arr.length * p)
        return arr[Math.min(idx, arr.length - 1)]
    }

    return {
        p25: getPercentile(filtered, 0.25),
        p50: getPercentile(filtered, 0.5),
        p75: getPercentile(filtered, 0.75),
        min: filtered[0],
        max: filtered[filtered.length - 1]
    }
}

async function fetchExchangeRate(currency: string): Promise<number> {
    if (!currency || currency === 'USD') return 1

    try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
        if (res.ok) {
            const data = await res.json() as { rates?: Record<string, number> }
            const rate = data.rates?.[currency]
            if (rate && Number.isFinite(rate) && rate > 0) {
                return 1 / rate
            }
        }
    } catch {
        // fallback below
    }

    const fallbackRates: Record<string, number> = {
        TWD: 0.032,
        EUR: 1.08,
        GBP: 1.27,
        JPY: 0.0067,
        CNY: 0.14,
        HKD: 0.128,
        KRW: 0.00075,
        INR: 0.012,
        AUD: 0.65,
        CAD: 0.74,
        CHF: 1.13,
        SGD: 0.75
    }

    return fallbackRates[currency] ?? 1
}

export async function fetchWACCInputs(apiKey: string): Promise<WACCInputs> {
    const now = Date.now()
    if (cachedWaccInputs && cachedWaccInputs.key === apiKey && (now - cachedWaccInputs.timestamp) < WACC_CACHE_DURATION_MS) {
        return cachedWaccInputs.value
    }

    const defaults: WACCInputs = {
        riskFreeRate: 0.045,
        marketRiskPremium: 0.05,
        countryRiskPremium: 0
    }

    const [treasuryData, riskPremiumData] = await Promise.all([
        fetchAndValidate<FMPTreasuryRate[]>(buildUrl('treasury-rates', { limit: 1 }, apiKey)),
        fetchAndValidate<FMPMarketRiskPremium[]>(buildUrl('market-risk-premium', {}, apiKey))
    ])

    let riskFreeRate = defaults.riskFreeRate
    if (treasuryData && treasuryData.length > 0) {
        const sampled = toNum(treasuryData[0].year10) / 100
        if (sampled >= 0.001 && sampled <= 0.15) {
            riskFreeRate = sampled
        }
    }

    let marketRiskPremium = defaults.marketRiskPremium
    if (riskPremiumData && riskPremiumData.length > 0) {
        const us = riskPremiumData.find(item => item.country === 'United States')
        const sampled = toNum(us?.totalEquityRiskPremium) / 100
        if (sampled >= 0.02 && sampled <= 0.12) {
            marketRiskPremium = sampled
        }
    }

    const out: WACCInputs = {
        riskFreeRate,
        marketRiskPremium,
        countryRiskPremium: 0
    }

    cachedWaccInputs = {
        key: apiKey,
        value: out,
        timestamp: now
    }

    return out
}

export async function fetchExtendedFinancialData(symbol: string, apiKey: string): Promise<ExtendedFinancialData | null> {
    const upperSymbol = symbol.toUpperCase()
    const profileData = await fetchAndValidate<FMPProfile[]>(buildUrl('profile', { symbol: upperSymbol }, apiKey))

    if (!profileData || profileData.length === 0) {
        return null
    }

    const profile = profileData[0]

    const [
        incomeQuarterly,
        incomeAnnual,
        cashFlowQuarterly,
        cashFlowAnnual,
        balanceSheet,
        analystData,
        keyMetrics
    ] = await Promise.all([
        fetchAndValidate<FMPIncomeStatement[]>(buildUrl('income-statement', { symbol: upperSymbol, period: 'quarter', limit: 4 }, apiKey)),
        fetchAndValidate<FMPIncomeStatement[]>(buildUrl('income-statement', { symbol: upperSymbol, period: 'annual', limit: 3 }, apiKey)),
        fetchAndValidate<FMPCashFlowStatement[]>(buildUrl('cash-flow-statement', { symbol: upperSymbol, period: 'quarter', limit: 4 }, apiKey)),
        fetchAndValidate<FMPCashFlowStatement[]>(buildUrl('cash-flow-statement', { symbol: upperSymbol, period: 'annual', limit: 3 }, apiKey)),
        fetchAndValidate<FMPBalanceSheet[]>(buildUrl('balance-sheet-statement', { symbol: upperSymbol, limit: 1 }, apiKey)),
        fetchAndValidate<FMPAnalystEstimate[]>(buildUrl('analyst-estimates', { symbol: upperSymbol, period: 'annual', limit: 5 }, apiKey)),
        fetchAndValidate<FMPKeyMetrics[]>(buildUrl('key-metrics', { symbol: upperSymbol, limit: 5 }, apiKey))
    ])

    if (!incomeQuarterly || incomeQuarterly.length === 0 || !cashFlowQuarterly || cashFlowQuarterly.length === 0) {
        return null
    }

    const reportedCurrency = incomeQuarterly[0].reportedCurrency || profile.currency
    const exchangeRate = await fetchExchangeRate(reportedCurrency)
    const priceExchangeRate = await fetchExchangeRate(profile.currency)

    let ttmRevenue = 0
    let ttmGrossProfit = 0
    let ttmOperatingIncome = 0
    let ttmNetIncome = 0
    let ttmInterestExpense = 0
    let sharesOutstanding = 0

    for (const item of incomeQuarterly) {
        ttmRevenue += toNum(item.revenue)
        ttmGrossProfit += toNum(item.grossProfit)
        ttmOperatingIncome += toNum(item.operatingIncome)
        ttmNetIncome += toNum(item.netIncome)
        ttmInterestExpense += toNum(item.interestExpense)
    }
    sharesOutstanding = toNum(incomeQuarterly[0].weightedAverageShsOutDil)

    let ttmFCF = 0
    let ttmDA = 0
    let ttmCapex = 0
    let ttmSBC = 0

    for (const item of cashFlowQuarterly) {
        ttmFCF += toNum(item.freeCashFlow)
        ttmDA += toNum(item.depreciationAndAmortization)
        ttmCapex += Math.abs(toNum(item.capitalExpenditure))
        ttmSBC += toNum(item.stockBasedCompensation)
    }

    ttmRevenue *= exchangeRate
    ttmGrossProfit *= exchangeRate
    ttmOperatingIncome *= exchangeRate
    ttmNetIncome *= exchangeRate
    ttmFCF *= exchangeRate
    ttmDA *= exchangeRate
    ttmCapex *= exchangeRate
    ttmSBC *= exchangeRate

    const grossMargin = ttmRevenue > 0 ? ttmGrossProfit / ttmRevenue : 0
    const operatingMargin = ttmRevenue > 0 ? ttmOperatingIncome / ttmRevenue : 0
    const netMargin = ttmRevenue > 0 ? ttmNetIncome / ttmRevenue : 0

    let latestAnnualRevenue = 0
    let latestAnnualNetIncome = 0
    let latestAnnualDateMs = 0
    if (incomeAnnual && incomeAnnual.length > 0) {
        latestAnnualRevenue = toNum(incomeAnnual[0].revenue) * exchangeRate
        latestAnnualNetIncome = toNum(incomeAnnual[0].netIncome) * exchangeRate
        latestAnnualDateMs = toDateMs(incomeAnnual[0].date)
    }

    let effectiveTaxRate = 0.21
    if (incomeAnnual && incomeAnnual.length > 0) {
        const taxRates: number[] = []
        for (const annual of incomeAnnual) {
            const taxExpense = annual.incomeTaxExpense
            const preTaxIncome = annual.incomeBeforeTax
            if (
                taxExpense != null && preTaxIncome != null &&
                Number.isFinite(taxExpense) && Number.isFinite(preTaxIncome) &&
                preTaxIncome > 0 && taxExpense >= 0
            ) {
                const rate = taxExpense / preTaxIncome
                if (rate >= 0 && rate <= 0.6) {
                    taxRates.push(rate)
                }
            }
        }
        if (taxRates.length > 0) {
            const avg = taxRates.reduce((sum, rate) => sum + rate, 0) / taxRates.length
            effectiveTaxRate = Math.max(0.05, Math.min(0.45, avg))
        }
    }

    let historicalDAPercent = 0.03
    let historicalCapexPercent = 0.04
    let historicalWCChangePercent = 0.01

    if (cashFlowAnnual && cashFlowAnnual.length > 0 && incomeAnnual && incomeAnnual.length > 0) {
        const latestCF = cashFlowAnnual[0]
        const latestIncome = incomeAnnual[0]
        const annualRevenue = toNum(latestIncome.revenue) * exchangeRate

        if (annualRevenue > 0) {
            const annualDA = toNum(latestCF.depreciationAndAmortization) * exchangeRate
            const annualCapex = Math.abs(toNum(latestCF.capitalExpenditure)) * exchangeRate
            historicalDAPercent = Math.abs(annualDA / annualRevenue)
            historicalCapexPercent = annualCapex / annualRevenue

            if (cashFlowAnnual.length >= 2 && incomeAnnual.length >= 2) {
                const previousRevenue = toNum(incomeAnnual[1].revenue) * exchangeRate
                const revenueChange = annualRevenue - previousRevenue
                const wcChange = -toNum(latestCF.changeInWorkingCapital) * exchangeRate
                if (Math.abs(revenueChange) > 0) {
                    historicalWCChangePercent = Math.max(-0.30, Math.min(0.30, wcChange / revenueChange))
                }
            }
        }
    }

    let totalEquity = 0
    let totalDebt = 0
    let totalCash = 0
    let historicalROIC = 0.12

    if (balanceSheet && balanceSheet.length > 0) {
        totalEquity = toNum(balanceSheet[0].totalStockholdersEquity) * exchangeRate
        totalDebt = toNum(balanceSheet[0].totalDebt) * exchangeRate
        totalCash = toNum(balanceSheet[0].cashAndCashEquivalents) * exchangeRate

        const investedCapital = totalEquity + totalDebt - totalCash
        const nopat = ttmOperatingIncome * (1 - effectiveTaxRate)
        if (investedCapital > 0) {
            const calculatedROIC = nopat / investedCapital
            if (Number.isFinite(calculatedROIC)) {
                historicalROIC = calculatedROIC
            }
        }
    }

    let costOfDebt = 0.06
    const interestExpense = ttmInterestExpense * exchangeRate
    if (totalDebt > 0 && interestExpense > 0) {
        costOfDebt = Math.max(0.02, Math.min(0.12, interestExpense / totalDebt))
    }

    const analystEstimates: AnalystEstimate[] = []
    if (analystData && analystData.length > 0) {
        const sorted = [...analystData].sort((a, b) => toDateMs(a.date) - toDateMs(b.date))
        const filtered = latestAnnualDateMs > 0
            ? sorted.filter(item => toDateMs(item.date) > latestAnnualDateMs)
            : sorted
        const selected = (filtered.length > 0 ? filtered : sorted).slice(0, 5)

        for (let i = 0; i < selected.length; i++) {
            const item = selected[i]
            analystEstimates.push({
                fiscalYear: `FY${i + 1}`,
                epsLow: toNum(item.epsLow) * exchangeRate,
                epsAvg: toNum(item.epsAvg) * exchangeRate,
                epsHigh: toNum(item.epsHigh) * exchangeRate,
                revenueLow: toNum(item.revenueLow) * exchangeRate,
                revenueAvg: toNum(item.revenueAvg) * exchangeRate,
                revenueHigh: toNum(item.revenueHigh) * exchangeRate,
                numAnalysts: toNum(item.numAnalystsEps)
            })
        }
    }

    const ttmEPS = sharesOutstanding > 0 ? ttmNetIncome / sharesOutstanding : 0
    if (analystEstimates.length === 0 && ttmEPS > 0) {
        analystEstimates.push({
            fiscalYear: 'FY1',
            epsLow: ttmEPS * 0.9,
            epsAvg: ttmEPS,
            epsHigh: ttmEPS * 1.1,
            revenueLow: ttmRevenue * 0.95,
            revenueAvg: ttmRevenue,
            revenueHigh: ttmRevenue * 1.05,
            numAnalysts: 0
        })
    }

    const peHistory: number[] = []
    const pfcfHistory: number[] = []
    if (keyMetrics) {
        for (const metric of keyMetrics) {
            const pe = toNum(metric.peRatio)
            if (pe > 0) peHistory.push(pe)

            const pfcf = toNum(metric.priceToFreeCashFlowsRatio)
            if (pfcf > 0) {
                pfcfHistory.push(pfcf)
            } else {
                const fcfYield = toNum(metric.freeCashFlowYield)
                if (fcfYield > 0) {
                    pfcfHistory.push(1 / fcfYield)
                }
            }
        }
    }

    const pegHistory = peHistory.map(pe => pe / 10)

    const currentPrice = toNum(profile.price) * priceExchangeRate
    const marketCap = toNum(profile.marketCap) * priceExchangeRate
    const currentPE = ttmEPS > 0 ? currentPrice / ttmEPS : 0
    const currentPFCF = ttmFCF > 0 ? marketCap / ttmFCF : 0

    let epsGrowth = 0
    if (analystEstimates.length >= 2 && analystEstimates[0].epsAvg > 0) {
        epsGrowth = ((analystEstimates[1].epsAvg / analystEstimates[0].epsAvg) - 1) * 100
    }
    const currentPEG = epsGrowth > 0 ? currentPE / epsGrowth : 0

    return {
        symbol: upperSymbol,
        companyName: profile.companyName,
        currency: profile.currency,
        currentPrice,
        marketCap,
        ttmRevenue,
        ttmGrossProfit,
        ttmOperatingIncome,
        ttmNetIncome,
        ttmEPS,
        ttmFCF,
        grossMargin,
        operatingMargin,
        netMargin,
        sharesOutstanding,
        exchangeRate,
        analystEstimates,
        latestAnnualRevenue,
        latestAnnualNetIncome,
        totalCash,
        totalDebt,
        netCash: totalCash - totalDebt,
        totalEquity,
        beta: toNum(profile.beta) || 1.0,
        costOfDebt,
        historicalDAPercent,
        historicalCapexPercent,
        historicalWCChangePercent,
        historicalROIC,
        pePercentiles: calculatePercentiles(peHistory, 5, 80),
        pegPercentiles: calculatePercentiles(pegHistory, 0.5, 4),
        pfcfPercentiles: calculatePercentiles(pfcfHistory, 5, 60),
        currentPE,
        currentPEG,
        currentPFCF,
        ttmSBC,
        sbcToFCFRatio: ttmFCF > 0 ? ttmSBC / ttmFCF : 0,
        effectiveTaxRate,
        interestExpense,
        sector: profile.sector || '',
        industry: profile.industry || ''
    }
}
