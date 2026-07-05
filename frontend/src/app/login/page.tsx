'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        setTimeout(() => {
            setLoading(false)
            if (email === 'test@urfu.ru' && password === '123456') {
                window.location.href = '/dashboard'
            } else {
                setError('Неверный email или пароль')
            }
        }, 1000)
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #EEEAFF 0%, #F5F4FD 50%, #E8F4FF 100%)' }}
        >
            {/* decorative blobs */}
            <div
                className="absolute pointer-events-none"
                style={{
                    width: 520,
                    height: 520,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(108,99,255,0.13) 0%, transparent 70%)',
                    top: -140,
                    left: -140,
                }}
            />
            <div
                className="absolute pointer-events-none"
                style={{
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(108,99,255,0.10) 0%, transparent 70%)',
                    bottom: -100,
                    right: -80,
                }}
            />
            <div
                className="absolute pointer-events-none"
                style={{
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(184,240,224,0.35) 0%, transparent 70%)',
                    top: '40%',
                    right: '10%',
                }}
            />

            {/* card */}
            <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">

                {/* logo */}
                <div className="flex items-center gap-3 mb-10">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                    >
                        🎓
                    </div>
                    <span className="font-extrabold text-lg tracking-tight text-[#1C1A3A]">
                        Практика УрФУ
                    </span>
                </div>

                {/* form card */}
                <div className="w-full bg-white rounded-2xl shadow-lg p-8"
                    style={{ boxShadow: '0 8px 40px rgba(108,99,255,0.12)' }}
                >
                    <div className="mb-7">
                        <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1.5">
                            Добро пожаловать
                        </h1>
                        <p className="text-sm text-[#6B6880]">
                            Войди в личный кабинет практиканта
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="ivan@urfu.ru"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Пароль</Label>
                                <a href="#" className="text-xs text-[#6C63FF] hover:underline font-medium">
                                    Забыл пароль?
                                </a>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 bg-[#FFF5F5] border-[1.5px] border-[#F0BABA] rounded-xl px-4 py-3">
                                <span className="text-sm">⚠️</span>
                                <p className="text-sm text-[#D94F4F]">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full text-white font-semibold py-5 rounded-lg shadow-md mt-1"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                        >
                            {loading ? 'Входим…' : 'Войти →'}
                        </Button>

                    </form>
                </div>

                {/* bottom hint */}
                <div className="flex items-center gap-2 mt-6 text-sm text-[#6B6880]">
                    <span>Ещё нет аккаунта?</span>
                    <a href="/apply" className="text-[#6C63FF] font-semibold hover:underline">
                        Подать заявку →
                    </a>
                </div>

                {/* feature pills */}
                <div className="flex flex-wrap justify-center gap-2 mt-8">
                    {[
                        '📋 Статус заявки',
                        '📄 Документы',
                        '✅ Дневник задач',
                    ].map(item => (
                        <span
                            key={item}
                            className="text-xs font-medium px-3 py-1.5 rounded-full border-[1.5px] border-[#E4E2F4] bg-white text-[#6B6880]"
                        >
                            {item}
                        </span>
                    ))}
                </div>

            </div>
        </div>
    )
}