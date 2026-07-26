'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Route, MoveRight, TriangleAlert, Check, ClipboardList, Star, ListFilter, CalendarRange, Archive, Trash2, FolderKanban } from 'lucide-react'
import { getMyApplications, type Application } from '@/services/api/invitation'
import { getMe, selectActiveApplication } from '@/services/api/auth'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'

// Основной список — только заявки, которые ещё "в работе": на рассмотрении
// или одобренные, пока когорта не завершилась и не закрыта. Отклонённые
// заявки и заявки в уже неактуальных когортах уходят в архив.
const MAIN_STATUS_FILTER_OPTIONS: { value: 'pending' | 'approved'; label: string }[] = [
    { value: 'pending', label: 'На рассмотрении' },
    { value: 'approved', label: 'Одобрена' },
]

// Причина, по которой заявка оказалась в архиве — ровно одна на заявку:
// либо её отклонили, либо когорта уже не активна (закрыта раньше срока
// администратором или естественно завершилась по дате конца практики).
type ArchiveReason = 'rejected' | 'closed' | 'completed'

const ARCHIVE_REASON_OPTIONS: { value: ArchiveReason; label: string }[] = [
    { value: 'rejected', label: 'Отклонена' },
    { value: 'closed', label: 'Закрыта' },
    { value: 'completed', label: 'Завершена' },
]

const ARCHIVE_REASON_BADGE: Record<'closed' | 'completed', string> = {
    closed: 'Когорта закрыта',
    completed: 'Когорта завершена',
}

// Бэкенд не хранит отдельного статуса "завершена по дате" — когорта остаётся
// ACTIVE, пока админ не закроет её вручную. Поэтому "естественное" завершение
// определяем на фронте: активна, но дата конца практики уже прошла.
function isCohortFinished(app: Application, now: number): boolean {
    return app.cohort.status === 'closed' || (app.cohort.status === 'active' && now > new Date(app.cohort.end_date).getTime())
}

// null — заявка не архивная (на рассмотрении/одобрена в ещё живой когорте).
function getArchiveReason(app: Application, now: number): ArchiveReason | null {
    if (app.status === 'rejected') return 'rejected'
    if (app.cohort.status === 'closed') return 'closed'
    if (app.cohort.status === 'active' && now > new Date(app.cohort.end_date).getTime()) return 'completed'
    return null
}

function isAllowedFilterDate(value: string | null | undefined): boolean {
    if (!value) return false
    return !Number.isNaN(new Date(value).getTime())
}

function periodOverlapsRange(rangeStart: string | null | undefined, rangeEnd: string | null | undefined, from: string, to: string): boolean {
    if (!isAllowedFilterDate(rangeStart) || !isAllowedFilterDate(rangeEnd)) return false
    const start = new Date(rangeStart!).getTime()
    const end = new Date(rangeEnd!).getTime()
    const from_ = from ? new Date(from).getTime() : -Infinity
    const to_ = to ? new Date(to).getTime() : Infinity
    return start <= to_ && end >= from_
}

function matchesSearchAndDate(app: Application, search: string, dateFrom: string, dateTo: string): boolean {
    if (search.trim()) {
        const query = search.trim().toLocaleLowerCase('ru-RU')
        const haystack = `${app.cohort.title} ${app.track.title}`.toLocaleLowerCase('ru-RU')
        if (!haystack.includes(query)) return false
    }
    if (!dateFrom && !dateTo) return true
    return periodOverlapsRange(app.cohort.start_date, app.cohort.end_date, dateFrom, dateTo)
}

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

const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-warning-bg border-warning-border text-warning', dot: 'bg-warning-dot' },
    approved: { label: 'Одобрена', className: 'bg-success-bg border-success-border text-success', dot: 'bg-success-dot' },
    rejected: { label: 'Отклонена', className: 'bg-danger-bg border-danger-border text-danger', dot: 'bg-danger-dot' },
}

