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
    ValueDrivers,
    NearTermPrediction
} from '@/types'
import { fetchExtendedFinancialData } from '@/services/fmp'
import { calculateDCF } from '@/engines/dcf-engine'
import { runStructuralCheck } from '@/engines/layer-b'
import { calculateMarketImplied } from '@/engines/layer-c'
import {
    savePrediction,
    getRecentPredictions,
    getPredictionsBySymbol
} from '@/services/predictionStore'

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

    // Prediction History
    predictions: NearTermPrediction[]
    isLoadingPredictions: boolean

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

    // Prediction Actions
    loadPredictions: () => Promise<void>
    loadPredictionsForSymbol: (symbol: string) => Promise<void>
    createPrediction: (targetQuarter: string) => Promise<string | null>
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
        terminalGrowthRate: 0.03,        // g_end: 永续增长率
        steadyStateROIC: 0.12,           // ROIC_end: 稳态 ROIC
        fadeYears: 10,
        fadeStartGrowth: 0.10,           // g_start: 渐退期起始增长率 (将被实际数据覆盖)
        fadeStartROIC: 0.20,             // ROIC_start: 渐退期起始 ROIC (将被实际数据覆盖)
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
    predictions: [],
    isLoadingPredictions: false,
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

                    // Fade Model: 起始增长率 = 显式期最后一年增长率
                    dcfInputs.fadeStartGrowth = growth * 0.6
                }
            }

            // Fade Model: 起始 ROIC = 历史 ROIC（当前竞争优势水平）
            dcfInputs.fadeStartROIC = data.historicalROIC

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
        predictions: [],
        isLoadingPredictions: false,
        error: null,
        activeTab: 'input'
    }),

    // Load recent predictions (all symbols)
    loadPredictions: async () => {
        set({ isLoadingPredictions: true })
        try {
            const predictions = await getRecentPredictions(50)
            set({ predictions, isLoadingPredictions: false })
        } catch (err) {
            console.error('Failed to load predictions:', err)
            set({ isLoadingPredictions: false })
        }
    },

    // Load predictions for current symbol
    loadPredictionsForSymbol: async (symbol: string) => {
        set({ isLoadingPredictions: true })
        try {
            const predictions = await getPredictionsBySymbol(symbol)
            set({ predictions, isLoadingPredictions: false })
        } catch (err) {
            console.error('Failed to load predictions for symbol:', err)
            set({ isLoadingPredictions: false })
        }
    },

    // Create a new prediction from current DCF inputs
    createPrediction: async (targetQuarter: string) => {
        const { dcfInputs, currentSymbol } = get()
        if (!dcfInputs || !currentSymbol) return null

        // 使用第一年的 drivers 作为预测驱动因子
        const predictedDrivers = dcfInputs.drivers[0]

        const prediction: Omit<import('@/types').NearTermPrediction, 'id'> = {
            symbol: currentSymbol,
            createdAt: new Date(),
            targetQuarter,
            predictedDrivers,
            confidenceIntervals: {
                revenueGrowth: [
                    predictedDrivers.revenueGrowth * 0.8,
                    predictedDrivers.revenueGrowth * 1.2
                ],
                operatingMargin: [
                    predictedDrivers.operatingMargin * 0.9,
                    predictedDrivers.operatingMargin * 1.1
                ],
                fcf: [0, 0] // 需要单独计算
            }
        }

        try {
            const id = await savePrediction(prediction)
            // 重新加载预测列表
            const predictions = await getPredictionsBySymbol(currentSymbol)
            set({ predictions })
            return id
        } catch (err) {
            console.error('Failed to save prediction:', err)
            return null
        }
    }
}))
