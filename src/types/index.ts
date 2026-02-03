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

    // Tax
    effectiveTaxRate: number  // Calculated from incomeTaxExpense / incomeBeforeTax

    // Interest expense (for cost of debt calculation)
    interestExpense: number

    // Industry classification (from FMP profile)
    sector: string      // e.g., "Technology", "Healthcare"
    industry: string    // e.g., "Semiconductors", "Software—Application"
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
    impliedEVtoFCF: number     // EV/FCFF (企业价值/企业自由现金流)

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

    // Growth process (multi-year with mean reversion)
    growth: {
        means: number[]        // Base growth path (per year)
        stdDev: number         // Shock stdDev (absolute)
        min: number            // Floor for sampled growth
        max: number            // Cap for sampled growth
        yearCorrelation: number // AR(1) correlation across years
        meanReversion: number  // Reversion strength toward base path (0-1)
    }

    // Driver distributions
    operatingMargin: {
        means: number[]       // Base margin path (per year)
        stdDev: number        // Shock stdDev (absolute)
        min: number           // Floor for sampled margin
        max: number           // Cap for sampled margin
        yearCorrelation: number // AR(1) correlation across years
        meanReversion: number  // Reversion strength toward base path (0-1)
    }
    wacc: {
        mean: number
        stdDev: number
        min: number
        max: number
        distribution: 'normal' | 'lognormal'
    }
    terminalGrowth: {
        mean: number
        stdDev: number
        min: number
        max: number
    }

    // Correlation assumptions (applies to growth/margin/wacc/terminalGrowth)
    correlation: {
        variables: ('growth' | 'margin' | 'wacc' | 'terminalGrowth')[]
        matrix: number[][]
    }

    // Terminal model parameters and constraints
    terminalModel: {
        minWaccSpread: number // Enforce WACC - g >= minWaccSpread
        roicDriven: {
            steadyStateROIC: {
                mean: number
                stdDev: number
                min: number
                max: number
            }
            maxReinvestmentRate: number
        }
        fade: {
            fadeYears: {
                mean: number
                stdDev: number
                min: number
                max: number
            }
            fadeStartGrowth: {
                mean: number
                stdDev: number
                min: number
                max: number
            }
            fadeStartROIC: {
                mean: number
                stdDev: number
                min: number
                max: number
            }
        }
    }
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
// Valuation Snapshot Types
// ============================================================

/** Key parameters saved in a valuation snapshot (Year 1 drivers) - DEPRECATED */
export interface SnapshotInputParams {
    wacc: number
    explicitPeriodYears: number
    terminalGrowthRate: number
    steadyStateROIC: number
    fadeYears: number
    fadeStartGrowth: number
    fadeStartROIC: number
    // Year 1 drivers
    year1RevenueGrowth: number
    year1OperatingMargin: number
    year1TaxRate: number
    year1DAPercent: number
    year1CapexPercent: number
    year1WCChangePercent: number
}

/** Complete inputs saved in a valuation snapshot (new format) */
export interface SnapshotFullInputs {
    dcfInputs: DCFInputs                   // All 5 years' drivers + terminal settings
    financialData: ExtendedFinancialData   // Market data at snapshot time
}

/** Valuation snapshot stored in IndexedDB */
export interface ValuationSnapshot {
    id: string
    symbol: string
    companyName: string
    createdAt: Date
    currentPrice: number
    // Complete inputs (new format)
    fullInputs?: SnapshotFullInputs
    // Key input parameters (deprecated, kept for backward compatibility)
    inputParams?: SnapshotInputParams
    // Fair value from each terminal value method
    perpetuityFairValue: number
    roicDrivenFairValue: number
    fadeFairValue: number
    // Optional note
    note?: string
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
