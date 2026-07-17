'use client'

import { useEffect, useState } from 'react'
import { getMyApplications, type Application } from '@/services/api/invitation'
import { getActiveApplicationId, setActiveApplicationId } from '@/lib/active-application'

const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]', dot: 'bg-[#F59E0B]' },
    approved: { label: 'Одобрена', className: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]', dot: 'bg-[#2CB87A]' },
    rejected: { label: 'Отклонена', className: 'bg-[#FFF5F5] border-[#F0BABA] text-[#C93B3B]', dot: 'bg-[#D94F4F]' },
}

export default function DashboardApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [applicationsError, setApplicationsError] = useState('')
    const [pageOpenedAt] = useState(() => Date.now())
    const [activeApplicationId, setActiveApplicationIdState] = useState(() => getActiveApplicationId())
    const [applicationToSelect, setApplicationToSelect] = useState<Application | null>(null)

    useEffect(() => {
        (async () => {
            try {
                const data = await getMyApplications()
                setApplications(data)
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

    function confirmApplicationSelection() {
        if (!applicationToSelect || isPracticeStarted(applicationToSelect)) return
        setActiveApplicationId(applicationToSelect.id)
        setActiveApplicationIdState(applicationToSelect.id)
        setApplicationToSelect(null)
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Мои заявки</h1>
                <p className="text-sm text-[#6B6880]">Архив всех заявок на практику по всем когортам.</p>
            </div>

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

            {!applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-[#1C1A3A] mb-1">Заявок пока нет</p>
                    <p className="text-sm text-[#6B6880] max-w-sm">
                        Чтобы подать заявку на практику, перейди по ссылке-приглашению,
                        которую пришлёт организатор когорты.
                    </p>
                </div>
            )}

            {!applicationsLoading && !applicationsError && applications.length > 0 && (
                <div className="flex flex-col gap-4">
                    {applications.map(app => {
                        const status = STATUS_CONFIG[app.status]
                        return (
                            <div key={app.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#6B6880] mb-1">
                                            {app.cohort.title}
                                        </p>
                                        <h2 className="font-bold text-lg text-[#1C1A3A]">{app.track.title}</h2>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${status.className}`}>
                                        <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                        <span className="text-xs font-semibold">{status.label}</span>
                                    </div>
                                </div>

                                {/* Инфо о практике — раньше её нигде не было видно */}
                                <div className="px-7 py-4 border-b border-[#E4E2F4] grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">Период практики</span>
                                        <span className="text-sm text-[#1C1A3A]">
                                            {new Date(app.cohort.start_date).toLocaleDateString('ru')} — {new Date(app.cohort.end_date).toLocaleDateString('ru')}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">Трек</span>
                                        <span className="text-sm text-[#1C1A3A]">{app.track.title}</span>
                                    </div>
                                </div>

                                {app.status === 'rejected' && (
                                    <div className="px-7 py-4 border-b border-[#F0BABA] bg-[#FFF5F5]">
                                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#C93B3B] mb-1">
                                            Причина отклонения
                                        </p>
                                        <p className="text-sm text-[#1C1A3A]">
                                            {app.rejection_reason?.trim() || 'Причина не указана'}
                                        </p>
                                    </div>
                                )}

                                <div className="px-7 py-4 flex items-center justify-between">
                                    <span className="text-xs text-[#6B6880]">
                                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status !== 'rejected' && (
                                        <div className="flex items-center gap-4">
                                            <a href={`/dashboard/applications/${app.id}/test-task`}
                                                className="text-xs font-semibold text-[#4A42D4] hover:underline">
                                                Тестовое задание →
                                            </a>
                                            {app.status === 'approved' && (
                                                <button onClick={() => setApplicationToSelect(app)}
                                                    disabled={isPracticeStarted(app)}
                                                    className={'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ' +
                                                        (isPracticeStarted(app)
                                                            ? 'border-[#E4E2F4] text-[#9A98AA] cursor-not-allowed'
                                                            : activeApplicationId === app.id
                                                                ? 'border-[#6C63FF] bg-[#EBE9FF] text-[#4A42D4]'
                                                                : 'border-[#6C63FF] text-[#4A42D4] hover:bg-[#EBE9FF]')}>
                                                    {isPracticeStarted(app)
                                                        ? 'Выбор закреплён'
                                                        : activeApplicationId === app.id
                                                            ? '✓ Выбранный трек'
                                                            : 'Выбрать этот трек'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            {applicationToSelect && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    onClick={event => {
                        if (event.target === event.currentTarget) setApplicationToSelect(null)
                    }}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                        <div className="w-12 h-12 rounded-full bg-[#EBE9FF] flex items-center justify-center text-2xl mb-5">🛤️</div>
                        <h2 className="font-bold text-xl text-[#1C1A3A] mb-2">Выбрать этот трек?</h2>
                        <p className="text-sm text-[#6B6880] leading-relaxed">
                            Вы выбираете трек «{applicationToSelect.track.title}» для прохождения практики.
                        </p>
                        <p className="mt-3 text-sm text-[#6B6880] leading-relaxed">
                            До начала практики выбор можно изменить. После начала практики смена трека будет недоступна.
                        </p>
                        <div className="mt-7 flex justify-end gap-3">
                            <button type="button" onClick={() => setApplicationToSelect(null)}
                                className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl">
                                Отмена
                            </button>
                            <button type="button" onClick={confirmApplicationSelection}
                                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                Выбрать трек
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
