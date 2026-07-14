'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
    getMyApplication,
    type Application,
} from '@/services/api/invitation'
import {
    getMyTestTask,
    uploadSubmission,
    ALLOWED_SUBMISSION_EXTENSIONS,
    MAX_SUBMISSION_SIZE_BYTES,
    SubmissionValidationError,
    type MyTestTask,
} from '@/services/api/test-task'

const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]', dot: 'bg-[#F59E0B]' },
    approved: { label: 'Одобрена', className: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]', dot: 'bg-[#2CB87A]' },
    rejected: { label: 'Отклонена', className: 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]', dot: 'bg-[#D94F4F]' },
}

export default function ApplicationTestTaskPage() {
    const params = useParams()
    const applicationId = params.id as string
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [application, setApplication] = useState<Application | null>(null)
    const [testTask, setTestTask] = useState<MyTestTask | null>(null)
    const [pageLoading, setPageLoading] = useState(true)
    const [error, setError] = useState('')

    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')

    const loadTestTask = useCallback(async () => {
        const task = await getMyTestTask(applicationId)
        setTestTask(task)
    }, [applicationId])

    useEffect(() => {
        (async () => {
            try {
                const app = await getMyApplication(applicationId)
                setApplication(app)
                await loadTestTask()
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Не удалось загрузить заявку')
            } finally {
                setPageLoading(false)
            }
        })()
    }, [applicationId, loadTestTask])

    function openFilePicker() {
        setUploadError('')
        fileInputRef.current?.click()
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = '' // чтобы повторный выбор того же файла тоже сработал
        if (!file) return

        setUploadError('')
        setUploading(true)
        try {
            await uploadSubmission(applicationId, file)
            await loadTestTask()
        } catch (err: unknown) {
            if (err instanceof SubmissionValidationError || err instanceof Error) {
                setUploadError(err.message)
            } else {
                setUploadError('Не удалось загрузить решение')
            }
        } finally {
            setUploading(false)
        }
    }

    if (pageLoading) return (
        <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
            <p className="text-sm text-[#6B6880]">Загружаем…</p>
        </div>
    )

    if (error || !application) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center mx-auto">
                <div className="w-14 h-14 rounded-full bg-[#FFF5F5] flex items-center justify-center text-2xl mb-5">⚠️</div>
                <h2 className="font-extrabold text-xl text-[#1C1A3A] mb-2">Не удалось открыть заявку</h2>
                <p className="text-sm text-[#6B6880] mb-6">{error || 'Заявка не найдена'}</p>
                <a href="/dashboard/applications" className="text-sm font-semibold text-[#6C63FF] hover:underline">← Вернуться в личный кабинет</a>
            </div>
        )
    }

    const status = STATUS_CONFIG[application.status]

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">

            <a href="/dashboard/applications" className="text-sm font-medium text-[#6C63FF] hover:underline self-start">← К списку заявок</a>

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
                            {!testTask || !testTask.available ? (
                                <div className="flex items-start gap-3 p-4 bg-[#EBE9FF] rounded-xl border-l-4 border-[#6C63FF]">
                                    <span className="text-lg">📬</span>
                                    <p className="text-sm text-[#6B6880] leading-relaxed">
                                        {testTask?.message ?? 'Пока задание не опубликовано, оно будет вам направлено на e-mail позже. Ожидайте...'}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5">
                                    <div>
                                        <h3 className="font-semibold text-[#1C1A3A] mb-2">{testTask.title || 'Тестовое задание'}</h3>
                                        {testTask.description && (
                                            <p className="text-sm text-[#6B6880] leading-relaxed whitespace-pre-wrap">{testTask.description}</p>
                                        )}
                                    </div>

                                    {testTask.hasFile && testTask.downloadPath && (
                                        <a href={testTask.downloadPath} target="_blank" rel="noopener noreferrer"
                                            className="self-start text-sm font-semibold px-5 py-2.5 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF]">
                                            📎 Скачать файл задания
                                        </a>
                                    )}

                                    {/* ── Решение: загрузка / замена ── */}
                                    <div className="border-t border-[#E4E2F4] pt-5 flex flex-col gap-3">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Твоё решение</span>

                                        {testTask.submission ? (
                                            <div className="flex items-center gap-3 bg-[#EDFBF4] border border-[#7EE8B8] rounded-xl px-4 py-3">
                                                <span className="text-lg">✅</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-[#1C1A3A] truncate">{testTask.submission.fileName}</p>
                                                    <p className="text-xs text-[#6B6880]">
                                                        Загружено {new Date(testTask.submission.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 bg-[#FFF8ED] border border-[#F5D9A0] rounded-xl px-4 py-3">
                                                <span className="text-lg">⏳</span>
                                                <p className="text-sm text-[#7A5C1A]">Решение ещё не загружено</p>
                                            </div>
                                        )}

                                        <input ref={fileInputRef} type="file" className="hidden"
                                            accept={ALLOWED_SUBMISSION_EXTENSIONS.join(',')}
                                            onChange={handleFileSelected} />

                                        <button onClick={openFilePicker} disabled={uploading}
                                            className="self-start text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-sm disabled:opacity-60"
                                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                            {uploading ? 'Загружаем…' : testTask.submission ? '🔄 Заменить решение' : '📤 Загрузить решение'}
                                        </button>

                                        {uploadError && (
                                            <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                                <p className="text-sm text-[#D94F4F]">⚠️ {uploadError}</p>
                                            </div>
                                        )}

                                        <p className="text-xs text-[#A9A7BB]">
                                            Форматы: {ALLOWED_SUBMISSION_EXTENSIONS.join(', ')} · до {MAX_SUBMISSION_SIZE_BYTES / (1024 * 1024)} МБ.
                                            Повторная загрузка заменяет предыдущее решение.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
        </div>
    )
}
