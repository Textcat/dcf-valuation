/**
 * Prediction History Storage Service
 * 
 * 预测历史的 CRUD 操作封装
 */

import { db } from './db'
import type { NearTermPrediction, ValueDrivers, PredictionScore } from '@/types'

/**
 * 生成 UUID
 */
function generateId(): string {
    return crypto.randomUUID()
}

/**
 * 保存新预测
 * @param prediction 预测数据 (不含 id)
 * @returns 生成的 id
 */
export async function savePrediction(
    prediction: Omit<NearTermPrediction, 'id'>
): Promise<string> {
    const id = generateId()
    await db.predictions.add({ ...prediction, id })
    return id
}

/**
 * 获取单个预测
 * @param id 预测 ID
 */
export async function getPrediction(id: string): Promise<NearTermPrediction | undefined> {
    return db.predictions.get(id)
}

/**
 * 按股票代码查询预测历史
 * @param symbol 股票代码
 * @param limit 最大返回数量
 */
export async function getPredictionsBySymbol(
    symbol: string,
    limit = 20
): Promise<NearTermPrediction[]> {
    return db.predictions
        .where('symbol')
        .equals(symbol.toUpperCase())
        .reverse()
        .sortBy('createdAt')
        .then(results => results.slice(0, limit))
}

/**
 * 获取待验证的预测 (有 targetQuarter 但无 actualDrivers)
 */
export async function getPendingPredictions(): Promise<NearTermPrediction[]> {
    return db.predictions
        .filter(p => !p.actualDrivers)
        .toArray()
}

/**
 * 按目标季度查询预测
 * @param targetQuarter 目标季度 (e.g., "2025Q1")
 */
export async function getPredictionsByQuarter(
    targetQuarter: string
): Promise<NearTermPrediction[]> {
    return db.predictions
        .where('targetQuarter')
        .equals(targetQuarter)
        .toArray()
}

/**
 * 更新实际结果和评分
 * @param id 预测 ID
 * @param actualDrivers 实际驱动因子
 * @param score 评分结果
 */
export async function updateActuals(
    id: string,
    actualDrivers: ValueDrivers,
    score: PredictionScore
): Promise<void> {
    await db.predictions.update(id, { actualDrivers, score })
}

/**
 * 删除预测
 * @param id 预测 ID
 */
export async function deletePrediction(id: string): Promise<void> {
    await db.predictions.delete(id)
}

/**
 * 获取最近预测列表 (跨所有股票)
 * @param limit 最大返回数量
 */
export async function getRecentPredictions(limit = 50): Promise<NearTermPrediction[]> {
    return db.predictions
        .orderBy('createdAt')
        .reverse()
        .limit(limit)
        .toArray()
}

/**
 * 获取预测统计 (已验证/总数)
 */
export async function getPredictionStats(): Promise<{
    total: number
    verified: number
    pending: number
}> {
    const all = await db.predictions.toArray()
    const verified = all.filter(p => p.actualDrivers).length
    return {
        total: all.length,
        verified,
        pending: all.length - verified
    }
}

/**
 * 清空所有预测 (仅用于调试)
 */
export async function clearAllPredictions(): Promise<void> {
    await db.predictions.clear()
}
