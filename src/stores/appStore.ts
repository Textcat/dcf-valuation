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
    MonteCarloParams,
    ValueDrivers,
    NearTermPrediction,
    ValuationSnapshot
} from '@/types'
import { fetchExtendedFinancialData, fetchWACCInputs, calculateCostOfDebt } from '@/services/fmp'
import { calculateDCF } from '@/engines/dcf-engine'
import { runStructuralCheck } from '@/engines/layer-b'
import { calculateMarketImplied } from '@/engines/layer-c'
import {
    savePrediction,
    getRecentPredictions,
    getPredictionsBySymbol
} from '@/services/predictionStore'
import {
    saveSnapshot,
    getSnapshotsBySymbol,
    getRecentSnapshots,
    deleteSnapshot as deleteSnapshotFromDb
} from '@/services/snapshotStore'
import { createDefaultMonteCarloParams, runMonteCarloSimulation } from '@/engines/monte-carlo'
import type { MonteCarloWorkerInput, MonteCarloWorkerOutput } from '@/engines/monte-carlo.worker'

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

    // Snapshot History
    snapshots: ValuationSnapshot[]
    isLoadingSnapshots: boolean

    // UI State
    isLoading: boolean
    error: string | null
    activeTab: 'input' | 'validation' | 'monte-carlo' | 'history'

    // Monte Carlo State
    monteCarloParams: MonteCarloParams | null
    isRunningMonteCarlo: boolean
    monteCarloRunId: string | null

    // Actions
    loadSymbol: (symbol: string) => Promise<void>
    setDCFInputs: (inputs: DCFInputs) => void
    runDCF: () => void
    runValidation: () => void
    setActiveTab: (tab: 'input' | 'validation' | 'monte-carlo' | 'history') => void
    clearError: () => void
    reset: () => void

    // Monte Carlo Actions
    setMonteCarloParams: (params: MonteCarloParams) => void
    runMonteCarlo: () => Promise<void>

    // Prediction Actions
    loadPredictions: () => Promise<void>
    loadPredictionsForSymbol: (symbol: string) => Promise<void>
    createPrediction: (targetQuarter: string) => Promise<string | null>

    // Snapshot Actions
    loadSnapshots: () => Promise<void>
    loadSnapshotsForSymbol: (symbol: string) => Promise<void>
    saveCurrentAsSnapshot: (note?: string) => Promise<string | null>
    deleteSnapshot: (id: string) => Promise<void>
    loadFromSnapshot: (snapshot: ValuationSnapshot) => void
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
    snapshots: [],
    isLoadingSnapshots: false,
    isLoading: false,
    error: null,
    activeTab: 'input',
    monteCarloParams: null,
    isRunningMonteCarlo: false,
    monteCarloRunId: null,

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
            // Calculate WACC using real-time API data
            // ============================================================

            // Fetch WACC inputs (Rf, MRP) from FMP API with caching
            const waccInputs = await fetchWACCInputs()

            // Cost of equity = Rf + β × MRP
            const costOfEquity = waccInputs.riskFreeRate +
                data.beta * waccInputs.marketRiskPremium

            // Cost of debt = Interest Expense / Total Debt (calculated from actual data)
            const costOfDebt = calculateCostOfDebt(data.interestExpense, data.totalDebt)

            // Weight by market value (debt at book value)
            const totalCapital = data.marketCap + data.totalDebt
            const equityWeight = totalCapital > 0 ? data.marketCap / totalCapital : 0.8
            const debtWeight = 1 - equityWeight
            // Use effective tax rate for debt tax shield
            const taxRate = data.effectiveTaxRate

            // WACC = E/V × Re + D/V × Rd × (1 - Tc)
            const calculatedWACC = equityWeight * costOfEquity +
                debtWeight * costOfDebt * (1 - taxRate)

            // Clamp WACC to reasonable range (6% - 15%)
            const wacc = Math.max(0.06, Math.min(0.15, calculatedWACC))

            // Log WACC components for debugging
            console.log(`WACC for ${symbol}:`, {
                Rf: (waccInputs.riskFreeRate * 100).toFixed(2) + '%',
                MRP: (waccInputs.marketRiskPremium * 100).toFixed(2) + '%',
                Beta: data.beta.toFixed(2),
                Re: (costOfEquity * 100).toFixed(2) + '%',
                Rd: (costOfDebt * 100).toFixed(2) + '%',
                Tax: (taxRate * 100).toFixed(2) + '%',
                WACC: (wacc * 100).toFixed(2) + '%'
            })

            // ============================================================
            // Create DCF inputs with data-driven defaults
            // ============================================================
            const dcfInputs = createDefaultDCFInputs(
                symbol,
                data.latestAnnualRevenue > 0 ? data.latestAnnualRevenue : data.ttmRevenue,
                data.latestAnnualNetIncome > 0 ? data.latestAnnualNetIncome : data.ttmNetIncome
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

                // Tax rate from effective tax rate (instead of default 21%)
                d.taxRate = data.effectiveTaxRate

                // Cash flow drivers from historical ratios
                d.daPercent = data.historicalDAPercent
                d.capexPercent = data.historicalCapexPercent
                d.wcChangePercent = data.historicalWCChangePercent
            })

            // Estimate growth from analyst estimates (per-year when available)
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
                // Fade Model: 起始增长率 = 显式期最后一年增长率
                const lastIdx = Math.min(explicitYears, dcfInputs.drivers.length) - 1
                if (lastIdx >= 0) {
                    dcfInputs.fadeStartGrowth = dcfInputs.drivers[lastIdx].revenueGrowth
                }
            } else if (data.analystEstimates.length >= 2) {
                // Fallback: use FY2/FY1 growth and decay if base revenue is unavailable
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

            // Fade Model: 起始 ROIC = 历史 ROIC（当前竞争优势水平）
            dcfInputs.fadeStartROIC = data.historicalROIC

            set({
                currentSymbol: symbol.toUpperCase(),
                financialData: data,
                dcfInputs,
                dcfResult: null,
                structuralCheck: null,
                marketImplied: null,
                monteCarloResult: null,
                monteCarloParams: null,
                isRunningMonteCarlo: false,
                monteCarloRunId: null,
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
        set({
            dcfInputs: inputs,
            dcfResult: null,
            monteCarloResult: null,
            monteCarloParams: null,
            isRunningMonteCarlo: false,
            monteCarloRunId: null
        })
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
        const marketImplied = calculateMarketImplied(financialData, dcfInputs.wacc, dcfInputs)

        set({ structuralCheck, marketImplied })
    },

    // Set active tab
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Clear error
    clearError: () => set({ error: null }),

    // Set Monte Carlo params
    setMonteCarloParams: (params: MonteCarloParams) => set({
        monteCarloParams: params,
        monteCarloResult: null,
        isRunningMonteCarlo: false,
        monteCarloRunId: null
    }),

    // Run Monte Carlo simulation using Web Worker
    runMonteCarlo: async () => {
        const { dcfInputs, financialData, monteCarloParams } = get()
        if (!dcfInputs || !financialData) return

        // Create default params if not set (uses analyst dispersion when available)
        const params = monteCarloParams || createDefaultMonteCarloParams(dcfInputs, financialData)

        const runId = crypto.randomUUID()

        set({
            isRunningMonteCarlo: true,
            monteCarloParams: params,
            monteCarloResult: null,
            monteCarloRunId: runId
        })

        try {
            // Check if Web Workers are supported
            if (typeof Worker !== 'undefined') {
                // Use Web Worker for parallel computation
                const worker = new Worker(
                    new URL('@/engines/monte-carlo.worker.ts', import.meta.url),
                    { type: 'module' }
                )

                const workerInput: MonteCarloWorkerInput = {
                    params,
                    dcfInputs,
                    financialData
                }

                worker.postMessage(workerInput)

                worker.onmessage = (event: MessageEvent<MonteCarloWorkerOutput>) => {
                    if (get().monteCarloRunId !== runId) {
                        worker.terminate()
                        return
                    }
                    const { success, result, error, executionTimeMs } = event.data
                    if (success && result) {
                        console.log(`Monte Carlo completed in ${executionTimeMs?.toFixed(0)}ms`)
                        set({ monteCarloResult: result, isRunningMonteCarlo: false })
                    } else {
                        console.error('Monte Carlo worker error:', error)
                        set({ isRunningMonteCarlo: false, error: error || 'Monte Carlo simulation failed' })
                    }
                    worker.terminate()
                }

                worker.onerror = (error) => {
                    if (get().monteCarloRunId !== runId) {
                        worker.terminate()
                        return
                    }
                    console.error('Worker error:', error)
                    set({ isRunningMonteCarlo: false, error: 'Web Worker error' })
                    worker.terminate()
                }
            } else {
                // Fallback: run synchronously (may block UI)
                console.warn('Web Workers not supported, running Monte Carlo synchronously')
                const result = runMonteCarloSimulation(params, dcfInputs, financialData)
                if (get().monteCarloRunId === runId) {
                    set({ monteCarloResult: result, isRunningMonteCarlo: false })
                }
            }
        } catch (err) {
            console.error('Monte Carlo error:', err)
            if (get().monteCarloRunId === runId) {
                set({
                    isRunningMonteCarlo: false,
                    error: err instanceof Error ? err.message : 'Monte Carlo simulation failed'
                })
            }
        }
    },

    // Reset store
    reset: () => set({
        currentSymbol: null,
        financialData: null,
        dcfInputs: null,
        dcfResult: null,
        structuralCheck: null,
        marketImplied: null,
        monteCarloResult: null,
        monteCarloParams: null,
        isRunningMonteCarlo: false,
        monteCarloRunId: null,
        predictions: [],
        isLoadingPredictions: false,
        snapshots: [],
        isLoadingSnapshots: false,
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
    },

    // ============================================================
    // Snapshot Actions
    // ============================================================

    // Load recent snapshots (all symbols)
    loadSnapshots: async () => {
        set({ isLoadingSnapshots: true })
        try {
            const snapshots = await getRecentSnapshots(50)
            set({ snapshots, isLoadingSnapshots: false })
        } catch (err) {
            console.error('Failed to load snapshots:', err)
            set({ isLoadingSnapshots: false })
        }
    },

    // Load snapshots for a specific symbol
    loadSnapshotsForSymbol: async (symbol: string) => {
        set({ isLoadingSnapshots: true })
        try {
            const snapshots = await getSnapshotsBySymbol(symbol)
            set({ snapshots, isLoadingSnapshots: false })
        } catch (err) {
            console.error('Failed to load snapshots for symbol:', err)
            set({ isLoadingSnapshots: false })
        }
    },

    // Save current DCF analysis as a snapshot
    saveCurrentAsSnapshot: async (note?: string) => {
        const { dcfInputs, financialData, currentSymbol } = get()
        if (!dcfInputs || !financialData || !currentSymbol) return null

        // Import calculateDCF to compute fair values for all three methods
        const { calculateDCF } = await import('@/engines/dcf-engine')

        // Calculate fair value for each terminal method
        const perpetuityResult = calculateDCF(
            { ...dcfInputs, terminalMethod: 'perpetuity' },
            financialData
        )
        const roicDrivenResult = calculateDCF(
            { ...dcfInputs, terminalMethod: 'roic-driven' },
            financialData
        )
        const fadeResult = calculateDCF(
            { ...dcfInputs, terminalMethod: 'fade' },
            financialData
        )

        // Extract Year 1 drivers for legacy inputParams (backward compatibility)
        const year1Drivers = dcfInputs.drivers[0]

        const snapshot: ValuationSnapshot = {
            id: crypto.randomUUID(),
            symbol: currentSymbol,
            companyName: financialData.companyName,
            createdAt: new Date(),
            currentPrice: financialData.currentPrice,
            // New format: complete inputs for full restoration
            fullInputs: {
                dcfInputs: { ...dcfInputs },
                financialData: { ...financialData }
            },
            // Legacy format (deprecated, kept for backward compatibility)
            inputParams: {
                wacc: dcfInputs.wacc,
                explicitPeriodYears: dcfInputs.explicitPeriodYears,
                terminalGrowthRate: dcfInputs.terminalGrowthRate,
                steadyStateROIC: dcfInputs.steadyStateROIC,
                fadeYears: dcfInputs.fadeYears,
                fadeStartGrowth: dcfInputs.fadeStartGrowth,
                fadeStartROIC: dcfInputs.fadeStartROIC,
                year1RevenueGrowth: year1Drivers.revenueGrowth,
                year1OperatingMargin: year1Drivers.operatingMargin,
                year1TaxRate: year1Drivers.taxRate,
                year1DAPercent: year1Drivers.daPercent,
                year1CapexPercent: year1Drivers.capexPercent,
                year1WCChangePercent: year1Drivers.wcChangePercent
            },
            perpetuityFairValue: perpetuityResult.fairValuePerShare,
            roicDrivenFairValue: roicDrivenResult.fairValuePerShare,
            fadeFairValue: fadeResult.fairValuePerShare,
            note
        }

        try {
            const id = await saveSnapshot(snapshot)
            // Reload snapshots
            const snapshots = await getSnapshotsBySymbol(currentSymbol)
            set({ snapshots })
            return id
        } catch (err) {
            console.error('Failed to save snapshot:', err)
            return null
        }
    },

    // Delete a snapshot
    deleteSnapshot: async (id: string) => {
        const { currentSymbol } = get()
        try {
            await deleteSnapshotFromDb(id)
            // Reload snapshots
            if (currentSymbol) {
                const snapshots = await getSnapshotsBySymbol(currentSymbol)
                set({ snapshots })
            } else {
                const snapshots = await getRecentSnapshots(50)
                set({ snapshots })
            }
        } catch (err) {
            console.error('Failed to delete snapshot:', err)
        }
    },

    // Load a snapshot and restore full analysis state
    loadFromSnapshot: (snapshot: ValuationSnapshot) => {
        // Check if snapshot has full inputs (new format)
        if (!snapshot.fullInputs) {
            console.error('Snapshot does not have complete inputs (legacy format)')
            set({ error: '此快照为旧格式，无法完整恢复。请使用新版本重新保存快照。' })
            return
        }

        const { dcfInputs, financialData } = snapshot.fullInputs

        // Restore state
        set({
            currentSymbol: snapshot.symbol,
            financialData,
            dcfInputs,
            dcfResult: null,
            structuralCheck: null,
            marketImplied: null,
            monteCarloResult: null,
            monteCarloParams: null,
            isRunningMonteCarlo: false,
            monteCarloRunId: null,
            activeTab: 'input'
        })

        // Run DCF calculation and validation
        const result = calculateDCF(dcfInputs, financialData)
        set({ dcfResult: result })

        const structuralCheck = runStructuralCheck(dcfInputs, result, financialData)
        const marketImplied = calculateMarketImplied(financialData, dcfInputs.wacc, dcfInputs)
        set({ structuralCheck, marketImplied })
    }
}))
