'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getCohortWeekProgress, type CohortWeekProgress, type DailyTask, type WeekDay } from '@/services/api/tasks'
import { useCohortWorkspace } from '../cohort-context'
import { FolderKanban, TriangleAlert, ListChecks, Calendar, ChevronLeft, ChevronRight, Route, ChevronDown, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Оверлей модалки закрывается только по клику НАЧАВШЕМУСЯ и ЗАКОНЧИВШЕМУСЯ на
// самом оверлее — иначе выделение текста мышью, отпущенной за пределами
// модалки (mouseup на оверлее), тоже засчитывалось бы как клик по нему и
// закрывало окно посреди выделения.
function useOverlayClose(onClose: () => void) {
    const mouseDownOnOverlay = useRef(false)
    return {
        onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
            mouseDownOnOverlay.current = e.target === e.currentTarget
        },
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget && mouseDownOnOverlay.current) onClose()
        },
    }
}

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

// [FIX] Как и в студенческом дневнике задач: если период практики начинается/
// заканчивается в выходной, обычный Monday-of-week уводит на неделю целиком
// вне границ практики — ищем первый/последний будний день.
function firstPracticeWeekMonday(practiceStartIso: string): Date {
    let d = new Date(practiceStartIso)
    d.setUTCHours(0, 0, 0, 0)
    while (isWeekendUTC(d)) d = addDays(d, 1)
    return getMondayOfWeek(d)
}

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

function pluralizeDays(n: number): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'день'
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
    return 'дней'
}

type DayStatus = 'done' | 'late' | 'missed' | 'today' | 'future' | 'na'

function isDayClickable(status: DayStatus): boolean {
    return status === 'done' || status === 'late' || status === 'missed' || status === 'today'
}

// day === undefined значит "вне периода практики" (бэк не прислал ячейку на эту дату).
// Сегодняшний день, пока не заполнен, ВСЕГДА "today" (нейтрально-серый "Не заполнено"),
// даже если день уже наступил — "Пропущено" ставим только дням СТРОГО в прошлом
// (день должен полностью закончиться, а не просто начаться).
function computeDayStatus(day: WeekDay | undefined, todayISO: string): DayStatus {
    if (!day) return 'na'
    const task = day.task
    const hasContent = Boolean(task && (task.description || task.links.length > 0))
    if (hasContent) {
        const late = task!.saved_at ? task!.saved_at.slice(0, 10) > day.date : false
        return late ? 'late' : 'done'
    }
    if (day.date === todayISO) return 'today'
    if (day.date < todayISO) return 'missed'
    return 'future'
}

// Одна ячейка дня — общая и для десктопной сетки, и для мобильного аккордеона,
// чтобы не дублировать разметку статусов.
function TaskDayCell({ day, status, dayLabel, onOpen }: {
    day: WeekDay | undefined
    status: DayStatus
    dayLabel?: string
    onOpen: () => void
}) {
    return (
        <button type="button" disabled={!day || !isDayClickable(status)} onClick={onOpen}
            className={`rounded-xl border p-3 flex flex-col gap-1.5 text-left min-h-[92px] transition-colors ${
                status === 'done' || status === 'late' || status === 'today'
                    ? 'border-border-soft bg-white hover:border-brand-subtle-border'
                    : status === 'missed'
                        ? 'border-danger-border bg-danger-bg/40'
                        : 'border-border-soft bg-surface cursor-default'
            }`}>
            {dayLabel && (
                <span className="text-[10px] font-bold text-muted-ink uppercase tracking-wide">{dayLabel}</span>
            )}
            {(status === 'done' || status === 'late') && (
                <>
                    <span className={`inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${status === 'done' ? 'bg-brand-subtle text-brand-hover' : 'bg-warning-bg text-warning'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'done' ? 'bg-brand' : 'bg-warning-dot'}`} />
                        {status === 'done' ? 'Готово' : 'Опоздание'}
                    </span>
                    {day?.task?.description && (
                        <p className="text-xs text-ink leading-relaxed line-clamp-2">{day.task.description}</p>
                    )}
                    {day?.task && day.task.links.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-brand-hover truncate">
                            {day.task.links.length} {day.task.links.length === 1 ? 'ссылка' : 'ссылки'}
                        </span>
                    )}
                </>
            )}
            {status === 'missed' && (
                <span className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-danger-bg text-danger">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger-dot" />
                    Пропущено
                </span>
            )}
            {status === 'today' && (
                <span className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface text-muted-ink border border-border-soft">
                    <span className="w-1.5 h-1.5 rounded-full bg-faint-ink" />
                    Не заполнено
                </span>
            )}
            {(status === 'future' || status === 'na') && (
                <span className="text-xs text-faint-ink flex items-center justify-center h-full">—</span>
            )}
        </button>
    )
}

