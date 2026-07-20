'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GraduationCap, MoveRight, ClipboardList, FileText, ListChecks, TriangleAlert, ShieldAlert, MailCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
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
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#EEEAFF] via-surface to-[#E8F4FF]">
            <div className="absolute pointer-events-none" style={{ width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.13) 0%, transparent 70%)', top: -140, left: -140 }} />
            <div className="absolute pointer-events-none" style={{ width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.10) 0%, transparent 70%)', bottom: -100, right: -80 }} />
            <div className="absolute pointer-events-none" style={{ width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,240,224,0.35) 0%, transparent 70%)', top: '40%', right: '10%' }} />

            <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">

                <Link href="/" className="group flex items-center gap-3 mb-10" title="На главную">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105 bg-gradient-to-br from-brand to-brand-light"><GraduationCap className="size-5" /></div>
                    <span className="font-extrabold text-lg tracking-tight text-ink group-hover:text-brand-hover transition-colors">Практика УрФУ</span>
                </Link>

                {sessionExpired && (
                    <Alert className="w-full bg-danger-bg border-danger-border mb-5">
                        <AlertDescription className="flex items-center gap-2.5 text-sm text-danger leading-relaxed">
                            <TriangleAlert className="size-4 flex-shrink-0" /> Сессия истекла или недействительна. Войдите снова.
                        </AlertDescription>
                    </Alert>
                )}

                {forbidden && (
                    <Alert className="w-full bg-danger-bg border-danger-border mb-5">
                        <AlertDescription className="flex items-center gap-2.5 text-sm text-danger leading-relaxed">
                            <ShieldAlert className="size-4 flex-shrink-0" /> У этого аккаунта нет доступа к запрошенному разделу. Войдите под подходящим аккаунтом.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Если пришли по инвайту — показываем контекст */}
                {redirect && !sessionExpired && !forbidden && (
                    <Alert className="w-full bg-brand-subtle border-brand-subtle-border mb-5">
                        <AlertDescription className="flex items-center gap-2.5 text-sm text-brand-hover leading-relaxed">
                            <MailCheck className="size-4 flex-shrink-0" /> Войдите, чтобы продолжить заполнение анкеты по приглашению.
                        </AlertDescription>
                    </Alert>
                )}

                <Card className="w-full p-8 rounded-2xl shadow-lg" style={{ boxShadow: '0 8px 40px rgba(108,99,255,0.12)' }}>
                    <div className="mb-7">
                        <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1.5">Добро пожаловать</h1>
                        <p className="text-sm text-muted-ink">Войдите в личный кабинет практиканта</p>
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
                                <a href="#" className="self-start text-xs text-brand-hover font-medium bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">Забыли пароль?</a>
                            </div>
                            <Input id="password" type="password" placeholder="••••••••"
                                value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>

                        {error && (
                            <Alert className="bg-danger-bg border-danger-border">
                                <AlertDescription className="flex items-center gap-2 text-sm text-danger">
                                    <TriangleAlert className="size-4 flex-shrink-0" /> {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button type="submit" variant="brand" disabled={loading}
                            className="w-full py-5 rounded-lg mt-1">
                            {loading ? 'Входим…' : <>Войти<MoveRight className="size-4" /></>}
                        </Button>
                    </form>
                </Card>

                <div className="flex items-center gap-2 mt-6 text-sm text-muted-ink">
                    <span>Ещё нет аккаунта?</span>
                    <a href={registerHref} className="inline-flex items-center gap-1 text-brand-hover font-semibold bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                        Зарегистрироваться<MoveRight className="size-4" />
                    </a>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {[
                        { icon: ClipboardList, label: 'Статус заявки' },
                        { icon: FileText, label: 'Документы' },
                        { icon: ListChecks, label: 'Дневник задач' },
                    ].map(item => (
                        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border-[1.5px] border-border-soft bg-white text-muted-ink">
                            <item.icon className="size-3.5 text-brand-hover" />{item.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
