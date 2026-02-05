/**
 * DCF Input Panel
 * Allows users to configure DCF parameters
 */

import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { DCFInputs, ValueDrivers } from '@/types'
import { getIndustryBenchmark, getIndustryThresholds } from '@/data/industryBenchmarks'

interface NumberInputProps {
    label: string
    value: number
    onChange: (value: number) => void
    step?: number
    min?: number
    max?: number
    isPercent?: boolean
    disabled?: boolean
}

function NumberInput({
    label,
    value,
    onChange,
    step = 0.01,
    min = 0,
    max = 1,
    isPercent = true,
    disabled = false
}: NumberInputProps) {
    const displayValue = isPercent ? (value * 100).toFixed(1) : value.toFixed(2)

    return (
        <div className="flex flex-col">
            <label className="text-xs text-slate-400 mb-1">{label}</label>
            <div className="relative">
                <input
                    type="number"
                    value={displayValue}
                    onChange={(e) => {
                        const raw = parseFloat(e.target.value)
                        if (!isNaN(raw)) {
                            onChange(isPercent ? raw / 100 : raw)
                        }
                    }}
                    step={isPercent ? step * 100 : step}
                    min={isPercent ? min * 100 : min}
                    max={isPercent ? max * 100 : max}
                    disabled={disabled}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 
                     text-white text-sm focus:outline-none focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {isPercent && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                )}
            </div>
        </div>
    )
}

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

function DriverRow({
    year,
    driver,
    onChange
}: {
    year: number
    driver: ValueDrivers
    onChange: (driver: ValueDrivers) => void
}) {
    const update = (key: keyof ValueDrivers, value: number) => {
        onChange({ ...driver, [key]: value })
    }

    return (
        <div className="grid grid-cols-6 gap-2 items-center py-2 border-b border-slate-700/30">
            <div className="text-sm font-semibold text-blue-400">Year {year}</div>
            <NumberInput label="收入增速" value={driver.revenueGrowth} onChange={(v) => update('revenueGrowth', v)} max={1} />
            <NumberInput label="营业利润率" value={driver.operatingMargin} onChange={(v) => update('operatingMargin', v)} />
            <NumberInput label="D&A %" value={driver.daPercent} onChange={(v) => update('daPercent', v)} max={0.2} />
            <NumberInput label="CapEx %" value={driver.capexPercent} onChange={(v) => update('capexPercent', v)} max={0.3} />
            <NumberInput label="WC变动 %" value={driver.wcChangePercent} onChange={(v) => update('wcChangePercent', v)} min={-0.1} max={0.1} />
        </div>
    )
}

