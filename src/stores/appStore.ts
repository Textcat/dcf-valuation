/**
 * Zustand Store for Application State
 */

import { create } from 'zustand'
import type {
    ExtendedFinancialData,
    DCFInputs,
    DCFResult,
    StructuralCheck,
    MarketImplied,
    MonteCarloResult,
    ValueDrivers
} from '@/types'
import { fetchExtendedFinancialData } from '@/services/fmp'
import { calculateDCF } from '@/engines/dcf-engine'
import { runStructuralCheck } from '@/engines/layer-b'
import { calculateMarketImplied } from '@/engines/layer-c'

// ============================================================
// Store Interface
// ============================================================

interface AppStore {
    // Data
    currentSymbol: string | null
    financialData: ExtendedFinancialData | null
    dcfInputs: DCFInputs | null
    dcfResult: DCFResult | null
    structuralCheck: StructuralCheck | null
    marketImplied: MarketImplied | null
    monteCarloResult: MonteCarloResult | null

    // UI State
    isLoading: boolean
    error: string | null
    activeTab: 'input' | 'validation' | 'monte-carlo' | 'history'

    // Actions
    loadSymbol: (symbol: string) => Promise<void>
    setDCFInputs: (inputs: DCFInputs) => void
    runDCF: () => void
    runValidation: () => void
    setActiveTab: (tab: 'input' | 'validation' | 'monte-carlo' | 'history') => void
    clearError: () => void
    reset: () => void
}

// ============================================================
// Default Values
// ============================================================

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
        wacc: 0.10,
        baseRevenue,
        baseNetIncome
    }
}

// ============================================================
// Store Implementation
// ============================================================

export const useAppStore = create<AppStore>((set, get) => ({
    // Initial state
    currentSymbol: null,
    financialData: null,
    dcfInputs: null,
    dcfResult: null,
    structuralCheck: null,
    marketImplied: null,
    monteCarloResult: null,
    isLoading: false,
    error: null,
    activeTab: 'input',

    // Load a new symbol
    loadSymbol: async (symbol: string) => {
        set({ isLoading: true, error: null })

        try {
            const data = await fetchExtendedFinancialData(symbol)

            if (!data) {
                set({
                    isLoading: false,
                    error: `Could not load data for ${symbol}`
                })
                return
            }

            // ============================================================
            // Calculate WACC using CAPM
            // ============================================================
            const riskFreeRate = 0.045  // 10Y Treasury ~4.5%
            const marketRiskPremium = 0.05  // Historical equity premium ~5%
            const costOfEquity = riskFreeRate + data.beta * marketRiskPremium

            // Weight by market value (simplified: assume debt at book value)
            const totalCapital = data.marketCap + data.totalDebt
            const equityWeight = totalCapital > 0 ? data.marketCap / totalCapital : 0.8
            const debtWeight = 1 - equityWeight
            const taxRate = 0.21

            // WACC = E/V × Re + D/V × Rd × (1 - Tc)
            const calculatedWACC = equityWeight * costOfEquity +
                debtWeight * data.costOfDebt * (1 - taxRate)

            // Clamp WACC to reasonable range (6% - 15%)
            const wacc = Math.max(0.06, Math.min(0.15, calculatedWACC))

            // ============================================================
            // Create DCF inputs with data-driven defaults
            // ============================================================
            const dcfInputs = createDefaultDCFInputs(
                symbol,
                data.ttmRevenue,
                data.ttmNetIncome
            )

            // Set calculated WACC
            dcfInputs.wacc = wacc

            // Set steady-state ROIC from historical data
            dcfInputs.steadyStateROIC = data.historicalROIC

            // Pre-fill drivers from actual data
            dcfInputs.drivers.forEach(d => {
                // Margins from current financials
                if (data.grossMargin > 0) d.grossMargin = data.grossMargin
                if (data.operatingMargin > 0) d.operatingMargin = data.operatingMargin

                // Cash flow drivers from historical ratios
                d.daPercent = data.historicalDAPercent
                d.capexPercent = data.historicalCapexPercent
                d.wcChangePercent = data.historicalWCChangePercent
            })

            // Estimate growth from analyst estimates (with fade)
            if (data.analystEstimates.length >= 2) {
                const fy1Rev = data.analystEstimates[0].revenueAvg
                const fy2Rev = data.analystEstimates[1].revenueAvg
                if (fy1Rev > 0 && fy2Rev > 0) {
                    const growth = (fy2Rev / fy1Rev) - 1
                    dcfInputs.drivers[0].revenueGrowth = growth
                    dcfInputs.drivers[1].revenueGrowth = growth * 0.9
                    dcfInputs.drivers[2].revenueGrowth = growth * 0.8
                    dcfInputs.drivers[3].revenueGrowth = growth * 0.7
                    dcfInputs.drivers[4].revenueGrowth = growth * 0.6
                }
            }

            set({
                currentSymbol: symbol.toUpperCase(),
                financialData: data,
                dcfInputs,
                dcfResult: null,
                structuralCheck: null,
                marketImplied: null,
                isLoading: false
            })
        } catch (err) {
            set({
                isLoading: false,
                error: err instanceof Error ? err.message : 'Unknown error'
            })
        }
    },

    // Update DCF inputs
    setDCFInputs: (inputs: DCFInputs) => {
        set({ dcfInputs: inputs, dcfResult: null })
    },

    // Run DCF calculation
    runDCF: () => {
        const { dcfInputs, financialData } = get()
        if (!dcfInputs || !financialData) return

        const result = calculateDCF(dcfInputs, financialData)
        set({ dcfResult: result })
    },

    // Run validation checks
    runValidation: () => {
        const { dcfInputs, dcfResult, financialData } = get()
        if (!dcfInputs || !dcfResult || !financialData) return

        const structuralCheck = runStructuralCheck(dcfInputs, dcfResult, financialData)
        const marketImplied = calculateMarketImplied(financialData, dcfInputs.wacc)

        set({ structuralCheck, marketImplied })
    },

    // Set active tab
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Clear error
    clearError: () => set({ error: null }),

    // Reset store
    reset: () => set({
        currentSymbol: null,
        financialData: null,
        dcfInputs: null,
        dcfResult: null,
        structuralCheck: null,
        marketImplied: null,
        monteCarloResult: null,
        error: null,
        activeTab: 'input'
    })
}))
