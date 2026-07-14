'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    getMyWeekTasks,
    updateDailyTask,
    DailyTaskValidationError,
    type StudentWeekResponse,
    type DailyTask,
} from '@/services/api/tasks'
import { getMyApplications, type Application } from '@/services/api/invitation'

// ── Утилиты дат (UTC — согласовано с бэком: даты обрабатываются как UTC date-only) ─
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

function isWeekendUTC(date: Date): boolean {
    const day = date.getUTCDay()
    return day === 0 || day === 6
}

// [FIX] Если период практики начинается в выходной (например, суббота),
// Monday-of-week этой даты попадает на ПРЕДЫДУЩУЮ неделю целиком до начала
// практики — вся неделя выходила бы пустой ("—" на все 5 ячеек). Вместо
// этого ищем первый будний день ОТ начала практики и берём понедельник его недели.
function firstPracticeWeekMonday(practiceStartIso: string): Date {
    let d = new Date(practiceStartIso)
    d.setUTCHours(0, 0, 0, 0)
    while (isWeekendUTC(d)) d = addDays(d, 1)
    return getMondayOfWeek(d)
}

// Симметричный случай для конца практики: если период заканчивается в выходной,
// берём последний будний день ДО конца практики и понедельник его недели —
// чтобы не показывать лишнюю неделю целиком после окончания практики.
function lastPracticeWeekMonday(practiceEndIso: string): Date {
    let d = new Date(practiceEndIso)
    d.setUTCHours(0, 0, 0, 0)
    while (isWeekendUTC(d)) d = addDays(d, -1)
    return getMondayOfWeek(d)
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

    // Дневник задач имеет смысл только после того, как заявку одобрили —
    // до этого момента нет ни роли, ни согласованных дат практики.
    const approvedApplication = applications.find(a => a.status === 'approved') ?? null

    const [weekStart, setWeekStart] = useState<string>(() => toISODate(getMondayOfWeek(new Date())))
    const [weekData, setWeekData] = useState<StudentWeekResponse | null>(null)
    const [tasksLoading, setTasksLoading] = useState(false)
    const [tasksError, setTasksError] = useState('')

    const [popup, setPopup] = useState<{ date: string; task: DailyTask } | null>(null)
    const [popupDesc, setPopupDesc] = useState('')
    const [popupLinks, setPopupLinks] = useState<string[]>([])
    const [popupSaving, setPopupSaving] = useState(false)
    const [popupError, setPopupError] = useState('')

    const loadWeek = useCallback(async () => {
        if (!approvedApplication) return
        setTasksLoading(true)
        setTasksError('')
        try {
            const data = await getMyWeekTasks(approvedApplication.id, weekStart)
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
            const practiceMonday = toISODate(firstPracticeWeekMonday(weekData.cohort.practice_start))
            const practiceLastMonday = toISODate(lastPracticeWeekMonday(weekData.cohort.practice_end))
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
            const practiceMonday = toISODate(firstPracticeWeekMonday(approvedApplication.cohort.start_date))
            setWeekStart(prev => (prev === toISODate(getMondayOfWeek(new Date())) ? practiceMonday : prev))
        })()
    }, [approvedApplication])

    function canGoPrev(): boolean {
        if (!weekData) return true
        return weekStart > toISODate(firstPracticeWeekMonday(weekData.cohort.practice_start))
    }

    function canGoNext(): boolean {
        if (!weekData) return true
        return weekStart < toISODate(lastPracticeWeekMonday(weekData.cohort.practice_end))
    }

    function goPrevWeek() {
        if (!canGoPrev()) return
        setWeekStart(prev => toISODate(addDays(new Date(prev), -7)))
    }

    function goNextWeek() {
        if (!canGoNext()) return
        setWeekStart(prev => toISODate(addDays(new Date(prev), 7)))
    }

    function openCell(date: string, task: DailyTask) {
        setPopup({ date, task })
        setPopupDesc(task.description ?? '')
        setPopupLinks(task.links.map(l => l.url))
        setPopupError('')
    }

    function closePopup() {
        setPopup(null)
        setPopupSaving(false)
        setPopupError('')
    }

    function addLinkField() {
        setPopupLinks(prev => [...prev, ''])
    }

    function updateLinkField(i: number, value: string) {
        setPopupLinks(prev => prev.map((l, idx) => (idx === i ? value : l)))
    }

    function removeLinkField(i: number) {
        setPopupLinks(prev => prev.filter((_, idx) => idx !== i))
    }

    async function handleSave() {
        if (!popup) return
        setPopupSaving(true)
        setPopupError('')
        try {
            await updateDailyTask(popup.task.id, {
                description: popupDesc.trim() || null,
                links: popupLinks.filter(l => l.trim() !== '').map(url => ({ url: url.trim() })),
            })
            closePopup()
            await loadWeek()
        } catch (err: unknown) {
            if (err instanceof DailyTaskValidationError || err instanceof Error) {
                setPopupError(err.message)
            } else {
                setPopupError('Ошибка сохранения')
            }
            setPopupSaving(false)
        }
    }

    async function handleClear() {
        if (!popup) return
        setPopupSaving(true)
        setPopupError('')
        try {
            await updateDailyTask(popup.task.id, { description: null, links: [] })
            closePopup()
            await loadWeek()
        } catch (err: unknown) {
            setPopupError(err instanceof Error ? err.message : 'Ошибка очистки')
            setPopupSaving(false)
        }
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
                    {weekData?.days.map(({ date }, i) => {
                        const d = new Date(date)
                        return (
                            <div key={i} className="px-5 py-3 border-r border-[#E4E2F4] last:border-r-0">
                                <span className="text-xs font-bold text-[#A9A7BB] uppercase tracking-wide">
                                    {DAYS_RU[i]} {d.getUTCDate()}.{String(d.getUTCMonth() + 1).padStart(2, '0')}
                                </span>
                            </div>
                        )
                    })}
                </div>

                <div className="grid grid-cols-5 divide-x divide-[#E4E2F4] min-h-[240px]">
                    {weekData?.days.map(({ date, task }) => (
                        <div key={date} className="p-4 flex flex-col gap-3 relative group">
                            {task ? (
                                <button onClick={() => openCell(date, task)} className="flex flex-col gap-2 text-left w-full h-full">
                                    {task.description ? (
                                        <>
                                            <div className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#EBE9FF] text-[#4A42D4]">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#6C63FF]" />
                                                Заполнено
                                            </div>
                                            <p className="text-xs text-[#1C1A3A] leading-relaxed line-clamp-3">{task.description}</p>
                                            {task.links.length > 0 && (
                                                <span className="text-[10px] text-[#6C63FF] truncate max-w-full">
                                                    🔗 {task.links.length === 1 ? 'Ссылка' : `Ссылок: ${task.links.length}`}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-[#A9A7BB] group-hover:text-[#6C63FF]">+ Заполнить день</span>
                                    )}
                                </button>
                            ) : (
                                <span className="text-xs text-[#D9D7E8]">—</span>
                            )}
                        </div>
                    ))}
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
                    Период практики: {new Date(weekData.cohort.practice_start).toLocaleDateString('ru')} — {new Date(weekData.cohort.practice_end).toLocaleDateString('ru')}
                    {' '}· Нажми на день, чтобы описать выполненную работу и прикрепить ссылки
                </p>
            )}

            {/* ── ПОПАП ДНЯ ── */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closePopup}>
                    <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="font-bold text-lg text-[#1C1A3A]">
                                    {new Date(popup.date).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </h3>
                                {popup.task.saved_at && (
                                    <p className="text-xs text-[#A9A7BB]">
                                        Сохранено {new Date(popup.task.saved_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                            <button onClick={closePopup} className="text-[#A9A7BB] hover:text-[#1C1A3A] text-xl leading-none">×</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Что делал сегодня?</label>
                                <textarea value={popupDesc} onChange={e => setPopupDesc(e.target.value)}
                                    placeholder="Опиши выполненную работу…" rows={4}
                                    className="w-full text-sm" style={{ resize: 'none' }} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-[#1C1A3A]">Ссылки на артефакты</label>
                                {popupLinks.map((link, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input type="text" value={link} onChange={e => updateLinkField(i, e.target.value)}
                                            placeholder="GitHub, Figma, Google Drive…" className="w-full text-sm" />
                                        <button onClick={() => removeLinkField(i)}
                                            className="px-3 text-[#D94F4F] hover:bg-[#FFF5F5] rounded-lg text-sm">✕</button>
                                    </div>
                                ))}
                                <button onClick={addLinkField}
                                    className="self-start text-xs font-semibold text-[#6C63FF] hover:underline">
                                    + Добавить ссылку
                                </button>
                            </div>

                            {popupError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {popupError}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-2">
                                <button onClick={handleClear} disabled={popupSaving}
                                    className="px-4 py-2 text-sm font-medium text-[#D94F4F] hover:bg-[#FFF5F5] rounded-lg disabled:opacity-50">
                                    Очистить день
                                </button>
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
