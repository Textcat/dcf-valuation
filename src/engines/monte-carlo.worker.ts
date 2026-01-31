/**
 * Monte Carlo Web Worker
 * 
 * Offloads Monte Carlo simulation to a background thread
 * to prevent UI blocking during high-intensity compute.
 */

import type {
    DCFInputs,
    MonteCarloParams,
    MonteCarloResult,
    ExtendedFinancialData
} from '@/types'
import { runMonteCarloSimulation } from './monte-carlo'

// ============================================================
// Worker Message Types
// ============================================================

export interface MonteCarloWorkerInput {
    params: MonteCarloParams
    dcfInputs: DCFInputs
    financialData: ExtendedFinancialData
}

export interface MonteCarloWorkerOutput {
    success: boolean
    result?: MonteCarloResult
    error?: string
    executionTimeMs?: number
}

// ============================================================
// Worker Entry Point
// ============================================================

self.onmessage = (event: MessageEvent<MonteCarloWorkerInput>) => {
    const startTime = performance.now()

    try {
        const { params, dcfInputs, financialData } = event.data

        // Validate inputs
        if (!params || !dcfInputs || !financialData) {
            const response: MonteCarloWorkerOutput = {
                success: false,
                error: 'Missing required input parameters'
            }
            self.postMessage(response)
            return
        }

        // Run simulation
        const result = runMonteCarloSimulation(params, dcfInputs, financialData)

        const executionTimeMs = performance.now() - startTime

        const response: MonteCarloWorkerOutput = {
            success: true,
            result,
            executionTimeMs
        }

        self.postMessage(response)
    } catch (error) {
        const response: MonteCarloWorkerOutput = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during simulation'
        }
        self.postMessage(response)
    }
}
