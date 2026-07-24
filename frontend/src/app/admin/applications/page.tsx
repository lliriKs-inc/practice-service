'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Route, ListFilter, ChevronDown, Users, CheckCircle2, Download, FileText, ListChecks, FolderKanban, ClipboardList, TriangleAlert } from 'lucide-react'
import { updateApplicationStatus, type Application } from '@/services/api/invitation'
import { getAdminApplications, getAdminApplicationDetail, type AdminApplicationSummary } from '@/services/api/admin'
import { useCohortWorkspace } from '../cohort-context'
import { downloadProtectedFile } from '@/lib/api/download'
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

const STATUS_LABELS: Record<Application['status'], string> = {
    pending: 'На рассмотрении',
    approved: 'Одобрена',
    rejected: 'Отклонена',
}

const STATUS_FILTER_LABELS: Record<Application['status'] | 'working', string> = {
    ...STATUS_LABELS,
    working: 'Рабочий трек',
}

function studentKey(app: AdminApplicationSummary): string {
    return app.student?.email ?? app.student?.id ?? app.applicationId
}

function pluralizeApplications(n: number): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'заявка'
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'заявки'
    return 'заявок'
}

// Заявки одного студента (по email) идут подряд, порядок групп и порядок
// заявок внутри группы — как пришли от бэкенда (стабильная группировка).
function groupByStudent(applications: AdminApplicationSummary[]): { list: AdminApplicationSummary[]; countByKey: Map<string, number> } {
    const groups = new Map<string, AdminApplicationSummary[]>()
    const order: string[] = []
    for (const app of applications) {
        const key = studentKey(app)
        if (!groups.has(key)) {
            groups.set(key, [])
            order.push(key)
        }
        groups.get(key)!.push(app)
    }
    const countByKey = new Map(order.map(key => [key, groups.get(key)!.length]))
    return { list: order.flatMap(key => groups.get(key)!), countByKey }
}

