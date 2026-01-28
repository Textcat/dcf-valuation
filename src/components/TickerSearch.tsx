/**
 * Stock Search Component
 */

import { useState, useCallback } from 'react'
import { searchStocks } from '@/services/fmp'
import { useAppStore } from '@/stores/appStore'

interface SearchResult {
    symbol: string
    name: string
}

export function TickerSearch() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)

    const { loadSymbol, isLoading } = useAppStore()

    const handleSearch = useCallback(async (value: string) => {
        setQuery(value)

        if (value.length < 1) {
            setResults([])
            setShowDropdown(false)
            return
        }

        setIsSearching(true)
        try {
            const data = await searchStocks(value)
            setResults(data.slice(0, 8))
            setShowDropdown(true)
        } catch (err) {
            console.error('Search failed:', err)
            setResults([])
        } finally {
            setIsSearching(false)
        }
    }, [])

    const handleSelect = useCallback((symbol: string) => {
        setQuery(symbol)
        setShowDropdown(false)
        loadSymbol(symbol)
    }, [loadSymbol])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.length > 0) {
            setShowDropdown(false)
            loadSymbol(query)
        }
    }, [query, loadSymbol])

    return (
        <div className="relative w-full max-w-md">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    placeholder="输入股票代码 (如 AAPL, MSFT)"
                    disabled={isLoading}
                    className="w-full px-4 py-3 pl-12 rounded-xl bg-slate-800/80 border border-slate-600 
                     text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 
                     focus:ring-2 focus:ring-blue-500/20 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    {isSearching || isLoading ? (
                        <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Dropdown results */}
            {showDropdown && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-card py-2 z-50 animate-fade-in">
                    {results.map((result) => (
                        <button
                            key={result.symbol}
                            onClick={() => handleSelect(result.symbol)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors
                         flex items-center justify-between group"
                        >
                            <span className="font-semibold text-blue-400 group-hover:text-blue-300">
                                {result.symbol}
                            </span>
                            <span className="text-sm text-slate-400 truncate max-w-[60%]">
                                {result.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
