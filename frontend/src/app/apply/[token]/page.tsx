'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isAuthenticated } from '@/services/api/auth'
import {
    getInvitationForm,
    submitApplication,
    type InvitationForm,
    type Question,
} from '@/services/api/invitation'

type PageState = 'loading' | 'invalid' | 'need-auth' | 'form' | 'submitted' | 'submit-error'

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
            .then(data => {
                setForm(data)
                if (data.tracks.length === 1) setTrackId(data.tracks[0].id)

                if (!isAuthenticated()) {
                    setState('need-auth')
                } else {
                    setState('form')
                }
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
            setSubmitError('Выбери направление практики')
            return
        }

        const missingRequired = form.questions.find(
            q => q.required && !answers[q.id]?.trim()
        )
        if (missingRequired) {
            setSubmitError(`Заполни обязательное поле: «${missingRequired.label}»`)
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
            setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить заявку')
        } finally {
            setSubmitting(false)
        }
    }

    // ── Загрузка ──────────────────────────────────────────────────
    if (state === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD]">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                    <p className="text-sm text-[#6B6880]">Загружаем анкету…</p>
                </div>
            </div>
        )
    }

    // ── Невалидный токен ──────────────────────────────────────────
    if (state === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD] px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-[#FFF5F5] flex items-center justify-center text-2xl mb-5">⚠️</div>
                    <h2 className="font-extrabold text-xl text-[#1C1A3A] mb-2">Ссылка недействительна</h2>
                    <p className="text-sm text-[#6B6880] mb-6">{loadError}</p>
                    <a href="/login" className="text-sm font-semibold text-[#6C63FF] hover:underline">
                        Перейти на страницу входа →
                    </a>
                </div>
            </div>
        )
    }

    // ── Нужна авторизация ──────────────────────────────────────────
    if (state === 'need-auth' && form) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD] px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-5"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                        🎓
                    </div>
                    <p className="text-xs font-semibold tracking-widest uppercase text-[#6C63FF] mb-2">
                        {form.cohort.title}
                    </p>
                    <h2 className="font-extrabold text-xl text-[#1C1A3A] mb-2">Приглашение на практику</h2>
                    <p className="text-sm text-[#6B6880] mb-7 leading-relaxed">
                        Чтобы заполнить анкету и подать заявку, сначала войди в аккаунт или зарегистрируйся.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <Button onClick={() => goAuth('login')}
                            className="w-full text-white font-semibold py-5 rounded-lg shadow-md"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                            Войти →
                        </Button>
                        <button onClick={() => goAuth('register')}
                            className="w-full text-sm font-semibold text-[#6C63FF] py-3 rounded-lg border-[1.5px] border-[#6C63FF] hover:bg-[#EBE9FF] transition-colors">
                            Создать аккаунт
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Успешно отправлено ──────────────────────────────────────────
    if (state === 'submitted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD] px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#EDFBF4] flex items-center justify-center text-3xl mb-5">✅</div>
                    <h2 className="font-extrabold text-2xl text-[#1C1A3A] mb-2">Заявка отправлена!</h2>
                    <p className="text-sm text-[#6B6880] mb-7 leading-relaxed">
                        Как только организаторы её рассмотрят, статус появится в личном кабинете.
                        Тестовое задание (если предусмотрено) станет доступно там же.
                    </p>
                    <a href="/dashboard"
                        className="text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md transition-colors"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                        Перейти в личный кабинет →
                    </a>
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
                <div className="flex items-center gap-3 mb-auto">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: 'rgba(255,255,255,0.22)' }}>🎓</div>
                    <span className="font-bold text-base">Практика УрФУ</span>
                </div>

                <div className="flex flex-col justify-center flex-1">
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-60 mb-5">{form.cohort.title}</p>
                    <h2 className="font-extrabold text-5xl leading-tight tracking-tight mb-5">
                        Начни путь<br />в профессию
                    </h2>
                    <p className="text-sm leading-relaxed opacity-80 mb-12 max-w-xs">
                        Заполни анкету — после отправки ты увидишь статус и тестовое задание в личном кабинете.
                    </p>

                    <div className="flex flex-col gap-4">
                        {[
                            { n: '1', label: 'Анкета', sub: 'Сейчас, на этой странице', active: true },
                            { n: '2', label: 'Тестовое задание', sub: 'В личном кабинете' },
                            { n: '3', label: 'Результат', sub: 'В личном кабинете' },
                        ].map(step => (
                            <div key={step.n} className={`flex items-center gap-4 ${step.active ? 'opacity-100' : 'opacity-50'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0
                                    ${step.active ? 'bg-white text-[#6C63FF] border-white' : 'border-white/40 bg-white/10'}`}>
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
            <main className="flex-1 flex justify-center overflow-y-auto bg-[#F5F4FD]">
                <div className="w-[75%] py-14 flex flex-col">

                    <div className="mb-7">
                        <h1 className="font-extrabold text-3xl tracking-tight text-[#1C1A3A] mb-2">Заявка на практику</h1>
                        <p className="text-sm text-[#6B6880]">{form.cohort.title} · заполни анкету ниже</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-9">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                            {/* ВЫБОР ТРЕКА */}
                            {form.tracks.length > 1 && (
                                <div>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                        Направление
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Желаемый трек <span className="text-[#6C63FF]">*</span></Label>
                                        <div className="flex flex-wrap gap-2">
                                            {form.tracks.map(track => (
                                                <button key={track.id} type="button"
                                                    onClick={() => setTrackId(track.id)}
                                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                                                        ${trackId === track.id
                                                            ? 'border-[#6C63FF] bg-[#EBE9FF] text-[#4A42D4]'
                                                            : 'border-[#E4E2F4] bg-[#F5F4FD] text-[#6B6880]'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full transition-colors
                                                        ${trackId === track.id ? 'bg-[#6C63FF]' : 'bg-[#A9A7BB]'}`} />
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
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                        Анкета
                                    </p>
                                    <div className="flex flex-col gap-4">
                                        {[...form.questions]
                                            .sort((a, b) => a.order_index - b.order_index)
                                            .map(q => (
                                                <QuestionInput
                                                    key={q.id}
                                                    question={q}
                                                    value={answers[q.id] ?? ''}
                                                    onChange={val => setAnswer(q.id, val)}
                                                />
                                            ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 p-4 bg-[#EBE9FF] rounded-xl border-l-4 border-[#6C63FF]">
                                    <span className="text-lg">ℹ️</span>
                                    <p className="text-sm text-[#6B6880] leading-relaxed">
                                        Дополнительных вопросов в анкете нет — просто выбери направление и отправь заявку.
                                    </p>
                                </div>
                            )}

                            {submitError && (
                                <div className="flex items-center gap-2 bg-[#FFF5F5] border-[1.5px] border-[#F0BABA] rounded-xl px-4 py-3">
                                    <span className="text-sm">⚠️</span>
                                    <p className="text-sm text-[#D94F4F]">{submitError}</p>
                                </div>
                            )}

                            <div className="flex justify-end items-center pt-2">
                                <Button type="submit" disabled={submitting}
                                    className="text-white px-8 py-5 rounded-lg font-semibold shadow-md"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                    {submitting ? 'Отправляем…' : 'Отправить заявку →'}
                                </Button>
                            </div>
                        </form>
                    </div>

                    <div className="flex items-start gap-3 mt-5 p-4 bg-[#EBE9FF] rounded-xl border-l-4 border-[#6C63FF]">
                        <span className="text-lg">📬</span>
                        <p className="text-sm text-[#6B6880] leading-relaxed">
                            <strong className="text-[#1C1A3A]">После отправки</strong> статус заявки и тестовое задание
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
}: {
    question: Question
    value: string
    onChange: (v: string) => void
}) {
    const label = (
        <label className="text-sm font-medium text-[#1C1A3A]">
            {question.label}
            {question.required && <span className="text-[#6C63FF] ml-0.5">*</span>}
        </label>
    )

    if (question.type === 'textarea') {
        return (
            <div className="flex flex-col gap-1.5">
                {label}
                <Textarea value={value} onChange={e => onChange(e.target.value)}
                    placeholder="Ваш ответ" rows={3}
                    required={question.required} className="resize-none" />
            </div>
        )
    }

    if (question.type === 'select' || question.type === 'radio') {
        return (
            <div className="flex flex-col gap-1.5">
                {label}
                <div className="flex flex-wrap gap-2">
                    {question.options.map(opt => (
                        <button key={opt} type="button"
                            onClick={() => onChange(value === opt ? '' : opt)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                                ${value === opt
                                    ? 'border-[#6C63FF] bg-[#EBE9FF] text-[#4A42D4]'
                                    : 'border-[#E4E2F4] bg-[#F5F4FD] text-[#6B6880]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors
                                ${value === opt ? 'bg-[#6C63FF]' : 'bg-[#A9A7BB]'}`} />
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
            <div className="flex flex-col gap-1.5">
                {label}
                <div className="flex flex-col gap-2">
                    {question.options.map(opt => (
                        <div key={opt} className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(opt)}>
                            <div className={`w-[18px] h-[18px] min-w-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-colors
                                ${selected.includes(opt) ? 'bg-[#6C63FF] border-[#6C63FF]' : 'border-[#E4E2F4] bg-[#F5F4FD]'}`}>
                                {selected.includes(opt) && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.8 7L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-sm text-[#6B6880]">{opt}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // text (default)
    return (
        <div className="flex flex-col gap-1.5">
            {label}
            <Input type="text" value={value} onChange={e => onChange(e.target.value)}
                placeholder="Ваш ответ" required={question.required} />
        </div>
    )
}
