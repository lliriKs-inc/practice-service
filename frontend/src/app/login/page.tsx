'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { login, getUser } from '@/services/api/auth'

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    )
}

function LoginForm() {
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect')
    const reason = searchParams.get('reason')
    const sessionExpired = reason === 'session-expired'
    const forbidden = reason === 'forbidden'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login({ email, password })
            const user = getUser()

            // Если пришли по ссылке-приглашению — возвращаемся туда
            if (redirect) {
                window.location.href = redirect
                return
            }
            window.location.href = user?.role === 'ADMIN' ? '/admin/cohorts' : '/dashboard/applications'
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Ошибка входа')
            setLoading(false)
        }
    }

    const registerHref = redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #EEEAFF 0%, #F5F4FD 50%, #E8F4FF 100%)' }}
        >
            <div className="absolute pointer-events-none" style={{ width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.13) 0%, transparent 70%)', top: -140, left: -140 }} />
            <div className="absolute pointer-events-none" style={{ width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.10) 0%, transparent 70%)', bottom: -100, right: -80 }} />
            <div className="absolute pointer-events-none" style={{ width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,240,224,0.35) 0%, transparent 70%)', top: '40%', right: '10%' }} />

            <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">

                <Link href="/" className="group flex items-center gap-3 mb-10" title="На главную">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-lg tracking-tight text-[#1C1A3A] group-hover:text-[#4A42D4] transition-colors">Практика УрФУ</span>
                </Link>

                {sessionExpired && (
                    <div className="w-full flex items-center gap-2.5 bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3 mb-5">
                        <span className="text-base">⚠️</span>
                        <p className="text-xs text-[#C93B3B] leading-relaxed">
                            Сессия истекла или недействительна. Войдите снова.
                        </p>
                    </div>
                )}

                {forbidden && (
                    <div className="w-full flex items-center gap-2.5 bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3 mb-5">
                        <span className="text-base">🚫</span>
                        <p className="text-xs text-[#C93B3B] leading-relaxed">
                            У этого аккаунта нет доступа к запрошенному разделу. Войдите под подходящим аккаунтом.
                        </p>
                    </div>
                )}

                {/* Если пришли по инвайту — показываем контекст */}
                {redirect && !sessionExpired && !forbidden && (
                    <div className="w-full flex items-center gap-2.5 bg-[#EBE9FF] border border-[#C4BEFF] rounded-xl px-4 py-3 mb-5">
                        <span className="text-base">📨</span>
                        <p className="text-xs text-[#4A42D4] leading-relaxed">
                            Войдите, чтобы продолжить заполнение анкеты по приглашению.
                        </p>
                    </div>
                )}

                <div className="w-full bg-white rounded-2xl shadow-lg p-8" style={{ boxShadow: '0 8px 40px rgba(108,99,255,0.12)' }}>
                    <div className="mb-7">
                        <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1.5">Добро пожаловать</h1>
                        <p className="text-sm text-[#6B6880]">Войди в личный кабинет практиканта</p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">E-mail</Label>
                            <Input id="email" type="email" placeholder="ivan@urfu.ru"
                                value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Пароль</Label>
                                <a href="#" className="text-xs text-[#4A42D4] hover:underline font-medium">Забыл пароль?</a>
                            </div>
                            <Input id="password" type="password" placeholder="••••••••"
                                value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 bg-[#FFF5F5] border-[1.5px] border-[#F0BABA] rounded-xl px-4 py-3">
                                <span className="text-sm">⚠️</span>
                                <p className="text-sm text-[#C93B3B]">{error}</p>
                            </div>
                        )}

                        <Button type="submit" disabled={loading}
                            className="w-full text-white font-semibold py-5 rounded-lg shadow-md mt-1"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                            {loading ? 'Входим…' : 'Войти →'}
                        </Button>
                    </form>
                </div>

                <div className="flex items-center gap-2 mt-6 text-sm text-[#6B6880]">
                    <span>Ещё нет аккаунта?</span>
                    <a href={registerHref} className="text-[#4A42D4] font-semibold hover:underline">
                        Зарегистрироваться →
                    </a>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mt-8">
                    {['📋 Статус заявки', '📄 Документы', '✅ Дневник задач'].map(item => (
                        <span key={item} className="text-xs font-medium px-3 py-1.5 rounded-full border-[1.5px] border-[#E4E2F4] bg-white text-[#6B6880]">
                            {item}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