export function DCFInputPanel() {
    const { dcfInputs, setDCFInputs, runDCF, dcfResult, runValidation, financialData, saveCurrentAsSnapshot } = useAppStore()
    const [snapshotNote, setSnapshotNote] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)

    if (!dcfInputs || !financialData) return null

    const benchmark = getIndustryBenchmark(financialData.industry, financialData.sector)
    const thresholds = getIndustryThresholds(benchmark)
    const lowerExtremeROIC = Math.min(-0.10, benchmark.afterTaxROIC - 0.30)
    const steadyStateROICExtreme = dcfInputs.steadyStateROIC > thresholds.roicError
    const historicalROICExtreme =
        financialData.historicalROIC > thresholds.roicError ||
        financialData.historicalROIC < lowerExtremeROIC
    const baseRevenueSource = financialData.latestAnnualRevenue > 0 ? '年报' : 'TTM'

    const updateDriver = (index: number, driver: ValueDrivers) => {
        const newDrivers = [...dcfInputs.drivers]
        newDrivers[index] = driver
        setDCFInputs({ ...dcfInputs, drivers: newDrivers })
    }

    const updateInput = <K extends keyof DCFInputs>(key: K, value: DCFInputs[K]) => {
        setDCFInputs({ ...dcfInputs, [key]: value })
    }

    const handleCalculate = () => {
        runDCF()
        runValidation()
        setSaveSuccess(false)
    }

    const handleSaveSnapshot = async () => {
        setIsSaving(true)
        setSaveSuccess(false)
        try {
            const id = await saveCurrentAsSnapshot(snapshotNote || undefined)
            if (id) {
                setSaveSuccess(true)
                setSnapshotNote('')
                // Reset success message after 3 seconds
                setTimeout(() => setSaveSuccess(false), 3000)
            }
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="glass-card p-6 animate-fade-in space-y-6">
            <h3 className="text-lg font-bold gradient-text">DCF 参数配置</h3>

            {/* Terminal Settings */}
            <div className="p-4 bg-slate-800/50 rounded-xl space-y-4">
                {/* WACC Calculation Info */}
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-400">WACC 计算 (CAPM)</span>
                        <span className="text-xs text-blue-400">
                            β = {financialData.beta.toFixed(2)}
                        </span>
                    </div>
                    <div className="text-xs text-slate-500">
                        Re = Rf + β × MRP = 4.5% + {financialData.beta.toFixed(2)} × 5% = {((0.045 + financialData.beta * 0.05) * 100).toFixed(1)}%
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <NumberInput
                        label="WACC"
                        value={dcfInputs.wacc}
                        onChange={(v) => updateInput('wacc', v)}
                        min={0.05}
                        max={0.2}
                    />
                    <NumberInput
                        label="终值增长率"
                        value={dcfInputs.terminalGrowthRate}
                        onChange={(v) => updateInput('terminalGrowthRate', v)}
                        min={0}
                        max={0.05}
                    />
                    <NumberInput
                        label="稳态ROIC"
                        value={dcfInputs.steadyStateROIC}
                        onChange={(v) => updateInput('steadyStateROIC', v)}
                        min={0.05}
                        max={1.0}
                    />
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-400 mb-1">终值方法</label>
                        <select
                            value={dcfInputs.terminalMethod}
                            onChange={(e) => updateInput('terminalMethod', e.target.value as DCFInputs['terminalMethod'])}
                            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 
                           text-white text-sm focus:outline-none focus:border-blue-500"
                        >
                            <option value="perpetuity">永续增长</option>
                            <option value="roic-driven">ROIC驱动</option>
                            <option value="fade">Fade模型</option>
                        </select>
                    </div>
                </div>

                {steadyStateROICExtreme && (
                    <div className="text-xs text-amber-400">
                        稳态ROIC高于行业极值区间(&gt;{(thresholds.roicError * 100).toFixed(1)}%)，估值对护城河假设敏感
                    </div>
                )}

                {/* Historical Ratios Info */}
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50 space-y-1">
                    <div>
                        <span className="text-slate-400">历史比率 (年报): </span>
                        D&A/Rev = {(financialData.historicalDAPercent * 100).toFixed(1)}% |
                        CapEx/Rev = {(financialData.historicalCapexPercent * 100).toFixed(1)}% |
                        ROIC = {(financialData.historicalROIC * 100).toFixed(1)}%
                    </div>
                    <div>
                        <span className="text-slate-400">基期收入 ({baseRevenueSource}): </span>
                        {formatNumber(dcfInputs.baseRevenue)}
                    </div>
                </div>
                {historicalROICExtreme && (
                    <div className="text-xs text-amber-400">
                        历史ROIC偏离行业常态，可能存在行业特例
                    </div>
                )}
            </div>

            {/* Yearly Drivers */}
            <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">显性期驱动因子 (5年)</h4>
                <div className="space-y-1">
                    {dcfInputs.drivers.map((driver, index) => (
                        <DriverRow
                            key={index}
                            year={index + 1}
                            driver={driver}
                            onChange={(d) => updateDriver(index, d)}
                        />
                    ))}
                </div>
            </div>

            {/* Calculate Button */}
            <button
                onClick={handleCalculate}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 
                   text-white font-semibold hover:from-blue-500 hover:to-purple-500 
                   transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
            >
                计算 DCF 估值
            </button>

            {/* Results */}
            {dcfResult && (
                <div className="p-4 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-xl border border-emerald-700/50">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-sm text-slate-400">公允价值</div>
                            <div className="text-2xl font-bold text-emerald-400">
                                ${dcfResult.fairValuePerShare.toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-500">
                                当前: ${financialData.currentPrice.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400">上行/下行</div>
                            <div className={`text-2xl font-bold ${dcfResult.fairValuePerShare > financialData.currentPrice
                                ? 'text-emerald-400'
                                : 'text-red-400'
                                }`}>
                                {(((dcfResult.fairValuePerShare / financialData.currentPrice) - 1) * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400">终值占比</div>
                            <div className={`text-2xl font-bold ${dcfResult.terminalValuePercent > 75
                                ? 'text-amber-400'
                                : 'text-white'
                                }`}>
                                {dcfResult.terminalValuePercent.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    {/* Save Snapshot Section */}
                    <div className="mt-4 pt-4 border-t border-slate-600/50">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={snapshotNote}
                                onChange={(e) => setSnapshotNote(e.target.value)}
                                placeholder="添加备注 (可选)"
                                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 
                                   text-white text-sm focus:outline-none focus:border-blue-500
                                   placeholder:text-slate-500"
                            />
                            <button
                                onClick={handleSaveSnapshot}
                                disabled={isSaving}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 
                                   text-white text-sm font-medium transition-colors
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        保存中...
                                    </>
                                ) : (
                                    '📸 保存快照'
                                )}
                            </button>
                        </div>
                        {saveSuccess && (
                            <p className="mt-2 text-sm text-emerald-400">
                                ✓ 快照保存成功！可在"历史快照"页面查看
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
