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
import { getActiveApplicationId } from '@/lib/active-application'

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
    const approvedApplications = applications.filter(a => a.status === 'approved')
    const preferredApplicationId = getActiveApplicationId()
    const approvedApplication = approvedApplications.find(a => a.id === preferredApplicationId)
        ?? approvedApplications[0]
        ?? null

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
    }, [weekData, weekStart])

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
        <div className="flex items-center gap-2 text-sm text-muted-ink">
            <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            Загружаем…
        </div>
    )

    if (!approvedApplication) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                <div className="text-4xl mb-4">🔒</div>
                <p className="font-semibold text-ink mb-1">Дневник задач пока недоступен</p>
                <p className="text-sm text-muted-ink max-w-sm mb-4">
                    Он откроется, как только одна из ваших заявок будет одобрена —
                    тогда даты практики подставятся автоматически.
                </p>
                <a href="/dashboard/applications"
                    className="text-xs font-semibold px-4 py-2 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle">
                    Посмотреть мои заявки
                </a>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Дневник задач</h1>
                    {weekData && (
                        <p className="text-sm text-muted-ink">{formatWeekLabel(weekData.weekStart, weekData.weekEnd)}</p>
                    )}
                    <p className="text-sm text-muted-ink">Текущий трек: {weekData?.track.title ?? approvedApplication.track.title}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={goPrevWeek} disabled={!canGoPrev() || tasksLoading}
                        className="px-4 py-2 text-sm font-medium border border-border-soft rounded-lg bg-white text-muted-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed">
                        ← Пред.
                    </button>
                    <button onClick={goNextWeek} disabled={!canGoNext() || tasksLoading}
                        className="px-4 py-2 text-sm font-medium border border-border-soft rounded-lg bg-white text-muted-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed">
                        След. →
                    </button>
                </div>
            </div>

            {tasksError && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4">
                    <p className="text-sm text-danger">⚠️ {tasksError}</p>
                </div>
            )}

            <div className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-opacity ${tasksLoading ? 'opacity-50' : ''}`}>
                <div className="grid grid-cols-5 border-b border-border-soft">
                    {weekData?.days.map(({ date }, i) => {
                        const d = new Date(date)
                        return (
                            <div key={i} className="px-5 py-3 border-r border-border-soft last:border-r-0">
                                <span className="text-xs font-bold text-muted-ink uppercase tracking-wide">
                                    {DAYS_RU[i]} {d.getUTCDate()}.{String(d.getUTCMonth() + 1).padStart(2, '0')}
                                </span>
                            </div>
                        )
                    })}
                </div>

                <div className="grid grid-cols-5 divide-x divide-border-soft min-h-[240px]">
                    {weekData?.days.map(({ date, task }) => (
                        <div key={date} className="p-4 flex flex-col gap-3 relative group">
                            {task ? (
                                <button onClick={() => openCell(date, task)} className="flex flex-col gap-2 text-left w-full h-full">
                                    {task.description ? (
                                        <>
                                            <div className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-subtle text-brand-hover">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                                                Заполнено
                                            </div>
                                            <p className="text-xs text-ink leading-relaxed line-clamp-3">{task.description}</p>
                                            {task.links.length > 0 && (
                                                <span className="text-[10px] text-brand-hover truncate max-w-full">
                                                    🔗 {task.links.length === 1 ? 'Ссылка' : `Ссылок: ${task.links.length}`}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-muted-ink group-hover:text-brand-hover">+ Заполнить день</span>
                                    )}
                                </button>
                            ) : (
                                <span className="text-xs text-faint-ink">—</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {tasksLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-ink">
                    <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Загрузка задач…
                </div>
            )}

            {weekData && (
                <p className="text-xs text-muted-ink">
                    Период практики: {new Date(weekData.cohort.practice_start).toLocaleDateString('ru')} — {new Date(weekData.cohort.practice_end).toLocaleDateString('ru')}
                    {' '}· Нажмите на день, чтобы описать выполненную работу и прикрепить ссылки
                </p>
            )}

            {/* ── ПОПАП ДНЯ ── */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closePopup}>
                    <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="font-bold text-lg text-ink">
                                    {new Date(popup.date).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </h3>
                                {popup.task.saved_at && (
                                    <p className="text-xs text-muted-ink">
                                        Сохранено {new Date(popup.task.saved_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                            <button onClick={closePopup} className="text-muted-ink hover:text-ink text-xl leading-none">×</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-ink">Что делал сегодня?</label>
                                <textarea value={popupDesc} onChange={e => setPopupDesc(e.target.value)}
                                    placeholder="Опиши выполненную работу…" rows={4}
                                    className="w-full text-sm" style={{ resize: 'none' }} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-ink">Ссылки на артефакты</label>
                                {popupLinks.map((link, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input type="text" value={link} onChange={e => updateLinkField(i, e.target.value)}
                                            placeholder="GitHub, Figma, Google Drive…" className="w-full text-sm" />
                                        <button onClick={() => removeLinkField(i)}
                                            className="px-3 text-danger hover:bg-danger-bg rounded-lg text-sm">✕</button>
                                    </div>
                                ))}
                                <button onClick={addLinkField}
                                    className="self-start text-xs font-semibold text-brand-hover hover:underline">
                                    + Добавить ссылку
                                </button>
                            </div>

                            {popupError && (
                                <div className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
                                    <p className="text-sm text-danger">⚠️ {popupError}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-2">
                                <button onClick={handleClear} disabled={popupSaving}
                                    className="px-4 py-2 text-sm font-medium text-danger hover:bg-danger-bg rounded-lg disabled:opacity-50">
                                    Очистить день
                                </button>
                                <div className="flex gap-3">
                                    <button onClick={closePopup} className="px-5 py-2 text-sm font-medium text-muted-ink hover:bg-surface rounded-lg">
                                        Отмена
                                    </button>
                                    <button onClick={handleSave} disabled={popupSaving}
                                        className="px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-md disabled:opacity-60 bg-gradient-to-br from-brand to-brand-light">
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
