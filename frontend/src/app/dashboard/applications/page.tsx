'use client'

import { useEffect, useState } from 'react'
import { getMyApplications, type Application } from '@/services/api/invitation'

const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]', dot: 'bg-[#F59E0B]' },
    approved: { label: 'Одобрена', className: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]', dot: 'bg-[#2CB87A]' },
    rejected: { label: 'Отклонена', className: 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]', dot: 'bg-[#D94F4F]' },
}

export default function DashboardApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [applicationsError, setApplicationsError] = useState('')

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
                    <p className="text-sm text-[#D94F4F]">⚠️ {applicationsError}</p>
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
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">
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
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Период практики</span>
                                        <span className="text-sm text-[#1C1A3A]">
                                            {new Date(app.cohort.start_date).toLocaleDateString('ru')} — {new Date(app.cohort.end_date).toLocaleDateString('ru')}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Трек</span>
                                        <span className="text-sm text-[#1C1A3A]">{app.track.title}</span>
                                    </div>
                                </div>

                                <div className="px-7 py-4 flex items-center justify-between">
                                    <span className="text-xs text-[#A9A7BB]">
                                        Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {app.status !== 'rejected' && (
                                        <a href={`/dashboard/applications/${app.id}/test-task`}
                                            className="text-xs font-semibold text-[#6C63FF] hover:underline">
                                            Тестовое задание →
                                        </a>
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
