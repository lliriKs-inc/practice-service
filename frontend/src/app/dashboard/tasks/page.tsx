'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    getWeekTasks,
    createTask,
    updateTask,
    deleteTask,
    type Task,
    type WeekTasksResponse,
} from '@/services/api/tasks'
import { getMyApplications, type Application } from '@/services/api/invitation'

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

export default function DashboardTasksPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)

    useEffect(() => {
        (async () => {
            try {
                const data = await getMyApplications()
                setApplications(data)
            } finally {
                setApplicationsLoading(false)
            }
        })()
    }, [])

    // [FIX] Дневник задач имеет смысл только после того, как заявку
    // одобрили — до этого момента у практиканта нет ни роли, ни
    // согласованных дат практики. approvedApplication — источник дат
    // для сетки (вместо общей заглушки, не привязанной к когорте).
    const approvedApplication = applications.find(a => a.status === 'approved') ?? null

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
            if (applicationsLoading || !approvedApplication) return
            await loadWeek()
        })()
    }, [weekStart, applicationsLoading, loadWeek, approvedApplication])

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

    if (applicationsLoading) return (
        <div className="flex items-center gap-2 text-sm text-[#6B6880]">
            <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
            Загружаем…
        </div>
    )

    if (!approvedApplication) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                <div className="text-4xl mb-4">🔒</div>
                <p className="font-semibold text-[#1C1A3A] mb-1">Дневник задач пока недоступен</p>
                <p className="text-sm text-[#6B6880] max-w-sm mb-4">
                    Он откроется, как только одна из твоих заявок будет одобрена —
                    тогда даты практики подставятся автоматически.
                </p>
                <a href="/dashboard/applications"
                    className="text-xs font-semibold px-4 py-2 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF]">
                    Посмотреть мои заявки
                </a>
            </div>
        )
    }

    const gridDays = buildGridDays()

    return (
        <div className="flex flex-col gap-6">
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
