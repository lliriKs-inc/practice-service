'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/api/auth'
import {
    getWeekTasks,
    createTask,
    updateTask,
    deleteTask,
    type Task,
    type WeekTasksResponse,
} from '@/services/api/tasks'
import { getMyApplications, type Application } from '@/services/api/invitation'

type Tab = 'applications' | 'documents' | 'tasks'

// ── Документы: моковые данные (пока не подключены к новой архитектуре) ──
const docFields = [
    { id: 'fio', label: 'ФИО студента', value: 'Иванов Иван Иванович', filled: true },
    { id: 'group', label: 'Группа', value: 'РИ-330948', filled: true },
    { id: 'direction_code', label: 'Код направления', value: '09.03.04', filled: true },
    { id: 'direction_name', label: 'Наименование направления', value: 'Программная инженерия', filled: true },
    { id: 'program_name', label: 'Наименование образовательной программы', value: '', filled: false },
    { id: 'practice_topic', label: 'Тема индивидуального задания', value: '', filled: false },
    { id: 'main_stage_tasks', label: 'Перечень работ основного этапа', value: '', filled: false },
]

// ── Заявки: статусы ──────────────────────────────────────────────
const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]', dot: 'bg-[#F59E0B]' },
    approved: { label: 'Одобрена', className: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]', dot: 'bg-[#2CB87A]' },
    rejected: { label: 'Отклонена', className: 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]', dot: 'bg-[#D94F4F]' },
}

// ── Утилиты дат (UTC — согласовано с мок-хранилищем задач) ─────────
function getMondayOfWeek(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setUTCDate(d.getUTCDate() + diff)
    return d
}

function toISODate(date: Date): string {
    return date.toISOString().split('T')[0]
}

function addDays(date: Date, n: number): Date {
    const d = new Date(date)
    d.setUTCDate(d.getUTCDate() + n)
    return d
}

function sameDate(a: string, b: string): boolean {
    return a.slice(0, 10) === b.slice(0, 10)
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
    const s = new Date(weekStart)
    const e = new Date(weekEnd)
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    if (s.getUTCMonth() === e.getUTCMonth()) {
        return `${s.getUTCDate()}–${e.getUTCDate()} ${months[s.getUTCMonth()]} ${s.getUTCFullYear()}`
    }
    return `${s.getUTCDate()} ${months[s.getUTCMonth()]} – ${e.getUTCDate()} ${months[e.getUTCMonth()]}`
}

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']

export default function DashboardPage() {
    const { user, loading } = useAuth()

    const [tab, setTab] = useState<Tab>('applications')

    // ── ЗАЯВКИ: состояние ──────────────────────────────────────────
    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [applicationsError, setApplicationsError] = useState('')

    useEffect(() => {
        (async () => {
            if (loading) return
            try {
                const data = await getMyApplications()
                setApplications(data)
            } catch (err: unknown) {
                setApplicationsError(err instanceof Error ? err.message : 'Не удалось загрузить заявки')
            } finally {
                setApplicationsLoading(false)
            }
        })()
    }, [loading])

    // [FIX] Дневник задач имеет смысл только после того, как заявку
    // одобрили — до этого момента у практиканта нет ни роли, ни
    // согласованных дат практики. approvedApplication — источник дат
    // для сетки (вместо общей заглушки, не привязанной к когорте).
    const approvedApplication = applications.find(a => a.status === 'approved') ?? null

    // ── ЗАДАЧИ: состояние ──────────────────────────────────────────
    const [weekStart, setWeekStart] = useState<string>(() => toISODate(getMondayOfWeek(new Date())))
    const [weekData, setWeekData] = useState<WeekTasksResponse | null>(null)
    const [tasksLoading, setTasksLoading] = useState(false)
    const [tasksError, setTasksError] = useState('')

    const [popup, setPopup] = useState<{ mode: 'create' | 'edit'; date: string; task?: Task } | null>(null)
    const [popupTitle, setPopupTitle] = useState('')
    const [popupDesc, setPopupDesc] = useState('')
    const [popupLink, setPopupLink] = useState('')
    const [popupSaving, setPopupSaving] = useState(false)
    const [popupError, setPopupError] = useState('')

    // ── ДОКУМЕНТЫ: состояние (мок) ───────────────────────────────
    const [fields, setFields] = useState(docFields)
    const allDocFilled = fields.every(f => f.filled)

    const loadWeek = useCallback(async () => {
        if (!approvedApplication) return
        setTasksLoading(true)
        setTasksError('')
        try {
            const data = await getWeekTasks(weekStart, {
                practiceStart: approvedApplication.cohort.start_date,
                practiceEnd: approvedApplication.cohort.end_date,
            })
            setWeekData(data)
        } catch (err: unknown) {
            setTasksError(err instanceof Error ? err.message : 'Ошибка загрузки задач')
        } finally {
            setTasksLoading(false)
        }
    }, [weekStart, approvedApplication])

    useEffect(() => {
        (async () => {
            if (tab === 'tasks' && !loading && approvedApplication) await loadWeek()
        })()
    }, [tab, weekStart, loading, loadWeek, approvedApplication])

    // Автоприлипание к периоду практики (если открыли неделю вне диапазона)
    useEffect(() => {
        (() => {
            if (!weekData) return
            const practiceMonday = toISODate(getMondayOfWeek(new Date(weekData.practiceStart)))
            const practiceLastMonday = toISODate(getMondayOfWeek(new Date(weekData.practiceEnd)))
            if (weekStart < practiceMonday) {
                setWeekStart(practiceMonday)
            } else if (weekStart > practiceLastMonday) {
                setWeekStart(practiceLastMonday)
            }
        })()
    }, [weekData])

    // При появлении одобренной заявки — сразу ставим неделю на начало практики,
    // а не на "сегодня" (которое почти наверняка вне диапазона)
    useEffect(() => {
        (() => {
            if (!approvedApplication) return
            const practiceMonday = toISODate(getMondayOfWeek(new Date(approvedApplication.cohort.start_date)))
            setWeekStart(prev => (prev === toISODate(getMondayOfWeek(new Date())) ? practiceMonday : prev))
        })()
    }, [approvedApplication])

    function canGoPrev(): boolean {
        if (!weekData) return true
        return weekStart > toISODate(getMondayOfWeek(new Date(weekData.practiceStart)))
    }

    function canGoNext(): boolean {
        if (!weekData) return true
        return weekStart < toISODate(getMondayOfWeek(new Date(weekData.practiceEnd)))
    }

    function goPrevWeek() {
        if (!canGoPrev()) return
        setWeekStart(prev => toISODate(addDays(new Date(prev), -7)))
    }

    function goNextWeek() {
        if (!canGoNext()) return
        setWeekStart(prev => toISODate(addDays(new Date(prev), 7)))
    }

    function openCreate(date: string) {
        setPopup({ mode: 'create', date })
        setPopupTitle('')
        setPopupDesc('')
        setPopupLink('')
        setPopupError('')
    }

    function openEdit(task: Task) {
        setPopup({ mode: 'edit', date: task.date, task })
        setPopupTitle(task.title)
        setPopupDesc(task.description)
        setPopupLink(task.artifact_link ?? '')
        setPopupError('')
    }

    function closePopup() {
        setPopup(null)
        setPopupSaving(false)
        setPopupError('')
    }

    async function handleSave() {
        if (!popupTitle.trim() || !popupDesc.trim()) {
            setPopupError('Заполни название и описание')
            return
        }
        if (!popup) return
        setPopupSaving(true)
        setPopupError('')
        try {
            if (popup.mode === 'create') {
                await createTask({
                    date: new Date(popup.date).toISOString(),
                    title: popupTitle.trim(),
                    description: popupDesc.trim(),
                    artifact_link: popupLink.trim() || null,
                })
            } else if (popup.task) {
                await updateTask(popup.task.id, {
                    title: popupTitle.trim(),
                    description: popupDesc.trim(),
                    artifact_link: popupLink.trim() || null,
                })
            }
            closePopup()
            await loadWeek()
        } catch (err: unknown) {
            setPopupError(err instanceof Error ? err.message : 'Ошибка сохранения')
            setPopupSaving(false)
        }
    }

    async function handleDelete() {
        if (!popup?.task) return
        setPopupSaving(true)
        try {
            await deleteTask(popup.task.id)
            closePopup()
            await loadWeek()
        } catch (err: unknown) {
            setPopupError(err instanceof Error ? err.message : 'Ошибка удаления')
            setPopupSaving(false)
        }
    }

    function buildGridDays(): { date: string; dayLabel: string; shortDate: string }[] {
        const monday = new Date(weekStart)
        return Array.from({ length: 5 }, (_, i) => {
            const d = addDays(monday, i)
            const day = d.getUTCDate()
            const month = d.getUTCMonth() + 1
            return { date: toISODate(d), dayLabel: DAYS_RU[i], shortDate: `${day}.${String(month).padStart(2, '0')}` }
        })
    }

    function getTaskForDate(date: string): Task | undefined {
        return weekData?.tasks.find(t => sameDate(t.date, date))
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD]">
            <p className="text-sm text-[#6B6880]">Загрузка…</p>
        </div>
    )

    const gridDays = buildGridDays()

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">

            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">{user?.email ?? '…'}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white text-sm font-bold flex items-center justify-center">
                        {user?.email?.[0]?.toUpperCase() ?? '?'}
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
                        <button key={item.id} onClick={() => setTab(item.id as Tab)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                ${tab === item.id ? 'bg-[#EBE9FF] text-[#4A42D4]' : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}>
                            <span>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                    <div className="mt-auto pt-4 border-t border-[#E4E2F4]">
                        <button onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left">
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
                                <p className="text-sm text-[#6B6880]">Архив всех заявок на практику по всем когортам.</p>
                            </div>

                            {applicationsLoading && (
                                <div className="flex items-center gap-2 text-sm text-[#6B6880]">
                                    <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                                    Загружаем заявки…
                                </div>
                            )}

                            {applicationsError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {applicationsError}</p>
                                </div>
                            )}

                            {!applicationsLoading && !applicationsError && applications.length === 0 && (
                                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                    <div className="text-4xl mb-4">📋</div>
                                    <p className="font-semibold text-[#1C1A3A] mb-1">Заявок пока нет</p>
                                    <p className="text-sm text-[#6B6880] max-w-sm">
                                        Чтобы подать заявку на практику, перейди по ссылке-приглашению,
                                        которую пришлёт организатор когорты.
                                    </p>
                                </div>
                            )}

                            {!applicationsLoading && !applicationsError && applications.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    {applications.map(app => {
                                        const status = STATUS_CONFIG[app.status]
                                        return (
                                            <div key={app.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">
                                                            {app.cohort.title}
                                                        </p>
                                                        <h2 className="font-bold text-lg text-[#1C1A3A]">{app.track.title}</h2>
                                                    </div>
                                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${status.className}`}>
                                                        <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                                        <span className="text-xs font-semibold">{status.label}</span>
                                                    </div>
                                                </div>

                                                {/* Инфо о практике — раньше её нигде не было видно */}
                                                <div className="px-7 py-4 border-b border-[#E4E2F4] grid grid-cols-2 gap-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Период практики</span>
                                                        <span className="text-sm text-[#1C1A3A]">
                                                            {new Date(app.cohort.start_date).toLocaleDateString('ru')} — {new Date(app.cohort.end_date).toLocaleDateString('ru')}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Трек</span>
                                                        <span className="text-sm text-[#1C1A3A]">{app.track.title}</span>
                                                    </div>
                                                </div>

                                                <div className="px-7 py-4 flex items-center justify-between">
                                                    <span className="text-xs text-[#A9A7BB]">
                                                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                    {app.status !== 'rejected' && (
                                                        <a href={`/dashboard/applications/${app.id}/test-task`}
                                                            className="text-xs font-semibold text-[#6C63FF] hover:underline">
                                                            Тестовое задание →
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ДОКУМЕНТЫ (мок) ── */}
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
                                                {f.filled && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">✅</span>
                                                )}
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
                                    { title: 'Индивидуальное задание', desc: 'Формируется автоматически после заполнения всех полей', ready: allDocFilled },
                                    { title: 'Отзыв руководителя', desc: 'Доступен после того как руководитель заполнит отзыв', ready: false },
                                    { title: 'Титульный лист отчёта', desc: 'Доступен после загрузки отчёта и одобрения руководителем', ready: false },
                                    { title: 'Извещение', desc: 'Формируется вместе с остальными документами', ready: false },
                                ].map((doc, i) => (
                                    <div key={i} className="px-7 py-5 border-b border-[#E4E2F4] last:border-b-0 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-[#1C1A3A] mb-0.5">{doc.title}</p>
                                            <p className="text-xs text-[#A9A7BB]">{doc.desc}</p>
                                        </div>
                                        <button disabled={!doc.ready}
                                            className={`text-sm font-semibold px-5 py-2 rounded-lg flex-shrink-0 transition-all
                                                ${doc.ready
                                                    ? 'bg-[#6C63FF] text-white shadow-md hover:bg-[#4A42D4]'
                                                    : 'bg-[#F5F4FD] text-[#A9A7BB] border border-[#E4E2F4] cursor-not-allowed'}`}>
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

                            {/* [FIX] Раньше дневник был доступен всегда, даже без единой
                                одобренной заявки, и показывал "сегодняшнюю" неделю вне
                                какого-либо периода практики. Теперь — заблокирован до
                                одобрения. */}
                            {!approvedApplication ? (
                                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                    <div className="text-4xl mb-4">🔒</div>
                                    <p className="font-semibold text-[#1C1A3A] mb-1">Дневник задач пока недоступен</p>
                                    <p className="text-sm text-[#6B6880] max-w-sm mb-4">
                                        Он откроется, как только одна из твоих заявок будет одобрена —
                                        тогда даты практики подставятся автоматически.
                                    </p>
                                    <button onClick={() => setTab('applications')}
                                        className="text-xs font-semibold px-4 py-2 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF]">
                                        Посмотреть мои заявки
                                    </button>
                                </div>
                            ) : (
                            <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Дневник задач</h1>
                                    {weekData && (
                                        <p className="text-sm text-[#6B6880]">{formatWeekLabel(weekData.weekStart, weekData.weekEnd)}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={goPrevWeek} disabled={!canGoPrev() || tasksLoading}
                                        className="px-4 py-2 text-sm font-medium border border-[#E4E2F4] rounded-lg bg-white text-[#6B6880] hover:bg-[#F5F4FD] disabled:opacity-40 disabled:cursor-not-allowed">
                                        ← Пред.
                                    </button>
                                    <button onClick={goNextWeek} disabled={!canGoNext() || tasksLoading}
                                        className="px-4 py-2 text-sm font-medium border border-[#E4E2F4] rounded-lg bg-white text-[#6B6880] hover:bg-[#F5F4FD] disabled:opacity-40 disabled:cursor-not-allowed">
                                        След. →
                                    </button>
                                </div>
                            </div>

                            {tasksError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {tasksError}</p>
                                </div>
                            )}

                            <div className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-opacity ${tasksLoading ? 'opacity-50' : ''}`}>
                                <div className="grid grid-cols-5 border-b border-[#E4E2F4]">
                                    {gridDays.map(({ dayLabel, shortDate }, i) => (
                                        <div key={i} className="px-5 py-3 border-r border-[#E4E2F4] last:border-r-0">
                                            <span className="text-xs font-bold text-[#A9A7BB] uppercase tracking-wide">{dayLabel} {shortDate}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-5 divide-x divide-[#E4E2F4] min-h-[240px]">
                                    {gridDays.map(({ date }) => {
                                        const task = getTaskForDate(date)
                                        return (
                                            <div key={date} className="p-4 flex flex-col gap-3 relative group">
                                                {task ? (
                                                    <button onClick={() => openEdit(task)} className="flex flex-col gap-2 text-left w-full">
                                                        <div className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#EBE9FF] text-[#4A42D4]">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#6C63FF]" />
                                                            Заполнено
                                                        </div>
                                                        <p className="text-xs font-semibold text-[#1C1A3A] leading-snug line-clamp-2">{task.title}</p>
                                                        {task.description && (
                                                            <p className="text-xs text-[#6B6880] leading-relaxed line-clamp-2">{task.description}</p>
                                                        )}
                                                        {task.artifact_link && (
                                                            <span className="text-[10px] text-[#6C63FF] truncate max-w-full">🔗 Артефакт</span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button onClick={() => openCreate(date)}
                                                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="w-8 h-8 rounded-full bg-[#EBE9FF] border-[1.5px] border-[#6C63FF] text-[#6C63FF] text-lg flex items-center justify-center">+</div>
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {tasksLoading && (
                                <div className="flex items-center gap-2 text-sm text-[#6B6880]">
                                    <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                                    Загрузка задач…
                                </div>
                            )}

                            {weekData && (
                                <p className="text-xs text-[#A9A7BB]">
                                    Период практики: {new Date(weekData.practiceStart).toLocaleDateString('ru')} — {new Date(weekData.practiceEnd).toLocaleDateString('ru')}
                                    {' '}· Нажми на пустую ячейку чтобы добавить задачу, на заполненную — чтобы изменить
                                </p>
                            )}
                            </>
                            )}
                        </div>
                    )}

                </main>
            </div>

            {/* ── ПОПАП ЗАДАЧИ ── */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closePopup}>
                    <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="font-bold text-lg text-[#1C1A3A]">
                                    {popup.mode === 'create' ? 'Новая задача' : 'Редактировать задачу'}
                                </h3>
                                <p className="text-xs text-[#A9A7BB]">
                                    {new Date(popup.date).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                            <button onClick={closePopup} className="text-[#A9A7BB] hover:text-[#1C1A3A] text-xl leading-none">×</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Название задачи <span className="text-[#6C63FF]">*</span></label>
                                <input type="text" value={popupTitle} onChange={e => setPopupTitle(e.target.value)}
                                    placeholder="Что делал сегодня?" className="w-full text-sm" />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Описание <span className="text-[#6C63FF]">*</span></label>
                                <textarea value={popupDesc} onChange={e => setPopupDesc(e.target.value)}
                                    placeholder="Опиши выполненную работу подробнее…" rows={4}
                                    className="w-full text-sm" style={{ resize: 'none' }} />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Ссылка на артефакт</label>
                                <input type="text" value={popupLink} onChange={e => setPopupLink(e.target.value)}
                                    placeholder="GitHub, Figma, Google Drive…" className="w-full text-sm" />
                                <span className="text-xs text-[#A9A7BB]">Необязательно</span>
                            </div>

                            {popupError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {popupError}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-2">
                                {popup.mode === 'edit' ? (
                                    <button onClick={handleDelete} disabled={popupSaving}
                                        className="px-4 py-2 text-sm font-medium text-[#D94F4F] hover:bg-[#FFF5F5] rounded-lg disabled:opacity-50">
                                        🗑 Удалить
                                    </button>
                                ) : <span />}
                                <div className="flex gap-3">
                                    <button onClick={closePopup} className="px-5 py-2 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-lg">
                                        Отмена
                                    </button>
                                    <button onClick={handleSave} disabled={popupSaving}
                                        className="px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-md disabled:opacity-60"
                                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                        {popupSaving ? 'Сохраняем…' : 'Сохранить'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
