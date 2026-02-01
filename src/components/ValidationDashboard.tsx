/**
 * Validation Dashboard
 * Displays Layer B (Structural) and Layer C (Market Implied) validation results
 */

import { useAppStore } from '@/stores/appStore'
import {
    getIndustryBenchmark,
    getDamodaranIndustryName,
    getIndustryThresholds
} from '@/data/industryBenchmarks'

interface AlertCardProps {
    type: 'warning' | 'success' | 'info'
    message: string
}

function AlertCard({ type, message }: AlertCardProps) {
    const colors = {
        warning: 'bg-amber-900/30 border-amber-600/50 text-amber-300',
        success: 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300',
        info: 'bg-blue-900/30 border-blue-600/50 text-blue-300'
    }

    const icons = {
        warning: '⚠️',
        success: '✓',
        info: 'ℹ️'
    }

    return (
        <div className={`px-4 py-3 rounded-lg border ${colors[type]} flex items-start gap-3`}>
            <span className="text-lg">{icons[type]}</span>
            <span className="text-sm">{message}</span>
        </div>
    )
}

interface MetricBarProps {
    label: string
    current: number
    target?: number
    min?: number
    max?: number
    isPercent?: boolean
    isValid: boolean
}

function MetricBar({ label, current, target, min = 0, max = 1, isPercent = true, isValid }: MetricBarProps) {
    const normalizedCurrent = Math.min(Math.max((current - min) / (max - min), 0), 1)
    const normalizedTarget = target !== undefined ? Math.min(Math.max((target - min) / (max - min), 0), 1) : undefined

    const displayValue = isPercent ? `${(current * 100).toFixed(1)}%` : current.toFixed(2)

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">{label}</span>
                <span className={`text-sm font-semibold ${isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {displayValue}
                </span>
            </div>
            <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`absolute h-full rounded-full transition-all duration-500 ${isValid ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                    style={{ width: `${normalizedCurrent * 100}%` }}
                />
                {normalizedTarget !== undefined && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                        style={{ left: `${normalizedTarget * 100}%` }}
                    />
                )}
            </div>
        </div>
    )
}

