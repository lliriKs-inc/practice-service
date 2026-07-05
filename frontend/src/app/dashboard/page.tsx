'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/api/auth'

type Tab = 'applications' | 'documents' | 'tasks'

const mockTasks: Record<string, { title: string; status: 'done' | 'review' | 'empty' }> = {
    '2026-07-06': { title: 'Настройка окружения, изучение кодовой базы', status: 'done' },
    '2026-07-07': { title: 'Реализация эндпоинта авторизации', status: 'review' },
    '2026-07-08': { title: '', status: 'empty' },
    '2026-07-09': { title: '', status: 'empty' },
    '2026-07-10': { title: '', status: 'empty' },
}

const docFields = [
    { id: 'fio', label: 'ФИО студента', value: 'Иванов Иван Иванович', filled: true },
    { id: 'group', label: 'Группа', value: 'РИ-330948', filled: true },
    { id: 'direction_code', label: 'Код направления', value: '09.03.04', filled: true },
    { id: 'direction_name', label: 'Наименование направления', value: 'Программная инженерия', filled: true },
    { id: 'program_name', label: 'Наименование образовательной программы', value: '', filled: false },
    { id: 'practice_topic', label: 'Тема индивидуального задания', value: '', filled: false },
    { id: 'main_stage_tasks', label: 'Перечень работ основного этапа', value: '', filled: false },
]

