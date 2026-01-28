// ============================================================
// Core Financial Data Types
// ============================================================

/** Base financial data fetched from FMP */
export interface FinancialData {
    symbol: string
    companyName: string
    currency: string
    currentPrice: number
    marketCap: number

    // TTM Fundamentals
    ttmRevenue: number
    ttmGrossProfit: number
    ttmOperatingIncome: number
    ttmNetIncome: number
    ttmEPS: number
    ttmFCF: number

    // Ratios
    grossMargin: number
    operatingMargin: number
    netMargin: number

    // Shares
    sharesOutstanding: number

    // Exchange rate (to USD)
    exchangeRate: number
}

/** Extended financial data with analyst estimates and historical metrics */
export interface ExtendedFinancialData extends FinancialData {
    // Analyst Estimates (FY1-FY3)
    analystEstimates: AnalystEstimate[]

    // Balance Sheet
    totalCash: number
    totalDebt: number
    netCash: number
    totalEquity: number

    // WACC Components (for CAPM calculation)
    beta: number
    costOfDebt: number        // Estimated from interest expense / total debt

    // Historical Ratios (as % of revenue, for DCF drivers)
    historicalDAPercent: number      // D&A / Revenue
    historicalCapexPercent: number   // CapEx / Revenue  
    historicalWCChangePercent: number // WC Change / Revenue Change
    historicalROIC: number           // NOPAT / Invested Capital

    // Historical Percentiles
    pePercentiles: Percentiles
    pegPercentiles: Percentiles
    pfcfPercentiles: Percentiles

    // Derived Metrics
    currentPE: number
    currentPEG: number
    currentPFCF: number

    // SBC
    ttmSBC: number
    sbcToFCFRatio: number
}

/** Analyst estimate for a fiscal year */
export interface AnalystEstimate {
    fiscalYear: string
    epsLow: number
    epsAvg: number
    epsHigh: number
    revenueLow: number
    revenueAvg: number
    revenueHigh: number
    numAnalysts: number
}

/** Percentile statistics */
export interface Percentiles {
    p25: number
    p50: number
    p75: number
    min: number
    max: number
}

// ============================================================
// DCF Model Types
// ============================================================

/** Value driver factors for DCF */
export interface ValueDrivers {
    revenueGrowth: number
    grossMargin: number
    operatingMargin: number
    taxRate: number
    daPercent: number       // D&A as % of revenue
    capexPercent: number    // CapEx as % of revenue
    wcChangePercent: number // Working Capital change as % of revenue
}

/** DCF input parameters */
export interface DCFInputs {
    symbol: string

    // Explicit Period (Years 1-5)
    explicitPeriodYears: number
    drivers: ValueDrivers[]

    // Terminal Value
    terminalMethod: 'perpetuity' | 'roic-driven' | 'fade'
    terminalGrowthRate: number      // g_end: 永续增长率 (长期 GDP 增速)
    steadyStateROIC: number         // ROIC_end: 稳态 ROIC (竞争优势消失后)
    fadeYears: number               // 渐退年数
    fadeStartGrowth: number         // g_start: 渐退期起始增长率
    fadeStartROIC: number           // ROIC_start: 渐退期起始 ROIC

    // Discount Rate
    wacc: number

    // Base Data
    baseRevenue: number
    baseNetIncome: number
}

/** DCF calculation results */
export interface DCFResult {
    enterpriseValue: number
    equityValue: number
    fairValuePerShare: number

    // Breakdown
    explicitPeriodPV: number
    terminalValuePV: number
    terminalValuePercent: number

    // Implied metrics
    impliedPE: number
    impliedPFCF: number

    // Yearly projections
    projections: YearProjection[]
}

/** Yearly projection data */
export interface YearProjection {
    year: number
    revenue: number
    operatingIncome: number
    nopat: number
    fcf: number
    discountFactor: number
    presentValue: number
}

// ============================================================
// Validation Layer Types
// ============================================================

/** Layer A: Near-term prediction */
export interface NearTermPrediction {
    id: string
    symbol: string
    createdAt: Date
    targetQuarter: string // e.g., "2024Q3"

    // Predicted drivers
    predictedDrivers: ValueDrivers

    // Confidence intervals
    confidenceIntervals: {
        revenueGrowth: [number, number]
        operatingMargin: [number, number]
        fcf: [number, number]
    }

    // Actual results (filled after earnings)
    actualDrivers?: ValueDrivers

    // Scoring
    score?: PredictionScore
}

/** Prediction scoring */
export interface PredictionScore {
    absoluteError: number        // Mean Absolute Percentage Error
    rangeCoverage: number        // % of actuals within confidence intervals
    fcfContribution: number      // FCF error contribution
    overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
}

/** Layer B: Structural consistency check */
export interface StructuralCheck {
    // Growth consistency: Growth ≈ Reinvestment Rate × ROIC
    growthConsistency: {
        impliedGrowth: number
        assumedGrowth: number
        deviation: number
        isValid: boolean
    }

    // CapEx/D&A ratio (should approach 1.0 in steady state)
    capexDARatio: {
        current: number
        target: number
        isReasonable: boolean
    }

    // FCF to Net Income bridge
    fcfQuality: {
        fcfToNI: number
        industryRange: [number, number]
        isReasonable: boolean
    }

    // Overall
    hasWarnings: boolean
    warnings: string[]
}

/** Layer C: Market implied assumptions */
export interface MarketImplied {
    // Implied from current price
    impliedGrowthRate: number
    impliedSteadyStateMargin: number
    impliedROIC: number
    impliedFadeSpeed: number

    // Feasibility checks
    feasibility: {
        marginExceedsIndustryMax: boolean
        roicExceedsHistoricalMax: boolean
        growthExceedsHistoricalFrequency: boolean
    }

    // Historical comparison
    historicalFrequency: number // % of companies that achieved this
}

// ============================================================
// Monte Carlo Types
// ============================================================

/** Monte Carlo simulation parameters */
export interface MonteCarloParams {
    iterations: number

    // Driver distributions (mean, stdDev)
    revenueGrowth: [number, number]
    operatingMargin: [number, number]
    wacc: [number, number]
    terminalGrowth: [number, number]
}

/** Monte Carlo simulation results */
export interface MonteCarloResult {
    valueDistribution: number[]

    // Percentiles
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number

    // Statistics
    mean: number
    stdDev: number

    // Current price position
    currentPricePercentile: number
}

// ============================================================
// UI State Types
// ============================================================

/** Main application state */
export interface AppState {
    // Current analysis
    currentSymbol: string | null
    financialData: ExtendedFinancialData | null
    dcfInputs: DCFInputs | null
    dcfResult: DCFResult | null

    // Validation
    structuralCheck: StructuralCheck | null
    marketImplied: MarketImplied | null

    // Monte Carlo
    monteCarloResult: MonteCarloResult | null

    // UI State
    isLoading: boolean
    error: string | null
    activeTab: 'input' | 'validation' | 'monte-carlo' | 'history'
}
