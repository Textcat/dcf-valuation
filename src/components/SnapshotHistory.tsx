/**
 * Snapshot History Component
 * 
 * Display, view details, and delete valuation snapshots.
 */

import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { ValuationSnapshot } from '@/types'

// Format number as percentage
function formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%'
}

// Format number as currency
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value)
}

// Format date
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date))
}

// Upside/downside badge
function UpsideBadge({ fairValue, currentPrice }: { fairValue: number; currentPrice: number }) {
    const upside = ((fairValue / currentPrice) - 1) * 100
    const isPositive = upside >= 0

    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositive
            ? 'bg-green-900/40 text-green-400'
            : 'bg-red-900/40 text-red-400'
            }`}>
            {isPositive ? '+' : ''}{upside.toFixed(1)}%
        </span>
    )
}

// Snapshot detail modal
function SnapshotDetail({
    snapshot,
    onClose
}: {
    snapshot: ValuationSnapshot
    onClose: () => void
}) {
    // Prefer fullInputs (new format), fall back to legacy inputParams
    const hasFullInputs = !!snapshot.fullInputs
    const dcfInputs = snapshot.fullInputs?.dcfInputs
    const legacyParams = snapshot.inputParams

    // Get WACC and terminal params from either source
    const wacc = dcfInputs?.wacc ?? legacyParams?.wacc ?? 0
    const explicitPeriodYears = dcfInputs?.explicitPeriodYears ?? legacyParams?.explicitPeriodYears ?? 5
    const terminalGrowthRate = dcfInputs?.terminalGrowthRate ?? legacyParams?.terminalGrowthRate ?? 0
    const steadyStateROIC = dcfInputs?.steadyStateROIC ?? legacyParams?.steadyStateROIC ?? 0
    const fadeYears = dcfInputs?.fadeYears ?? legacyParams?.fadeYears ?? 10
    const fadeStartGrowth = dcfInputs?.fadeStartGrowth ?? legacyParams?.fadeStartGrowth ?? 0

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="glass-card max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-white">
                                {snapshot.symbol}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {snapshot.companyName}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {formatDate(snapshot.createdAt)}
                            </p>
                            {hasFullInputs && (
                                <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded-full">
                                    完整快照
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Fair Values */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">公允价值</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                <p className="text-xs text-slate-400 mb-1">永续增长</p>
                                <p className="text-lg font-bold text-white">{formatCurrency(snapshot.perpetuityFairValue)}</p>
                                <UpsideBadge fairValue={snapshot.perpetuityFairValue} currentPrice={snapshot.currentPrice} />
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                <p className="text-xs text-slate-400 mb-1">ROIC驱动</p>
                                <p className="text-lg font-bold text-white">{formatCurrency(snapshot.roicDrivenFairValue)}</p>
                                <UpsideBadge fairValue={snapshot.roicDrivenFairValue} currentPrice={snapshot.currentPrice} />
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                <p className="text-xs text-slate-400 mb-1">Fade Model</p>
                                <p className="text-lg font-bold text-white">{formatCurrency(snapshot.fadeFairValue)}</p>
                                <UpsideBadge fairValue={snapshot.fadeFairValue} currentPrice={snapshot.currentPrice} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            估值时市价: {formatCurrency(snapshot.currentPrice)}
                        </p>
                    </div>

                    {/* Key Parameters */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">关键参数</h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">WACC</span>
                                <span className="text-white">{formatPercent(wacc)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">显式期</span>
                                <span className="text-white">{explicitPeriodYears} 年</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">永续增长率</span>
                                <span className="text-white">{formatPercent(terminalGrowthRate)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">稳态 ROIC</span>
                                <span className="text-white">{formatPercent(steadyStateROIC)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">渐退期</span>
                                <span className="text-white">{fadeYears} 年</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">渐退起始增长</span>
                                <span className="text-white">{formatPercent(fadeStartGrowth)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Yearly Drivers - show all years for new format, Year 1 only for legacy */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">
                            {hasFullInputs ? '显式期驱动因子 (5年)' : '第一年驱动因子'}
                        </h4>
                        {hasFullInputs && dcfInputs ? (
                            <div className="space-y-3">
                                {dcfInputs.drivers.map((driver, idx) => (
                                    <div key={idx} className="bg-slate-800/30 rounded-lg p-2">
                                        <div className="text-xs font-semibold text-blue-400 mb-1">Year {idx + 1}</div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div><span className="text-slate-500">收入增速:</span> <span className="text-white">{formatPercent(driver.revenueGrowth)}</span></div>
                                            <div><span className="text-slate-500">营业利润率:</span> <span className="text-white">{formatPercent(driver.operatingMargin)}</span></div>
                                            <div><span className="text-slate-500">税率:</span> <span className="text-white">{formatPercent(driver.taxRate)}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : legacyParams ? (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">收入增长</span>
                                    <span className="text-white">{formatPercent(legacyParams.year1RevenueGrowth)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">经营利润率</span>
                                    <span className="text-white">{formatPercent(legacyParams.year1OperatingMargin)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">税率</span>
                                    <span className="text-white">{formatPercent(legacyParams.year1TaxRate)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">D&A %</span>
                                    <span className="text-white">{formatPercent(legacyParams.year1DAPercent)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">CapEx %</span>
                                    <span className="text-white">{formatPercent(legacyParams.year1CapexPercent)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">WC 变动 %</span>
                                    <span className="text-white">{formatPercent(legacyParams.year1WCChangePercent)}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm">无参数数据</p>
                        )}
                    </div>

                    {/* Note */}
                    {snapshot.note && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-slate-300 mb-2">备注</h4>
                            <p className="text-sm text-slate-400 bg-slate-800/50 rounded-lg p-3">
                                {snapshot.note}
                            </p>
                        </div>
                    )}

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    )
}

export function SnapshotHistory() {
    const {
        snapshots,
        isLoadingSnapshots,
        currentSymbol,
        loadSnapshots,
        loadSnapshotsForSymbol,
        deleteSnapshot,
        loadFromSnapshot
    } = useAppStore()

    const [selectedSnapshot, setSelectedSnapshot] = useState<ValuationSnapshot | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())

    // Group snapshots by symbol
    const groupedSnapshots = snapshots.reduce((acc, snapshot) => {
        const symbol = snapshot.symbol
        if (!acc[symbol]) {
            acc[symbol] = []
        }
        acc[symbol].push(snapshot)
        return acc
    }, {} as Record<string, ValuationSnapshot[]>)

    // Sort symbols by most recent snapshot
    const sortedSymbols = Object.keys(groupedSnapshots).sort((a, b) => {
        const aLatest = new Date(groupedSnapshots[a][0].createdAt).getTime()
        const bLatest = new Date(groupedSnapshots[b][0].createdAt).getTime()
        return bLatest - aLatest
    })

    // Toggle expand/collapse for a symbol group
    const toggleSymbol = (symbol: string) => {
        setExpandedSymbols(prev => {
            const next = new Set(prev)
            if (next.has(symbol)) {
                next.delete(symbol)
            } else {
                next.add(symbol)
            }
            return next
        })
    }

    // Expand all groups
    const expandAll = () => {
        setExpandedSymbols(new Set(sortedSymbols))
    }

    // Collapse all groups
    const collapseAll = () => {
        setExpandedSymbols(new Set())
    }

    // Load snapshots on mount
    useEffect(() => {
        if (currentSymbol) {
            loadSnapshotsForSymbol(currentSymbol)
        } else {
            loadSnapshots()
        }
    }, [currentSymbol, loadSnapshots, loadSnapshotsForSymbol])

    // Handle delete
    const handleDelete = async (id: string) => {
        await deleteSnapshot(id)
        setConfirmDelete(null)
    }

    if (isLoadingSnapshots) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-400">加载快照历史...</p>
            </div>
        )
    }

    if (snapshots.length === 0) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="text-4xl mb-3">📸</div>
                <h3 className="text-lg font-semibold text-white mb-2">暂无估值快照</h3>
                <p className="text-slate-400 text-sm">
                    在 DCF 参数页面完成估值后，点击"保存快照"按钮保存估值历史
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">
                    估值快照 ({snapshots.length})
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={expandAll}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        全部展开
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                        onClick={collapseAll}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        全部折叠
                    </button>
                </div>
            </div>

            {/* Grouped Snapshot List */}
            <div className="space-y-3">
                {sortedSymbols.map((symbol) => {
                    const symbolSnapshots = groupedSnapshots[symbol]
                    const isExpanded = expandedSymbols.has(symbol)
                    const latestSnapshot = symbolSnapshots[0]

                    return (
                        <div key={symbol} className="glass-card overflow-hidden">
                            {/* Collapsible Header */}
                            <button
                                onClick={() => toggleSymbol(symbol)}
                                className="w-full p-4 flex justify-between items-center hover:bg-slate-800/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                        ▶
                                    </span>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-lg">{symbol}</span>
                                            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">
                                                {symbolSnapshots.length} 条记录
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {latestSnapshot.companyName} · 最近: {formatDate(latestSnapshot.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-slate-400">最新估值</div>
                                    <div className="text-white font-semibold">
                                        {formatCurrency(latestSnapshot.fadeFairValue)}
                                    </div>
                                    <UpsideBadge fairValue={latestSnapshot.fadeFairValue} currentPrice={latestSnapshot.currentPrice} />
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="border-t border-slate-700/50">
                                    {symbolSnapshots.map((snapshot) => (
                                        <div
                                            key={snapshot.id}
                                            className="p-4 border-b border-slate-700/30 last:border-b-0 hover:bg-slate-800/30 transition-colors"
                                        >
                                            <div className="flex justify-between items-start">
                                                {/* Left: Info */}
                                                <div
                                                    className="flex-1 cursor-pointer"
                                                    onClick={() => setSelectedSnapshot(snapshot)}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs text-slate-500">
                                                            {formatDate(snapshot.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-400 mb-2">
                                                        市价 {formatCurrency(snapshot.currentPrice)}
                                                    </p>

                                                    {/* Fair values summary */}
                                                    <div className="flex gap-4 text-xs">
                                                        <div>
                                                            <span className="text-slate-500">永续:</span>
                                                            <span className="text-white ml-1">{formatCurrency(snapshot.perpetuityFairValue)}</span>
                                                            <span className="ml-1">
                                                                <UpsideBadge fairValue={snapshot.perpetuityFairValue} currentPrice={snapshot.currentPrice} />
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">ROIC:</span>
                                                            <span className="text-white ml-1">{formatCurrency(snapshot.roicDrivenFairValue)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Fade:</span>
                                                            <span className="text-white ml-1">{formatCurrency(snapshot.fadeFairValue)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => loadFromSnapshot(snapshot)}
                                                        disabled={!snapshot.fullInputs}
                                                        className={`p-2 rounded-lg transition-colors ${snapshot.fullInputs
                                                            ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30'
                                                            : 'text-slate-600 cursor-not-allowed'
                                                            }`}
                                                        title={snapshot.fullInputs ? '分析此快照' : '旧格式快照，无法分析'}
                                                    >
                                                        📊
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedSnapshot(snapshot)}
                                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                                        title="查看详情"
                                                    >
                                                        👁
                                                    </button>
                                                    {confirmDelete === snapshot.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleDelete(snapshot.id)}
                                                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                                                            >
                                                                确认
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(null)}
                                                                className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                                                            >
                                                                取消
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDelete(snapshot.id)}
                                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                                            title="删除"
                                                        >
                                                            🗑
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Note */}
                                            {snapshot.note && (
                                                <p className="mt-2 text-xs text-slate-500 italic truncate">
                                                    "{snapshot.note}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Detail Modal */}
            {selectedSnapshot && (
                <SnapshotDetail
                    snapshot={selectedSnapshot}
                    onClose={() => setSelectedSnapshot(null)}
                />
            )}
        </div>
    )
}
