'use client'

import { useEffect, useState, useCallback } from 'react'
import { updateApplicationStatus, type Application } from '@/services/api/invitation'
import { getAdminApplications, getAdminApplicationDetail, type AdminApplicationSummary } from '@/services/api/admin'
import { useCohortWorkspace } from '../cohort-context'
import { downloadProtectedFile } from '@/lib/api/download'

const STATUS_LABELS: Record<Application['status'], string> = {
    pending: 'На рассмотрении',
    approved: 'Одобрена',
    rejected: 'Отклонена',
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
    const [rejectionReason, setRejectionReason] = useState('')

    const [statusFilter, setStatusFilter] = useState<Application['status'] | ''>('')
    const [trackFilter, setTrackFilter] = useState('')
    const [search, setSearch] = useState('')

    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [answersById, setAnswersById] = useState<Record<string, { label: string; value: string }[]>>({})
    const [answersLoading, setAnswersLoading] = useState<string | null>(null)

    const loadApplications = useCallback(async () => {
        if (!selectedCohort) return
        setApplicationsLoading(true)
        setApplicationsError('')
        try {
            const data = await getAdminApplications(selectedCohort.id, {
                status: statusFilter || undefined,
                trackId: trackFilter || undefined,
                search: search.trim() || undefined,
            })
            setApplications(data)
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
                <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Заявки</h1>
                <p className="text-sm text-muted-ink">
                    {selectedCohort ? `Заявки кандидатов когорты «${selectedCohort.title}»` : 'Выберите рабочую когорту в шапке, чтобы увидеть заявки.'}
                </p>
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">🗂️</div>
                    <p className="font-semibold text-ink mb-1">Выберите рабочую когорту</p>
                    <p className="text-sm text-muted-ink">Заявки, фильтры и статусы отчётов показываются в разрезе одной когорты.</p>
                </div>
            )}

            {selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                    <select aria-label="Фильтр по статусу заявки" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Application['status'] | '')}
                        className="text-sm px-3 py-2 rounded-lg border border-border-soft">
                        <option value="">Все статусы</option>
                        <option value="pending">На рассмотрении</option>
                        <option value="approved">Одобрена</option>
                        <option value="rejected">Отклонена</option>
                    </select>
                    <select aria-label="Фильтр по треку" value={trackFilter} onChange={e => setTrackFilter(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg border border-border-soft">
                        <option value="">Все треки</option>
                        {sourceCohort?.tracks.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                    <input type="text" aria-label="Поиск по email" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по email…" className="text-sm px-3 py-2 rounded-lg border border-border-soft flex-1 min-w-[180px]" />
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
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4">
                    <p className="text-sm text-danger">⚠️ {applicationsError}</p>
                </div>
            )}

            {selectedCohort && !applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-ink mb-1">Заявок не найдено</p>
                    <p className="text-sm text-muted-ink">Попробуй изменить фильтры, либо заявок ещё нет в этой когорте.</p>
                </div>
            )}

            {selectedCohort && !applicationsError && applications.length > 0 && (
                <div className="flex flex-col gap-4">
                    {applications.map(app => {
                        const trackTestTask = sourceCohort?.tracks.find(t => t.id === app.track.id)?.testTask

                        return (
                            <div key={app.applicationId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-border-soft flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-muted-ink mb-1">{app.track.title}</p>
                                        <h2 className="font-bold text-lg text-ink">{app.student?.email ?? 'Неизвестный кандидат'}</h2>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border
                                        ${app.status === 'pending' ? 'bg-warning-bg border-warning-border text-warning'
                                            : app.status === 'approved' ? 'bg-success-bg border-success-border text-success'
                                            : 'bg-danger-bg border-danger-border text-danger'}`}>
                                        <div className={`w-2 h-2 rounded-full
                                            ${app.status === 'pending' ? 'bg-warning-dot' : app.status === 'approved' ? 'bg-success-dot' : 'bg-danger-dot'}`} />
                                        <span className="text-xs font-semibold">{STATUS_LABELS[app.status]}</span>
                                    </div>
                                </div>

                                <div className="px-7 py-3 border-b border-border-soft">
                                    <button onClick={() => toggleAnswers(app.applicationId)}
                                        className="text-xs font-semibold text-brand-hover hover:underline">
                                        {expandedId === app.applicationId ? '▲ Скрыть ответы анкеты' : '▼ Показать ответы анкеты'}
                                    </button>
                                    {expandedId === app.applicationId && (
                                        <div className="mt-3">
                                            {answersLoading === app.applicationId ? (
                                                <p className="text-xs text-muted-ink">Загружаем…</p>
                                            ) : answersById[app.applicationId]?.length ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {answersById[app.applicationId].map((a, i) => (
                                                        <div key={i} className="flex flex-col gap-0.5">
                                                            <span className="text-xs text-muted-ink">{a.label}</span>
                                                            <span className="text-sm text-ink">{a.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-ink">Ответов нет.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Тестовое задание трека */}
                                {trackTestTask && (trackTestTask.title || trackTestTask.description) && (
                                    <div className="px-7 py-4 border-b border-border-soft flex flex-col gap-1.5 bg-surface-alt">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Тестовое задание трека</span>
                                        <p className="text-sm font-semibold text-ink">{trackTestTask.title || '—'}</p>
                                        {app.testTaskSubmission ? (
                                            <div className="flex items-center gap-2 flex-wrap mt-1">
                                                <p className="text-[11px] text-[#1A7A5A]">
                                                    ✅ Решение загружено: {app.testTaskSubmission.fileName}
                                                    {' · '}
                                                    {new Date(app.testTaskSubmission.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSubmissionDownloadError('')
                                                        downloadProtectedFile(
                                                            app.testTaskSubmission!.downloadPath,
                                                            app.testTaskSubmission!.fileName,
                                                        ).catch(err => setSubmissionDownloadError(
                                                            err instanceof Error ? err.message : 'Не удалось скачать решение',
                                                        ))
                                                    }}
                                                    className="text-xs font-semibold text-[#4A42D4] hover:underline">
                                                    ⬇ Скачать решение
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-muted-ink mt-1">Решение пока не загружено кандидатом.</p>
                                        )}
                                    </div>
                                )}

                                {submissionDownloadError && (
                                    <div className="mx-7 mb-4 bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                        <p className="text-sm text-[#C93B3B]">⚠️ {submissionDownloadError}</p>
                                    </div>
                                )}

                                {/* Отчёт и прогресс (только для одобренных) */}
                                {app.status === 'approved' && (
                                    <div className="px-7 py-4 border-b border-border-soft flex items-center gap-6 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Отчёт</span>
                                            {app.report ? (
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                                                    ${app.report.status === 'APPROVED' ? 'bg-success-bg text-success'
                                                        : app.report.status === 'REJECTED' ? 'bg-danger-bg text-danger'
                                                        : 'bg-warning-bg text-warning'}`}>
                                                    {app.report.status === 'APPROVED' ? 'Одобрен' : app.report.status === 'REJECTED' ? 'Отклонён' : 'На проверке'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-ink">не загружен</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Пропущено дней</span>
                                            <span className={`text-xs font-semibold ${app.missedDays > 0 ? 'text-danger' : 'text-success'}`}>
                                                {app.missedDays}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="px-7 py-4 flex items-center justify-between">
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
                    })}
                </div>
            )}
            {applicationToApprove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    onClick={event => {
                        if (event.target === event.currentTarget && !applicationActionId) setApplicationToApprove(null)
                    }}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                        <div className="w-12 h-12 rounded-full bg-brand-subtle flex items-center justify-center text-2xl mb-5">✅</div>
                        <h2 className="font-bold text-xl text-ink mb-2">Одобрить заявку?</h2>
                        <p className="text-sm text-muted-ink leading-relaxed">
                            Вы одобряете заявку {applicationToApprove.student?.email ?? 'кандидата'} на трек «{applicationToApprove.track.title}».
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed">
                            Если студент будет одобрен на нескольких треках, он самостоятельно выберет нужный трек в личном кабинете.
                        </p>
                        <div className="mt-7 flex justify-end gap-3">
                            <button type="button" onClick={() => setApplicationToApprove(null)}
                                disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 text-sm font-medium text-muted-ink hover:bg-surface rounded-xl disabled:opacity-50">
                                Отмена
                            </button>
                            <button type="button" onClick={confirmApproval}
                                disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm disabled:opacity-50 bg-gradient-to-br from-brand to-brand-light">
                                {applicationActionId ? 'Одобряем…' : 'Подтвердить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {applicationToReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    onClick={event => {
                        if (event.target === event.currentTarget && !applicationActionId) setApplicationToReject(null)
                    }}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                        <div className="w-12 h-12 rounded-full bg-danger-bg flex items-center justify-center text-2xl mb-5">⚠️</div>
                        <h2 className="font-bold text-xl text-ink mb-2">Отклонить заявку?</h2>
                        <p className="text-sm text-muted-ink leading-relaxed">
                            Вы отклоняете заявку {applicationToReject.student?.email ?? 'кандидата'} на трек «{applicationToReject.track.title}».
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed">
                            После отклонения студент не сможет повторно подать заявку на этот трек.
                        </p>
                        <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-ink">
                            Причина отклонения для студента
                            <textarea value={rejectionReason} onChange={event => setRejectionReason(event.target.value)}
                                placeholder="Опишите причину (необязательно)"
                                className="min-h-24 text-sm font-normal" />
                        </label>
                        <div className="mt-7 flex justify-end gap-3">
                            <button type="button" onClick={() => setApplicationToReject(null)}
                                disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 text-sm font-medium text-muted-ink hover:bg-surface rounded-xl disabled:opacity-50">
                                Отмена
                            </button>
                            <button type="button" onClick={confirmRejection}
                                disabled={Boolean(applicationActionId)}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-danger hover:bg-danger-hover rounded-xl shadow-sm disabled:opacity-50">
                                {applicationActionId ? 'Отклоняем…' : 'Отклонить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