export default function AdminTasksPage() {
    const { selectedCohort } = useCohortWorkspace()

    const [weekStart, setWeekStart] = useState<string>(() => toISODate(getMondayOfWeek(new Date())))

    // При выборе рабочей когорты сразу открываем первую рабочую неделю практики,
    // а не "сегодня" (которое почти наверняка вне диапазона практики)
    useEffect(() => {
        (() => {
            if (!selectedCohort) return
            const practiceMonday = toISODate(firstPracticeWeekMonday(selectedCohort.start_date))
            setWeekStart(() => practiceMonday)
        })()
    }, [selectedCohort])
    const [progress, setProgress] = useState<CohortWeekProgress | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedTask, setSelectedTask] = useState<{ task: DailyTask; date: string } | null>(null)
    const selectedTaskModalOverlay = useOverlayClose(() => setSelectedTask(null))
    const [trackFilter, setTrackFilter] = useState('')
    const [search, setSearch] = useState('')
    // Мобильный вид: дневник студента — аккордеон, открыт только один за раз.
    const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!selectedCohort) return
        setLoading(true)
        setError('')
        try {
            const progressData = await getCohortWeekProgress(selectedCohort.id, weekStart)
            setProgress(progressData)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки прогресса')
        } finally {
            setLoading(false)
        }
    }, [selectedCohort, weekStart])

    useEffect(() => {
        (async () => { await load() })()
    }, [load])

    function goPrevWeek() {
        if (!selectedCohort) return
        const firstWeek = firstPracticeWeekMonday(selectedCohort.start_date)
        setWeekStart(prev => {
            const candidate = addDays(new Date(prev), -7)
            return candidate < firstWeek ? toISODate(firstWeek) : toISODate(candidate)
        })
    }

    function goNextWeek() {
        if (!selectedCohort) return
        const lastWeek = lastPracticeWeekMonday(selectedCohort.end_date)
        setWeekStart(prev => {
            const candidate = addDays(new Date(prev), 7)
            return candidate > lastWeek ? toISODate(lastWeek) : toISODate(candidate)
        })
    }

    const firstWeekStart = selectedCohort
        ? toISODate(firstPracticeWeekMonday(selectedCohort.start_date))
        : null
    const lastWeekStart = selectedCohort
        ? toISODate(lastPracticeWeekMonday(selectedCohort.end_date))
        : null

    function matchesFilters(student: { student: { email: string; full_name?: string }; track: { id: string } }): boolean {
        if (trackFilter && student.track.id !== trackFilter) return false
        const q = search.trim().toLowerCase()
        if (!q) return true
        return student.student.email.toLowerCase().includes(q) || (student.student.full_name ?? '').toLowerCase().includes(q)
    }

    const filteredStudents = progress?.students.filter(matchesFilters) ?? []

    const todayISO = toISODate(new Date())
    const displayDates = Array.from({ length: 5 }, (_, i) => toISODate(addDays(new Date(weekStart), i)))

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="font-extrabold text-2xl tracking-tight text-ink">
                        {selectedCohort ? <>Дневник задач по когорте «{selectedCohort.title}»</> : 'Дневник задач'}
                    </h1>
                    {!selectedCohort && (
                        <p className="text-sm text-muted-ink mt-1">Выберите рабочую когорту в шапке.</p>
                    )}
                </div>
                {selectedCohort && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={goPrevWeek} disabled={weekStart === firstWeekStart} aria-label="Предыдущая неделя"
                            className="px-4 py-2 text-sm font-medium border-0 text-white rounded-lg bg-gradient-to-br from-brand to-brand-light hover:brightness-110 active:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                            <ChevronLeft className="size-4" />
                        </button>
                        {progress && (
                            <span className="inline-flex items-center justify-center gap-1.5 h-9 flex-1 sm:flex-initial sm:min-w-[210px] text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-4">
                                <Calendar className="size-4" />
                                {formatWeekLabel(progress.weekStart, progress.weekEnd)}
                            </span>
                        )}
                        <button onClick={goNextWeek} disabled={weekStart === lastWeekStart} aria-label="Следующая неделя"
                            className="px-4 py-2 text-sm font-medium border-0 text-white rounded-lg bg-gradient-to-br from-brand to-brand-light hover:brightness-110 active:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                )}
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                        <FolderKanban className="size-5" />
                    </div>
                    <p className="font-semibold text-ink mb-1">Выберите рабочую когорту</p>
                </div>
            )}

            {selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                    <div className="relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white w-full sm:w-auto sm:flex-shrink-0 focus-within:border-brand cursor-pointer">
                        <Route className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-sm font-medium text-ink truncate pointer-events-none">
                            {selectedCohort.tracks.find(t => t.id === trackFilter)?.title ?? 'Все треки'}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select aria-label="Фильтр по треку" value={trackFilter} onChange={e => setTrackFilter(e.target.value)}
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            <option value="">Все треки</option>
                            {selectedCohort.tracks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                    <input type="text" aria-label="Поиск по ФИО или email" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по ФИО или email…" className="h-9 text-sm px-3 rounded-lg border border-border-soft flex-1 min-w-[180px]" />
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-ink">
                    <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Загружаем…
                </div>
            )}

            {error && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{error}</p>
                </div>
            )}

            {selectedCohort && !loading && !error && progress && (
                progress.students.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                            <ListChecks className="size-5" />
                        </div>
                        <p className="font-semibold text-ink mb-1">Одобренных заявок пока нет</p>
                        <p className="text-sm text-muted-ink">Дневник задач появится после одобрения заявок кандидатов.</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                            <ListChecks className="size-5" />
                        </div>
                        <p className="font-semibold text-ink mb-1">Ничего не найдено</p>
                        <p className="text-sm text-muted-ink">Измените фильтр или поисковый запрос.</p>
                    </div>
                ) : (
                    <>
                        {/* ── Десктоп: таблица-сетка (ФИО + 5 дней в ряд) ── */}
                        <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
                            <div className="grid gap-3 px-5 py-3 border-b border-border-soft min-w-[860px]" style={{ gridTemplateColumns: '220px repeat(5, 1fr)' }}>
                                <span className="text-xs font-bold text-muted-ink uppercase tracking-wide">Студент</span>
                                {displayDates.map((date, i) => {
                                    const d = new Date(date)
                                    return (
                                        <span key={date} className="text-xs font-bold text-muted-ink uppercase tracking-wide text-center">
                                            {DAYS_RU[i]} {d.getUTCDate()}.{String(d.getUTCMonth() + 1).padStart(2, '0')}
                                        </span>
                                    )
                                })}
                            </div>
                            <div className="flex flex-col divide-y divide-border-soft min-w-[860px]">
                                {filteredStudents.map(student => (
                                    <div key={student.applicationId} className="grid gap-3 px-5 py-4" style={{ gridTemplateColumns: '220px repeat(5, 1fr)' }}>
                                        <div className="flex flex-col justify-center gap-1.5">
                                            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                                <Route className="size-3.5" />{student.track.title}
                                            </span>
                                            <p className="font-bold text-lg text-ink leading-tight">{student.student.full_name || student.student.email}</p>
                                            {student.student.full_name && (
                                                <span className="text-xs text-muted-ink">{student.student.email}</span>
                                            )}
                                        </div>
                                        {displayDates.map(date => {
                                            const day = student.tasks.find(t => t.date === date)
                                            const status = computeDayStatus(day, todayISO)
                                            return (
                                                <TaskDayCell key={date} day={day} status={status}
                                                    onOpen={() => day?.task && setSelectedTask({ task: day.task, date })} />
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Мобильные: аккордеон — дневник одного студента открыт за раз ── */}
                        <div className="sm:hidden flex flex-col gap-3">
                            {filteredStudents.map(student => {
                                const isOpen = expandedStudentId === student.applicationId
                                return (
                                    <div key={student.applicationId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                        <button type="button" onClick={() => setExpandedStudentId(isOpen ? null : student.applicationId)}
                                            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left">
                                            <div className="flex flex-col gap-1.5 min-w-0">
                                                <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                                    <Route className="size-3.5" />{student.track.title}
                                                </span>
                                                <p className="font-bold text-lg text-ink leading-tight truncate">{student.student.full_name || student.student.email}</p>
                                                {student.student.full_name && (
                                                    <span className="text-xs text-muted-ink truncate">{student.student.email}</span>
                                                )}
                                            </div>
                                            <ChevronDown className={`size-5 text-muted-ink flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isOpen && (
                                            <div className="px-5 pb-5 flex flex-col gap-2 border-t border-border-soft pt-4">
                                                {displayDates.map((date, i) => {
                                                    const d = new Date(date)
                                                    const day = student.tasks.find(t => t.date === date)
                                                    const status = computeDayStatus(day, todayISO)
                                                    return (
                                                        <TaskDayCell key={date} day={day} status={status}
                                                            dayLabel={`${DAYS_RU[i]} ${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`}
                                                            onOpen={() => day?.task && setSelectedTask({ task: day.task, date })} />
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )
            )}

            {selectedTask && (() => {
                const task = selectedTask.task
                const hasContent = Boolean(task.description || task.links.length > 0)
                const late = hasContent && task.saved_at ? task.saved_at.slice(0, 10) > selectedTask.date : false
                const savedAtLabel = task.saved_at
                    ? new Date(task.saved_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                    : null
                const daysLate = late && task.saved_at
                    ? Math.round((new Date(`${task.saved_at.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${selectedTask.date}T00:00:00Z`).getTime()) / 86400000)
                    : 0
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
                        role="dialog" aria-modal="true" aria-label="Детали выполненной задачи" {...selectedTaskModalOverlay}>
                        <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className="relative mb-5">
                                <button type="button" onClick={() => setSelectedTask(null)}
                                    className="absolute right-0 top-0 text-muted-ink hover:text-ink text-xl leading-none transition-colors" aria-label="Закрыть">×</button>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-3 py-1.5">
                                        <Calendar className="size-4" />
                                        {new Date(selectedTask.date).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full border px-3 py-1.5 ${
                                        !hasContent
                                            ? 'bg-danger-bg border-danger-border text-danger'
                                            : late
                                                ? 'bg-warning-bg border-warning-border text-warning'
                                                : 'bg-success-bg border-success-border text-success'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${!hasContent ? 'bg-danger-dot' : late ? 'bg-warning-dot' : 'bg-success-dot'}`} />
                                        {!hasContent
                                            ? 'Не заполнено'
                                            : late
                                                ? <>Опоздание на {daysLate} {pluralizeDays(daysLate)}:<br className="sm:hidden" /> сдано {savedAtLabel}</>
                                                : `Заполнено: ${savedAtLabel}`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Описание выполненной задачи</label>
                                    <p className="rounded-lg border border-border-soft bg-surface px-4 py-[18px] max-h-[220px] overflow-y-auto text-sm text-ink whitespace-pre-wrap">
                                        {task.description || <span className="text-faint-ink italic">Пока не заполнено</span>}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-ink">Ссылки на артефакты</label>
                                    {task.links.length > 0 ? (
                                        <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                                            {task.links.map(link => (
                                                <button key={link.id} type="button" title="Скопировать ссылку"
                                                    onClick={() => navigator.clipboard.writeText(link.url)}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-brand px-4 py-2.5 text-sm text-brand-hover hover:bg-brand-subtle transition-colors text-left">
                                                    <span className="truncate">{link.url}</span>
                                                    <Copy className="size-4 flex-shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border-soft px-4 py-2.5 text-sm text-faint-ink">
                                            <span>Ссылок нет</span>
                                            <Copy className="size-4 flex-shrink-0" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end mt-6">
                                <Button variant="brand" onClick={() => setSelectedTask(null)}
                                    className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                    Закрыть
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
