'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { GraduationCap, MoveRight, MailCheck, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isAuthenticated, getUser } from '@/services/api/auth'
import { describeApiErrors } from '@/lib/api/error-messages'
import {
    getInvitationForm,
    submitApplication,
    type InvitationForm,
    type Question,
} from '@/services/api/invitation'

type PageState = 'loading' | 'invalid' | 'need-auth' | 'admin-blocked' | 'form' | 'submitted' | 'submit-error'

export default function ApplyByInvitationPage() {
    const params = useParams()
    const token = params.token as string

    const [state, setState] = useState<PageState>('loading')
    const [form, setForm] = useState<InvitationForm | null>(null)
    const [loadError, setLoadError] = useState('')

    const [trackId, setTrackId] = useState('')
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    // ── Загрузка анкеты по токену ──────────────────────────────────
    useEffect(() => {
        getInvitationForm(token)
            .then(async data => {
                setForm(data)
                if (data.tracks.length === 1) setTrackId(data.tracks[0].id)

                if (!isAuthenticated()) {
                    setState('need-auth')
                    return
                }

                // [FIX] Ссылка-приглашение предназначена кандидатам, а не
                // организаторам — раньше залогиненный админ мог заполнить
                // и отправить анкету от своего имени.
                if (getUser()?.role === 'ADMIN') {
                    setState('admin-blocked')
                    return
                }

                setState('form')
            })
            .catch(err => {
                setLoadError(err instanceof Error ? err.message : 'Ссылка недействительна')
                setState('invalid')
            })
    }, [token])

    function goAuth(path: 'login' | 'register') {
        const redirect = encodeURIComponent(`/apply/${token}`)
        window.location.href = `/${path}?redirect=${redirect}`
    }

    function setAnswer(questionId: string, value: string) {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form) return

        if (!trackId) {
            setSubmitError('Выберите направление практики')
            return
        }

        const missingRequired = form.questions.find(
            q => q.required && !answers[q.id]?.trim()
        )
        if (missingRequired) {
            setSubmitError(`Заполните обязательное поле: «${missingRequired.label}»`)
            return
        }

        setSubmitting(true)
        setSubmitError('')

        try {
            const answersArray = form.questions
                .filter(q => answers[q.id]?.trim())
                .map(q => ({ question_id: q.id, answer_value: answers[q.id] }))

            await submitApplication(token, trackId, answersArray)
            setState('submitted')
        } catch (err: unknown) {
            setSubmitError(describeApiErrors(err, 'Не удалось отправить заявку').join(' '))
        } finally {
            setSubmitting(false)
        }
    }

    // ── Загрузка ──────────────────────────────────────────────────
    if (state === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-ink">Загружаем анкету…</p>
                </div>
            </div>
        )
    }

    // ── Невалидный токен ──────────────────────────────────────────
    if (state === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center text-2xl mb-5">⚠️</div>
                    <h2 className="font-extrabold text-xl text-ink mb-2">Ссылка недействительна</h2>
                    <p className="text-sm text-muted-ink mb-6">{loadError}</p>
                    <a href="/login" className="text-sm font-semibold text-brand-hover hover:underline">
                        Перейти на страницу входа →
                    </a>
                </div>
            </div>
        )
    }

    // ── Нужна авторизация ──────────────────────────────────────────
    if (state === 'need-auth' && form) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-5 bg-gradient-to-br from-brand to-brand-light">
                        🎓
                    </div>
                    <p className="text-xs font-semibold tracking-widest uppercase text-brand-hover mb-2">
                        {form.cohort.title}
                    </p>
                    <h2 className="font-extrabold text-xl text-ink mb-2">Приглашение на практику</h2>
                    <p className="text-sm text-muted-ink mb-7 leading-relaxed">
                        Чтобы заполнить анкету и подать заявку, сначала войди в аккаунт или зарегистрируйся.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <Button onClick={() => goAuth('login')} variant="brand"
                            className="w-full py-5 rounded-lg">
                            Войти →
                        </Button>
                        <button onClick={() => goAuth('register')}
                            className="w-full text-sm font-semibold text-brand-hover py-3 rounded-lg border-[1.5px] border-brand hover:bg-brand-subtle transition-colors">
                            Создать аккаунт
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Залогинен админ — ссылка не для него ────────────────────────
    if (state === 'admin-blocked') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center text-2xl mb-5">🚫</div>
                    <h2 className="font-extrabold text-xl text-ink mb-2">Ссылка не для организаторов</h2>
                    <p className="text-sm text-muted-ink mb-6">
                        Вы вошли под аккаунтом администратора — заявки на практику подают кандидаты.
                        Выйдите и откройте ссылку под аккаунтом практиканта, если нужно проверить анкету.
                    </p>
                    <a href="/admin/cohorts" className="text-sm font-semibold text-brand-hover hover:underline">
                        Перейти в панель администратора →
                    </a>
                </div>
            </div>
        )
    }

    // ── Успешно отправлено ──────────────────────────────────────────
    if (state === 'submitted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-xl bg-success-bg text-success flex items-center justify-center mb-5">
                        <CircleCheck className="size-8" />
                    </div>
                    <h2 className="font-extrabold text-2xl text-ink mb-2">Заявка отправлена!</h2>
                    <p className="text-sm text-muted-ink mb-7 leading-relaxed">
                        Как только организаторы её рассмотрят, статус появится в личном кабинете.
                        Тестовое задание (если предусмотрено) станет доступно там же.
                    </p>
                    <Button variant="brand" render={<a href="/dashboard/applications" />} nativeButton={false}
                        className="px-6 py-3 rounded-lg h-auto">
                        Перейти в личный кабинет<MoveRight className="size-4" />
                    </Button>
                </div>
            </div>
        )
    }

    // ── Форма анкеты ──────────────────────────────────────────────
    if (!form) return null

    return (
        <div className="flex min-h-screen">

            {/* LEFT */}
            <aside className="hidden lg:flex w-[30%] flex-col sticky top-0 h-screen overflow-hidden text-white p-14"
                style={{ background: 'linear-gradient(155deg, #6C63FF 0%, #9B8FFF 55%, #C4BEFF 100%)' }}>
                <Link href="/" className="group flex items-center gap-3 mb-auto">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ background: 'rgba(255,255,255,0.22)' }}><GraduationCap className="size-5" /></div>
                    <span className="font-bold text-base transition-opacity group-hover:opacity-80">Практика УрФУ</span>
                </Link>

                <div className="flex flex-col justify-center flex-1">
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-60 mb-5">Практика</p>
                    <h2 className="font-extrabold text-5xl leading-tight tracking-tight mb-5">
                        {form.cohort.title}
                    </h2>
                    <p className="text-sm leading-relaxed opacity-80 mb-12 max-w-xs">
                        Заполните анкету — далее в личном кабинете появятся статус заявки
                        и тестовое задание.
                    </p>

                    <div className="flex flex-col gap-4">
                        {[
                            { n: '1', label: 'Анкета', sub: 'Сейчас, на этой странице', active: true },
                            { n: '2', label: 'Тестовое задание', sub: 'В личном кабинете' },
                            { n: '3', label: 'Результат', sub: 'В личном кабинете' },
                        ].map(step => (
                            <div key={step.n} className={`flex items-center gap-4 ${step.active ? 'opacity-100' : 'opacity-50'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0
                                    ${step.active ? 'bg-white text-brand-hover border-white' : 'border-white/40 bg-white/10'}`}>
                                    {step.n}
                                </div>
                                <div>
                                    <div className="text-sm font-medium">{step.label}</div>
                                    <div className="text-xs opacity-60">{step.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* RIGHT */}
            <main className="flex-1 flex justify-center overflow-y-auto bg-surface">
                <div className="w-[75%] py-14 flex flex-col">

                    <div className="mb-7">
                        <h1 className="font-extrabold text-3xl tracking-tight text-ink">Заявка на практику</h1>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-9">
                        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-6">

                            {/* ВЫБОР ТРЕКА */}
                            {form.tracks.length > 1 && (
                                <div>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-brand-hover mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-border-soft">
                                        Направление
                                    </p>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <Label>Желаемый трек <span className="text-brand-hover">*</span></Label>
                                        <div className="flex flex-wrap gap-2">
                                            {form.tracks.map(track => (
                                                <button key={track.id} type="button"
                                                    onClick={() => setTrackId(track.id)}
                                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                                                        ${trackId === track.id
                                                            ? 'border-brand bg-brand-subtle text-brand-hover'
                                                            : 'border-border-soft bg-surface text-muted-ink'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full transition-colors
                                                        ${trackId === track.id ? 'bg-brand' : 'bg-faint-ink'}`} />
                                                    {track.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ВОПРОСЫ АНКЕТЫ */}
                            {form.questions.length > 0 ? (
                                <div>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-brand-hover mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-border-soft">
                                        Анкета
                                    </p>
                                    <div className="grid sm:grid-cols-2 gap-4 items-start">
                                        {(() => {
                                            const sorted = [...form.questions].sort((a, b) => a.order_index - b.order_index)
                                            const firstRadioId = sorted.find(q => q.type === 'radio')?.id
                                            const firstCheckboxId = sorted.find(q => q.type === 'checkbox')?.id
                                            return sorted.map(q => (
                                                <QuestionInput
                                                    key={q.id}
                                                    question={q}
                                                    value={answers[q.id] ?? ''}
                                                    onChange={val => setAnswer(q.id, val)}
                                                    className={q.type === 'textarea' ? 'sm:col-span-2' : ''}
                                                    showHint={q.id === firstRadioId || q.id === firstCheckboxId}
                                                />
                                            ))
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 p-4 bg-brand-subtle rounded-xl border-l-4 border-brand">
                                    <span className="text-lg">ℹ️</span>
                                    <p className="text-sm text-muted-ink leading-relaxed">
                                        Дополнительных вопросов в анкете нет — просто выберите направление и отправьте заявку.
                                    </p>
                                </div>
                            )}

                            {submitError && (
                                <div className="flex items-center gap-2 bg-danger-bg border-[1.5px] border-danger-border rounded-xl px-4 py-3">
                                    <span className="text-sm">⚠️</span>
                                    <p className="text-sm text-danger">{submitError}</p>
                                </div>
                            )}

                            <div className="flex justify-end items-center pt-2">
                                <Button type="submit" variant="brand" disabled={submitting}
                                    className="px-8 py-5 rounded-lg">
                                    {submitting ? 'Отправляем…' : <>Отправить заявку<MoveRight className="size-4" /></>}
                                </Button>
                            </div>
                        </form>
                    </div>

                    <div className="flex items-start gap-3 mt-5 p-4 bg-brand-subtle rounded-xl border-l-4 border-brand">
                        <MailCheck className="size-5 text-brand-hover flex-shrink-0" />
                        <p className="text-sm text-muted-ink leading-relaxed">
                            <strong className="text-ink">После отправки</strong> статус заявки и тестовое задание
                            будут доступны в личном кабинете.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

// ── Компонент вопроса анкеты ──────────────────────────────────────
function QuestionInput({
    question,
    value,
    onChange,
    className,
    showHint,
}: {
    question: Question
    value: string
    onChange: (v: string) => void
    className?: string
    showHint?: boolean
}) {
    const label = (
        <label className="text-sm font-medium text-ink">
            {question.label}
            {question.required && <span className="text-brand-hover ml-0.5">*</span>}
        </label>
    )

    if (question.type === 'textarea') {
        return (
            <div className={cn('flex flex-col gap-1.5', className)}>
                {label}
                <Textarea value={value} onChange={e => onChange(e.target.value)}
                    placeholder="Ваш ответ" rows={3} autoComplete="off"
                    required={question.required} className="resize-none" />
            </div>
        )
    }

    if (question.type === 'select') {
        return (
            <div className={cn('flex flex-col gap-1.5', className)}>
                {label}
                <select value={value} onChange={e => onChange(e.target.value)} required={question.required}
                    className="w-full text-sm rounded-lg border-[1.5px] border-border-soft bg-surface px-3 py-2 text-ink focus:outline-none focus:border-brand">
                    <option value="" disabled>Выберите вариант</option>
                    {question.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        )
    }

    if (question.type === 'radio') {
        return (
            <div className={cn('flex flex-col gap-1.5', className)}>
                <div className="flex items-center gap-2 flex-wrap">
                    {label}
                    {showHint && <span className="text-xs text-muted-ink">выберите один вариант из списка</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {question.options.map(opt => (
                        <button key={opt} type="button"
                            onClick={() => onChange(value === opt ? '' : opt)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                                ${value === opt
                                    ? 'border-brand bg-brand-subtle text-brand-hover'
                                    : 'border-border-soft bg-surface text-muted-ink'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors
                                ${value === opt ? 'bg-brand' : 'bg-faint-ink'}`} />
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    if (question.type === 'checkbox') {
        const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
        function toggle(opt: string) {
            const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
            onChange(next.join(', '))
        }
        return (
            <div className={cn('flex flex-col gap-1.5', className)}>
                <div className="flex items-center gap-2 flex-wrap">
                    {label}
                    {showHint && <span className="text-xs text-muted-ink">можно выбрать несколько вариантов</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {question.options.map(opt => (
                        <button key={opt} type="button" onClick={() => toggle(opt)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                                ${selected.includes(opt)
                                    ? 'border-brand bg-brand-subtle text-brand-hover'
                                    : 'border-border-soft bg-surface text-muted-ink'}`}>
                            <div className={`w-[14px] h-[14px] min-w-[14px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors
                                ${selected.includes(opt) ? 'bg-brand border-brand' : 'border-border-soft bg-surface'}`}>
                                {selected.includes(opt) && (
                                    <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.8 7L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // text (default)
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label}
            <Input type="text" value={value} onChange={e => onChange(e.target.value)}
                placeholder="Ваш ответ" autoComplete="off" required={question.required} />
        </div>
    )
}
