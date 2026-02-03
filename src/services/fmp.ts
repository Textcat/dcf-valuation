/**
 * FMP API Service
 * 
 * Fetches financial data from Financial Modeling Prep API.
 * Updated for the new /stable API format (post-August 2025).
 */

import type { FinancialData, ExtendedFinancialData, AnalystEstimate, Percentiles } from '@/types'

const FMP_API_KEY = 'mtAUFJCshqKGHEdg0CzD1kYlPooTtTwd'
// New stable API uses query params instead of path params
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

// ============================================================
// Helper Functions
// ============================================================

/** Convert value to number, defaulting to 0 for invalid values */
function toNum(val: unknown): number {
    if (typeof val === 'number' && !isNaN(val)) return val
    if (typeof val === 'string') {
        const parsed = parseFloat(val)
        if (!isNaN(parsed)) return parsed
    }
    return 0
}

/** Build URL with query parameters */
function buildUrl(endpoint: string, params: Record<string, string | number>): string {
    const url = new URL(`${FMP_BASE_URL}/${endpoint}`)
    url.searchParams.set('apikey', FMP_API_KEY)
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value))
    }
    return url.toString()
}

/** Fetch and validate JSON response */
async function fetchAndValidate<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) {
            console.warn(`FMP API error: ${res.status} for ${url}`)
            return null
        }
        const data = await res.json()

        // Check for FMP error messages
        if (data && typeof data === 'object' && 'Error Message' in data) {
            console.warn(`FMP API error: ${data['Error Message']}`)
            return null
        }

        return data as T
    } catch (err) {
        console.error(`Fetch error for ${url}:`, err)
        return null
    }
}

/** Calculate percentiles from an array of numbers */
function calculatePercentiles(values: number[], clampMin: number, clampMax: number): Percentiles {
    const filtered = values
        .filter(v => v > 0 && isFinite(v))
        .map(v => Math.min(Math.max(v, clampMin), clampMax))
        .sort((a, b) => a - b)

    if (filtered.length === 0) {
        return { p25: 0, p50: 0, p75: 0, min: 0, max: 0 }
    }

    const getPercentile = (arr: number[], p: number) => {
        const idx = Math.floor(arr.length * p)
        return arr[Math.min(idx, arr.length - 1)]
    }

    return {
        p25: getPercentile(filtered, 0.25),
        p50: getPercentile(filtered, 0.50),
        p75: getPercentile(filtered, 0.75),
        min: filtered[0],
        max: filtered[filtered.length - 1]
    }
}

// ============================================================
// API Types (FMP Response Shapes - New Format)
// ============================================================

interface FMPProfile {
    symbol: string
    companyName: string
    price: number
    marketCap: number
    currency: string
    exchange: string
    beta: number
    country: string  // For matching with market risk premium
    sector: string   // For industry benchmarks (e.g., "Technology")
    industry: string // For industry benchmarks (e.g., "Semiconductors")
}

interface FMPIncomeStatement {
    date: string
    symbol: string
    reportedCurrency: string   // 财报实际使用的货币（可能与 profile.currency 不同）
    revenue: number
    grossProfit: number
    operatingIncome: number
    netIncome: number
    eps: number
    weightedAverageShsOutDil: number
    // Tax fields for effective tax rate calculation
    incomeTaxExpense: number
    incomeBeforeTax: number
    // Interest expense for cost of debt calculation
    interestExpense: number
}

interface FMPCashFlowStatement {
    date: string
    symbol: string
    operatingCashFlow: number
    capitalExpenditure: number
    freeCashFlow: number
    depreciationAndAmortization: number
    changeInWorkingCapital: number
    stockBasedCompensation: number
    // 经营性 WC 分项 (用于计算精确的经营性净营运资本变动)
    changeInAccountReceivables: number
    changeInInventory: number
    changeInAccountPayables: number
    changeInOtherWorkingCapital: number
}

interface FMPBalanceSheet {
    date: string
    symbol: string
    totalStockholdersEquity: number
    totalDebt: number
    cashAndCashEquivalents: number
    totalAssets: number
    totalLiabilities: number
}

