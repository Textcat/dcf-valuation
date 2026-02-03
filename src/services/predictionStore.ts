/**
 * Prediction History Storage Service
 * 
 * 预测历史的 CRUD 操作封装 (Supabase)
 */
import { supabase } from './supabase'
import type { NearTermPrediction, ValueDrivers, PredictionScore } from '@/types'

type PredictionRecord = {
    id: string
    symbol: string
    created_at: string
    target_quarter: string
    predicted_drivers: NearTermPrediction['predictedDrivers']
    confidence_intervals: NearTermPrediction['confidenceIntervals']
    actual_drivers: NearTermPrediction['actualDrivers'] | null
    score: NearTermPrediction['score'] | null
}

function mapPredictionToRecord(prediction: NearTermPrediction): PredictionRecord {
    return {
        id: prediction.id,
        symbol: prediction.symbol,
        created_at: prediction.createdAt.toISOString(),
        target_quarter: prediction.targetQuarter,
        predicted_drivers: prediction.predictedDrivers,
        confidence_intervals: prediction.confidenceIntervals,
        actual_drivers: prediction.actualDrivers ?? null,
        score: prediction.score ?? null
    }
}

function mapRecordToPrediction(record: PredictionRecord): NearTermPrediction {
    return {
        id: record.id,
        symbol: record.symbol,
        createdAt: new Date(record.created_at),
        targetQuarter: record.target_quarter,
        predictedDrivers: record.predicted_drivers,
        confidenceIntervals: record.confidence_intervals,
        actualDrivers: record.actual_drivers ?? undefined,
        score: record.score ?? undefined
    }
}

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
    const record = mapPredictionToRecord({ ...prediction, id })
    const { error } = await supabase
        .from('near_term_predictions')
        .insert(record)
    if (error) throw error
    return id
}

/**
 * 获取单个预测
 * @param id 预测 ID
 */
export async function getPrediction(id: string): Promise<NearTermPrediction | undefined> {
    const { data, error } = await supabase
        .from('near_term_predictions')
        .select('*')
        .eq('id', id)
        .maybeSingle()
    if (error) throw error
    return data ? mapRecordToPrediction(data) : undefined
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
    const { data, error } = await supabase
        .from('near_term_predictions')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapRecordToPrediction)
}

/**
 * 获取待验证的预测 (有 targetQuarter 但无 actualDrivers)
 */
export async function getPendingPredictions(): Promise<NearTermPrediction[]> {
    const { data, error } = await supabase
        .from('near_term_predictions')
        .select('*')
        .is('actual_drivers', null)
    if (error) throw error
    return (data ?? []).map(mapRecordToPrediction)
}

/**
 * 按目标季度查询预测
 * @param targetQuarter 目标季度 (e.g., "2025Q1")
 */
export async function getPredictionsByQuarter(
    targetQuarter: string
): Promise<NearTermPrediction[]> {
    const { data, error } = await supabase
        .from('near_term_predictions')
        .select('*')
        .eq('target_quarter', targetQuarter)
    if (error) throw error
    return (data ?? []).map(mapRecordToPrediction)
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
    const { error } = await supabase
        .from('near_term_predictions')
        .update({
            actual_drivers: actualDrivers,
            score
        })
        .eq('id', id)
    if (error) throw error
}

/**
 * 删除预测
 * @param id 预测 ID
 */
export async function deletePrediction(id: string): Promise<void> {
    const { error } = await supabase
        .from('near_term_predictions')
        .delete()
        .eq('id', id)
    if (error) throw error
}

/**
 * 获取最近预测列表 (跨所有股票)
 * @param limit 最大返回数量
 */
export async function getRecentPredictions(limit = 50): Promise<NearTermPrediction[]> {
    const { data, error } = await supabase
        .from('near_term_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapRecordToPrediction)
}

/**
 * 获取预测统计 (已验证/总数)
 */
export async function getPredictionStats(): Promise<{
    total: number
    verified: number
    pending: number
}> {
    const { data, error } = await supabase
        .from('near_term_predictions')
        .select('actual_drivers')
    if (error) throw error
    const all = data ?? []
    const verified = all.filter(p => p.actual_drivers).length
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
    const { error } = await supabase
        .from('near_term_predictions')
        .delete()
        .neq('id', '')
    if (error) throw error
}
