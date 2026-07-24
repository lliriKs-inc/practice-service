'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GraduationCap, MoveRight, MailCheck, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
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

    const [fullName, setFullName] = useState('')
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
            await register({ email, password, full_name: fullName })
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
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#EEEAFF] via-surface to-[#E8F4FF] py-10">
            <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.13) 0%, transparent 70%)', top: -140, left: -140, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.10) 0%, transparent 70%)', bottom: -100, right: -80, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,240,224,0.35) 0%, transparent 70%)', top: '40%', right: '10%', pointerEvents: 'none' }} />

            <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">

                <Link href="/" className="group flex items-center gap-3 mb-10" title="На главную">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105 bg-gradient-to-br from-brand to-brand-light"><GraduationCap className="size-5" /></div>
                    <span className="font-extrabold text-lg tracking-tight text-ink group-hover:text-brand-hover transition-colors">Практика УрФУ</span>
                </Link>

                {redirect && (
                    <Alert className="w-full bg-brand-subtle border-brand-subtle-border mb-5">
                        <AlertDescription className="flex items-center gap-2.5 text-sm text-brand-hover leading-relaxed">
                            <MailCheck className="size-4 flex-shrink-0" /> Создайте аккаунт, чтобы продолжить заполнение анкеты по приглашению.
                        </AlertDescription>
                    </Alert>
                )}

                <Card className="w-full p-8 rounded-2xl" style={{ boxShadow: '0 8px 40px rgba(108,99,255,0.12)' }}>
                    <div className="mb-7">
                        <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1.5">Создать аккаунт</h1>
                        <p className="text-sm text-muted-ink">
                            {redirect ? 'После регистрации вы сразу вернётесь к заполнению анкеты' : 'После регистрации заполните анкету для подачи заявки'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="fullName">ФИО</Label>
                            <Input id="fullName" type="text" placeholder="Иванов Иван Иванович"
                                value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">E-mail</Label>
                            <Input id="email" type="email" placeholder="ivan@urfu.ru"
                                value={email} onChange={(e) => setEmail(e.target.value)} required />
                            <span className="text-xs text-muted-ink">Используется для входа в систему</span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="password">Пароль</Label>
                            <Input id="password" type="password" placeholder="••••••••"
                                value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <span className="text-xs text-muted-ink">Минимум 8 символов</span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="passwordConfirm">Повторите пароль</Label>
                            <Input id="passwordConfirm" type="password" placeholder="••••••••"
                                value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
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
                            {loading ? 'Создаём аккаунт…' : <>Зарегистрироваться<MoveRight className="size-4" /></>}
                        </Button>
                    </form>
                </Card>

                <div className="flex items-center gap-2 mt-6 text-sm text-muted-ink">
                    <span>Уже есть аккаунт?</span>
                    <a href={loginHref} className="inline-flex items-center gap-1 text-brand-hover font-semibold bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                        Войти<MoveRight className="size-4" />
                    </a>
                </div>
            </div>
        </div>
    )
}
