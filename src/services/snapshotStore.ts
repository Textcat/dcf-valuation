/**
 * Snapshot Store Service
 * 
 * CRUD operations for valuation snapshots stored in IndexedDB.
 */

import { db } from './db'
import type { ValuationSnapshot } from '@/types'

/**
 * Save a new valuation snapshot
 * @returns The ID of the saved snapshot
 */
export async function saveSnapshot(snapshot: ValuationSnapshot): Promise<string> {
    await db.snapshots.add(snapshot)
    return snapshot.id
}

/**
 * Get all snapshots for a specific symbol, ordered by date (newest first)
 */
export async function getSnapshotsBySymbol(symbol: string): Promise<ValuationSnapshot[]> {
    return db.snapshots
        .where('symbol')
        .equals(symbol)
        .reverse()
        .sortBy('createdAt')
}

/**
 * Get recent snapshots across all symbols
 * @param limit Maximum number of snapshots to return (default: 20)
 */
export async function getRecentSnapshots(limit: number = 20): Promise<ValuationSnapshot[]> {
    return db.snapshots
        .orderBy('createdAt')
        .reverse()
        .limit(limit)
        .toArray()
}

/**
 * Delete a snapshot by ID
 */
export async function deleteSnapshot(id: string): Promise<void> {
    await db.snapshots.delete(id)
}

/**
 * Get a single snapshot by ID
 */
export async function getSnapshotById(id: string): Promise<ValuationSnapshot | undefined> {
    return db.snapshots.get(id)
}
