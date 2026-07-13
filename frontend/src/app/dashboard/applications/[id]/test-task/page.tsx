'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/api/auth'
import {
    getMyApplication,
    getApplicationTestTask,
    type Application,
} from '@/services/api/invitation'
import type { TestTask } from '@/services/api/cohorts'

const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]', dot: 'bg-[#F59E0B]' },
    approved: { label: 'Одобрена', className: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]', dot: 'bg-[#2CB87A]' },
    rejected: { label: 'Отклонена', className: 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]', dot: 'bg-[#D94F4F]' },
}

export default function ApplicationTestTaskPage() {
    const { user, loading } = useAuth()
    const params = useParams()
    const applicationId = params.id as string

    const [application, setApplication] = useState<Application | null>(null)
    const [testTask, setTestTask] = useState<TestTask | null>(null)
    const [pageLoading, setPageLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        (async () => {
            if (loading) return
            try {
                const [app, task] = await Promise.all([
                    getMyApplication(applicationId),
                    getApplicationTestTask(applicationId),
                ])
                setApplication(app)
                setTestTask(task)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Не удалось загрузить заявку')
            } finally {
                setPageLoading(false)
            }
        })()
    }, [loading, applicationId])

    if (loading || pageLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD]">
            <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                <p className="text-sm text-[#6B6880]">Загружаем…</p>
            </div>
        </div>
    )

    if (error || !application) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD] px-6">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-[#FFF5F5] flex items-center justify-center text-2xl mb-5">⚠️</div>
                    <h2 className="font-extrabold text-xl text-[#1C1A3A] mb-2">Не удалось открыть заявку</h2>
                    <p className="text-sm text-[#6B6880] mb-6">{error || 'Заявка не найдена'}</p>
                    <a href="/dashboard" className="text-sm font-semibold text-[#6C63FF] hover:underline">← Вернуться в личный кабинет</a>
                </div>
            </div>
        )
    }

    const status = STATUS_CONFIG[application.status]

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">

            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">{user?.email ?? '…'}</span>
                    </div>
                    <button onClick={logout} className="text-xs font-medium text-[#6B6880] hover:text-[#1C1A3A]">Выйти</button>
                </div>
            </header>

            <main className="flex-1 flex justify-center px-6 py-10">
                <div className="w-full max-w-2xl flex flex-col gap-6">

                    <a href="/dashboard" className="text-sm font-medium text-[#6C63FF] hover:underline self-start">← К списку заявок</a>

                    {/* Карточка заявки */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">{application.cohort.title}</p>
                                <h1 className="font-extrabold text-xl text-[#1C1A3A]">{application.track.title}</h1>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${status.className}`}>
                                <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                <span className="text-xs font-semibold">{status.label}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-[#E4E2F4]">
                            <div className="px-7 py-4 flex flex-col gap-1">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Период практики</span>
                                <span className="text-sm font-semibold text-[#1C1A3A]">
                                    {new Date(application.cohort.start_date).toLocaleDateString('ru')} — {new Date(application.cohort.end_date).toLocaleDateString('ru')}
                                </span>
                            </div>
                            <div className="px-7 py-4 flex flex-col gap-1">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Заявка подана</span>
                                <span className="text-sm font-semibold text-[#1C1A3A]">
                                    {new Date(application.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>

                        {application.answers && application.answers.length > 0 && (
                            <div className="px-7 py-5 border-t border-[#E4E2F4] flex flex-col gap-3">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Твои ответы в анкете</span>
                                <div className="flex flex-col gap-2.5">
                                    {application.answers.map((a, i) => (
                                        <div key={i} className="flex flex-col gap-0.5">
                                            <span className="text-xs text-[#A9A7BB]">{a.label}</span>
                                            <span className="text-sm text-[#1C1A3A]">{a.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Тестовое задание */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-7 py-5 border-b border-[#E4E2F4]">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Тестовое задание</p>
                            <h2 className="font-bold text-lg text-[#1C1A3A]">{application.track.title}</h2>
                        </div>

                        <div className="px-7 py-6">
                            {!testTask || !testTask.publishedAt ? (
                                <div className="flex items-start gap-3 p-4 bg-[#EBE9FF] rounded-xl border-l-4 border-[#6C63FF]">
                                    <span className="text-lg">📬</span>
                                    <p className="text-sm text-[#6B6880] leading-relaxed">
                                        Пока задание не опубликовано, оно будет вам направлено на e-mail позже. Ожидайте...
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <h3 className="font-semibold text-[#1C1A3A] mb-2">{testTask.title || 'Тестовое задание'}</h3>
                                        {testTask.description && (
                                            <p className="text-sm text-[#6B6880] leading-relaxed whitespace-pre-wrap">{testTask.description}</p>
                                        )}
                                    </div>

                                    {testTask.fileUrl && (
                                        <a href={testTask.fileUrl} target="_blank" rel="noopener noreferrer"
                                            className="self-start text-sm font-semibold px-5 py-2.5 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF]">
                                            📎 Скачать файл задания
                                        </a>
                                    )}

                                    <div className="bg-[#F5F4FD] border border-[#E4E2F4] rounded-xl px-4 py-3">
                                        <p className="text-xs text-[#6B6880]">
                                            Загрузка решения пока не реализована в этой версии — эта возможность появится отдельно.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
