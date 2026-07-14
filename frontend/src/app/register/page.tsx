'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { register, login } from '@/services/api/auth'

export default function RegisterPage() {
    return (
        <Suspense fallback={null}>
            <RegisterForm />
        </Suspense>
    )
}

function RegisterForm() {
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect')

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (password !== passwordConfirm) {
            setError('Пароли не совпадают')
            return
        }
        if (password.length < 8) {
            setError('Пароль должен быть не менее 8 символов')
            return
        }

        setLoading(true)
        try {
            await register({ email, password })
            // [FIX] Раньше после регистрации кидало на /login, где нужно было
            // ещё раз вводить только что придуманный пароль. Раз пароль уже
            // известен — сразу логинимся и идём прямиком по назначению.
            await login({ email, password })
            window.location.href = redirect || '/dashboard/applications'
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Ошибка регистрации')
            setLoading(false)
        }
    }

    const loginHref = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #EEEAFF 0%, #F5F4FD 50%, #E8F4FF 100%)' }}
        >
            <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.13) 0%, transparent 70%)', top: -140, left: -140, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.10) 0%, transparent 70%)', bottom: -100, right: -80, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,240,224,0.35) 0%, transparent 70%)', top: '40%', right: '10%', pointerEvents: 'none' }} />

            <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">

                <Link href="/" className="group flex items-center gap-3 mb-10" title="На главную">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-lg tracking-tight text-[#1C1A3A] group-hover:text-[#6C63FF] transition-colors">Практика УрФУ</span>
                </Link>

                {redirect && (
                    <div className="w-full flex items-center gap-2.5 bg-[#EBE9FF] border border-[#C4BEFF] rounded-xl px-4 py-3 mb-5">
                        <span className="text-base">📨</span>
                        <p className="text-xs text-[#4A42D4] leading-relaxed">
                            Создайте аккаунт, чтобы продолжить заполнение анкеты по приглашению.
                        </p>
                    </div>
                )}

                <div className="w-full bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 40px rgba(108,99,255,0.12)' }}>
                    <div className="mb-7">
                        <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1.5">Создать аккаунт</h1>
                        <p className="text-sm text-[#6B6880]">
                            {redirect ? 'После регистрации сразу вернёшься к заполнению анкеты' : 'После регистрации заполни анкету для подачи заявки'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">E-mail</Label>
                            <Input id="email" type="email" placeholder="ivan@urfu.ru"
                                value={email} onChange={(e) => setEmail(e.target.value)} required />
                            <span className="text-xs text-[#A9A7BB]">Используется для входа в систему</span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="password">Пароль</Label>
                            <Input id="password" type="password" placeholder="••••••••"
                                value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <span className="text-xs text-[#A9A7BB]">Минимум 8 символов</span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="passwordConfirm">Повторите пароль</Label>
                            <Input id="passwordConfirm" type="password" placeholder="••••••••"
                                value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 bg-[#FFF5F5] border-[1.5px] border-[#F0BABA] rounded-xl px-4 py-3">
                                <span className="text-sm">⚠️</span>
                                <p className="text-sm text-[#D94F4F]">{error}</p>
                            </div>
                        )}

                        <Button type="submit" disabled={loading}
                            className="w-full text-white font-semibold py-5 rounded-lg shadow-md mt-1"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                            {loading ? 'Создаём аккаунт…' : 'Зарегистрироваться →'}
                        </Button>
                    </form>
                </div>

                <div className="flex items-center gap-2 mt-6 text-sm text-[#6B6880]">
                    <span>Уже есть аккаунт?</span>
                    <a href={loginHref} className="text-[#6C63FF] font-semibold hover:underline">Войти →</a>
                </div>
            </div>
        </div>
    )
}
