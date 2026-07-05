'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const ROLES = ['Backend', 'Frontend', 'ML', 'Аналитика', 'Дизайн', 'Fullstack', 'Проджект']

export default function ApplyPage() {
    const [selectedRoles, setSelectedRoles] = useState<string[]>([])
    const [consent, setConsent] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [progress, setProgress] = useState(0)
    const [course, setCourse] = useState('')

    function toggleRole(role: string) {
        setSelectedRoles(prev => {
            const next = prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
            calcProgress(next, consent)
            return next
        })
    }

    function calcProgress(roles = selectedRoles, con = consent, cur = course) {
        const fields = ['fio', 'email', 'password', 'group', 'direction', 'stack', 'motivation']
        const filled = fields.filter(id => {
            const el = document.getElementById(id) as HTMLInputElement
            return el && el.value.trim() !== ''
        }).length
        const total = fields.length + 3
        setProgress(Math.round((filled + (roles.length > 0 ? 1 : 0) + (con ? 1 : 0) + (cur !== '' ? 1 : 0)) / total * 100))
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitted(true)
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
                        <p className="text-sm text-[#6B6880]">Все поля обязательны, если не указано иное.</p>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1 bg-[#E4E2F4] rounded-full mb-7 overflow-hidden">
                        <div
                            className="h-full bg-[#6C63FF] rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-9">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                            {/* ЛИЧНЫЕ ДАННЫЕ */}
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Личные данные
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 flex flex-col gap-1.5">
                                        <Label htmlFor="fio">ФИО <span className="text-[#6C63FF]">*</span></Label>
                                        <Input id="fio" placeholder="Иванов Иван Иванович" onChange={() => calcProgress()} required />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="email">E-mail <span className="text-[#6C63FF]">*</span></Label>
                                        <Input id="email" type="email" placeholder="ivan@urfu.ru" onChange={() => calcProgress()} required />
                                        <span className="text-xs text-[#A9A7BB]">Используется для входа в систему</span>                                   
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="password">Пароль <span className="text-[#6C63FF]">*</span></Label>
                                        <Input id="password" type="password" placeholder="••••••••" onChange={() => calcProgress()} required />
                                        <span className="text-xs text-[#A9A7BB]">Минимум 8 символов</span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="phone">Телефон</Label>
                                        <Input id="phone" type="tel" placeholder="+7 (900) 000-00-00" />
                                        <span className="text-xs text-[#A9A7BB]">Необязательно</span>
                                    </div>
                                </div>
                            </div>

                            {/* УЧЁБА */}
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Учёба
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="group">Группа <span className="text-[#6C63FF]">*</span></Label>
                                        <Input id="group" placeholder="РИ-330948" onChange={() => calcProgress()} required />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Курс <span className="text-[#6C63FF]">*</span></Label>
                                        <Select required onValueChange={(val: string | null) => { const v = val ?? ''; setCourse(v); calcProgress(selectedRoles, consent, v) }}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите курс" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="2">2 курс</SelectItem>
                                                <SelectItem value="3">3 курс</SelectItem>
                                                <SelectItem value="4">4 курс</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1.5">
                                        <Label htmlFor="direction">Направление подготовки <span className="text-[#6C63FF]">*</span></Label>
                                        <Input id="direction" placeholder="09.03.04 Программная инженерия" onChange={() => calcProgress()} required />
                                    </div>
                                </div>
                            </div>

                            {/* РОЛЬ И СТЕК */}
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Роль и стек
                                </p>
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                        <Label>Желаемое направление <span className="text-[#6C63FF]">*</span></Label>
                                        <div className="flex flex-wrap gap-2">
                                            {ROLES.map(role => (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onClick={() => toggleRole(role)}
                                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all
                            ${selectedRoles.includes(role)
                                                            ? 'border-[#6C63FF] bg-[#EBE9FF] text-[#4A42D4]'
                                                            : 'border-[#E4E2F4] bg-[#F5F4FD] text-[#6B6880]'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full transition-colors
                            ${selectedRoles.includes(role) ? 'bg-[#6C63FF]' : 'bg-[#A9A7BB]'}`} />
                                                    {role}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 flex flex-col gap-1.5">
                                            <Label htmlFor="stack">Стек / инструменты <span className="text-[#6C63FF]">*</span></Label>
                                            <Input id="stack" placeholder="React, TypeScript, Node.js…" onChange={() => calcProgress()} required />
                                            <span className="text-xs text-[#A9A7BB]">Перечислите через запятую</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="experience">Опыт / проекты</Label>
                                            <Textarea id="experience" placeholder="Пет-проекты, стажировки…" className="resize-none h-28" />
                                            <span className="text-xs text-[#A9A7BB]">Необязательно</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="motivation">Мотивация <span className="text-[#6C63FF]">*</span></Label>
                                            <Textarea id="motivation" placeholder="Почему хочешь пройти практику здесь?" className="resize-none h-28" onChange={() => calcProgress()} required />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* СОГЛАСИЕ */}
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Согласие
                                </p>
                                <div className="flex items-start gap-3 cursor-pointer" onClick={() => { const next = !consent; setConsent(next); calcProgress(selectedRoles, next) }}>
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
                                        <span className="text-[#6C63FF] font-medium cursor-pointer">обработку персональных данных</span>
                                        {' '}в соответствии с Политикой конфиденциальности УрФУ.
                                    </p>
                                </div>
                            </div>

                            {/* ACTIONS */}
                            <div className="flex justify-between items-center pt-2">
                                <button type="button" className="text-sm text-[#6B6880] px-8 py-3 rounded-lg hover:bg-[#E4E2F4] transition-colors">
                                    Очистить форму
                                </button>
                                <Button type="submit" disabled={submitted}
                                    className="bg-[#6C63FF] hover:bg-[#4A42D4] text-white px-8 py-5 rounded-lg font-semibold shadow-md">
                                    {submitted ? '✓ Заявка отправлена!' : 'Отправить заявку →'}
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
