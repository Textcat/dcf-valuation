/**
 * IndexedDB Database Configuration (using Dexie)
 * 
 * 存储预测历史用于验证闭环
 */

import Dexie, { type Table } from 'dexie'
import type { NearTermPrediction } from '@/types'

export class DCFDatabase extends Dexie {
    predictions!: Table<NearTermPrediction, string>

    constructor() {
        super('dcf-validation-db')

        this.version(1).stores({
            // 索引字段:
            // - id: 主键 (UUID)
            // - symbol: 按股票代码查询
            // - createdAt: 按时间排序
            // - targetQuarter: 按目标季度查询待验证预测
            predictions: 'id, symbol, createdAt, targetQuarter'
        })
    }
}

export const db = new DCFDatabase()