export default function DashboardApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [applicationsError, setApplicationsError] = useState('')
    const [pageOpenedAt] = useState(() => Date.now())
    const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
    const [applicationToSelect, setApplicationToSelect] = useState<Application | null>(null)
    const [selectionSaving, setSelectionSaving] = useState(false)
    const selectModalOverlay = useOverlayClose(() => { if (!selectionSaving) setApplicationToSelect(null) })
    const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set())
    const approvedApplications = applications.filter(app => app.status === 'approved')
    const needsApplicationSelection = approvedApplications.length > 1 &&
        !approvedApplications.some(app => app.id === activeApplicationId)

    // Если одобренная заявка ровно одна — она и есть текущий трек, даже если
    // студент явно ничего не выбирал (и даже если другие его заявки в этой
    // же когорте были отклонены). Явный выбор (activeApplicationId с бэка)
    // имеет приоритет, когда одобренных заявок несколько.
    const effectiveActiveApplicationId = activeApplicationId
        ?? (approvedApplications.length === 1 ? approvedApplications[0].id : null)
    const currentApplication = approvedApplications.find(app => app.id === effectiveActiveApplicationId) ?? null

    // Фильтры основного списка (заявки в открытых когортах — закрытые уходят в архив)
    const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'approved'>('')
    const [search, setSearch] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    // Архив (отклонённые заявки и заявки в уже неактуальных когортах) —
    // свёрнут по умолчанию, свои фильтры
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [archiveReasonFilter, setArchiveReasonFilter] = useState<'' | ArchiveReason>('')
    const [archiveSearch, setArchiveSearch] = useState('')
    const [archiveDateFrom, setArchiveDateFrom] = useState('')
    const [archiveDateTo, setArchiveDateTo] = useState('')

    function toggleAnswers(applicationId: string) {
        setExpandedAnswers(prev => {
            const next = new Set(prev)
            if (next.has(applicationId)) next.delete(applicationId)
            else next.add(applicationId)
            return next
        })
    }

    useEffect(() => {
        (async () => {
            try {
                const [data, user] = await Promise.all([getMyApplications(), getMe()])
                setApplications(data)
                setActiveApplicationId(user.active_application_id ?? null)
            } catch (err: unknown) {
                setApplicationsError(err instanceof Error ? err.message : 'Не удалось загрузить заявки')
            } finally {
                setApplicationsLoading(false)
            }
        })()
    }, [])

    function isPracticeStarted(application: Application): boolean {
        return pageOpenedAt >= new Date(application.cohort.start_date).getTime()
    }

    async function confirmApplicationSelection() {
        if (!applicationToSelect || isPracticeStarted(applicationToSelect)) return
        setSelectionSaving(true)
        try {
            const user = await selectActiveApplication(applicationToSelect.id)
            setActiveApplicationId(user.active_application_id ?? null)
            setApplicationToSelect(null)
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Не удалось сохранить выбранный трек')
        } finally {
            setSelectionSaving(false)
        }
    }

    function renderApplicationCard(app: Application) {
        const status = STATUS_CONFIG[app.status]
        const isSelectedTrack = effectiveActiveApplicationId === app.id && app.status === 'approved'
        const cohortFinished = isCohortFinished(app, pageOpenedAt)
        const cohortBadge = app.status !== 'rejected' && cohortFinished
            ? ARCHIVE_REASON_BADGE[app.cohort.status === 'closed' ? 'closed' : 'completed']
            : null
        return (
            <div key={app.id} className={`bg-white rounded-2xl overflow-hidden ${isSelectedTrack ? 'border-t-[3px] border-brand-hover shadow-md' : 'shadow-sm'}`}>
                <div className="px-7 py-5 border-b border-border-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Практика</span>
                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                            <h2 className="font-extrabold text-xl text-ink tracking-tight uppercase">{app.cohort.title}</h2>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                <Route className="size-3.5" />{app.track.title}
                            </span>
                            {isSelectedTrack && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning bg-warning-bg border border-warning-border rounded-full px-2.5 py-1">
                                    <Star className="size-3.5 fill-warning-dot text-warning-dot" />Текущая практика
                                </span>
                            )}
                            {cohortBadge && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-ink bg-surface border border-border-soft rounded-full px-2.5 py-1">
                                    <Archive className="size-3.5" />{cohortBadge}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={`inline-flex self-start sm:self-auto items-center gap-2 px-4 py-1.5 rounded-full border flex-shrink-0 ${status.className} ${isSelectedTrack ? '' : 'opacity-70'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        <span className="text-xs font-semibold">{status.label}</span>
                    </div>
                </div>

                {/* Инфо о когорте — раньше её нигде не было видно */}
                <div className="grid grid-cols-2 divide-x divide-border-soft border-b border-border-soft">
                    <div className="px-7 py-4 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Период практики</span>
                        <span className="text-sm text-ink">
                            {new Date(app.cohort.start_date).toLocaleDateString('ru')} — {new Date(app.cohort.end_date).toLocaleDateString('ru')}
                        </span>
                    </div>
                    {app.status !== 'rejected' && (
                        <div className="px-7 py-4 flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Тестовое задание</span>
                            <a href={`/dashboard/applications/${app.id}/test-task`}
                                className="self-start inline-flex items-center gap-1 text-sm font-semibold text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                                Перейти<MoveRight className="size-3.5" />
                            </a>
                        </div>
                    )}
                </div>

                {app.status === 'rejected' && (
                    <div className="px-7 py-4 border-y border-danger-border bg-danger-bg">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-danger mb-1">
                            Причина отклонения
                        </p>
                        <p className="text-sm text-ink">
                            {app.rejection_reason?.trim() || 'Причина не указана'}
                        </p>
                    </div>
                )}

                {/* Ответы на анкету — свёрнуты по умолчанию, раньше их можно было увидеть только в момент подачи заявки */}
                <div className="border-b border-border-soft">
                    <button type="button" onClick={() => toggleAnswers(app.id)}
                        className="w-full px-7 py-4 flex items-center justify-between text-left hover:bg-surface transition-colors">
                        <span className="text-sm font-semibold text-ink">Ответы на анкету</span>
                        <ChevronDown className={`size-4 text-muted-ink transition-transform ${expandedAnswers.has(app.id) ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedAnswers.has(app.id) && (
                        <div className="px-7 py-4">
                            {app.answers && app.answers.length > 0 ? (
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {app.answers.map((a, i) => (
                                        <div key={i} className="flex flex-col gap-0.5">
                                            <span className="text-xs text-muted-ink">{a.label}</span>
                                            <span className="text-sm text-ink">{a.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-ink">В анкете этой когорты не было вопросов.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-7 py-3 bg-surface flex items-center justify-between">
                    <span className="text-xs text-muted-ink">
                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    {app.status === 'approved' && (
                        <div className="flex items-center gap-4">
                            {effectiveActiveApplicationId === app.id ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                                        <Check className="size-3.5" />Выбранный трек
                                    </span>
                                ) : isPracticeStarted(app) ? (
                                    <span className="text-xs font-medium text-faint-ink">Выбран другой трек</span>
                                ) : (
                                    <Button variant="brand" onClick={() => setApplicationToSelect(app)}
                                        className="px-4 py-2 rounded-lg h-auto">
                                        Выбрать этот трек
                                    </Button>
                                )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo)
    const archiveDateRangeInvalid = Boolean(archiveDateFrom && archiveDateTo && archiveDateFrom > archiveDateTo)

    // Текущая практика (если есть) всегда закреплена отдельным блоком сверху —
    // из обычного списка и архива её убираем, чтобы не дублировать.
    const restApplications = applications.filter(app => app.id !== currentApplication?.id)

    const liveApplications = restApplications.filter(app => getArchiveReason(app, pageOpenedAt) === null)
    const filteredLiveApplications = liveApplications.filter(app =>
        (!statusFilter || app.status === statusFilter) && matchesSearchAndDate(app, search, dateRangeInvalid ? '' : dateFrom, dateRangeInvalid ? '' : dateTo)
    )

    const archivedApplications = restApplications.filter(app => getArchiveReason(app, pageOpenedAt) !== null)
    const filteredArchivedApplications = archivedApplications.filter(app => {
        const reason = getArchiveReason(app, pageOpenedAt)
        return (!archiveReasonFilter || reason === archiveReasonFilter)
            && matchesSearchAndDate(app, archiveSearch, archiveDateRangeInvalid ? '' : archiveDateFrom, archiveDateRangeInvalid ? '' : archiveDateTo)
    })

    function resetFilters() {
        setStatusFilter(''); setSearch(''); setDateFrom(''); setDateTo('')
    }
    function resetArchiveFilters() {
        setArchiveReasonFilter(''); setArchiveSearch(''); setArchiveDateFrom(''); setArchiveDateTo('')
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-ink">Мои заявки</h1>
            </div>

            {!applicationsLoading && !applicationsError && needsApplicationSelection && (
                <div className="bg-warning-bg border border-warning-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <TriangleAlert className="size-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-warning">Выберите трек</p>
                        <p className="text-sm text-muted-ink mt-1">
                            У вас несколько одобренных заявок. До начала практики выберите трек, по которому будете проходить практику.
                        </p>
                    </div>
                </div>
            )}

            {applicationsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-ink">
                    <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Загружаем заявки…
                </div>
            )}

            {applicationsError && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{applicationsError}</p>
                </div>
            )}

            {!applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 min-h-[280px] flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                        <ClipboardList className="size-5" />
                    </div>
                    <p className="font-semibold text-ink mb-1">Заявок пока нет</p>
                    <p className="text-sm text-muted-ink max-w-sm">
                        Чтобы подать заявку на практику, перейдите по ссылке-приглашению,
                        которую пришлёт организатор когорты.
                    </p>
                </div>
            )}

            {!applicationsLoading && !applicationsError && currentApplication && renderApplicationCard(currentApplication)}

            {!applicationsLoading && !applicationsError && (liveApplications.length > 0 || archivedApplications.length > 0) && (
                <div className="flex flex-col gap-4">
                    {liveApplications.length > 0 && (
                        <>
                            <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                                <button type="button" onClick={resetFilters}
                                    className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-danger whitespace-nowrap px-3 h-9 rounded-lg border border-border-soft bg-white hover:bg-surface transition-colors duration-300 flex-shrink-0 w-full sm:w-auto">
                                    <Trash2 className="size-3.5" />Сбросить
                                </button>
                                <FilterSelect icon={ListFilter} ariaLabel="Фильтр по статусу заявки" placeholder="Все статусы"
                                    value={statusFilter} onChange={v => setStatusFilter(v as '' | 'pending' | 'approved')}
                                    options={MAIN_STATUS_FILTER_OPTIONS} />
                                <input type="date" aria-label="Дата от" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                    className="h-9 text-sm px-3 rounded-lg border border-border-soft w-full sm:w-auto" />
                                <span className="text-sm text-muted-ink hidden sm:inline">—</span>
                                <input type="date" aria-label="Дата до" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                    className="h-9 text-sm px-3 rounded-lg border border-border-soft w-full sm:w-auto" />
                                <input type="text" aria-label="Поиск по названию практики или трека" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Поиск по названию…" className="h-9 text-sm px-3 rounded-lg border border-border-soft flex-1 min-w-[180px]" />
                            </div>
                            {dateRangeInvalid && (
                                <div className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3 flex items-start gap-3">
                                    <TriangleAlert className="size-4 text-danger flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-danger">Конечная дата периода не может быть раньше начальной</p>
                                </div>
                            )}

                            {filteredLiveApplications.length === 0 && (
                                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                                        <FolderKanban className="size-5" />
                                    </div>
                                    <p className="font-semibold text-ink mb-1">Ничего не найдено</p>
                                    <p className="text-sm text-muted-ink">Попробуйте изменить фильтры или поиск</p>
                                </div>
                            )}

                            {filteredLiveApplications.map(renderApplicationCard)}
                        </>
                    )}

                    {archivedApplications.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            <button type="button" onClick={() => setArchiveOpen(v => !v)}
                                className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-surface transition-colors duration-300">
                                <span className="flex items-center gap-2.5">
                                    <Archive className="size-4 text-muted-ink" />
                                    <span className="font-bold text-ink">Архив</span>
                                    <span className="text-xs font-semibold text-muted-ink bg-surface border border-border-soft rounded-full px-2 py-0.5">{archivedApplications.length}</span>
                                </span>
                                <ChevronDown className={`size-4 text-muted-ink transition-transform duration-300 ${archiveOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {archiveOpen && (
                                <div className="border-t border-border-soft px-6 py-5 flex flex-col gap-4">
                                    <div className="bg-white border border-border-soft rounded-2xl p-4 flex flex-wrap items-center gap-3">
                                        <button type="button" onClick={resetArchiveFilters}
                                            className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-danger whitespace-nowrap px-3 h-9 rounded-lg border border-border-soft bg-white hover:bg-surface transition-colors duration-300 flex-shrink-0 w-full sm:w-auto">
                                            <Trash2 className="size-3.5" />Сбросить
                                        </button>
                                        <FilterSelect icon={ListFilter} ariaLabel="Фильтр по причине архивации" placeholder="Все причины"
                                            value={archiveReasonFilter} onChange={v => setArchiveReasonFilter(v as '' | ArchiveReason)}
                                            options={ARCHIVE_REASON_OPTIONS} />
                                        <input type="date" aria-label="Дата от (архив)" value={archiveDateFrom} onChange={e => setArchiveDateFrom(e.target.value)}
                                            className="h-9 text-sm px-3 rounded-lg border border-border-soft w-full sm:w-auto" />
                                        <span className="text-sm text-muted-ink hidden sm:inline">—</span>
                                        <input type="date" aria-label="Дата до (архив)" value={archiveDateTo} onChange={e => setArchiveDateTo(e.target.value)}
                                            className="h-9 text-sm px-3 rounded-lg border border-border-soft w-full sm:w-auto" />
                                        <input type="text" aria-label="Поиск по названию практики или трека в архиве" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
                                            placeholder="Поиск по названию…" className="h-9 text-sm px-3 rounded-lg border border-border-soft flex-1 min-w-[180px]" />
                                    </div>

                                    {archiveDateRangeInvalid && (
                                        <div className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3 flex items-start gap-3">
                                            <TriangleAlert className="size-4 text-danger flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-danger">Конечная дата периода не может быть раньше начальной</p>
                                        </div>
                                    )}

                                    {filteredArchivedApplications.length === 0 ? (
                                        <p className="text-sm text-muted-ink text-center py-6">Ничего не найдено</p>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {filteredArchivedApplications.map(renderApplicationCard)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {applicationToSelect && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    {...selectModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
                        <h3 className="font-extrabold text-2xl text-ink tracking-tight mb-3">Выбрать этот трек?</h3>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-3 py-1.5 mb-6">
                            <Route className="size-4" />{applicationToSelect.track.title}
                        </span>
                        <p className="text-sm text-muted-ink leading-relaxed text-left">
                            Вы выбираете трек «{applicationToSelect.track.title}» для прохождения практики «{applicationToSelect.cohort.title}».
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed text-left">
                            До начала практики выбор можно изменить. После начала практики смена трека будет недоступна.
                        </p>
                        <div className="flex justify-end gap-3 mt-7">
                            <Button variant="ghost" onClick={() => setApplicationToSelect(null)} disabled={selectionSaving}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm text-muted-ink hover:bg-surface hover:text-ink">
                                Отмена
                            </Button>
                            <Button variant="brand" onClick={confirmApplicationSelection} disabled={selectionSaving}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                {selectionSaving ? 'Сохраняем…' : 'Выбрать трек'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
