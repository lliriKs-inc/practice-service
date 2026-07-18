'use client'

import { useEffect, useState } from 'react'
import { getMyApplications, type Application } from '@/services/api/invitation'
import { getActiveApplicationId, setActiveApplicationId } from '@/lib/active-application'

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
                <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Мои заявки</h1>
                <p className="text-sm text-muted-ink">Архив всех заявок на практику по всем когортам.</p>
            </div>

            {applicationsLoading && (
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

            {!applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-ink mb-1">Заявок пока нет</p>
                    <p className="text-sm text-muted-ink max-w-sm">
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
                                <div className="px-7 py-5 border-b border-border-soft flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-muted-ink mb-1">
                                            {app.cohort.title}
                                        </p>
                                        <h2 className="font-bold text-lg text-ink">{app.track.title}</h2>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${status.className}`}>
                                        <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                        <span className="text-xs font-semibold">{status.label}</span>
                                    </div>
                                </div>

                                {/* Инфо о практике — раньше её нигде не было видно */}
                                <div className="px-7 py-4 border-b border-border-soft grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Период практики</span>
                                        <span className="text-sm text-ink">
                                            {new Date(app.cohort.start_date).toLocaleDateString('ru')} — {new Date(app.cohort.end_date).toLocaleDateString('ru')}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Трек</span>
                                        <span className="text-sm text-ink">{app.track.title}</span>
                                    </div>
                                </div>

                                {app.status === 'rejected' && (
                                    <div className="px-7 py-4 border-b border-danger-border bg-danger-bg">
                                        <p className="text-[10px] font-bold tracking-widest uppercase text-danger mb-1">
                                            Причина отклонения
                                        </p>
                                        <p className="text-sm text-ink">
                                            {app.rejection_reason?.trim() || 'Причина не указана'}
                                        </p>
                                    </div>
                                )}

                                <div className="px-7 py-4 flex items-center justify-between">
                                    <span className="text-xs text-muted-ink">
                                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status !== 'rejected' && (
                                        <div className="flex items-center gap-4">
                                            <a href={`/dashboard/applications/${app.id}/test-task`}
                                                className="text-xs font-semibold text-brand-hover hover:underline">
                                                Тестовое задание →
                                            </a>
                                            {app.status === 'approved' && (
                                                <button onClick={() => setApplicationToSelect(app)}
                                                    disabled={isPracticeStarted(app)}
                                                    className={'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ' +
                                                        (isPracticeStarted(app)
                                                            ? 'border-border-soft text-faint-ink cursor-not-allowed'
                                                            : activeApplicationId === app.id
                                                                ? 'border-brand bg-brand-subtle text-brand-hover'
                                                                : 'border-brand text-brand-hover hover:bg-brand-subtle')}>
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
                        <div className="w-12 h-12 rounded-full bg-brand-subtle flex items-center justify-center text-2xl mb-5">🛤️</div>
                        <h2 className="font-bold text-xl text-ink mb-2">Выбрать этот трек?</h2>
                        <p className="text-sm text-muted-ink leading-relaxed">
                            Вы выбираете трек «{applicationToSelect.track.title}» для прохождения практики.
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed">
                            До начала практики выбор можно изменить. После начала практики смена трека будет недоступна.
                        </p>
                        <div className="mt-7 flex justify-end gap-3">
                            <button type="button" onClick={() => setApplicationToSelect(null)}
                                className="px-5 py-2.5 text-sm font-medium text-muted-ink hover:bg-surface rounded-xl">
                                Отмена
                            </button>
                            <button type="button" onClick={confirmApplicationSelection}
                                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm bg-gradient-to-br from-brand to-brand-light">
                                Выбрать трек
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