export function ValidationDashboard() {
    const { structuralCheck, marketImplied, dcfResult, financialData } = useAppStore()

    if (!structuralCheck || !marketImplied || !dcfResult) {
        return (
            <div className="glass-card p-6 text-center text-slate-400">
                请先计算 DCF 估值以查看验证结果
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Layer B: Structural Checks */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold gradient-text mb-4">
                    Layer B: 结构一致性检验
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Growth Consistency */}
                    <MetricBar
                        label="增长一致性"
                        current={structuralCheck.growthConsistency.assumedGrowth}
                        target={structuralCheck.growthConsistency.impliedGrowth}
                        min={-0.1}
                        max={0.4}
                        isValid={structuralCheck.growthConsistency.isValid}
                    />

                    {/* CapEx/D&A */}
                    <MetricBar
                        label="CapEx/折旧比率"
                        current={structuralCheck.capexDARatio.current}
                        target={structuralCheck.capexDARatio.target}
                        min={0}
                        max={2}
                        isPercent={false}
                        isValid={structuralCheck.capexDARatio.isReasonable}
                    />

                    {/* FCF Quality */}
                    <MetricBar
                        label="FCF/NOPAT 质量"
                        current={structuralCheck.fcfQuality.fcfToNI}
                        min={0}
                        max={1.5}
                        isValid={structuralCheck.fcfQuality.isReasonable}
                    />
                </div>

                {/* Warnings */}
                {structuralCheck.warnings.length > 0 && (
                    <div className="space-y-2">
                        {structuralCheck.warnings.map((warning, index) => (
                            <AlertCard key={index} type="warning" message={warning} />
                        ))}
                    </div>
                )}

                {structuralCheck.warnings.length === 0 && (
                    <AlertCard type="success" message="所有结构一致性检验通过" />
                )}
            </div>

            {/* Layer C: Market Implied */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold gradient-text mb-4">
                    Layer C: 市场隐含假设
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <div className="text-sm text-slate-400 mb-1">隐含增长率</div>
                        <div className={`text-xl font-bold ${marketImplied.feasibility.growthExceedsHistoricalFrequency
                            ? 'text-amber-400'
                            : 'text-white'
                            }`}>
                            {(marketImplied.impliedGrowthRate * 100).toFixed(1)}%
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <div className="text-sm text-slate-400 mb-1">隐含利润率</div>
                        <div className={`text-xl font-bold ${marketImplied.feasibility.marginExceedsIndustryMax
                            ? 'text-red-400'
                            : 'text-white'
                            }`}>
                            {(marketImplied.impliedSteadyStateMargin * 100).toFixed(1)}%
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <div className="text-sm text-slate-400 mb-1">隐含ROIC</div>
                        <div className={`text-xl font-bold ${marketImplied.feasibility.roicExceedsHistoricalMax
                            ? 'text-red-400'
                            : 'text-white'
                            }`}>
                            {(marketImplied.impliedROIC * 100).toFixed(1)}%
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <div className="text-sm text-slate-400 mb-1">历史达成概率</div>
                        <div className={`text-xl font-bold ${marketImplied.historicalFrequency < 20
                            ? 'text-red-400'
                            : marketImplied.historicalFrequency < 40
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}>
                            {marketImplied.historicalFrequency}%
                        </div>
                    </div>
                </div>

                {/* Industry Benchmark Comparison */}
                {financialData && (
                    <div className="mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-slate-400 text-sm">行业基准</span>
                            <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded-full">
                                {getDamodaranIndustryName(financialData.industry, financialData.sector)}
                            </span>
                        </div>
                        {(() => {
                            const benchmark = getIndustryBenchmark(financialData.industry, financialData.sector)
                            const thresholds = getIndustryThresholds(benchmark)
                            return (
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Margin Comparison */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">行业Operating Margin中位数</span>
                                            <span className="text-slate-300">{(benchmark.operatingMargin * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">隐含稳态利润率</span>
                                            <span className={`font-medium ${marketImplied.impliedSteadyStateMargin > thresholds.marginError
                                                    ? 'text-red-400'
                                                    : marketImplied.impliedSteadyStateMargin > thresholds.marginWarning
                                                        ? 'text-amber-400'
                                                        : 'text-emerald-400'
                                                }`}>
                                                {(marketImplied.impliedSteadyStateMargin * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
                                            {/* Industry benchmark marker */}
                                            <div
                                                className="absolute w-0.5 h-full bg-cyan-400/70"
                                                style={{ left: `${Math.min(Math.max(benchmark.operatingMargin, 0) * 100, 60)}%` }}
                                            />
                                            {/* Implied value bar */}
                                            <div
                                                className={`h-full rounded-full ${marketImplied.impliedSteadyStateMargin > thresholds.marginError
                                                        ? 'bg-red-500'
                                                        : marketImplied.impliedSteadyStateMargin > thresholds.marginWarning
                                                            ? 'bg-amber-500'
                                                            : 'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${Math.min(marketImplied.impliedSteadyStateMargin * 100, 60)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* ROIC Comparison */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">行业After-tax ROIC中位数</span>
                                            <span className="text-slate-300">{(benchmark.afterTaxROIC * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">隐含ROIC</span>
                                            <span className={`font-medium ${marketImplied.impliedROIC > thresholds.roicError
                                                    ? 'text-red-400'
                                                    : marketImplied.impliedROIC > thresholds.roicWarning
                                                        ? 'text-amber-400'
                                                        : 'text-emerald-400'
                                                }`}>
                                                {(marketImplied.impliedROIC * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
                                            {/* Industry benchmark marker */}
                                            <div
                                                className="absolute w-0.5 h-full bg-cyan-400/70"
                                                style={{ left: `${Math.min(Math.max(benchmark.afterTaxROIC, 0) * 100, 80)}%` }}
                                            />
                                            {/* Implied value bar */}
                                            <div
                                                className={`h-full rounded-full ${marketImplied.impliedROIC > thresholds.roicError
                                                        ? 'bg-red-500'
                                                        : marketImplied.impliedROIC > thresholds.roicWarning
                                                            ? 'bg-amber-500'
                                                            : 'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${Math.min(marketImplied.impliedROIC * 100, 80)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                )}

                {/* Feasibility Alerts */}
                <div className="space-y-2">
                    {marketImplied.feasibility.marginExceedsIndustryMax && (
                        <AlertCard
                            type="warning"
                            message="隐含利润率超出行业上限，市场可能过度乐观"
                        />
                    )}
                    {marketImplied.feasibility.roicExceedsHistoricalMax && (
                        <AlertCard
                            type="warning"
                            message="隐含ROIC超过历史最高水平，需要强护城河支撑"
                        />
                    )}
                    {marketImplied.feasibility.growthExceedsHistoricalFrequency && (
                        <AlertCard
                            type="info"
                            message="隐含增长率 >15%，历史上仅有少数公司长期维持"
                        />
                    )}
                    {!marketImplied.feasibility.marginExceedsIndustryMax &&
                        !marketImplied.feasibility.roicExceedsHistoricalMax && (
                            <AlertCard
                                type="success"
                                message="市场隐含假设在合理范围内"
                            />
                        )}
                </div>
            </div>

            {/* Summary Comparison */}
            {financialData && (
                <div className="glass-card p-6">
                    <h3 className="text-lg font-bold gradient-text mb-4">估值对比</h3>
                    <div className="flex items-center justify-around">
                        <div className="text-center">
                            <div className="text-sm text-slate-400">当前价格</div>
                            <div className="text-3xl font-bold text-white">
                                ${financialData.currentPrice.toFixed(2)}
                            </div>
                        </div>
                        <div className="text-4xl text-slate-600">→</div>
                        <div className="text-center">
                            <div className="text-sm text-slate-400">DCF 公允价值</div>
                            <div className={`text-3xl font-bold ${dcfResult.fairValuePerShare > financialData.currentPrice
                                ? 'text-emerald-400'
                                : 'text-red-400'
                                }`}>
                                ${dcfResult.fairValuePerShare.toFixed(2)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-slate-400">价差</div>
                            <div className={`text-2xl font-bold ${dcfResult.fairValuePerShare > financialData.currentPrice
                                ? 'text-emerald-400'
                                : 'text-red-400'
                                }`}>
                                {(((dcfResult.fairValuePerShare / financialData.currentPrice) - 1) * 100) > 0 ? '+' : ''}
                                {(((dcfResult.fairValuePerShare / financialData.currentPrice) - 1) * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
