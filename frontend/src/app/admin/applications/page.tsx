'use client'

import { useEffect, useState, useCallback } from 'react'
import { updateApplicationStatus, type Application } from '@/services/api/invitation'
import { getAdminApplications, getAdminApplicationDetail, type AdminApplicationSummary } from '@/services/api/admin'
import { useCohortWorkspace } from '../cohort-context'

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
    const [applicationActionId, setApplicationActionId] = useState<string | null>(null)

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

    async function handleApplicationDecision(id: string, status: 'approved' | 'rejected') {
        setApplicationActionId(id)
        try {
            await updateApplicationStatus(id, status)
            await loadApplications()
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
                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Заявки</h1>
                <p className="text-sm text-[#6B6880]">
                    {selectedCohort ? `Заявки кандидатов когорты «${selectedCohort.title}»` : 'Выбери рабочую когорту в шапке, чтобы увидеть заявки.'}
                </p>
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">🗂️</div>
                    <p className="font-semibold text-[#1C1A3A] mb-1">Выбери рабочую когорту</p>
                    <p className="text-sm text-[#6B6880]">Заявки, фильтры и статусы отчётов показываются в разрезе одной когорты.</p>
                </div>
            )}

            {selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                    <select aria-label="Фильтр по статусу заявки" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Application['status'] | '')}
                        className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4]">
                        <option value="">Все статусы</option>
                        <option value="pending">На рассмотрении</option>
                        <option value="approved">Одобрена</option>
                        <option value="rejected">Отклонена</option>
                    </select>
                    <select aria-label="Фильтр по треку" value={trackFilter} onChange={e => setTrackFilter(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4]">
                        <option value="">Все треки</option>
                        {sourceCohort?.tracks.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                    <input type="text" aria-label="Поиск по email" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по email…" className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4] flex-1 min-w-[180px]" />
                </div>
            )}

            {applicationsLoading && (
                <div className="flex items-center gap-2 text-sm text-[#6B6880]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                    Загружаем заявки…
                </div>
            )}

            {applicationsError && (
                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                    <p className="text-sm text-[#C93B3B]">⚠️ {applicationsError}</p>
                </div>
            )}

            {selectedCohort && !applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-[#1C1A3A] mb-1">Заявок не найдено</p>
                    <p className="text-sm text-[#6B6880]">Попробуй изменить фильтры, либо заявок ещё нет в этой когорте.</p>
                </div>
            )}

            {selectedCohort && !applicationsLoading && !applicationsError && applications.length > 0 && (
                <div className="flex flex-col gap-4">
                    {applications.map(app => {
                        const trackTestTask = sourceCohort?.tracks.find(t => t.id === app.track.id)?.testTask

                        return (
                            <div key={app.applicationId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#6B6880] mb-1">{app.track.title}</p>
                                        <h2 className="font-bold text-lg text-[#1C1A3A]">{app.student?.email ?? 'Неизвестный кандидат'}</h2>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border
                                        ${app.status === 'pending' ? 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]'
                                            : app.status === 'approved' ? 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]'
                                            : 'bg-[#FFF5F5] border-[#F0BABA] text-[#C93B3B]'}`}>
                                        <div className={`w-2 h-2 rounded-full
                                            ${app.status === 'pending' ? 'bg-[#F59E0B]' : app.status === 'approved' ? 'bg-[#2CB87A]' : 'bg-[#D94F4F]'}`} />
                                        <span className="text-xs font-semibold">{STATUS_LABELS[app.status]}</span>
                                    </div>
                                </div>

                                <div className="px-7 py-3 border-b border-[#E4E2F4]">
                                    <button onClick={() => toggleAnswers(app.applicationId)}
                                        className="text-xs font-semibold text-[#4A42D4] hover:underline">
                                        {expandedId === app.applicationId ? '▲ Скрыть ответы анкеты' : '▼ Показать ответы анкеты'}
                                    </button>
                                    {expandedId === app.applicationId && (
                                        <div className="mt-3">
                                            {answersLoading === app.applicationId ? (
                                                <p className="text-xs text-[#6B6880]">Загружаем…</p>
                                            ) : answersById[app.applicationId]?.length ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {answersById[app.applicationId].map((a, i) => (
                                                        <div key={i} className="flex flex-col gap-0.5">
                                                            <span className="text-xs text-[#6B6880]">{a.label}</span>
                                                            <span className="text-sm text-[#1C1A3A]">{a.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-[#6B6880]">Ответов нет.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Тестовое задание трека */}
                                {trackTestTask && (trackTestTask.title || trackTestTask.description) && (
                                    <div className="px-7 py-4 border-b border-[#E4E2F4] flex flex-col gap-1.5 bg-[#FBFAFF]">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">Тестовое задание трека</span>
                                        <p className="text-sm font-semibold text-[#1C1A3A]">{trackTestTask.title || '—'}</p>
                                        {app.testTaskSubmission ? (
                                            <p className="text-[11px] text-[#1A7A5A] mt-1">
                                                ✅ Решение загружено: {app.testTaskSubmission.fileName}
                                                {' · '}
                                                {new Date(app.testTaskSubmission.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-[#6B6880] mt-1">Решение пока не загружено кандидатом.</p>
                                        )}
                                    </div>
                                )}

                                {/* Отчёт и прогресс (только для одобренных) */}
                                {app.status === 'approved' && (
                                    <div className="px-7 py-4 border-b border-[#E4E2F4] flex items-center gap-6 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">Отчёт</span>
                                            {app.report ? (
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                                                    ${app.report.status === 'APPROVED' ? 'bg-[#EDFBF4] text-[#1A7A5A]'
                                                        : app.report.status === 'REJECTED' ? 'bg-[#FFF5F5] text-[#C93B3B]'
                                                        : 'bg-[#FFF8ED] text-[#7A5C1A]'}`}>
                                                    {app.report.status === 'APPROVED' ? 'Одобрен' : app.report.status === 'REJECTED' ? 'Отклонён' : 'На проверке'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[#6B6880]">не загружен</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">Пропущено дней</span>
                                            <span className={`text-xs font-semibold ${app.missedDays > 0 ? 'text-[#C93B3B]' : 'text-[#1A7A5A]'}`}>
                                                {app.missedDays}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="px-7 py-4 flex items-center justify-between">
                                    <span className="text-xs text-[#6B6880]">
                                        Подана {new Date(app.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                disabled={applicationActionId === app.applicationId}
                                                onClick={() => handleApplicationDecision(app.applicationId, 'rejected')}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#F0BABA] text-[#C93B3B] hover:bg-[#FFF5F5] disabled:opacity-50">
                                                Отклонить
                                            </button>
                                            <button
                                                disabled={applicationActionId === app.applicationId}
                                                onClick={() => handleApplicationDecision(app.applicationId, 'approved')}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white shadow-sm disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
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
        </div>
    )
}
