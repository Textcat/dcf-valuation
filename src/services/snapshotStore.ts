/**
 * Snapshot Store Service
 * 
 * CRUD operations for valuation snapshots stored in Supabase.
 */
import { supabase } from './supabase'
import type { ValuationSnapshot } from '@/types'

type SnapshotRecord = {
    id: string
    symbol: string
    company_name: string
    created_at: string
    current_price: number
    perpetuity_fair_value: number
    roic_driven_fair_value: number
    fade_fair_value: number
    note: string | null
    full_inputs: ValuationSnapshot['fullInputs'] | null
    input_params: ValuationSnapshot['inputParams'] | null
}

function mapSnapshotToRecord(snapshot: ValuationSnapshot): SnapshotRecord {
    return {
        id: snapshot.id,
        symbol: snapshot.symbol,
        company_name: snapshot.companyName,
        created_at: snapshot.createdAt.toISOString(),
        current_price: snapshot.currentPrice,
        perpetuity_fair_value: snapshot.perpetuityFairValue,
        roic_driven_fair_value: snapshot.roicDrivenFairValue,
        fade_fair_value: snapshot.fadeFairValue,
        note: snapshot.note ?? null,
        full_inputs: snapshot.fullInputs ?? null,
        input_params: snapshot.inputParams ?? null
    }
}

function mapRecordToSnapshot(record: SnapshotRecord): ValuationSnapshot {
    return {
        id: record.id,
        symbol: record.symbol,
        companyName: record.company_name,
        createdAt: new Date(record.created_at),
        currentPrice: Number(record.current_price),
        fullInputs: record.full_inputs ?? undefined,
        inputParams: record.input_params ?? undefined,
        perpetuityFairValue: Number(record.perpetuity_fair_value),
        roicDrivenFairValue: Number(record.roic_driven_fair_value),
        fadeFairValue: Number(record.fade_fair_value),
        note: record.note ?? undefined
    }
}

/**
 * Save a new valuation snapshot
 * @returns The ID of the saved snapshot
 */
export async function saveSnapshot(snapshot: ValuationSnapshot): Promise<string> {
    const { error } = await supabase
        .from('valuation_snapshots')
        .insert(mapSnapshotToRecord(snapshot))
    if (error) throw error
    return snapshot.id
}

/**
 * Get all snapshots for a specific symbol, ordered by date (newest first)
 */
export async function getSnapshotsBySymbol(symbol: string): Promise<ValuationSnapshot[]> {
    const { data, error } = await supabase
        .from('valuation_snapshots')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapRecordToSnapshot)
}

/**
 * Get recent snapshots across all symbols
 * @param limit Maximum number of snapshots to return (default: 20)
 */
export async function getRecentSnapshots(limit: number = 20): Promise<ValuationSnapshot[]> {
    const { data, error } = await supabase
        .from('valuation_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapRecordToSnapshot)
}

/**
 * Delete a snapshot by ID
 */
export async function deleteSnapshot(id: string): Promise<void> {
    const { error } = await supabase
        .from('valuation_snapshots')
        .delete()
        .eq('id', id)
    if (error) throw error
}

/**
 * Get a single snapshot by ID
 */
export async function getSnapshotById(id: string): Promise<ValuationSnapshot | undefined> {
    const { data, error } = await supabase
        .from('valuation_snapshots')
        .select('*')
        .eq('id', id)
        .maybeSingle()
    if (error) throw error
    return data ? mapRecordToSnapshot(data) : undefined
}
