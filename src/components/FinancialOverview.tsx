/**
 * Financial Overview Card
 * Displays key financial metrics after loading a stock
 */

import { useAppStore } from '@/stores/appStore'

function formatNumber(value: number, decimals = 2): string {
    const isNegative = value < 0
    const absValue = Math.abs(value)
    let formatted: string

    if (absValue >= 1e12) {
        formatted = `$${(absValue / 1e12).toFixed(decimals)}T`
    } else if (absValue >= 1e9) {
        formatted = `$${(absValue / 1e9).toFixed(decimals)}B`
    } else if (absValue >= 1e6) {
        formatted = `$${(absValue / 1e6).toFixed(decimals)}M`
    } else if (absValue >= 1e3) {
        formatted = `$${(absValue / 1e3).toFixed(decimals)}K`
    } else {
        formatted = `$${absValue.toFixed(decimals)}`
    }

    return isNegative ? `-${formatted}` : formatted
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`
}

interface MetricCardProps {
    label: string
    value: string
    subValue?: string
    highlight?: 'positive' | 'negative' | 'neutral'
}

function MetricCard({ label, value, subValue, highlight = 'neutral' }: MetricCardProps) {
    const highlightColors = {
        positive: 'text-emerald-400',
        negative: 'text-red-400',
        neutral: 'text-white'
    }

    return (
        <div className="metric-card bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600/50">
            <div className="text-sm text-slate-400 mb-1">{label}</div>
            <div className={`text-xl font-bold ${highlightColors[highlight]}`}>{value}</div>
            {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
        </div>
    )
}

export function FinancialOverview() {
    const { financialData } = useAppStore()

    if (!financialData) return null

    const data = financialData

    // Determine margin health
    const marginHighlight = data.operatingMargin > 0.15 ? 'positive' :
        data.operatingMargin > 0 ? 'neutral' : 'negative'

    // Determine PE health
    const peHighlight = data.currentPE > 0 && data.currentPE < 25 ? 'positive' :
        data.currentPE > 40 ? 'negative' : 'neutral'

    return (
        <div className="glass-card p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold gradient-text">{data.symbol}</h2>
                    <p className="text-slate-400">{data.companyName}</p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-white">
                        ${data.currentPrice.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">
                        市值: {formatNumber(data.marketCap)}
                    </div>
                </div>
            </div>

            {/* TTM Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MetricCard
                    label="TTM 收入"
                    value={formatNumber(data.ttmRevenue)}
                />
                <MetricCard
                    label="TTM 净利润"
                    value={formatNumber(data.ttmNetIncome)}
                    highlight={data.ttmNetIncome > 0 ? 'positive' : 'negative'}
                />
                <MetricCard
                    label="TTM FCF"
                    value={formatNumber(data.ttmFCF)}
                    highlight={data.ttmFCF > 0 ? 'positive' : 'negative'}
                />
                <MetricCard
                    label="营业利润率"
                    value={formatPercent(data.operatingMargin)}
                    highlight={marginHighlight}
                />
            </div>

            {/* Valuation Metrics */}
            <div className="border-t border-slate-700/50 pt-4">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">估值指标</h3>
                <div className="grid grid-cols-3 gap-4">
                    <MetricCard
                        label="P/E (TTM)"
                        value={data.currentPE > 0 ? data.currentPE.toFixed(1) + 'x' : 'N/A'}
                        subValue={data.pePercentiles.p50 > 0 ? `历史中位数: ${data.pePercentiles.p50.toFixed(1)}x` : undefined}
                        highlight={peHighlight}
                    />
                    <MetricCard
                        label="P/FCF"
                        value={data.currentPFCF > 0 ? data.currentPFCF.toFixed(1) + 'x' : 'N/A'}
                        subValue={data.pfcfPercentiles.p50 > 0 ? `历史中位数: ${data.pfcfPercentiles.p50.toFixed(1)}x` : undefined}
                    />
                    <MetricCard
                        label="净现金/(负债)"
                        value={formatNumber(data.netCash)}
                        highlight={data.netCash > 0 ? 'positive' : 'negative'}
                    />
                </div>
            </div>

            {/* Analyst Estimates */}
            {data.analystEstimates.length > 0 && (
                <div className="border-t border-slate-700/50 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-slate-400 mb-3">分析师预测</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400">
                                    <th className="text-left py-2">年度</th>
                                    <th className="text-right py-2">EPS (Low)</th>
                                    <th className="text-right py-2">EPS (Avg)</th>
                                    <th className="text-right py-2">EPS (High)</th>
                                    <th className="text-right py-2">分析师#</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.analystEstimates.map((est) => (
                                    <tr key={est.fiscalYear} className="border-t border-slate-700/30">
                                        <td className="py-2 font-medium text-blue-400">{est.fiscalYear}</td>
                                        <td className="text-right text-red-400">${est.epsLow.toFixed(2)}</td>
                                        <td className="text-right text-white font-semibold">${est.epsAvg.toFixed(2)}</td>
                                        <td className="text-right text-emerald-400">${est.epsHigh.toFixed(2)}</td>
                                        <td className="text-right text-slate-400">{est.numAnalysts || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
