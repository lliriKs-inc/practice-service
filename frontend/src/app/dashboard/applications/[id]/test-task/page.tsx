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
import { downloadProtectedFile } from '@/lib/api/download'
import { Route, Clock, CheckCircle2, Upload, RotateCw, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STATUS_CONFIG: Record<Application['status'], { label: string; className: string; dot: string }> = {
    pending: { label: 'На рассмотрении', className: 'bg-warning-bg border-warning-border text-warning', dot: 'bg-warning-dot' },
    approved: { label: 'Одобрена', className: 'bg-success-bg border-success-border text-success', dot: 'bg-success-dot' },
    rejected: { label: 'Отклонена', className: 'bg-danger-bg border-danger-border text-danger', dot: 'bg-danger-dot' },
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

    async function handleDownload(path: string, suggestedFilename?: string) {
        try {
            await downloadProtectedFile(path, suggestedFilename)
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : 'Не удалось скачать файл')
        }
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
            <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-sm text-muted-ink">Загружаем…</p>
        </div>
    )

    if (error || !application) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md flex flex-col items-center text-center mx-auto">
                <div className="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center text-2xl mb-5">⚠️</div>
                <h2 className="font-extrabold text-xl text-ink mb-2">Не удалось открыть заявку</h2>
                <p className="text-sm text-muted-ink mb-6">{error || 'Заявка не найдена'}</p>
                <a href="/dashboard/applications" className="text-sm font-semibold text-brand-hover hover:underline">← Вернуться в личный кабинет</a>
            </div>
        )
    }

    const status = STATUS_CONFIG[application.status]

    return (
        <div className="w-full flex flex-col gap-6">

            <a href="/dashboard/applications"
                className="self-start inline-flex items-center text-sm font-medium text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300">
                ← К списку заявок
            </a>

            <div className="grid lg:grid-cols-2 gap-6 items-start">
                    {/* Карточка заявки */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-7 py-5 border-b border-border-soft flex items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Практика</span>
                                <div className="flex items-center gap-3 flex-wrap mt-0.5">
                                    <h1 className="font-extrabold text-xl text-ink tracking-tight uppercase">{application.cohort.title}</h1>
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                        <Route className="size-3.5" />{application.track.title}
                                    </span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border flex-shrink-0 ${status.className}`}>
                                <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                <span className="text-xs font-semibold">{status.label}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-border-soft">
                            <div className="px-7 py-4 flex flex-col gap-1">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Заявка подана</span>
                                <span className="text-sm font-semibold text-ink">
                                    {new Date(application.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="px-7 py-4 flex flex-col gap-1">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Период практики</span>
                                <span className="text-sm font-semibold text-ink">
                                    {new Date(application.cohort.start_date).toLocaleDateString('ru')} — {new Date(application.cohort.end_date).toLocaleDateString('ru')}
                                </span>
                            </div>
                        </div>

                        <div className="px-7 py-5 border-t border-border-soft flex flex-col gap-4">
                            {[
                                { n: '1', label: 'Анкета', sub: 'Заявка отправлена', done: true },
                                { n: '2', label: 'Тестовое задание', sub: 'Сейчас, на этой странице', active: true },
                                { n: '3', label: 'Результат', sub: 'После проверки' },
                            ].map(step => (
                                <div key={step.n} className={`flex items-center gap-3 ${step.done || step.active ? 'opacity-100' : 'opacity-50'}`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                                        ${step.done ? 'bg-brand text-white' : step.active ? 'border-2 border-brand text-brand-hover' : 'border-2 border-border-soft text-faint-ink'}`}>
                                        {step.done ? <Check className="size-3.5" /> : step.n}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-ink">{step.label}</div>
                                        <div className="text-xs text-muted-ink">{step.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Тестовое задание */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-7 py-5 border-b border-border-soft">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-muted-ink mb-1">Тестовое задание</p>
                            <h2 className="font-bold text-lg text-ink">{application.track.title}</h2>
                        </div>

                        <div className="px-7 py-6">
                            {!testTask || !testTask.available ? (
                                <div className="flex items-start gap-3 p-4 bg-brand-subtle rounded-xl border-l-4 border-brand">
                                    <span className="text-lg">📬</span>
                                    <p className="text-sm text-muted-ink leading-relaxed">
                                        {testTask?.message ?? 'Пока задание не опубликовано, оно будет вам направлено на e-mail позже. Ожидайте...'}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5">
                                    <div>
                                        <h3 className="font-semibold text-ink mb-2">{testTask.title || 'Тестовое задание'}</h3>
                                        {testTask.description && (
                                            <p className="text-sm text-muted-ink leading-relaxed whitespace-pre-wrap">{testTask.description}</p>
                                        )}
                                    </div>

                                    {testTask.hasFile && testTask.downloadPath && (
                                        <button onClick={() => handleDownload(testTask.downloadPath!, testTask.title || 'Тестовое задание')}
                                            className="self-start text-sm font-semibold px-5 py-2.5 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle">
                                            📎 Скачать файл задания
                                        </button>
                                    )}

                                    {/* ── Решение: загрузка / замена ── */}
                                    <div className="border-t border-border-soft pt-5 flex flex-col gap-3">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">Твоё решение</span>

                                        <div className="flex items-stretch gap-3">
                                            {testTask.submission ? (
                                                <div className="flex-1 flex items-center gap-3 bg-success-bg border border-success-border rounded-xl px-4 py-3">
                                                    <CheckCircle2 className="size-5 text-success flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-ink truncate">{testTask.submission.fileName}</p>
                                                        <p className="text-xs text-muted-ink">
                                                            Загружено {new Date(testTask.submission.submittedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center gap-3 bg-warning-bg border border-warning-border rounded-xl px-4 py-3">
                                                    <Clock className="size-5 text-warning flex-shrink-0" />
                                                    <p className="text-sm text-warning">Решение ещё не загружено</p>
                                                </div>
                                            )}

                                            <input ref={fileInputRef} type="file" className="hidden"
                                                accept={ALLOWED_SUBMISSION_EXTENSIONS.join(',')}
                                                onChange={handleFileSelected} />

                                            <Button variant="brand" onClick={openFilePicker} disabled={uploading}
                                                className="px-5 rounded-lg h-auto flex-shrink-0">
                                                {uploading
                                                    ? 'Загружаем…'
                                                    : testTask.submission
                                                        ? <><RotateCw className="size-4" />Заменить решение</>
                                                        : <><Upload className="size-4" />Загрузить решение</>}
                                            </Button>
                                        </div>

                                        {uploadError && (
                                            <div className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
                                                <p className="text-sm text-danger">⚠️ {uploadError}</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-muted-ink">Форматы:</span>
                                            {ALLOWED_SUBMISSION_EXTENSIONS.map(ext => (
                                                <span key={ext} className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border-soft bg-white text-muted-ink">
                                                    {ext}
                                                </span>
                                            ))}
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border-soft bg-white text-muted-ink">
                                                до {MAX_SUBMISSION_SIZE_BYTES / (1024 * 1024)} МБ
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
            </div>
        </div>
    )
}
