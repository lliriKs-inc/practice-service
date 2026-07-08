'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getSurveyFields, type SurveyField } from '@/services/api/survey'
import { submitApplication } from '@/services/api/applications'
import { register, login } from '@/services/api/auth'

export default function ApplyPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [surveyFields, setSurveyFields] = useState<SurveyField[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [fieldsLoading, setFieldsLoading] = useState(true)
    const [fieldsError, setFieldsError] = useState('')

    const [consent, setConsent] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        getSurveyFields()
            .then(fields => setSurveyFields(fields))
            .catch(() => setFieldsError('Не удалось загрузить поля анкеты'))
            .finally(() => setFieldsLoading(false))
    }, [])

    function setAnswer(fieldId: string, value: string) {
        setAnswers(prev => ({ ...prev, [fieldId]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!consent) {
            setSubmitError('Необходимо дать согласие на обработку персональных данных')
            return
        }
        if (password.length < 8) {
            setSubmitError('Пароль должен быть не менее 8 символов')
            return
        }

        setSubmitting(true)
        setSubmitError('')

        try {
            // 1. Регистрация
            await register({ email, password })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : ''
            // Если пользователь уже существует — пробуем залогиниться
            if (!msg.toLowerCase().includes('already') && !msg.includes('409')) {
                setSubmitError(msg || 'Ошибка регистрации')
                setSubmitting(false)
                return
            }
        }

        try {
            // 2. Авторизация
            await login({ email, password })

            // 3. Подача заявки (только если есть поля анкеты)
            if (surveyFields.length > 0) {
                const answersArray = surveyFields
                    .filter(f => answers[f.id]?.trim())
                    .map(f => ({ field_id: f.id, value: answers[f.id] }))
                await submitApplication(answersArray)
            }

            setSubmitted(true)
            // Переходим на страницу тестового задания
            setTimeout(() => {
                window.location.href = '/test-task'
            }, 1500)
        } catch (err: unknown) {
            setSubmitError(err instanceof Error ? err.message : 'Ошибка при отправке заявки')
            setSubmitting(false)
        }
    }

    // ── Успешная отправка ──────────────────────────────────────────
    if (submitted) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F5F4FD]">
                <div className="bg-white rounded-2xl shadow-lg p-12 flex flex-col items-center text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-[#EDFBF4] flex items-center justify-center text-3xl mb-5">✅</div>
                    <h2 className="font-extrabold text-2xl text-[#1C1A3A] mb-2">Заявка отправлена!</h2>
                    <p className="text-sm text-[#6B6880]">Переходим к тестовому заданию…</p>
                </div>
            </div>
        )
    }

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
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-60 mb-5">Набор 2026</p>
                    <h2 className="font-extrabold text-5xl leading-tight tracking-tight mb-5">
                        Начни путь<br />в профессию
                    </h2>
                    <p className="text-sm leading-relaxed opacity-80 mb-12 max-w-xs">
                        Подай заявку за 5 минут. После проверки анкеты ты получишь тестовое задание на e-mail.
                    </p>

                    <div className="flex flex-col gap-4">
                        {[
                            { n: '1', label: 'Анкета', sub: 'Базовые данные', active: true },
                            { n: '2', label: 'Тестовое задание', sub: 'Придёт на e-mail' },
                            { n: '3', label: 'Результат', sub: 'Одобрение / отказ' },
                        ].map(step => (
                            <div key={step.n} className={`flex items-center gap-4 ${step.active ? 'opacity-100' : 'opacity-50'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0
                                    ${step.active
                                        ? 'bg-white text-[#6C63FF] border-white'
                                        : 'border-white/40 bg-white/10'}`}>
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

                <p className="text-xs opacity-50">Приём заявок: 1 июня — 30 июня 2026</p>
            </aside>

            {/* RIGHT */}
            <main className="flex-1 flex justify-center overflow-y-auto bg-[#F5F4FD]">
                <div className="w-[75%] py-14 flex flex-col">

                    <div className="mb-7">
                        <h1 className="font-extrabold text-3xl tracking-tight text-[#1C1A3A] mb-2">Заявка на практику</h1>
                        <p className="text-sm text-[#6B6880]">Заполни форму — мы пришлём тестовое задание на e-mail.</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-9">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                            {/* АККАУНТ */}
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Данные аккаунта
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 flex flex-col gap-1.5">
                                        <Label htmlFor="email">E-mail <span className="text-[#6C63FF]">*</span></Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="ivan@urfu.ru"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                        />
                                        <span className="text-xs text-[#A9A7BB]">Используется для входа и получения тестового задания</span>
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1.5">
                                        <Label htmlFor="password">Пароль <span className="text-[#6C63FF]">*</span></Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                        />
                                        <span className="text-xs text-[#A9A7BB]">Минимум 8 символов</span>
                                    </div>
                                </div>
                            </div>

                            {/* ДИНАМИЧЕСКИЕ ПОЛЯ АНКЕТЫ */}
                            {fieldsLoading && (
                                <div className="flex items-center gap-3 py-4">
                                    <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                                    <span className="text-sm text-[#6B6880]">Загружаем поля анкеты…</span>
                                </div>
                            )}

                            {fieldsError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {fieldsError}</p>
                                </div>
                            )}

                            {!fieldsLoading && !fieldsError && surveyFields.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                        Анкета
                                    </p>
                                    <div className="flex flex-col gap-4">
                                        {surveyFields.map(field => (
                                            <SurveyFieldInput
                                                key={field.id}
                                                field={field}
                                                value={answers[field.id] ?? ''}
                                                onChange={val => setAnswer(field.id, val)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!fieldsLoading && !fieldsError && surveyFields.length === 0 && (
                                <div className="flex items-start gap-3 p-4 bg-[#EBE9FF] rounded-xl border-l-4 border-[#6C63FF]">
                                    <span className="text-lg">ℹ️</span>
                                    <p className="text-sm text-[#6B6880] leading-relaxed">
                                        Поля анкеты ещё не настроены организатором. Ты можешь создать аккаунт и зайти позже.
                                    </p>
                                </div>
                            )}

                            {/* СОГЛАСИЕ */}
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Согласие
                                </p>
                                <div
                                    className="flex items-start gap-3 cursor-pointer"
                                    onClick={() => setConsent(prev => !prev)}
                                >
                                    <div className={`w-[18px] h-[18px] min-w-[18px] rounded-md border-[1.5px] flex items-center justify-center mt-0.5 transition-colors
                                        ${consent ? 'bg-[#6C63FF] border-[#6C63FF]' : 'border-[#E4E2F4] bg-[#F5F4FD]'}`}>
                                        {consent && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                <path d="M1 4L3.8 7L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                    <p className="text-sm text-[#6B6880] leading-relaxed">
                                        Я согласен(-на) на{' '}
                                        <span className="text-[#6C63FF] font-medium">обработку персональных данных</span>
                                        {' '}в соответствии с Политикой конфиденциальности УрФУ.
                                    </p>
                                </div>
                            </div>

                            {/* ОШИБКА */}
                            {submitError && (
                                <div className="flex items-center gap-2 bg-[#FFF5F5] border-[1.5px] border-[#F0BABA] rounded-xl px-4 py-3">
                                    <span className="text-sm">⚠️</span>
                                    <p className="text-sm text-[#D94F4F]">{submitError}</p>
                                </div>
                            )}

                            {/* КНОПКИ */}
                            <div className="flex justify-end items-center pt-2">
                                <Button
                                    type="submit"
                                    disabled={submitting || !email || !password || !consent}
                                    className="text-white px-8 py-5 rounded-lg font-semibold shadow-md"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                >
                                    {submitting ? 'Отправляем…' : 'Отправить заявку →'}
                                </Button>
                            </div>

                        </form>
                    </div>

                    <div className="flex items-start gap-3 mt-5 p-4 bg-[#EBE9FF] rounded-xl border-l-4 border-[#6C63FF]">
                        <span className="text-lg">📬</span>
                        <p className="text-sm text-[#6B6880] leading-relaxed">
                            <strong className="text-[#1C1A3A]">После отправки</strong> проверь e-mail — на него придёт тестовое задание.
                        </p>
                    </div>

                </div>
            </main>
        </div>
    )
}

// ── Компонент одного поля анкеты ─────────────────────────────────
function SurveyFieldInput({
    field,
    value,
    onChange,
}: {
    field: SurveyField
    value: string
    onChange: (v: string) => void
}) {
    const label = (
        <label className="text-sm font-medium text-[#1C1A3A]">
            {field.label}
            {field.required && <span className="text-[#6C63FF] ml-0.5">*</span>}
        </label>
    )

    if (field.type === 'TEXTAREA') {
        return (
            <div className="flex flex-col gap-1.5">
                {label}
                <Textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={`Введите ${field.label.toLowerCase()}`}
                    rows={3}
                    required={field.required}
                    className="resize-none"
                />
            </div>
        )
    }

    if (field.type === 'SELECT' && field.options) {
        return (
            <div className="flex flex-col gap-1.5">
                {label}
                <div className="flex flex-wrap gap-2">
                    {field.options.map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange(value === opt ? '' : opt)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                                ${value === opt
                                    ? 'border-[#6C63FF] bg-[#EBE9FF] text-[#4A42D4]'
                                    : 'border-[#E4E2F4] bg-[#F5F4FD] text-[#6B6880]'}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors
                                ${value === opt ? 'bg-[#6C63FF]' : 'bg-[#A9A7BB]'}`} />
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    if (field.type === 'CHECKBOX' && field.options) {
        const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
        function toggleOption(opt: string) {
            const next = selected.includes(opt)
                ? selected.filter(s => s !== opt)
                : [...selected, opt]
            onChange(next.join(', '))
        }
        return (
            <div className="flex flex-col gap-1.5">
                {label}
                <div className="flex flex-col gap-2">
                    {field.options.map(opt => (
                        <div
                            key={opt}
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => toggleOption(opt)}
                        >
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

    // TEXT (default)
    return (
        <div className="flex flex-col gap-1.5">
            {label}
            <Input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={`Введите ${field.label.toLowerCase()}`}
                required={field.required}
            />
        </div>
    )
}
