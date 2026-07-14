'use client'

import { useState } from 'react'

type State = 'approved' | 'rejected'

export default function ResultPage() {
    const [state, setState] = useState<State>('approved')

    return (
        <div className="flex min-h-screen">

            {/* LEFT */}
            <aside
                className="hidden lg:flex w-[30%] flex-col sticky top-0 h-screen overflow-hidden text-white p-14"
                style={{
                    background: state === 'approved'
                        ? 'linear-gradient(155deg, #1DB97A 0%, #4DD8A0 55%, #A8F0D0 100%)'
                        : 'linear-gradient(155deg, #D94F4F 0%, #E87878 55%, #F5BABA 100%)',
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: 'rgba(255,255,255,0.22)' }}
                    >
                        🎓
                    </div>
                    <span className="font-bold text-base">Практика УрФУ</span>
                </div>

                <div className="flex flex-col justify-center flex-1">
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-60 mb-5">Набор 2026</p>
                    <h2 className="font-extrabold text-5xl leading-tight tracking-tight mb-5">
                        {state === 'approved' ? <>Заявка<br />одобрена</> : <>Заявка<br />отклонена</>}
                    </h2>
                    <p className="text-sm leading-relaxed opacity-80 mb-12 max-w-xs">
                        {state === 'approved'
                            ? 'Поздравляем! Добро пожаловать на практику. Войди в личный кабинет.'
                            : 'В этот раз не сложилось. Читай причину и подавай заявку на следующий поток.'}
                    </p>

                    <div className="flex flex-col gap-4">
                        {[
                            { n: '✓', label: 'Анкета', sub: 'Отправлена', done: true },
                            { n: '✓', label: 'Тестовое задание', sub: 'Отправлено', done: true },
                            {
                                n: '3',
                                label: 'Результат',
                                sub: state === 'approved' ? 'Одобрено ✓' : 'Отклонено',
                                active: true,
                            },
                        ].map((step, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-4 ${step.active ? 'opacity-100' : step.done ? 'opacity-75' : 'opacity-50'}`}
                            >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0
                                    ${step.active ? 'bg-white border-white' : 'border-white/40 bg-white/20'}`}
                                    style={step.active ? { color: state === 'approved' ? '#1DB97A' : '#D94F4F' } : {}}
                                >
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

                <p className="text-xs opacity-50">Набор 2026 · УрФУ ИРИТ-РТФ</p>
            </aside>

            {/* RIGHT */}
            <main className="flex-1 flex justify-center overflow-y-auto bg-[#F5F4FD]">
                <div className="w-[75%] py-14 flex flex-col">

                    {/* demo toggle */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setState('approved')}
                            className={`text-xs font-medium px-4 py-1.5 rounded-full border-[1.5px] transition-all
                                ${state === 'approved'
                                    ? 'bg-[#EBE9FF] border-[#6C63FF] text-[#4A42D4]'
                                    : 'bg-[#F5F4FD] border-[#E4E2F4] text-[#6B6880]'}`}
                        >
                            ✅ Одобрено
                        </button>
                        <button
                            onClick={() => setState('rejected')}
                            className={`text-xs font-medium px-4 py-1.5 rounded-full border-[1.5px] transition-all
                                ${state === 'rejected'
                                    ? 'bg-[#EBE9FF] border-[#6C63FF] text-[#4A42D4]'
                                    : 'bg-[#F5F4FD] border-[#E4E2F4] text-[#6B6880]'}`}
                        >
                            ❌ Отклонено
                        </button>
                    </div>

                    {/* APPROVED */}
                    {state === 'approved' && (
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

                            <div className="p-8 text-white flex items-start gap-5"
                                style={{ background: 'linear-gradient(135deg, #1DB97A 0%, #34D48E 100%)' }}
                            >
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.22)' }}
                                >
                                    🎉
                                </div>
                                <div>
                                    <p className="text-xs font-semibold tracking-widest uppercase opacity-70 mb-2">
                                        Заявка одобрена
                                    </p>
                                    <h2 className="font-extrabold text-xl mb-1">Добро пожаловать на практику!</h2>
                                    <p className="text-sm opacity-80">Иванов Иван Иванович · Backend · Поток 2026</p>
                                </div>
                            </div>

                            {/* meta */}
                            <div className="grid grid-cols-2 border-b border-[#E4E2F4]">
                                {[
                                    { label: 'Начало практики', value: '1 июля 2026' },
                                    { label: 'Окончание практики', value: '31 августа 2026' },
                                    { label: 'Роль', value: 'Backend-разработчик' },
                                    { label: 'Руководитель', value: 'Езуб А.С.' },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="px-7 py-4 border-r border-b border-[#E4E2F4] last:border-b-0 [&:nth-child(2n)]:border-r-0 flex flex-col gap-1"
                                    >
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">
                                            {item.label}
                                        </span>
                                        <span className="text-sm font-bold text-[#1C1A3A]">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* next steps */}
                            <div className="p-8">
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Дальнейшие шаги
                                </p>
                                <div className="flex flex-col gap-3">
                                    {[
                                        { n: '1', text: 'Войди в личный кабинет — там доступны задачи, документы и дневник практики.' },
                                        { n: '2', text: 'Заполни поля для документов — индивидуальное задание сформируется автоматически.' },
                                        { n: '3', text: 'Веди дневник задач — ежедневно фиксируй выполненную работу. Прогресс видит PM.' },
                                    ].map((step) => (
                                        <div
                                            key={step.n}
                                            className="flex items-start gap-4 p-4 bg-[#F5F4FD] border-[1.5px] border-[#E4E2F4] rounded-xl"
                                        >
                                            <div className="w-7 h-7 rounded-full bg-[#EBE9FF] border-[1.5px] border-[#6C63FF] text-[#4A42D4] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                                {step.n}
                                            </div>
                                            <p className="text-sm text-[#6B6880] leading-relaxed">{step.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* footer */}
                            <div className="flex items-center justify-between gap-4 px-8 py-5 bg-[#F5F4FD] border-t border-[#E4E2F4]">
                                <p className="text-xs text-[#A9A7BB]">Вопросы? Пиши на practice@urfu.ru</p>
                                <a
                                    href="/dashboard/applications"
                                    className="bg-[#1DB97A] hover:bg-[#4A42D4] text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md transition-colors flex items-center gap-2"
                                >
                                    Перейти в личный кабинет →
                                </a>
                            </div>

                        </div>
                    )}

                    {/* REJECTED */}
                    {state === 'rejected' && (
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

                            <div className="p-8 text-white flex items-start gap-5"
                                style={{ background: 'linear-gradient(135deg, #D94F4F 0%, #E87070 100%)' }}
                            >
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.22)' }}
                                >
                                    😔
                                </div>
                                <div>
                                    <p className="text-xs font-semibold tracking-widest uppercase opacity-70 mb-2">
                                        Заявка отклонена
                                    </p>
                                    <h2 className="font-extrabold text-xl mb-1">В этот раз не получилось</h2>
                                    <p className="text-sm opacity-80">Иванов Иван Иванович · Поток 2026</p>
                                </div>
                            </div>

                            {/* reason */}
                            <div className="p-8 flex flex-col gap-6">

                                <div>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                        Причина отказа
                                    </p>
                                    <div className="bg-[#FFF5F5] border-[1.5px] border-[#F0BABA] rounded-xl p-5">
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#D94F4F] mb-3">
                                            Комментарий организатора
                                        </p>
                                        <p className="text-sm text-[#5A2A2A] leading-relaxed">
                                            К сожалению, тестовое задание не было выполнено в полном объёме —
                                            отсутствовала реализация JWT-авторизации и валидации входных данных.
                                            Также в репозитории не было README с инструкцией по запуску.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                        Что дальше
                                    </p>
                                    <div className="flex items-start gap-3 p-4 bg-[#EBE9FF] border-l-4 border-[#6C63FF] rounded-xl">
                                        <span className="text-lg">🔄</span>
                                        <p className="text-sm text-[#6B6880] leading-relaxed">
                                            <strong className="text-[#1C1A3A]">Не расстраивайся —</strong> практика проводится
                                            дважды в год. Следи за анонсами нового набора, доработай пробелы и подавай
                                            заявку снова. Все твои данные сохранятся и автоматически подставятся в следующую анкету.
                                        </p>
                                    </div>
                                </div>

                            </div>

                            {/* footer */}
                            <div className="flex items-center justify-between gap-4 px-8 py-5 bg-[#F5F4FD] border-t border-[#E4E2F4]">
                                <p className="text-xs text-[#A9A7BB]">Вопросы? Пиши на practice@urfu.ru</p>
                                <a
                                    href="/apply"
                                    className="text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md transition-colors flex items-center gap-2"
                                    style={{ background: '#D94F4F', boxShadow: '0 4px 16px rgba(217,79,79,0.28)' }}
                                >
                                    Подать заявку снова →
                                </a>
                            </div>

                        </div>
                    )}

                </div>
            </main>
        </div>
    )
}