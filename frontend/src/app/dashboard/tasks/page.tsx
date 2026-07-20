'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    getMyWeekTasks,
    updateDailyTask,
    DailyTaskValidationError,
    type StudentWeekResponse,
    type DailyTask,
} from '@/services/api/tasks'
import { getMyApplications, type Application } from '@/services/api/invitation'
import { getMe } from '@/services/api/auth'
import { Lock, CalendarClock, Calendar, ChevronLeft, ChevronRight, X, TriangleAlert, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    return `${s.getUTCDate()} ${months[s.getUTCMonth()]} – ${e.getUTCDate()} ${months[e.getUTCMonth()]} ${e.getUTCFullYear()}`
}

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']

export default function DashboardTasksPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
    const [applicationsLoading, setApplicationsLoading] = useState(true)

    useEffect(() => {
        (async () => {
            try {
                const [data, user] = await Promise.all([getMyApplications(), getMe()])
                setApplications(data)
                setActiveApplicationId(user.active_application_id ?? null)
            } finally {
                setApplicationsLoading(false)
            }
        })()
    }, [])

    // Дневник задач имеет смысл только после того, как заявку одобрили —
    // до этого момента нет ни роли, ни согласованных дат практики.
    const approvedApplications = applications.filter(a => a.status === 'approved')
    const selectedApplication = approvedApplications.find(a => a.id === activeApplicationId) ?? null
    const needsApplicationSelection = approvedApplications.length > 1 && !selectedApplication
    const approvedApplication = selectedApplication ?? (approvedApplications.length === 1 ? approvedApplications[0] : null)
    const [currentTime] = useState(() => Date.now())
    // Сервер создаёт DailyTask на весь срок практики сразу при одобрении заявки —
    // ячейки на будущие недели существуют заранее. Заполнять их до фактического
    // начала практики смысла не имеет, поэтому блокируем взаимодействие на фронте.
    const practiceStarted = approvedApplication
        ? currentTime >= new Date(approvedApplication.cohort.start_date).getTime()
        : false

    const [weekStart, setWeekStart] = useState<string>(() => toISODate(getMondayOfWeek(new Date())))
    const [weekData, setWeekData] = useState<StudentWeekResponse | null>(null)
    const [tasksLoading, setTasksLoading] = useState(false)
    const [tasksError, setTasksError] = useState('')

    const [popup, setPopup] = useState<{ date: string; task: DailyTask } | null>(null)
    // [FIX] Раньше выделение текста мышью внутри окна с выходом за его границы
    // засчитывалось как клик по фону и закрывало попап. Закрываем только если
    // и mousedown, и mouseup произошли именно на фоне, а не на содержимом.
    const backdropMouseDownRef = useRef(false)
    const [popupDesc, setPopupDesc] = useState('')
    const [popupLinks, setPopupLinks] = useState<string[]>([])
    const [popupSaving, setPopupSaving] = useState(false)
    const [popupError, setPopupError] = useState('')
    // Валидационные ошибки (например, дублирующиеся ссылки) — это подсказка,
    // а не поломка; настоящие сбои сохранения/очистки остаются danger.
    const [popupErrorIsWarning, setPopupErrorIsWarning] = useState(false)

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
        if (!practiceStarted) return
        setPopup({ date, task })
        setPopupDesc(task.description ?? '')
        setPopupLinks(task.links.map(l => l.url))
        setPopupError('')
        setPopupErrorIsWarning(false)
    }

    function closePopup() {
        setPopup(null)
        setPopupSaving(false)
        setPopupError('')
        setPopupErrorIsWarning(false)
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
        setPopupErrorIsWarning(false)
        try {
            await updateDailyTask(popup.task.id, {
                description: popupDesc.trim() || null,
                links: popupLinks.filter(l => l.trim() !== '').map(url => ({ url: url.trim() })),
            })
            closePopup()
            await loadWeek()
        } catch (err: unknown) {
            if (err instanceof DailyTaskValidationError) {
                setPopupError(err.message)
                setPopupErrorIsWarning(true)
            } else {
                setPopupError(err instanceof Error ? err.message : 'Ошибка сохранения')
                setPopupErrorIsWarning(false)
            }
            setPopupSaving(false)
        }
    }

    async function handleClear() {
        if (!popup) return
        setPopupSaving(true)
        setPopupError('')
        setPopupErrorIsWarning(false)
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
            <div className="bg-white rounded-2xl shadow-sm p-12 min-h-[280px] flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                    <Lock className="size-5" />
                </div>
                <p className="font-semibold text-ink mb-1">
                    {needsApplicationSelection ? 'Выберите рабочий трек' : 'Дневник задач пока недоступен'}
                </p>
                <p className="text-sm text-muted-ink max-w-sm mb-4">
                    {needsApplicationSelection
                        ? 'Выберите рабочий трек в разделе «Мои заявки», чтобы открыть его задачи.'
                        : 'Он откроется, как только одна из ваших заявок будет одобрена — тогда даты практики подставятся автоматически.'}
                </p>
                <Button variant="brand" render={<a href="/dashboard/applications" />} nativeButton={false}
                    className="px-4 py-2 rounded-lg h-auto">
                    Посмотреть мои заявки
                </Button>
            </div>
        )
    }

    // Сервер отдаёт только дни, попадающие в период практики — если практика
    // начинается, например, во вторник, понедельник этой недели в ответе
    // отсутствует вовсе. Достраиваем полную рабочую неделю (Пн–Пт) на фронте,
    // чтобы такие дни были видны (просто без возможности заполнения), а не
    // выпадали из сетки целиком.
    const displayDays = weekData
        ? Array.from({ length: 5 }, (_, i) => {
              const dateStr = toISODate(addDays(new Date(weekStart), i))
              return weekData.days.find(d => d.date === dateStr) ?? { date: dateStr, task: null }
          })
        : []

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="font-extrabold text-2xl tracking-tight text-ink">Дневник задач</h1>
                <div className="flex items-center gap-2">
                    <button onClick={goPrevWeek} disabled={!canGoPrev() || tasksLoading} aria-label="Предыдущая неделя"
                        className="px-4 py-2 text-sm font-medium border-0 text-white rounded-lg bg-gradient-to-br from-brand to-brand-light hover:brightness-110 active:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft className="size-4" />
                    </button>
                    {weekData && (
                        <span className="inline-flex items-center justify-center gap-1.5 h-9 min-w-[210px] text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-4">
                            <Calendar className="size-4" />
                            {formatWeekLabel(weekData.weekStart, weekData.weekEnd)}
                        </span>
                    )}
                    <button onClick={goNextWeek} disabled={!canGoNext() || tasksLoading} aria-label="Следующая неделя"
                        className="px-4 py-2 text-sm font-medium border-0 text-white rounded-lg bg-gradient-to-br from-brand to-brand-light hover:brightness-110 active:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </div>

            {tasksError && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{tasksError}</p>
                </div>
            )}

            {!practiceStarted && (
                <div className="bg-warning-bg border border-warning-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <CalendarClock className="size-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-warning">Практика ещё не началась</p>
                        <p className="text-sm text-muted-ink mt-1">
                            Дни практики уже видны ниже, но заполнить их можно только начиная
                            с {new Date(approvedApplication.cohort.start_date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}.
                        </p>
                    </div>
                </div>
            )}

            <div className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-opacity ${tasksLoading ? 'opacity-50' : ''}`}>
                <div className="grid grid-cols-5 border-b border-border-soft">
                    {displayDays.map(({ date }, i) => {
                        const d = new Date(date)
                        return (
                            <div key={i} className="px-5 py-3 border-r border-border-soft last:border-r-0">
                                <span className="text-xs font-bold text-muted-ink uppercase tracking-wide">
                                    {DAYS_RU[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()}.{String(d.getUTCMonth() + 1).padStart(2, '0')}
                                </span>
                            </div>
                        )
                    })}
                </div>

                <div className="grid grid-cols-5 divide-x divide-border-soft min-h-[240px]">
                    {displayDays.map(({ date, task }) => (
                        <div key={date} className="p-4 flex flex-col gap-3 relative group">
                            {task ? (
                                <button onClick={() => openCell(date, task)} disabled={!practiceStarted}
                                    className={`flex flex-col gap-2 text-left w-full h-full ${!practiceStarted ? 'cursor-default' : ''}`}>
                                    {task.description || task.links.length > 0 ? (
                                        <>
                                            <div className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-subtle text-brand-hover">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                                                Заполнено
                                            </div>
                                            {task.description && <p className="text-sm text-ink leading-relaxed line-clamp-3">{task.description}</p>}
                                            {task.links.length > 0 && (
                                                <span className="inline-flex items-center gap-1 text-xs text-brand-hover truncate max-w-full">
                                                    <LinkIcon className="size-3 flex-shrink-0" />
                                                    {task.links.length === 1 ? 'Ссылка' : `Ссылок: ${task.links.length}`}
                                                </span>
                                            )}
                                        </>
                                    ) : practiceStarted ? (
                                        <div className="flex flex-col items-center justify-center gap-2 h-full text-xs text-muted-ink group-hover:text-brand-hover">
                                            <span className="w-7 h-7 rounded-full border border-dashed border-border-soft group-hover:border-brand-subtle-border flex items-center justify-center text-sm transition-colors">+</span>
                                            Заполнить день
                                        </div>
                                    ) : (
                                        <span className="text-xs text-faint-ink">Пока недоступно</span>
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
                    {' '}· Нажмите на день, чтобы описать выполненную работу и прикрепить решение
                </p>
            )}

            {/* ── ПОПАП ДНЯ ── */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onMouseDown={e => { backdropMouseDownRef.current = e.target === e.currentTarget }}
                    onMouseUp={e => {
                        if (backdropMouseDownRef.current && e.target === e.currentTarget) closePopup()
                        backdropMouseDownRef.current = false
                    }}>
                    <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="relative mb-5">
                            <button onClick={closePopup} className="absolute right-0 top-0 text-muted-ink hover:text-ink text-xl leading-none transition-colors">×</button>
                            <div className="flex flex-col items-center gap-1.5 text-center">
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-3 py-1.5">
                                    <Calendar className="size-4" />
                                    {new Date(popup.date).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </span>
                                {popup.task.saved_at && (
                                    <p className="text-xs text-muted-ink">
                                        Сохранено {new Date(popup.task.saved_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-ink">Что было сделано сегодня?</label>
                                <textarea value={popupDesc} onChange={e => setPopupDesc(e.target.value)}
                                    placeholder="Опиши выполненную работу…" rows={4}
                                    className="w-full text-sm rounded-lg" style={{ resize: 'none' }} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-ink">Ссылки на артефакты</label>
                                {popupLinks.length > 0 && (
                                    <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                                        {popupLinks.map((link, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input type="text" value={link} onChange={e => updateLinkField(i, e.target.value)}
                                                    placeholder="GitHub, Figma, Google Drive…" className="w-full text-sm rounded-lg" />
                                                <button onClick={() => removeLinkField(i)}
                                                    className="px-3 flex items-center justify-center text-danger bg-danger-bg border border-danger-border rounded-lg hover:bg-danger-border/40 transition-colors">
                                                    <X className="size-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button onClick={addLinkField}
                                    className="self-start inline-flex items-center text-xs font-semibold text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                                    + Добавить ссылку
                                </button>
                            </div>

                            {popupError && (
                                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${popupErrorIsWarning ? 'bg-warning-bg border border-warning-border' : 'bg-danger-bg border border-danger-border'}`}>
                                    <TriangleAlert className={`size-4 flex-shrink-0 ${popupErrorIsWarning ? 'text-warning' : 'text-danger'}`} />
                                    <p className={`text-sm ${popupErrorIsWarning ? 'text-warning' : 'text-danger'}`}>{popupError}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-2">
                                <Button variant="danger" onClick={handleClear} disabled={popupSaving}
                                    className="px-4 py-2 rounded-lg h-auto">
                                    Очистить день
                                </Button>
                                <div className="flex items-center gap-4">
                                    <button onClick={closePopup} className="text-sm font-semibold text-muted-ink hover:text-ink transition-colors">
                                        Отмена
                                    </button>
                                    <Button variant="brand" onClick={handleSave} disabled={popupSaving}
                                        className="px-5 py-2 rounded-lg h-auto">
                                        {popupSaving ? 'Сохраняем…' : 'Сохранить'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
