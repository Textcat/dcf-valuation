/**
 * Monte Carlo Dashboard
 * Visualizes simulation results with histogram, percentiles, and interpretation
 */

import { useAppStore } from '@/stores/appStore'
import { interpretMonteCarloResult } from '@/engines/monte-carlo'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'
import { useMemo } from 'react'

// ============================================================
// Histogram Data Preparation
// ============================================================

interface HistogramBin {
    range: string
    rangeStart: number
    rangeEnd: number
    count: number
    frequency: number
    midpoint: number
}

function createHistogramData(values: number[], binCount: number = 30): HistogramBin[] {
    if (values.length === 0) return []

    const min = Math.min(...values)
    const max = Math.max(...values)
    const binWidth = (max - min) / binCount

    const bins: HistogramBin[] = Array(binCount)
        .fill(null)
        .map((_, i) => ({
            range: `$${(min + i * binWidth).toFixed(0)}-${(min + (i + 1) * binWidth).toFixed(0)}`,
            rangeStart: min + i * binWidth,
            rangeEnd: min + (i + 1) * binWidth,
            count: 0,
            frequency: 0,
            midpoint: min + (i + 0.5) * binWidth
        }))

    for (const value of values) {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1)
        if (binIndex >= 0 && binIndex < binCount) {
            bins[binIndex].count++
        }
    }

    const maxCount = Math.max(...bins.map(b => b.count))
    for (const bin of bins) {
        bin.frequency = maxCount > 0 ? (bin.count / maxCount) * 100 : 0
    }

    return bins
}

// ============================================================
// Sub-components
// ============================================================

interface PercentileCardProps {
    label: string
    value: number
    color: string
    isHighlighted?: boolean
}

function PercentileCard({ label, value, color, isHighlighted }: PercentileCardProps) {
    return (
        <div className={`rounded-xl p-4 text-center transition-all ${isHighlighted
            ? 'bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 border border-violet-500/50 scale-105'
            : 'bg-slate-800/50'
            }`}>
            <div className="text-xs text-slate-400 mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>
                ${value.toFixed(2)}
            </div>
        </div>
    )
}

interface InterpretationBadgeProps {
    percentile: number
}