export default function DashboardPage() {
    const { user, loading } = useAuth()

    const [tab, setTab] = useState<Tab>('applications')
    const [taskPopup, setTaskPopup] = useState<string | null>(null)
    const [taskText, setTaskText] = useState('')
    const [fields, setFields] = useState(docFields)

    const allDocFilled = fields.every(f => f.filled)

    function saveTask() {
        setTaskPopup(null)
        setTaskText('')
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD]">
            <p className="text-sm text-[#6B6880]">Загрузка…</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">

            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                    >
                        🎓
                    </div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">Backend · Поток 2026</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white text-sm font-bold flex items-center justify-center">
                        {user?.fio?.[0] ?? 'И'}
                    </div>
                </div>
            </header>

            <div className="flex flex-1">

                {/* SIDEBAR */}
                <aside className="w-56 bg-white border-r border-[#E4E2F4] flex flex-col p-4 gap-1 sticky top-[65px] h-[calc(100vh-65px)]">
                    {[
                        { id: 'applications', icon: '📋', label: 'Заявки' },
                        { id: 'documents', icon: '📄', label: 'Документы' },
                        { id: 'tasks', icon: '✅', label: 'Задачи' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id as Tab)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                ${tab === item.id
                                    ? 'bg-[#EBE9FF] text-[#4A42D4]'
                                    : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}

                    <div className="mt-auto pt-4 border-t border-[#E4E2F4]">
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left"
                        >
                            <span>🚪</span> Выйти
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <main className="flex-1 p-8 flex flex-col gap-6">

                    {/* ── ЗАЯВКИ ── */}
                    {tab === 'applications' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Мои заявки</h1>
                                <p className="text-sm text-[#6B6880]">История всех твоих заявок на практику.</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Текущая заявка</p>
                                        <h2 className="font-bold text-lg text-[#1C1A3A]">Поток 2026</h2>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EDFBF4] border border-[#7EE8B8]">
                                        <div className="w-2 h-2 rounded-full bg-[#2CB87A]" />
                                        <span className="text-xs font-semibold text-[#1A7A5A]">Одобрена</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 divide-x divide-[#E4E2F4]">
                                    {[
                                        { label: 'Роль', value: 'Backend-разработчик' },
                                        { label: 'Период', value: '1 июля — 31 авг 2026' },
                                        { label: 'Руководитель', value: 'Езуб А.С.' },
                                    ].map((item, i) => (
                                        <div key={i} className="px-6 py-4 flex flex-col gap-1">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">{item.label}</span>
                                            <span className="text-sm font-semibold text-[#1C1A3A]">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4]">
                                    <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Архив</p>
                                    <h2 className="font-bold text-lg text-[#1C1A3A]">Прошлые заявки</h2>
                                </div>
                                {[
                                    { year: 'Поток 2025', role: 'Frontend-разработчик', status: 'Одобрена', color: 'text-[#1A7A5A] bg-[#EDFBF4] border-[#7EE8B8]' },
                                    { year: 'Поток 2024', role: 'Дизайнер', status: 'Отклонена', color: 'text-[#D94F4F] bg-[#FFF5F5] border-[#F0BABA]' },
                                ].map((item, i) => (
                                    <div key={i} className="px-7 py-4 border-b border-[#E4E2F4] last:border-b-0 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-[#1C1A3A]">{item.year}</p>
                                            <p className="text-xs text-[#6B6880]">{item.role}</p>
                                        </div>
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${item.color}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ДОКУМЕНТЫ ── */}
                    {tab === 'documents' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Документы</h1>
                                <p className="text-sm text-[#6B6880]">Заполни поля — документы сформируются автоматически.</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm p-7">
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                                    Данные для документов
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {fields.map(f => (
                                        <div key={f.id} className={`flex flex-col gap-1.5 ${f.id === 'main_stage_tasks' ? 'col-span-2' : ''}`}>
                                            <label className="text-xs font-medium text-[#6B6880]">{f.label}</label>
                                            <div className="relative">
                                                {f.id === 'main_stage_tasks' ? (
                                                    <textarea
                                                        defaultValue={f.value}
                                                        placeholder="Перечислите задачи через точку с запятой"
                                                        rows={3}
                                                        onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, value: e.target.value, filled: e.target.value.trim() !== '' } : x))}
                                                        className="w-full text-sm"
                                                        style={{ resize: 'vertical' }}
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        defaultValue={f.value}
                                                        placeholder={`Введите ${f.label.toLowerCase()}`}
                                                        onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, value: e.target.value, filled: e.target.value.trim() !== '' } : x))}
                                                        className="w-full text-sm"
                                                    />
                                                )}
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                                                    {f.filled ? '✅' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4]">
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Готовые документы</p>
                                    <h2 className="font-bold text-lg text-[#1C1A3A]">Сформировать и скачать</h2>
                                </div>
                                {[
                                    {
                                        title: 'Индивидуальное задание',
                                        desc: 'Формируется автоматически после заполнения всех полей',
                                        ready: allDocFilled,
                                    },
                                    {
                                        title: 'Отзыв руководителя',
                                        desc: 'Доступен после того как руководитель заполнит отзыв',
                                        ready: false,
                                    },
                                    {
                                        title: 'Титульный лист отчёта',
                                        desc: 'Доступен после загрузки отчёта и одобрения руководителем',
                                        ready: false,
                                    },
                                ].map((doc, i) => (
                                    <div key={i} className="px-7 py-5 border-b border-[#E4E2F4] last:border-b-0 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-[#1C1A3A] mb-0.5">{doc.title}</p>
                                            <p className="text-xs text-[#A9A7BB]">{doc.desc}</p>
                                        </div>
                                        <button
                                            disabled={!doc.ready}
                                            className={`text-sm font-semibold px-5 py-2 rounded-lg flex-shrink-0 transition-all
                                                ${doc.ready
                                                    ? 'bg-[#6C63FF] text-white shadow-md hover:bg-[#4A42D4]'
                                                    : 'bg-[#F5F4FD] text-[#A9A7BB] border border-[#E4E2F4] cursor-not-allowed'}`}
                                        >
                                            {doc.ready ? '⬇ Скачать' : 'Не готов'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ЗАДАЧИ ── */}
                    {tab === 'tasks' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Дневник задач</h1>
                                    <p className="text-sm text-[#6B6880]">Неделя 1 · 6 — 10 июля 2026</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 text-sm font-medium border border-[#E4E2F4] rounded-lg bg-white text-[#6B6880] hover:bg-[#F5F4FD]">
                                        ← Пред.
                                    </button>
                                    <button className="px-4 py-2 text-sm font-medium border border-[#E4E2F4] rounded-lg bg-white text-[#6B6880] hover:bg-[#F5F4FD]">
                                        След. →
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="grid grid-cols-5 border-b border-[#E4E2F4]">
                                    {['Пн 6.07', 'Вт 7.07', 'Ср 8.07', 'Чт 9.07', 'Пт 10.07'].map((d, i) => (
                                        <div key={i} className="px-5 py-3 border-r border-[#E4E2F4] last:border-r-0">
                                            <span className="text-xs font-bold text-[#A9A7BB] uppercase tracking-wide">{d}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-5 divide-x divide-[#E4E2F4] min-h-[240px]">
                                    {Object.entries(mockTasks).map(([date, task]) => (
                                        <div key={date} className="p-4 flex flex-col gap-3 relative group">
                                            {task.status !== 'empty' ? (
                                                <>
                                                    <div className={`inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full
                                                        ${task.status === 'done'
                                                            ? 'bg-[#EDFBF4] text-[#1A7A5A]'
                                                            : 'bg-[#FFF8ED] text-[#7A5C1A]'}`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'done' ? 'bg-[#2CB87A]' : 'bg-[#F59E0B]'}`} />
                                                        {task.status === 'done' ? 'Выполнено' : 'На ревью'}
                                                    </div>
                                                    <p className="text-xs text-[#6B6880] leading-relaxed">{task.title}</p>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setTaskPopup(date)}
                                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-[#EBE9FF] border-[1.5px] border-[#6C63FF] text-[#6C63FF] text-lg flex items-center justify-center">
                                                        +
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {[
                                    { color: 'bg-[#2CB87A]', label: 'Выполнено' },
                                    { color: 'bg-[#F59E0B]', label: 'На ревью' },
                                    { color: 'bg-[#E4E2F4]', label: 'Не заполнено' },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                        <span className="text-xs text-[#6B6880]">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* TASK POPUP */}
            {taskPopup && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setTaskPopup(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-lg text-[#1C1A3A]">Задача на день</h3>
                            <button
                                onClick={() => setTaskPopup(null)}
                                className="text-[#A9A7BB] hover:text-[#1C1A3A] text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Что сделано сегодня</label>
                                <textarea
                                    value={taskText}
                                    onChange={e => setTaskText(e.target.value)}
                                    placeholder="Опиши выполненную работу…"
                                    rows={4}
                                    className="w-full text-sm"
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Ссылка на артефакт</label>
                                <input
                                    type="text"
                                    placeholder="GitHub, Figma, Google Drive…"
                                    className="w-full text-sm"
                                />
                                <span className="text-xs text-[#A9A7BB]">Необязательно</span>
                            </div>

                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => setTaskPopup(null)}
                                    className="px-5 py-2 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-lg"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={saveTask}
                                    className="px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-md"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                >
                                    Сохранить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
