'use client'

import { useEffect, useState } from 'react'
import { getAllApplications, updateApplicationStatus, type Application } from '@/services/api/invitation'
import { getSubmissionForApplication, type SubmissionInfo } from '@/services/api/test-task'
import { useCohortWorkspace } from '../cohort-context'

export default function AdminApplicationsPage() {
    const { cohorts, selectedCohort } = useCohortWorkspace()

    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [applicationsError, setApplicationsError] = useState('')
    const [applicationActionId, setApplicationActionId] = useState<string | null>(null)
    const [submissions, setSubmissions] = useState<Record<string, SubmissionInfo | null>>({})

    async function loadApplications() {
        setApplicationsLoading(true)
        setApplicationsError('')
        try {
            const data = await getAllApplications()
            setApplications(data)
            const entries = await Promise.all(
                data.map(async app => [app.id, await getSubmissionForApplication(app.id)] as const)
            )
            setSubmissions(Object.fromEntries(entries))
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Ошибка загрузки заявок')
        } finally {
            setApplicationsLoading(false)
        }
    }

    useEffect(() => {
        (async () => {
            await loadApplications()
        })()
    }, [])

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

    // Показываем заявки выбранной рабочей когорты — если она выбрана.
    const visibleApplications = selectedCohort
        ? applications.filter(app => app.cohort.id === selectedCohort.id)
        : applications

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Заявки</h1>
                <p className="text-sm text-[#6B6880]">
                    {selectedCohort ? `Заявки кандидатов когорты «${selectedCohort.title}»` : 'Все заявки кандидатов по всем когортам.'}
                </p>
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

            {!applicationsLoading && !applicationsError && visibleApplications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-[#1C1A3A] mb-1">Заявок пока нет</p>
                    <p className="text-sm text-[#6B6880]">Как только кандидат подаст заявку по ссылке-приглашению, она появится здесь.</p>
                </div>
            )}

            {!applicationsLoading && !applicationsError && visibleApplications.length > 0 && (
                <div className="flex flex-col gap-4">
                    {visibleApplications.map(app => {
                        // [FIX] Раньше админ не видел ни ответов анкеты, ни тестового
                        // задания трека — ищем их прямо из уже загруженного списка когорт
                        const sourceCohort = cohorts.find(c => c.id === app.cohort.id)
                        const trackTestTask = sourceCohort?.tracks.find(t => t.id === app.track.id)?.testTask

                        return (
                            <div key={app.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">
                                            {app.cohort.title} · {app.track.title}
                                        </p>
                                        <h2 className="font-bold text-lg text-[#1C1A3A]">{app.student?.email ?? 'Неизвестный кандидат'}</h2>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border
                                        ${app.status === 'pending' ? 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]'
                                            : app.status === 'approved' ? 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]'
                                            : 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]'}`}>
                                        <div className={`w-2 h-2 rounded-full
                                            ${app.status === 'pending' ? 'bg-[#F59E0B]' : app.status === 'approved' ? 'bg-[#2CB87A]' : 'bg-[#D94F4F]'}`} />
                                        <span className="text-xs font-semibold">
                                            {app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Одобрена' : 'Отклонена'}
                                        </span>
                                    </div>
                                </div>

                                {/* Ответы анкеты */}
                                {app.answers && app.answers.length > 0 && (
                                    <div className="px-7 py-4 border-b border-[#E4E2F4] flex flex-col gap-2.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Ответы анкеты</span>
                                        <div className="grid grid-cols-2 gap-3">
                                            {app.answers.map((a, i) => (
                                                <div key={i} className="flex flex-col gap-0.5">
                                                    <span className="text-xs text-[#A9A7BB]">{a.label}</span>
                                                    <span className="text-sm text-[#1C1A3A]">{a.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Тестовое задание трека */}
                                {trackTestTask && (trackTestTask.title || trackTestTask.description) && (
                                    <div className="px-7 py-4 border-b border-[#E4E2F4] flex flex-col gap-1.5 bg-[#FBFAFF]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Тестовое задание трека</span>
                                            {trackTestTask.publishedAt ? (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDFBF4] border border-[#7EE8B8] text-[#1A7A5A]">Опубликовано</span>
                                            ) : (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F4FD] border border-[#E4E2F4] text-[#A9A7BB]">Черновик</span>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold text-[#1C1A3A]">{trackTestTask.title || '—'}</p>
                                        {trackTestTask.description && (
                                            <p className="text-xs text-[#6B6880] leading-relaxed">{trackTestTask.description}</p>
                                        )}
                                        {submissions[app.id] ? (
                                            <p className="text-[11px] text-[#1A7A5A] mt-1 flex items-center gap-1">
                                                ✅ Решение загружено: {submissions[app.id]!.fileName}
                                                {' · '}
                                                {new Date(submissions[app.id]!.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-[#A9A7BB] mt-1">Решение пока не загружено кандидатом.</p>
                                        )}
                                    </div>
                                )}

                                <div className="px-7 py-4 flex items-center justify-between">
                                    <span className="text-xs text-[#A9A7BB]">
                                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                disabled={applicationActionId === app.id}
                                                onClick={() => handleApplicationDecision(app.id, 'rejected')}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#F0BABA] text-[#D94F4F] hover:bg-[#FFF5F5] disabled:opacity-50">
                                                Отклонить
                                            </button>
                                            <button
                                                disabled={applicationActionId === app.id}
                                                onClick={() => handleApplicationDecision(app.id, 'approved')}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white shadow-sm disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                                {applicationActionId === app.id ? 'Сохраняем…' : 'Одобрить'}
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
