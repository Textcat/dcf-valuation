/**
 * Main App Component
 */

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { TickerSearch } from '@/components/TickerSearch'
import { FinancialOverview } from '@/components/FinancialOverview'
import { DCFInputPanel } from '@/components/DCFInputPanel'
import { ValidationDashboard } from '@/components/ValidationDashboard'
import { MonteCarloDashboard } from '@/components/MonteCarloDashboard'
import { SnapshotHistory } from '@/components/SnapshotHistory'
import { AuthScreen } from '@/components/AuthScreen'
import { useAppStore } from '@/stores/appStore'
import { supabase } from '@/services/supabase'

function App() {
    const {
        financialData,
        isLoading,
        error,
        clearError,
        activeTab,
        setActiveTab,
        reset
    } = useAppStore()

    const [session, setSession] = useState<Session | null>(null)
    const [isAuthLoading, setIsAuthLoading] = useState(true)

    useEffect(() => {
        let isMounted = true
        supabase.auth.getSession().then(({ data }) => {
            if (!isMounted) return
            setSession(data.session ?? null)
            setIsAuthLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (!isMounted) return
            setSession(nextSession ?? null)
            setIsAuthLoading(false)
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        if (!isAuthLoading && !session) {
            reset()
        }
    }, [isAuthLoading, session, reset])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
    }

    if (isAuthLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="glass-card p-12 text-center">
                    <div className="inline-block w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-slate-300">正在加载登录状态...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return <AuthScreen />
    }

    return (
        <div className="min-h-screen p-6 md:p-10">
            {/* Header */}
            <header className="max-w-6xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold gradient-text">
                            DCF Validation Framework
                        </h1>
                        <p className="text-slate-400 mt-1">
                            三层验证闭环 · 快速可检验的估值系统
                        </p>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="text-xs text-slate-400 md:text-right">
                            已登录: <span className="text-slate-200">{session.user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TickerSearch />
                            <button
                                onClick={handleSignOut}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700"
                            >
                                退出登录
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Error Alert */}
            {error && (
                <div className="max-w-6xl mx-auto mb-6">
                    <div className="bg-red-900/30 border border-red-600/50 text-red-300 px-4 py-3 rounded-xl flex justify-between items-center">
                        <span>{error}</span>
                        <button
                            onClick={clearError}
                            className="text-red-400 hover:text-red-300"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="max-w-6xl mx-auto">
                    <div className="glass-card p-12 text-center">
                        <div className="inline-block w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-slate-300">正在加载财务数据...</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {!isLoading && financialData && (
                <main className="max-w-6xl mx-auto space-y-6">
                    {/* Financial Overview */}
                    <FinancialOverview />

                    {/* Tab Navigation */}
                    <div className="flex gap-6 border-b border-slate-700/50 pb-0">
                        <button
                            onClick={() => setActiveTab('input')}
                            className={`tab-button px-1 py-3 text-sm font-medium transition-colors
                ${activeTab === 'input'
                                    ? 'text-white active'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            DCF 参数
                        </button>
                        <button
                            onClick={() => setActiveTab('validation')}
                            className={`tab-button px-1 py-3 text-sm font-medium transition-colors
                ${activeTab === 'validation'
                                    ? 'text-white active'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            验证结果
                        </button>
                        <button
                            onClick={() => setActiveTab('monte-carlo')}
                            className={`tab-button px-1 py-3 text-sm font-medium transition-colors
                ${activeTab === 'monte-carlo'
                                    ? 'text-white active'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Monte Carlo
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`tab-button px-1 py-3 text-sm font-medium transition-colors
                ${activeTab === 'history'
                                    ? 'text-white active'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            历史快照
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'input' && <DCFInputPanel />}
                    {activeTab === 'validation' && <ValidationDashboard />}
                    {activeTab === 'monte-carlo' && <MonteCarloDashboard />}
                    {activeTab === 'history' && <SnapshotHistory />}
                </main>
            )}

            {/* Empty State - with history access */}
            {!isLoading && !financialData && !error && (
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Quick access to history */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                ${activeTab === 'history'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            📸 历史快照
                        </button>
                    </div>

                    {activeTab === 'history' ? (
                        <SnapshotHistory />
                    ) : (
                        <div className="glass-card p-12 text-center">
                            <div className="text-6xl mb-4">📊</div>
                            <h2 className="text-2xl font-bold text-white mb-2">开始分析</h2>
                            <p className="text-slate-400 max-w-md mx-auto">
                                输入股票代码以加载财务数据，构建三层可验证的 DCF 估值模型
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <footer className="max-w-6xl mx-auto mt-12 pt-6 border-t border-slate-800 text-center text-sm text-slate-500">
                <p>DCF Validation Framework · 数据来源: Financial Modeling Prep</p>
            </footer>
        </div>
    )
}

export default App
