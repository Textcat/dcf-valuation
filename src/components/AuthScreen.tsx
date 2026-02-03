import { useMemo, useState } from 'react'
import { supabase } from '@/services/supabase'

export function AuthScreen() {
    const [email, setEmail] = useState('')
    const [token, setToken] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const isEmailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email])

    const sendOtp = async () => {
        if (!isEmailValid || isSending) return
        setIsSending(true)
        setError(null)
        setMessage(null)

        const { error: sendError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: window.location.origin
            }
        })

        if (sendError) {
            setError(sendError.message)
        } else {
            setOtpSent(true)
            setMessage('验证码或登录链接已发送，请查收邮箱。')
        }

        setIsSending(false)
    }

    const verifyOtp = async () => {
        if (!isEmailValid || !token || isVerifying) return
        setIsVerifying(true)
        setError(null)
        setMessage(null)

        const { error: verifyError } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        })

        if (verifyError) {
            setError(verifyError.message)
        } else {
            setMessage('验证成功，正在登录...')
        }

        setIsVerifying(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="glass-card w-full max-w-md p-8 space-y-6 animate-fade-in">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold gradient-text">DCF Validation Framework</h1>
                    <p className="text-slate-400">登录后即可跨设备同步估值快照与预测历史</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-300">邮箱</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value.trim())}
                            className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none"
                        />
                    </div>

                    <button
                        onClick={sendOtp}
                        disabled={!isEmailValid || isSending}
                        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 px-4 py-2 text-sm font-semibold text-white"
                    >
                        {isSending ? '发送中...' : '发送验证码 / 登录链接'}
                    </button>

                    {otpSent && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-300">验证码</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="6 位验证码"
                                    value={token}
                                    onChange={(event) => setToken(event.target.value.trim())}
                                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={verifyOtp}
                                disabled={!token || isVerifying}
                                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 px-4 py-2 text-sm font-semibold text-white"
                            >
                                {isVerifying ? '验证中...' : '使用验证码登录'}
                            </button>
                            <p className="text-xs text-slate-500">
                                也可直接点击邮件中的登录链接，返回本页即可自动登录。
                            </p>
                        </div>
                    )}
                </div>

                {(message || error) && (
                    <div
                        className={`rounded-lg px-4 py-3 text-sm ${error
                            ? 'bg-red-900/30 border border-red-600/50 text-red-300'
                            : 'bg-emerald-900/30 border border-emerald-600/40 text-emerald-200'
                            }`}
                    >
                        {error ?? message}
                    </div>
                )}
            </div>
        </div>
    )
}