interface FMPAnalystEstimate {
    date: string
    symbol: string
    // New API field names (different from legacy)
    revenueAvg: number
    revenueLow: number
    revenueHigh: number
    epsAvg: number
    epsLow: number
    epsHigh: number
    numAnalystsEps: number
    numAnalystsRevenue: number
}

interface FMPKeyMetrics {
    date: string
    symbol: string
    peRatio: number
    pegRatio: number
    priceToFreeCashFlowsRatio: number
    earningsYield: number
    freeCashFlowYield: number
}

interface FMPSearchResult {
    symbol: string
    name: string
    currency: string
    exchange: string
}

// WACC-related API types
interface FMPTreasuryRate {
    date: string
    month1: number
    month2: number
    month3: number
    month6: number
    year1: number
    year2: number
    year3: number
    year5: number
    year7: number
    year10: number  // 10Y Treasury - used as risk-free rate
    year20: number
    year30: number
}

interface FMPMarketRiskPremium {
    country: string
    continent: string
    countryRiskPremium: number
    totalEquityRiskPremium: number  // This is Rf + MRP for that country
}


// ============================================================
// Exchange Rate Fetching
// ============================================================

async function fetchExchangeRate(currency: string): Promise<number> {
    if (currency === 'USD') return 1

    // Use free exchangerate-api.com as primary source
    // Returns: 1 unit of source currency = X USD
    try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`)
        if (res.ok) {
            const data = await res.json()
            if (data.rates && data.rates[currency]) {
                // The API gives USD base, so 1 USD = X currency
                // We need: 1 currency = Y USD, so Y = 1 / X
                return 1 / data.rates[currency]
            }
        }
    } catch (err) {
        console.warn(`Failed to fetch exchange rate from exchangerate-api:`, err)
    }

    // Fallback: common currency hardcoded rates (approximate)
    const fallbackRates: Record<string, number> = {
        'TWD': 0.032,   // 1 TWD ≈ 0.032 USD
        'EUR': 1.08,    // 1 EUR ≈ 1.08 USD
        'GBP': 1.27,    // 1 GBP ≈ 1.27 USD
        'JPY': 0.0067,  // 1 JPY ≈ 0.0067 USD
        'CNY': 0.14,    // 1 CNY ≈ 0.14 USD
        'HKD': 0.128,   // 1 HKD ≈ 0.128 USD
        'KRW': 0.00075, // 1 KRW ≈ 0.00075 USD
        'INR': 0.012,   // 1 INR ≈ 0.012 USD
        'AUD': 0.65,    // 1 AUD ≈ 0.65 USD
        'CAD': 0.74,    // 1 CAD ≈ 0.74 USD
        'CHF': 1.13,    // 1 CHF ≈ 1.13 USD
        'SGD': 0.75,    // 1 SGD ≈ 0.75 USD
    }

    if (fallbackRates[currency]) {
        console.log(`Using fallback exchange rate for ${currency}: ${fallbackRates[currency]}`)
        return fallbackRates[currency]
    }

    console.warn(`Unknown currency ${currency}, using 1 (may cause incorrect display)`)
    return 1
}

// ============================================================
// Main API Functions
// ============================================================

/** Search for stocks by query (uses search-name for company names) */
export async function searchStocks(query: string): Promise<{ symbol: string; name: string }[]> {
    if (!query || query.length < 1) return []

    const url = buildUrl('search-name', { query, limit: 10 })
    const data = await fetchAndValidate<FMPSearchResult[]>(url)

    if (!data) return []

    return data.map(item => ({
        symbol: item.symbol,
        name: item.name
    }))
}

/** Fetch basic financial data for a symbol */
export async function fetchFinancialData(symbol: string): Promise<FinancialData | null> {
    const upperSymbol = symbol.toUpperCase()

    // Fetch profile (new format uses query param)
    const profileUrl = buildUrl('profile', { symbol: upperSymbol })
    const profileData = await fetchAndValidate<FMPProfile[]>(profileUrl)

    if (!profileData || profileData.length === 0) {
        console.error(`No profile data for ${upperSymbol}`)
        return null
    }

    const profile = profileData[0]

    // Fetch exchange rate for non-USD stocks
    const exchangeRate = await fetchExchangeRate(profile.currency)

    // Fetch quarterly income statements (4 quarters for TTM)
    const incomeUrl = buildUrl('income-statement', {
        symbol: upperSymbol,
        period: 'quarter',
        limit: 4
    })
    const incomeData = await fetchAndValidate<FMPIncomeStatement[]>(incomeUrl)

    // Fetch quarterly cash flow statements
    const cashFlowUrl = buildUrl('cash-flow-statement', {
        symbol: upperSymbol,
        period: 'quarter',
        limit: 4
    })
    const cashFlowData = await fetchAndValidate<FMPCashFlowStatement[]>(cashFlowUrl)

    // Calculate TTM values
    let ttmRevenue = 0, ttmGrossProfit = 0, ttmOperatingIncome = 0, ttmNetIncome = 0, ttmFCF = 0
    let sharesOutstanding = 0

    if (incomeData && incomeData.length > 0) {
        for (const q of incomeData) {
            ttmRevenue += toNum(q.revenue)
            ttmGrossProfit += toNum(q.grossProfit)
            ttmOperatingIncome += toNum(q.operatingIncome)
            ttmNetIncome += toNum(q.netIncome)
        }
        sharesOutstanding = toNum(incomeData[0].weightedAverageShsOutDil)
    }

    if (cashFlowData && cashFlowData.length > 0) {
        for (const q of cashFlowData) {
            ttmFCF += toNum(q.freeCashFlow)
        }
    }

    // Apply exchange rate conversion
    ttmRevenue *= exchangeRate
    ttmGrossProfit *= exchangeRate
    ttmOperatingIncome *= exchangeRate
    ttmNetIncome *= exchangeRate
    ttmFCF *= exchangeRate

    // Calculate ratios
    const grossMargin = ttmRevenue > 0 ? ttmGrossProfit / ttmRevenue : 0
    const operatingMargin = ttmRevenue > 0 ? ttmOperatingIncome / ttmRevenue : 0
    const netMargin = ttmRevenue > 0 ? ttmNetIncome / ttmRevenue : 0

    return {
        symbol: upperSymbol,
        companyName: profile.companyName,
        currency: profile.currency,
        currentPrice: toNum(profile.price) * exchangeRate,
        marketCap: toNum(profile.marketCap) * exchangeRate,
        ttmRevenue,
        ttmGrossProfit,
        ttmOperatingIncome,
        ttmNetIncome,
        ttmEPS: sharesOutstanding > 0 ? ttmNetIncome / sharesOutstanding : 0,
        ttmFCF,
        grossMargin,
        operatingMargin,
        netMargin,
        sharesOutstanding,
        exchangeRate
    }
}

/** Fetch extended financial data with analyst estimates and historical metrics */
export async function fetchExtendedFinancialData(symbol: string): Promise<ExtendedFinancialData | null> {
    const upperSymbol = symbol.toUpperCase()

    // Fetch profile first to get beta
    const profileUrl = buildUrl('profile', { symbol: upperSymbol })
    const profileData = await fetchAndValidate<FMPProfile[]>(profileUrl)

    if (!profileData || profileData.length === 0) {
        console.error(`No profile data for ${upperSymbol}`)
        return null
    }

    const profile = profileData[0]
    const beta = toNum(profile.beta) || 1.0 // Default beta = 1 if not available

    // Parallel fetch all data
    const [
        incomeQuarterlyData,
        incomeAnnualData,
        cashFlowQuarterlyData,
        cashFlowAnnualData,
        balanceData,
        analystData,
        keyMetricsData
    ] = await Promise.all([
        // Quarterly for TTM
        fetchAndValidate<FMPIncomeStatement[]>(
            buildUrl('income-statement', { symbol: upperSymbol, period: 'quarter', limit: 4 })
        ),
        // Annual for historical ratios
        fetchAndValidate<FMPIncomeStatement[]>(
            buildUrl('income-statement', { symbol: upperSymbol, period: 'annual', limit: 3 })
        ),
        // Quarterly cash flow for TTM
        fetchAndValidate<FMPCashFlowStatement[]>(
            buildUrl('cash-flow-statement', { symbol: upperSymbol, period: 'quarter', limit: 4 })
        ),
        // Annual cash flow for historical ratios
        fetchAndValidate<FMPCashFlowStatement[]>(
            buildUrl('cash-flow-statement', { symbol: upperSymbol, period: 'annual', limit: 3 })
        ),
        fetchAndValidate<FMPBalanceSheet[]>(
            buildUrl('balance-sheet-statement', { symbol: upperSymbol, limit: 1 })
        ),
        fetchAndValidate<FMPAnalystEstimate[]>(
            buildUrl('analyst-estimates', { symbol: upperSymbol, period: 'annual', limit: 5 })
        ),
        fetchAndValidate<FMPKeyMetrics[]>(
            buildUrl('key-metrics', { symbol: upperSymbol, limit: 5 })
        )
    ])

    // Calculate TTM values from quarterly data
    let ttmRevenue = 0, ttmGrossProfit = 0, ttmOperatingIncome = 0, ttmNetIncome = 0
    let ttmFCF = 0, ttmDA = 0, ttmCapex = 0, ttmWCChange = 0, ttmSBC = 0
    let ttmInterestExpense = 0
    let sharesOutstanding = 0

    if (incomeQuarterlyData && incomeQuarterlyData.length > 0) {
        for (const q of incomeQuarterlyData) {
            ttmRevenue += toNum(q.revenue)
            ttmGrossProfit += toNum(q.grossProfit)
            ttmOperatingIncome += toNum(q.operatingIncome)
            ttmNetIncome += toNum(q.netIncome)
            ttmInterestExpense += toNum(q.interestExpense)
        }
        sharesOutstanding = toNum(incomeQuarterlyData[0].weightedAverageShsOutDil)
    }

    if (cashFlowQuarterlyData && cashFlowQuarterlyData.length > 0) {
        for (const q of cashFlowQuarterlyData) {
            ttmFCF += toNum(q.freeCashFlow)
            ttmDA += toNum(q.depreciationAndAmortization)
            ttmCapex += Math.abs(toNum(q.capitalExpenditure)) // CapEx is negative in CF
            ttmWCChange += toNum(q.changeInWorkingCapital)
            ttmSBC += toNum(q.stockBasedCompensation)
        }
    }

    // 使用财报的 reportedCurrency 获取汇率（而非 profile.currency）
    // 这修复了 ADR 股票（如 TSM）的货币单位不一致问题：
    // - profile.currency = "USD" (ADR 交易货币)
    // - reportedCurrency = "TWD" (财报实际货币)
    const reportedCurrency = incomeQuarterlyData?.[0]?.reportedCurrency || profile.currency
    const exchangeRate = await fetchExchangeRate(reportedCurrency)

    // Apply exchange rate
    ttmRevenue *= exchangeRate
    ttmGrossProfit *= exchangeRate
    ttmOperatingIncome *= exchangeRate
    ttmNetIncome *= exchangeRate
    ttmFCF *= exchangeRate
    ttmDA *= exchangeRate
    ttmCapex *= exchangeRate
    ttmWCChange *= exchangeRate
    ttmSBC *= exchangeRate

    // Calculate margins
    const grossMargin = ttmRevenue > 0 ? ttmGrossProfit / ttmRevenue : 0
    const operatingMargin = ttmRevenue > 0 ? ttmOperatingIncome / ttmRevenue : 0
    const netMargin = ttmRevenue > 0 ? ttmNetIncome / ttmRevenue : 0

    // ============================================================
    // Calculate Effective Tax Rate (from annual data)
    // ============================================================

    let effectiveTaxRate = 0.21 // Default to US corporate rate
    if (incomeAnnualData && incomeAnnualData.length > 0) {
        const taxRates: number[] = []
        for (const yr of incomeAnnualData) {
            // Check raw values first - treat null/undefined/NaN as invalid data
            // (toNum would convert these to 0, creating a false 0% tax rate)
            const rawTaxExpense = yr.incomeTaxExpense
            const rawPreTaxIncome = yr.incomeBeforeTax

            // Skip if either value is missing or not a finite number
            if (rawTaxExpense == null || rawPreTaxIncome == null ||
                typeof rawTaxExpense !== 'number' || typeof rawPreTaxIncome !== 'number' ||
                !isFinite(rawTaxExpense) || !isFinite(rawPreTaxIncome)) {
                continue
            }

            const taxExpense = rawTaxExpense
            const preTaxIncome = rawPreTaxIncome

            // Only include if pre-tax income is positive and tax expense is non-negative
            if (preTaxIncome > 0 && taxExpense >= 0) {
                const rate = taxExpense / preTaxIncome
                // Sanity check: tax rate should be between 0% and 60%
                if (rate >= 0 && rate <= 0.60) {
                    taxRates.push(rate)
                }
            }
        }
        if (taxRates.length > 0) {
            // Average of valid tax rates
            const avgRate = taxRates.reduce((sum, r) => sum + r, 0) / taxRates.length
            // Clamp to reasonable range: 5% - 45%
            effectiveTaxRate = Math.max(0.05, Math.min(0.45, avgRate))
        }
    }

    // ============================================================
    // Calculate Historical Ratios (from annual data)
    // ============================================================

    let historicalDAPercent = 0.03       // Default 3%
    let historicalCapexPercent = 0.04    // Default 4%
    let historicalWCChangePercent = 0.01 // Default 1%
    let historicalROIC = 0.12            // Default 12%

    if (cashFlowAnnualData && cashFlowAnnualData.length > 0 && incomeAnnualData && incomeAnnualData.length > 0) {
        // Use most recent annual data for ratios
        const latestCF = cashFlowAnnualData[0]
        const latestIncome = incomeAnnualData[0]
        const annualRevenue = toNum(latestIncome.revenue) * exchangeRate

        if (annualRevenue > 0) {
            // D&A as % of Revenue
            const annualDA = toNum(latestCF.depreciationAndAmortization) * exchangeRate
            historicalDAPercent = Math.abs(annualDA / annualRevenue)

            // CapEx as % of Revenue
            const annualCapex = Math.abs(toNum(latestCF.capitalExpenditure)) * exchangeRate
            historicalCapexPercent = annualCapex / annualRevenue

            // WC Change as % of Revenue Change (ΔWC / ΔRevenue)
            // 注意: FMP Stable API 不再提供分项数据 (changeInAccountReceivables 等都是 null)
            // 直接使用汇总的 changeInWorkingCapital
            if (cashFlowAnnualData.length >= 2 && incomeAnnualData.length >= 2) {
                const prevRevenue = toNum(incomeAnnualData[1].revenue) * exchangeRate
                const revenueChange = annualRevenue - prevRevenue

                // 取反：现金流量表符号 → DCF 符号
                // changeInWorkingCapital < 0 (WC增加/现金流出) → wcChange > 0 (减少FCF)
                // changeInWorkingCapital > 0 (WC减少/现金流入) → wcChange < 0 (增加FCF)
                const wcChange = -toNum(latestCF.changeInWorkingCapital) * exchangeRate

                if (Math.abs(revenueChange) > 0) {
                    historicalWCChangePercent = wcChange / revenueChange
                    // Clamp to reasonable range
                    historicalWCChangePercent = Math.max(-0.30, Math.min(0.30, historicalWCChangePercent))
                }
            }
        }
    }

    // Calculate ROIC from balance sheet and income
    let totalEquity = 0
    let totalDebt = 0
    let totalCash = 0

    if (balanceData && balanceData.length > 0) {
        totalEquity = toNum(balanceData[0].totalStockholdersEquity) * exchangeRate
        totalDebt = toNum(balanceData[0].totalDebt) * exchangeRate
        totalCash = toNum(balanceData[0].cashAndCashEquivalents) * exchangeRate

        // ROIC = NOPAT / Invested Capital
        // Invested Capital = Total Equity + Total Debt - Cash
        const investedCapital = totalEquity + totalDebt - totalCash
        // Use calculated effective tax rate instead of hardcoded 21%
        const nopat = ttmOperatingIncome * (1 - effectiveTaxRate)

        if (investedCapital > 0) {
            // Keep raw ROIC for analysis; surface extremes via UI/validation warnings
            historicalROIC = nopat / investedCapital
            if (!isFinite(historicalROIC)) {
                historicalROIC = 0
            }
        }
    }

    // Calculate cost of debt from interest expense / total debt
    // TTM interest expense was calculated earlier, now apply exchange rate
    const ttmInterestExpenseConverted = ttmInterestExpense * exchangeRate
    let costOfDebt = 0.06  // Default fallback
    if (totalDebt > 0 && ttmInterestExpenseConverted > 0) {
        costOfDebt = ttmInterestExpenseConverted / totalDebt
        // Clamp to reasonable range (2% - 12%)
        costOfDebt = Math.max(0.02, Math.min(0.12, costOfDebt))
    }

    // ============================================================
    // Process Analyst Estimates
    // ============================================================

    const analystEstimates: AnalystEstimate[] = []
    if (analystData && analystData.length > 0) {
        const reversed = [...analystData].reverse()
        for (let i = 0; i < Math.min(3, reversed.length); i++) {
            const est = reversed[i]
            analystEstimates.push({
                fiscalYear: `FY${i + 1}`,
                epsLow: toNum(est.epsLow) * exchangeRate,
                epsAvg: toNum(est.epsAvg) * exchangeRate,
                epsHigh: toNum(est.epsHigh) * exchangeRate,
                revenueLow: toNum(est.revenueLow) * exchangeRate,
                revenueAvg: toNum(est.revenueAvg) * exchangeRate,
                revenueHigh: toNum(est.revenueHigh) * exchangeRate,
                numAnalysts: toNum(est.numAnalystsEps)
            })
        }
    }

    // Synthetic estimates if no analyst coverage
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

    // ============================================================
    // Historical Valuation Percentiles
    // ============================================================

    const peHistory: number[] = []
    const pfcfHistory: number[] = []
    if (keyMetricsData) {
        for (const k of keyMetricsData) {
            const pe = toNum(k.peRatio)
            if (pe > 0) peHistory.push(pe)

            const pfcf = toNum(k.priceToFreeCashFlowsRatio)
            if (pfcf > 0) {
                pfcfHistory.push(pfcf)
            } else {
                const fcfYield = toNum(k.freeCashFlowYield)
                if (fcfYield > 0) {
                    pfcfHistory.push(1 / fcfYield)
                }
            }
        }
    }

    const pegHistory = peHistory.map(pe => pe / 10)

    // 股价和市值使用交易货币的汇率（对于 ADR 如 TSM，profile.currency = USD）
    // 这与财报货币（reportedCurrency = TWD）不同
    const priceExchangeRate = await fetchExchangeRate(profile.currency)
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

        // Extended data
        analystEstimates,
        totalCash,
        totalDebt,
        netCash: totalCash - totalDebt,
        totalEquity,

        // WACC components
        beta,
        costOfDebt,

        // Historical ratios for DCF drivers
        historicalDAPercent,
        historicalCapexPercent,
        historicalWCChangePercent,
        historicalROIC,

        // Valuation percentiles
        pePercentiles: calculatePercentiles(peHistory, 5, 80),
        pegPercentiles: calculatePercentiles(pegHistory, 0.5, 4),
        pfcfPercentiles: calculatePercentiles(pfcfHistory, 5, 60),
        currentPE,
        currentPEG,
        currentPFCF,

        // SBC
        ttmSBC,
        sbcToFCFRatio: ttmFCF > 0 ? ttmSBC / ttmFCF : 0,

        // Tax
        effectiveTaxRate,

        // Interest expense (for cost of debt)
        interestExpense: ttmInterestExpense * exchangeRate,

        // Industry classification
        sector: profile.sector || '',
        industry: profile.industry || ''
    }
}

// ============================================================
// WACC Inputs Fetching (Real-time Rf, MRP, Country Risk)
// ============================================================

export interface WACCInputs {
    riskFreeRate: number           // 10Y Treasury yield (decimal, e.g., 0.0426)
    marketRiskPremium: number      // Equity risk premium (decimal, e.g., 0.05)
    countryRiskPremium: number     // Additional premium for non-US (decimal)
}

// Cache for WACC inputs (refreshes every hour)
let waccCache: { data: WACCInputs; timestamp: number } | null = null
let mrpByCountryCache: Map<string, FMPMarketRiskPremium> | null = null
let mrpCacheTimestamp = 0
const WACC_CACHE_DURATION_MS = 60 * 60 * 1000  // 1 hour

/**
 * Fetch WACC inputs from FMP API
 * - Risk-free rate from 10Y Treasury
 * - Market risk premium from FMP Market Risk Premium API
 */
export async function fetchWACCInputs(): Promise<WACCInputs> {
    const now = Date.now()

    // Return cached data if still valid
    if (waccCache && (now - waccCache.timestamp) < WACC_CACHE_DURATION_MS) {
        return waccCache.data
    }

    // Default fallback values
    const defaults: WACCInputs = {
        riskFreeRate: 0.045,       // 4.5%
        marketRiskPremium: 0.05,   // 5%
        countryRiskPremium: 0
    }

    try {
        // Fetch 10Y Treasury rate
        const treasuryUrl = buildUrl('treasury-rates', { limit: 1 })
        const treasuryData = await fetchAndValidate<FMPTreasuryRate[]>(treasuryUrl)

        let riskFreeRate = defaults.riskFreeRate
        if (treasuryData && treasuryData.length > 0) {
            // API returns percentage (e.g., 4.26), convert to decimal (0.0426)
            riskFreeRate = toNum(treasuryData[0].year10) / 100
            // Sanity check
            if (riskFreeRate < 0.001 || riskFreeRate > 0.15) {
                riskFreeRate = defaults.riskFreeRate
            }
        }

        // Fetch Market Risk Premium data
        await fetchAndCacheMRPData()

        // Get US market risk premium (base case)
        let marketRiskPremium = defaults.marketRiskPremium
        if (mrpByCountryCache) {
            const usData = mrpByCountryCache.get('United States')
            if (usData) {
                // totalEquityRiskPremium includes country risk, so for US it's pure ERP
                // We use this directly as the market risk premium
                marketRiskPremium = toNum(usData.totalEquityRiskPremium) / 100
                if (marketRiskPremium < 0.02 || marketRiskPremium > 0.12) {
                    marketRiskPremium = defaults.marketRiskPremium
                }
            }
        }

        const result: WACCInputs = {
            riskFreeRate,
            marketRiskPremium,
            countryRiskPremium: 0  // Base case for US
        }

        waccCache = { data: result, timestamp: now }
        return result

    } catch (err) {
        console.error('Failed to fetch WACC inputs:', err)
        return defaults
    }
}

/**
 * Get country risk premium for a specific country
 */
export async function getCountryRiskPremium(country: string): Promise<number> {
    await fetchAndCacheMRPData()

    if (!mrpByCountryCache) return 0

    const countryData = mrpByCountryCache.get(country)
    if (!countryData) return 0

    // Country risk premium is the additional premium over US
    const crp = toNum(countryData.countryRiskPremium) / 100
    return Math.max(0, Math.min(0.20, crp))  // Clamp to 0-20%
}

/**
 * Fetch and cache Market Risk Premium data by country
 */
async function fetchAndCacheMRPData(): Promise<void> {
    const now = Date.now()

    if (mrpByCountryCache && (now - mrpCacheTimestamp) < WACC_CACHE_DURATION_MS) {
        return
    }

    try {
        const mrpUrl = buildUrl('market-risk-premium', {})
        const mrpData = await fetchAndValidate<FMPMarketRiskPremium[]>(mrpUrl)

        if (mrpData && mrpData.length > 0) {
            mrpByCountryCache = new Map()
            for (const item of mrpData) {
                mrpByCountryCache.set(item.country, item)
            }
            mrpCacheTimestamp = now
        }
    } catch (err) {
        console.error('Failed to fetch market risk premium data:', err)
    }
}

/**
 * Calculate cost of debt from interest expense and total debt
 */
export function calculateCostOfDebt(interestExpense: number, totalDebt: number): number {
    if (totalDebt <= 0 || interestExpense < 0) {
        return 0.06  // Default 6% if can't calculate
    }

    const costOfDebt = interestExpense / totalDebt

    // Sanity check: cost of debt typically between 2% and 15%
    if (costOfDebt < 0.02) return 0.04  // Floor at 4%
    if (costOfDebt > 0.15) return 0.10  // Cap at 10%

    return costOfDebt
}