function InterpretationBadge({ percentile }: InterpretationBadgeProps) {
    let color: string
    let label: string
    let emoji: string

    if (percentile < 25) {
        color = 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
        label = '潜在低估'
        emoji = '📈'
    } else if (percentile > 75) {
        color = 'bg-red-600/30 text-red-300 border-red-500/50'
        label = '潜在高估'
        emoji = '📉'
    } else if (percentile >= 40 && percentile <= 60) {
        color = 'bg-blue-600/30 text-blue-300 border-blue-500/50'
        label = '定价合理'
        emoji = '⚖️'
    } else {
        color = 'bg-slate-600/30 text-slate-300 border-slate-500/50'
        label = '中性区间'
        emoji = '📊'
    }

    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${color} text-sm font-medium`}>
            <span>{emoji}</span>
            <span>{label}</span>
        </span>
    )
}

// ============================================================
// Main Component
// ============================================================

export function MonteCarloDashboard() {
    const {
        monteCarloResult,
        isRunningMonteCarlo,
        financialData,
        dcfInputs,
        monteCarloParams,
        runMonteCarlo
    } = useAppStore()

    // Create histogram data
    const histogramData = useMemo(() => {
        if (!monteCarloResult || monteCarloResult.valueDistribution.length === 0) return []
        return createHistogramData(monteCarloResult.valueDistribution)
    }, [monteCarloResult])

    // Interpretation
    const interpretation = useMemo(() => {
        if (!monteCarloResult || !financialData) return null
        return interpretMonteCarloResult(monteCarloResult, financialData.currentPrice)
    }, [monteCarloResult, financialData])

    // Loading state
    if (isRunningMonteCarlo) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="inline-block mb-4">
                    <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-lg font-medium text-white mb-2">正在运行 Monte Carlo 模拟...</div>
                <div className="text-sm text-slate-400">10,000 次迭代，请稍候</div>
            </div>
        )
    }

    // No data yet
    if (!monteCarloResult || !financialData || !dcfInputs) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="text-5xl mb-4">🎲</div>
                <div className="text-lg font-medium text-white mb-2">Monte Carlo 模拟</div>
                <div className="text-sm text-slate-400 mb-6">
                    对 DCF 关键驱动因素进行概率采样，生成估值分布
                </div>
                <button
                    onClick={() => runMonteCarlo()}
                    disabled={!dcfInputs}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    运行模拟
                </button>
            </div>
        )
    }

    const currentPrice = financialData.currentPrice
    const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`
    const formatRange = (min: number, max: number) => `${formatPercent(min)} ~ ${formatPercent(max)}`
    const correlationVars = monteCarloParams?.correlation.variables || []
    const correlationMatrix = monteCarloParams?.correlation.matrix || []

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with Run Button */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold gradient-text">Monte Carlo 估值分布</h3>
                <button
                    onClick={() => runMonteCarlo()}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white transition-colors"
                >
                    重新运行
                </button>
            </div>

            {/* Interpretation Banner */}
            {interpretation && (
                <div className="glass-card p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <InterpretationBadge percentile={monteCarloResult.currentPricePercentile} />
                            <span className="text-slate-300">
                                当前价格 <span className="font-bold text-white">${currentPrice.toFixed(2)}</span> 位于估值分布的
                                <span className="font-bold text-violet-400"> P{monteCarloResult.currentPricePercentile.toFixed(0)}</span>
                            </span>
                        </div>
                        <div className="text-sm text-slate-400">
                            {interpretation.interpretation}
                        </div>
                    </div>
                </div>
            )}

            {/* Histogram Chart */}
            <div className="glass-card p-6">
                <h4 className="text-sm font-medium text-slate-300 mb-4">估值分布直方图</h4>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={histogramData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="midpoint"
                                tickFormatter={(v) => `$${v.toFixed(0)}`}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                axisLine={{ stroke: '#475569' }}
                            />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #475569',
                                    borderRadius: '8px'
                                }}
                                formatter={(value: number) => [`${value.toFixed(0)}%`, '频率']}
                                labelFormatter={(label) => `$${Number(label).toFixed(2)}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="frequency"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                fill="url(#colorFreq)"
                            />
                            {/* Current Price Line */}
                            <ReferenceLine
                                x={currentPrice}
                                stroke="#f59e0b"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: '当前价格',
                                    fill: '#f59e0b',
                                    fontSize: 12,
                                    position: 'top'
                                }}
                            />
                            {/* P50 Line */}
                            <ReferenceLine
                                x={monteCarloResult.p50}
                                stroke="#10b981"
                                strokeWidth={2}
                                label={{
                                    value: 'P50',
                                    fill: '#10b981',
                                    fontSize: 12,
                                    position: 'top'
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Percentile Grid */}
            <div className="glass-card p-6">
                <h4 className="text-sm font-medium text-slate-300 mb-4">分位数估值</h4>
                <div className="grid grid-cols-5 gap-3">
                    <PercentileCard label="P10 (悲观)" value={monteCarloResult.p10} color="text-red-400" />
                    <PercentileCard label="P25" value={monteCarloResult.p25} color="text-amber-400" />
                    <PercentileCard label="P50 (中位数)" value={monteCarloResult.p50} color="text-emerald-400" isHighlighted />
                    <PercentileCard label="P75" value={monteCarloResult.p75} color="text-blue-400" />
                    <PercentileCard label="P90 (乐观)" value={monteCarloResult.p90} color="text-violet-400" />
                </div>
            </div>

            {/* Risk-Reward Analysis */}
            {interpretation && (
                <div className="glass-card p-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-4">风险收益分析</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-400 mb-1">至 P50 上升空间</div>
                            <div className={`text-xl font-bold ${interpretation.upsideP50 > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {interpretation.upsideP50 > 0 ? '+' : ''}{interpretation.upsideP50.toFixed(1)}%
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-400 mb-1">至 P75 上升空间</div>
                            <div className={`text-xl font-bold ${interpretation.upsideP75 > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {interpretation.upsideP75 > 0 ? '+' : ''}{interpretation.upsideP75.toFixed(1)}%
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-400 mb-1">至 P25 下降风险</div>
                            <div className="text-xl font-bold text-amber-400">
                                -{interpretation.downsideP25.toFixed(1)}%
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-400 mb-1">风险收益比</div>
                            <div className={`text-xl font-bold ${interpretation.riskRewardRatio > 2 ? 'text-emerald-400' :
                                interpretation.riskRewardRatio > 1 ? 'text-blue-400' : 'text-amber-400'
                                }`}>
                                {interpretation.riskRewardRatio.toFixed(2)}x
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics - only show when we have valid results */}
            {monteCarloResult.valueDistribution.length > 0 && monteCarloResult.mean > 0 ? (
                <div className="glass-card p-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-4">统计摘要</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-400">有效迭代</span>
                            <span className="text-white font-medium">{monteCarloResult.valueDistribution.length.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">均值</span>
                            <span className="text-white font-medium">${monteCarloResult.mean.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">标准差</span>
                            <span className="text-white font-medium">${monteCarloResult.stdDev.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">变异系数</span>
                            <span className="text-white font-medium">
                                {((monteCarloResult.stdDev / monteCarloResult.mean) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-6 text-center">
                    <div className="text-amber-400 text-lg mb-2">⚠️ 模拟失败</div>
                    <div className="text-sm text-slate-400">
                        所有迭代均未产生有效估值。请检查 DCF 参数（如 WACC 必须大于终值增长率）。
                    </div>
                </div>
            )}

            {/* Assumptions */}
            {monteCarloParams && (
                <div className="glass-card p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-slate-300">模拟假设与分布</h4>
                        <span className="text-xs text-slate-500">固定相关系数 + 硬约束重抽</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-3">
                            <div className="text-slate-400">增长率路径（逐年抽样）</div>
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">均值路径</span>
                                    <span className="text-white">
                                        {monteCarloParams.growth.means.map(g => formatPercent(g)).join(' → ')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">波动率</span>
                                    <span className="text-white">{formatPercent(monteCarloParams.growth.stdDev)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">范围</span>
                                    <span className="text-white">{formatRange(monteCarloParams.growth.min, monteCarloParams.growth.max)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">年际相关</span>
                                    <span className="text-white">{monteCarloParams.growth.yearCorrelation.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">均值回归</span>
                                    <span className="text-white">{monteCarloParams.growth.meanReversion.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="text-slate-400">关键驱动分布</div>
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">营业利润率</span>
                                    <span className="text-white">
                                        {formatPercent(monteCarloParams.operatingMargin.mean)} ± {formatPercent(monteCarloParams.operatingMargin.stdDev)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">WACC ({monteCarloParams.wacc.distribution})</span>
                                    <span className="text-white">
                                        {formatPercent(monteCarloParams.wacc.mean)} ± {formatPercent(monteCarloParams.wacc.stdDev)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">终值增长率</span>
                                    <span className="text-white">
                                        {formatPercent(monteCarloParams.terminalGrowth.mean)} ± {formatPercent(monteCarloParams.terminalGrowth.stdDev)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">终值约束</span>
                                    <span className="text-white">WACC - g ≥ {formatPercent(monteCarloParams.terminalModel.minWaccSpread)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-3">
                            <div className="text-slate-400">ROIC 终值参数</div>
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">稳态 ROIC</span>
                                    <span className="text-white">
                                        {formatPercent(monteCarloParams.terminalModel.roicDriven.steadyStateROIC.mean)} ± {formatPercent(monteCarloParams.terminalModel.roicDriven.steadyStateROIC.stdDev)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">再投资率上限</span>
                                    <span className="text-white">{formatPercent(monteCarloParams.terminalModel.roicDriven.maxReinvestmentRate)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="text-slate-400">Fade 终值参数</div>
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Fade 年数</span>
                                    <span className="text-white">
                                        {monteCarloParams.terminalModel.fade.fadeYears.mean.toFixed(0)} ± {monteCarloParams.terminalModel.fade.fadeYears.stdDev.toFixed(1)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">起始增长率</span>
                                    <span className="text-white">
                                        {formatPercent(monteCarloParams.terminalModel.fade.fadeStartGrowth.mean)} ± {formatPercent(monteCarloParams.terminalModel.fade.fadeStartGrowth.stdDev)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">起始 ROIC</span>
                                    <span className="text-white">
                                        {formatPercent(monteCarloParams.terminalModel.fade.fadeStartROIC.mean)} ± {formatPercent(monteCarloParams.terminalModel.fade.fadeStartROIC.stdDev)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {correlationVars.length > 0 && correlationMatrix.length > 0 && (
                        <div className="space-y-3">
                            <div className="text-slate-400">相关性矩阵</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-separate border-spacing-1">
                                    <thead>
                                        <tr>
                                            <th className="text-left text-slate-500 font-medium">变量</th>
                                            {correlationVars.map(v => (
                                                <th key={v} className="text-slate-400 font-medium px-2 py-1">
                                                    {v}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {correlationVars.map((rowVar, rowIdx) => (
                                            <tr key={rowVar}>
                                                <td className="text-slate-400 pr-2">{rowVar}</td>
                                                {correlationVars.map((colVar, colIdx) => (
                                                    <td
                                                        key={`${rowVar}-${colVar}`}
                                                        className="bg-slate-800/50 rounded px-2 py-1 text-center text-slate-200"
                                                    >
                                                        {correlationMatrix[rowIdx]?.[colIdx]?.toFixed(2) ?? '—'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