export default function AdminApplicationsPage() {
    const { cohorts, selectedCohort } = useCohortWorkspace()

    const [applications, setApplications] = useState<AdminApplicationSummary[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [applicationsError, setApplicationsError] = useState('')
    const [submissionDownloadError, setSubmissionDownloadError] = useState('')
    const [applicationActionId, setApplicationActionId] = useState<string | null>(null)
    const [applicationToApprove, setApplicationToApprove] = useState<AdminApplicationSummary | null>(null)
    const [applicationToReject, setApplicationToReject] = useState<AdminApplicationSummary | null>(null)
    const approveModalOverlay = useOverlayClose(() => { if (!applicationActionId) setApplicationToApprove(null) })
    const rejectModalOverlay = useOverlayClose(() => { if (!applicationActionId) setApplicationToReject(null) })
    const [rejectionReason, setRejectionReason] = useState('')

    // 'working' — отдельный клиентский фильтр (не статус на бэке): заявки,
    // которые реально являются рабочим треком студента (isWorkingApplication).
    const [statusFilter, setStatusFilter] = useState<Application['status'] | 'working' | ''>('')
    const [trackFilter, setTrackFilter] = useState('')
    const [search, setSearch] = useState('')

    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [answersById, setAnswersById] = useState<Record<string, { label: string; value: string }[]>>({})
    const [answersLoading, setAnswersLoading] = useState<string | null>(null)
    const [expandedTestTaskId, setExpandedTestTaskId] = useState<string | null>(null)

    const loadApplications = useCallback(async () => {
        if (!selectedCohort) return
        setApplicationsLoading(true)
        setApplicationsError('')
        try {
            const data = await getAdminApplications(selectedCohort.id, {
                status: statusFilter === 'working' ? 'approved' : statusFilter || undefined,
                trackId: trackFilter || undefined,
                search: search.trim() || undefined,
            })
            setApplications(statusFilter === 'working' ? data.filter(a => a.isWorkingApplication) : data)
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Ошибка загрузки заявок')
        } finally {
            setApplicationsLoading(false)
        }
    }, [selectedCohort, statusFilter, trackFilter, search])

    useEffect(() => {
        (async () => {
            await loadApplications()
        })()
    }, [loadApplications])

    async function toggleAnswers(applicationId: string) {
        if (expandedId === applicationId) {
            setExpandedId(null)
            return
        }
        setExpandedId(applicationId)
        if (answersById[applicationId] || !selectedCohort) return
        setAnswersLoading(applicationId)
        try {
            const detail = await getAdminApplicationDetail(selectedCohort.id, applicationId)
            setAnswersById(prev => ({ ...prev, [applicationId]: detail.answers }))
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Не удалось загрузить ответы анкеты')
        } finally {
            setAnswersLoading(null)
        }
    }

    async function confirmApproval() {
        if (!selectedCohort || !applicationToApprove) return
        const applicationId = applicationToApprove.applicationId

        setApplicationActionId(applicationId)
        try {
            await updateApplicationStatus(selectedCohort.id, applicationId, 'approved', undefined)
            await loadApplications()
            setApplicationToApprove(null)
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Не удалось изменить статус заявки')
        } finally {
            setApplicationActionId(null)
        }
    }

    function openRejectionModal(application: AdminApplicationSummary) {
        setApplicationToReject(application)
        setRejectionReason('')
    }

    async function confirmRejection() {
        if (!selectedCohort || !applicationToReject) return
        const applicationId = applicationToReject.applicationId

        setApplicationActionId(applicationId)
        try {
            await updateApplicationStatus(
                selectedCohort.id,
                applicationId,
                'rejected',
                rejectionReason.trim() || 'Причина не указана',
            )
            await loadApplications()
            setApplicationToReject(null)
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Не удалось изменить статус заявки')
        } finally {
            setApplicationActionId(null)
        }
    }

    const sourceCohort = selectedCohort ? cohorts.find(c => c.id === selectedCohort.id) : null

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-ink">
                    {selectedCohort ? <>Заявки по когорте «{selectedCohort.title}»</> : 'Заявки'}
                </h1>
                {!selectedCohort && (
                    <p className="text-sm text-muted-ink mt-1">Выберите рабочую когорту в шапке, чтобы увидеть заявки.</p>
                )}
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                        <FolderKanban className="size-5" />
                    </div>
                    <p className="font-semibold text-ink mb-1">Выберите рабочую когорту</p>
                    <p className="text-sm text-muted-ink">Заявки, фильтры и статусы отчётов показываются в разрезе одной когорты.</p>
                </div>
            )}

            {selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                    <div className="relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white w-full sm:w-auto sm:flex-shrink-0 focus-within:border-brand cursor-pointer">
                        <ListFilter className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-sm font-medium text-ink truncate pointer-events-none">
                            {statusFilter ? STATUS_FILTER_LABELS[statusFilter] : 'Все статусы'}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select aria-label="Фильтр по статусу заявки" value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as Application['status'] | 'working' | '')}
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            <option value="">Все статусы</option>
                            <option value="pending">На рассмотрении</option>
                            <option value="approved">Одобрена</option>
                            <option value="rejected">Отклонена</option>
                            <option value="working">Рабочий трек</option>
                        </select>
                    </div>
                    <div className="relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white w-full sm:w-auto sm:flex-shrink-0 focus-within:border-brand cursor-pointer">
                        <Route className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-sm font-medium text-ink truncate pointer-events-none">
                            {sourceCohort?.tracks.find(t => t.id === trackFilter)?.title ?? 'Все треки'}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select aria-label="Фильтр по треку" value={trackFilter} onChange={e => setTrackFilter(e.target.value)}
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            <option value="">Все треки</option>
                            {sourceCohort?.tracks.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                    <input type="text" aria-label="Поиск по ФИО или email" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по ФИО или email…" className="h-9 text-sm px-3 rounded-lg border border-border-soft flex-1 min-w-[180px]" />
                </div>
            )}

            {/* Спиннер только на самой первой загрузке — при фоновом обновлении
                (после одобрения/отклонения заявки) список остаётся на месте,
                не мигает и не сбрасывает скролл наверх. */}
            {applicationsLoading && applications.length === 0 && (
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

            {selectedCohort && !applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                        <ClipboardList className="size-5" />
                    </div>
                    <p className="font-semibold text-ink mb-1">Заявок не найдено</p>
                    <p className="text-sm text-muted-ink">Попробуй изменить фильтры, либо заявок ещё нет в этой когорте.</p>
                </div>
            )}

            {selectedCohort && !applicationsError && applications.length > 0 && (
                <div className="flex flex-col gap-4">
                    {(() => {
                        const { list, countByKey } = groupByStudent(applications)
                        return list.map(app => {
                        const trackTestTask = sourceCohort?.tracks.find(t => t.id === app.track.id)?.testTask
                        const applicationsCount = countByKey.get(studentKey(app)) ?? 1

                        return (
                            <div key={app.applicationId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-border-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                        <Route className="size-3.5" />{app.track.title}
                                    </span>
                                    <div className={`inline-flex w-fit items-center gap-2 px-4 py-1.5 rounded-full border
                                        ${app.status === 'pending' ? 'bg-warning-bg border-warning-border text-warning'
                                            : app.status === 'approved' ? 'bg-success-bg border-success-border text-success'
                                            : 'bg-danger-bg border-danger-border text-danger'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full
                                            ${app.status === 'pending' ? 'bg-warning-dot' : app.status === 'approved' ? 'bg-success-dot' : 'bg-danger-dot'}`} />
                                        <span className="text-xs font-semibold">{STATUS_LABELS[app.status]}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border-soft border-b border-border-soft">
                                    <div className="px-7 py-5 flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                                        <h2 className="font-bold text-lg text-ink">{app.student?.full_name || 'Неизвестный кандидат'}</h2>
                                        {applicationsCount > 1 && (
                                            app.isWorkingApplication ? (
                                                <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-success-bg border border-success-border text-success"
                                                    title="Студент выбрал этот трек рабочим — по нему ведётся дневник задач и отчёт.">
                                                    <CheckCircle2 className="size-3 flex-shrink-0" />{applicationsCount} {pluralizeApplications(applicationsCount)} · рабочий трек
                                                </span>
                                            ) : (
                                                <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed border-border-soft text-faint-ink"
                                                    title="У этого студента несколько заявок в этой когорте — эта не выбрана рабочей.">
                                                    <Users className="size-3 flex-shrink-0" />{applicationsCount} {pluralizeApplications(applicationsCount)} · не выбрана
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <div className="px-7 py-5 flex items-center">
                                        <span className="font-bold text-lg text-ink">{app.student?.email ?? '—'}</span>
                                    </div>
                                </div>

                                {app.status === 'rejected' && (
                                    <div className="px-7 py-4 border-b border-danger-border bg-danger-bg">
                                        <p className="text-[10px] font-bold tracking-widest uppercase text-danger mb-1">
                                            Причина отклонения
                                        </p>
                                        <p className="text-sm text-ink">
                                            {app.rejectionReason?.trim() || 'Причина не указана'}
                                        </p>
                                    </div>
                                )}

                                <div className="border-b border-border-soft">
                                    <button type="button" onClick={() => toggleAnswers(app.applicationId)}
                                        className="w-full px-7 py-4 flex items-center justify-between text-left hover:bg-surface transition-colors">
                                        <span className="text-sm font-semibold text-ink">Ответы на анкету</span>
                                        <ChevronDown className={`size-4 text-muted-ink transition-transform ${expandedId === app.applicationId ? 'rotate-180' : ''}`} />
                                    </button>
                                    {expandedId === app.applicationId && (
                                        <div className="px-7 py-4">
                                            {answersLoading === app.applicationId ? (
                                                <p className="text-xs text-muted-ink">Загружаем…</p>
                                            ) : answersById[app.applicationId]?.length ? (
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    {answersById[app.applicationId].map((a, i) => (
                                                        <div key={i} className="flex flex-col gap-0.5">
                                                            <span className="text-xs text-muted-ink">{a.label}</span>
                                                            <span className="text-sm text-ink">{a.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-ink">В анкете этой когорты не было вопросов.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Тестовое задание трека */}
                                {trackTestTask && (trackTestTask.title || trackTestTask.description) && (
                                    <div className="border-b border-border-soft">
                                        <button type="button"
                                            onClick={() => setExpandedTestTaskId(prev => prev === app.applicationId ? null : app.applicationId)}
                                            className="w-full px-7 py-4 flex items-center justify-between text-left hover:bg-surface transition-colors">
                                            <span className="text-sm font-semibold text-ink">Тестовое задание трека</span>
                                            <ChevronDown className={`size-4 text-muted-ink transition-transform ${expandedTestTaskId === app.applicationId ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedTestTaskId === app.applicationId && (
                                            <div className="px-7 py-4 bg-surface-alt flex flex-col gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-ink">{trackTestTask.title || '—'}</p>
                                                    {trackTestTask.description && (
                                                        <p className="text-sm text-muted-ink whitespace-pre-wrap mt-1">{trackTestTask.description}</p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 flex-wrap">
                                                    {trackTestTask.hasFile && trackTestTask.downloadPath && (
                                                        <Button variant="brand-outline"
                                                            onClick={() => {
                                                                setSubmissionDownloadError('')
                                                                downloadProtectedFile(trackTestTask.downloadPath!, trackTestTask.title || 'Тестовое задание')
                                                                    .catch(err => setSubmissionDownloadError(err instanceof Error ? err.message : 'Не удалось скачать задание'))
                                                            }}
                                                            className="px-4 py-2 rounded-lg h-auto text-xs">
                                                            <Download className="size-3.5" />Скачать задание
                                                        </Button>
                                                    )}
                                                    {app.testTaskSubmission && (
                                                        <Button variant="brand"
                                                            onClick={() => {
                                                                setSubmissionDownloadError('')
                                                                downloadProtectedFile(app.testTaskSubmission!.downloadPath, app.testTaskSubmission!.fileName)
                                                                    .catch(err => setSubmissionDownloadError(err instanceof Error ? err.message : 'Не удалось скачать решение'))
                                                            }}
                                                            className="px-4 py-2 rounded-lg h-auto text-xs">
                                                            <Download className="size-3.5" />Скачать решение
                                                        </Button>
                                                    )}
                                                    {app.testTaskSubmission ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-success border border-success-border rounded-full px-3 py-1.5">
                                                            <CheckCircle2 className="size-3.5 flex-shrink-0" />
                                                            Загружено {new Date(app.testTaskSubmission.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-ink">Решение пока не загружено кандидатом.</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {submissionDownloadError && (
                                    <div className="mx-7 mb-4 bg-danger-bg border border-danger-border rounded-xl px-4 py-3 flex items-start gap-3">
                                        <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-danger">{submissionDownloadError}</p>
                                    </div>
                                )}

                                {app.status === 'approved' && app.isWorkingApplication && selectedCohort && (
                                    <div className="grid grid-cols-2 divide-x divide-border-soft border-b border-border-soft">
                                        <div className="px-7 py-4 flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Документы студента</span>
                                            <Link href={`/admin/documents?cohort=${selectedCohort.id}&q=${encodeURIComponent(app.student?.email ?? '')}`}
                                                className="self-start inline-flex items-center gap-1 text-sm font-semibold text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                                                Перейти<FileText className="size-3.5" />
                                            </Link>
                                        </div>
                                        <div className="px-7 py-4 flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Задачи студента</span>
                                            <Link href={`/admin/tasks?cohort=${selectedCohort.id}`}
                                                className="self-start inline-flex items-center gap-1 text-sm font-semibold text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                                                Перейти<ListChecks className="size-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                )}

                                <div className="px-7 py-4 bg-surface flex items-center justify-between">
                                    <span className="text-xs text-muted-ink">
                                        Подана {new Date(app.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                disabled={applicationActionId === app.applicationId}
                                                onClick={() => openRejectionModal(app)}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-danger-border text-danger hover:bg-danger-bg disabled:opacity-50">
                                                Отклонить
                                            </button>
                                            <button
                                                disabled={applicationActionId === app.applicationId}
                                                onClick={() => setApplicationToApprove(app)}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white shadow-sm disabled:opacity-50 bg-gradient-to-br from-brand to-brand-light">
                                                {applicationActionId === app.applicationId ? 'Сохраняем…' : 'Одобрить'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                        })
                    })()}
                </div>
            )}
            {applicationToApprove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    {...approveModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-xl bg-success-bg flex items-center justify-center mb-5 mx-auto">
                            <CheckCircle2 className="size-6 text-success" />
                        </div>
                        <h3 className="font-extrabold text-2xl text-ink tracking-tight mb-4">Одобрить заявку?</h3>
                        <p className="text-sm text-muted-ink leading-relaxed">
                            Вы одобряете заявку студента {applicationToApprove.student?.full_name || 'Неизвестный кандидат'}
                            {applicationToApprove.student?.email && <> ({applicationToApprove.student.email})</>} на трек «{applicationToApprove.track.title}».
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed">
                            Если студент будет одобрен на нескольких треках, он самостоятельно выберет нужный трек в личном кабинете.
                        </p>
                        <div className="flex justify-end gap-3 mt-7">
                            <Button variant="ghost" onClick={() => setApplicationToApprove(null)} disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm text-muted-ink hover:bg-surface hover:text-ink">
                                Отмена
                            </Button>
                            <Button variant="brand" onClick={confirmApproval} disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                {applicationActionId ? 'Одобряем…' : 'Подтвердить'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {applicationToReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    {...rejectModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-xl bg-danger-bg flex items-center justify-center mb-5 mx-auto">
                            <TriangleAlert className="size-6 text-danger" />
                        </div>
                        <h3 className="font-extrabold text-2xl text-ink tracking-tight mb-4">Отклонить заявку?</h3>
                        <p className="text-sm text-muted-ink leading-relaxed">
                            Вы отклоняете заявку студента {applicationToReject.student?.full_name || 'Неизвестный кандидат'}
                            {applicationToReject.student?.email && <> ({applicationToReject.student.email})</>} на трек «{applicationToReject.track.title}».
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed">
                            После отклонения студент не сможет повторно подать заявку на этот трек.
                        </p>
                        <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-ink">
                            Причина отклонения для студента
                            <textarea value={rejectionReason} onChange={event => setRejectionReason(event.target.value)}
                                placeholder="Опишите причину (необязательно)"
                                className="min-h-24 text-sm font-normal rounded-xl" />
                        </label>
                        <div className="flex justify-end gap-3 mt-7">
                            <Button variant="ghost" onClick={() => setApplicationToReject(null)} disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm text-muted-ink hover:bg-surface hover:text-ink">
                                Отмена
                            </Button>
                            <Button variant="danger" onClick={confirmRejection} disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                {applicationActionId ? 'Отклоняем…' : 'Отклонить'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
