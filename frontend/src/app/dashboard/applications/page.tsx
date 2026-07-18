'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Route, MoveRight, X } from 'lucide-react'
import { getMyApplications, type Application } from '@/services/api/invitation'
import { getMe, selectActiveApplication } from '@/services/api/auth'

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
    const approvedApplications = applications.filter(app => app.status === 'approved')
    const needsApplicationSelection = approvedApplications.length > 1 &&
        !approvedApplications.some(app => app.id === activeApplicationId)

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

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Мои заявки</h1>
                <p className="text-sm text-muted-ink">Архив всех заявок на практику по всем когортам.</p>
            </div>

            {!applicationsLoading && !applicationsError && needsApplicationSelection && (
                <div className="bg-[#FFF8ED] border border-[#F5D9A0] rounded-xl px-5 py-4 flex items-start gap-3">
                    <span className="text-lg" aria-hidden="true">⚠️</span>
                    <div>
                        <p className="text-sm font-semibold text-[#7A5C1A]">Выберите рабочий трек</p>
                        <p className="text-sm text-[#6B6880] mt-1">
                            У вас несколько одобренных заявок. До начала практики выберите трек, по которому будете выполнять задачи и оформлять документы.
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
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4">
                    <p className="text-sm text-danger">⚠️ {applicationsError}</p>
                </div>
            )}

            {!applicationsLoading && !applicationsError && applications.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-ink mb-1">Заявок пока нет</p>
                    <p className="text-sm text-muted-ink max-w-sm">
                        Чтобы подать заявку на практику, перейдите по ссылке-приглашению,
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
                                <div className="px-7 py-5 border-b border-border-soft flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Практика</span>
                                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                                            <h2 className="font-extrabold text-xl text-ink tracking-tight uppercase">{app.cohort.title}</h2>
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                                <Route className="size-3.5" />{app.track.title}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border flex-shrink-0 ${status.className}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                        <span className="text-xs font-semibold">{status.label}</span>
                                    </div>
                                </div>

                                {/* Инфо о когорте — раньше её нигде не было видно */}
                                <div className="px-7 py-4 border-b border-border-soft grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Период практики</span>
                                        <span className="text-sm text-ink">
                                            {new Date(app.cohort.start_date).toLocaleDateString('ru')} — {new Date(app.cohort.end_date).toLocaleDateString('ru')}
                                        </span>
                                    </div>
                                    {app.status !== 'rejected' && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Тестовое задание</span>
                                            <a href={`/dashboard/applications/${app.id}/test-task`}
                                                className="self-start inline-flex items-center gap-1 text-sm font-semibold text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                                                Перейти<MoveRight className="size-3.5" />
                                            </a>
                                        </div>
                                    )}
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

                                {/* Ответы на анкету — свёрнуты по умолчанию, раньше их можно было увидеть только в момент подачи заявки */}
                                <div className="border-b border-border-soft">
                                    <button type="button" onClick={() => toggleAnswers(app.id)}
                                        className="w-full px-7 py-4 flex items-center justify-between text-left hover:bg-surface transition-colors">
                                        <span className="text-sm font-semibold text-ink">Ответы на анкету</span>
                                        <ChevronDown className={`size-4 text-muted-ink transition-transform ${expandedAnswers.has(app.id) ? 'rotate-180' : ''}`} />
                                    </button>
                                    {expandedAnswers.has(app.id) && (
                                        <div className="px-7 py-4 flex flex-col gap-3">
                                            {app.answers && app.answers.length > 0 ? (
                                                app.answers.map((a, i) => (
                                                    <div key={i} className="flex flex-col gap-0.5">
                                                        <span className="text-xs text-muted-ink">{a.label}</span>
                                                        <span className="text-sm text-ink">{a.value}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-ink">В анкете этой когорты не было вопросов.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-7 py-4 flex items-center justify-between">
                                    <span className="text-xs text-muted-ink">
                                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status === 'approved' && (
                                        <div className="flex items-center gap-4">
                                            {activeApplicationId === app.id ? (
                                                    <Button variant={isPracticeStarted(app) ? 'outline' : 'danger'}
                                                        onClick={cancelApplicationSelection}
                                                        disabled={isPracticeStarted(app)}
                                                        className="px-4 py-2 rounded-lg h-auto">
                                                        {isPracticeStarted(app)
                                                            ? 'Выбор закреплён'
                                                            : <><X className="size-3.5" strokeWidth={2.5} />Отменить выбор</>}
                                                    </Button>
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
                    })}
                </div>
            )}
            {applicationToSelect && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    onClick={event => {
                        if (event.target === event.currentTarget) setApplicationToSelect(null)
                    }}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
                        <h2 className="font-bold text-xl text-ink mb-3">Выбрать этот трек?</h2>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-3 py-1.5 mb-6">
                            <Route className="size-4" />{applicationToSelect.track.title}
                        </span>
                        <p className="text-sm text-muted-ink leading-relaxed text-left">
                            Вы выбираете трек «{applicationToSelect.track.title}» для прохождения практики «{applicationToSelect.cohort.title}».
                        </p>
                        <p className="mt-3 text-sm text-muted-ink leading-relaxed text-left">
                            До начала практики выбор можно изменить. После начала практики смена трека будет недоступна.
                        </p>
                        <div className="mt-7 flex justify-end gap-3">
                            <button type="button" onClick={() => setApplicationToSelect(null)} disabled={selectionSaving}
                                className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl disabled:opacity-50">
                                Отмена
                            </button>
                            <button type="button" onClick={confirmApplicationSelection} disabled={selectionSaving}
                                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                {selectionSaving ? 'Сохраняем…' : 'Выбрать трек'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
