'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getMyApplications, type Application } from '@/services/api/invitation'
import {
    getReadiness,
    getDocuments,
    updateDocumentField,
    generateDocument,
    getReport,
    uploadReport,
    validateReportFile,
    MAX_REPORT_SIZE_BYTES,
    DOCUMENT_TYPES,
    DOCUMENT_TYPE_LABELS,
    DOCUMENT_FIELD_CONFIG,
    DocumentValidationError,
    type DocumentType,
    type DocumentData,
    type ReadinessResponse,
    type ReportInfo,
} from '@/services/api/documents'
import { downloadProtectedFile } from '@/lib/api/download'
import { getMe } from '@/services/api/auth'
import { Lock, Upload, RotateCw, Clock, CheckCircle2, TriangleAlert, X, Download, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REPORT_STATUS_CONFIG: Record<ReportInfo['status'], { label: string; className: string; icon: LucideIcon }> = {
    PENDING: { label: 'На проверке', className: 'bg-warning-bg border-warning-border text-warning', icon: Clock },
    APPROVED: { label: 'Одобрен', className: 'bg-success-bg border-success-border text-success', icon: CheckCircle2 },
    REJECTED: { label: 'Отклонён', className: 'bg-danger-bg border-danger-border text-danger', icon: X },
}

// Одно и то же поле (по ключу) может встречаться в нескольких типах
// документов — например student_fio есть у всех четырёх. Раньше значение
// приходилось вносить в каждый документ отдельно; собираем сюда, где ещё
// встречается ключ поля, которое принадлежит студенту, чтобы синхронизировать
// значение сразу везде.
function studentFieldOccurrences(fieldKey: string): DocumentType[] {
    return DOCUMENT_TYPES.filter(type =>
        DOCUMENT_FIELD_CONFIG[type].some(f => f.key === fieldKey && f.owner === 'STUDENT')
    )
}

export default function DashboardDocumentsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
    const [applicationsLoading, setApplicationsLoading] = useState(true)
    const [studentName, setStudentName] = useState('')

    useEffect(() => {
        (async () => {
            try {
                const [data, user] = await Promise.all([getMyApplications(), getMe()])
                setApplications(data)
                setActiveApplicationId(user.active_application_id ?? null)
                setStudentName(user.full_name ?? '')
            } finally {
                setApplicationsLoading(false)
            }
        })()
    }, [])

    const approvedApplications = applications.filter(a => a.status === 'approved')
    const selectedApplication = approvedApplications.find(a => a.id === activeApplicationId) ?? null
    const needsApplicationSelection = approvedApplications.length > 1 && !selectedApplication
    const approvedApplication = selectedApplication ?? (approvedApplications.length === 1 ? approvedApplications[0] : null)

    const [readiness, setReadiness] = useState<ReadinessResponse | null>(null)
    const [documents, setDocuments] = useState<DocumentData[]>([])
    const [report, setReport] = useState<ReportInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({})
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const [fieldError, setFieldError] = useState<{ key: string; message: string } | null>(null)
    const [generatingType, setGeneratingType] = useState<DocumentType | null>(null)
    const [generateError, setGenerateError] = useState<{ type: DocumentType; message: string } | null>(null)

    const [reportUploading, setReportUploading] = useState(false)
    const [reportError, setReportError] = useState('')
    const reportFileInputRef = useRef<HTMLInputElement>(null)

    function openReportFilePicker() {
        setReportError('')
        reportFileInputRef.current?.click()
    }

    const load = useCallback(async () => {
        if (!approvedApplication) return
        setLoading(true)
        setError('')
        try {
            const [readinessData, documentsData, reportData] = await Promise.all([
                getReadiness(approvedApplication.id),
                getDocuments(approvedApplication.id),
                getReport(approvedApplication.id),
            ])
            setReadiness(readinessData)
            setDocuments(documentsData)
            setReport(reportData)

            const drafts: Record<string, string> = {}
            for (const doc of documentsData) {
                for (const field of doc.fieldValues) {
                    drafts[draftKey(doc.type, field.key)] = field.value
                }
            }
            setFieldDrafts(drafts)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить документы')
        } finally {
            setLoading(false)
        }
    }, [approvedApplication])

    useEffect(() => {
        (async () => {
            if (applicationsLoading || !approvedApplication) return
            await load()
        })()
    }, [applicationsLoading, approvedApplication, load])

    // ФИО студента уже известно из его профиля — не заставляем вводить его
    // вручную в каждом документе, если оно там ещё не заполнено.
    const [autoFilledForAppId, setAutoFilledForAppId] = useState<string | null>(null)
    useEffect(() => {
        if (!approvedApplication || !studentName || documents.length === 0) return
        if (autoFilledForAppId === approvedApplication.id) return
        ;(async () => {
            setAutoFilledForAppId(approvedApplication.id)
            const missing = studentFieldOccurrences('student_fio').filter(t => {
                const doc = documents.find(d => d.type === t)
                return !(doc?.fieldValues.find(f => f.key === 'student_fio')?.value ?? '').trim()
            })
            if (missing.length === 0) return
            for (const t of missing) {
                try {
                    await updateDocumentField(approvedApplication.id, t, 'student_fio', studentName)
                } catch {
                    // одно неудавшееся автозаполнение не должно мешать остальным
                }
            }
            await load()
        })()
    }, [approvedApplication, studentName, documents, autoFilledForAppId, load])

    function draftKey(type: DocumentType, fieldKey: string): string {
        return `${type}__${fieldKey}`
    }

    function handleFieldChange(type: DocumentType, fieldKey: string, value: string) {
        setFieldDrafts(prev => ({ ...prev, [draftKey(type, fieldKey)]: value }))
    }

    // Один и тот же ключ поля (ФИО, Группа, Тема практики) повторяется в
    // нескольких документах — заполнил в одном, подставляем везде остальным.
    async function syncFieldToOtherDocuments(applicationId: string, fieldKey: string, value: string, skipType: DocumentType) {
        const targets = studentFieldOccurrences(fieldKey).filter(t => t !== skipType)
        for (const t of targets) {
            const doc = documents.find(d => d.type === t)
            const current = doc?.fieldValues.find(f => f.key === fieldKey)?.value ?? ''
            if (current === value) continue
            try {
                await updateDocumentField(applicationId, t, fieldKey, value)
            } catch {
                // не блокируем сохранение основного поля из-за синхронизации остальных
            }
        }
    }

    async function handleFieldBlur(type: DocumentType, fieldKey: string) {
        if (!approvedApplication) return
        const key = draftKey(type, fieldKey)
        const value = fieldDrafts[key] ?? ''

        const doc = documents.find(d => d.type === type)
        const original = doc?.fieldValues.find(f => f.key === fieldKey)?.value ?? ''
        if (value === original) return // ничего не поменялось — не дёргаем сеть

        setSavingKey(key)
        setFieldError(null)
        try {
            await updateDocumentField(approvedApplication.id, type, fieldKey, value)
            await syncFieldToOtherDocuments(approvedApplication.id, fieldKey, value, type)
            await load()
        } catch (err: unknown) {
            setFieldError({ key, message: err instanceof Error ? err.message : 'Не удалось сохранить поле' })
        } finally {
            setSavingKey(null)
        }
    }

    async function handleGenerate(type: DocumentType) {
        if (!approvedApplication) return
        setGeneratingType(type)
        setGenerateError(null)
        try {
            await generateDocument(approvedApplication.id, type)
            const readinessData = await getReadiness(approvedApplication.id)
            setReadiness(readinessData)
        } catch (err: unknown) {
            setGenerateError({ type, message: err instanceof Error ? err.message : 'Не удалось сгенерировать документ' })
        } finally {
            setGeneratingType(null)
        }
    }

    async function handleDownload(path: string, suggestedFilename?: string) {
        try {
            await downloadProtectedFile(path, suggestedFilename)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось скачать файл')
        }
    }

    async function handleReportUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file || !approvedApplication) return

        setReportError('')
        try {
            validateReportFile(file)
        } catch (err: unknown) {
            setReportError(err instanceof DocumentValidationError ? err.message : 'Не удалось загрузить отчёт')
            return
        }

        setReportUploading(true)
        try {
            const updated = await uploadReport(approvedApplication.id, file)
            setReport(updated)
            const readinessData = await getReadiness(approvedApplication.id)
            setReadiness(readinessData)
        } catch (err: unknown) {
            setReportError(err instanceof Error ? err.message : 'Не удалось загрузить отчёт')
        } finally {
            setReportUploading(false)
        }
    }

    if (applicationsLoading) return (
        <div className="flex items-center gap-2 text-sm text-muted-ink">
            <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            Загружаем…
        </div>
    )

    if (!approvedApplication) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-12 min-h-[280px] flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                    <Lock className="size-5" />
                </div>
                <p className="font-semibold text-ink mb-1">
                    {needsApplicationSelection ? 'Выберите рабочий трек' : 'Документы пока недоступны'}
                </p>
                <p className="text-sm text-muted-ink max-w-sm mb-4">
                    {needsApplicationSelection
                        ? 'Выберите рабочий трек в разделе «Мои заявки», чтобы открыть его документы.'
                        : 'Они откроются, как только одна из ваших заявок будет одобрена.'}
                </p>
                <Button variant="brand" render={<a href="/dashboard/applications" />} nativeButton={false}
                    className="px-4 py-2 rounded-lg h-auto">
                    Посмотреть мои заявки
                </Button>
            </div>
        )
    }

    if (loading && !readiness) return (
        <div className="flex items-center gap-2 text-sm text-muted-ink">
            <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            Загружаем документы…
        </div>
    )

    function readinessFor(type: DocumentType) {
        return readiness?.documents.find(d => d.type === type)
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-ink">Документы</h1>
            </div>

            {error && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{error}</p>
                </div>
            )}

            {/* ── Отчёт о практике ── */}
            <div className="bg-white rounded-2xl shadow-sm px-7 pt-5 pb-7 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="font-bold text-lg text-ink leading-none">Отчёт о практике</h2>
                </div>

                <input ref={reportFileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx"
                    onChange={handleReportUpload} disabled={reportUploading} />

                <div className="flex items-stretch gap-3">
                    {report ? (
                        <div className={`flex-1 flex items-center gap-3 rounded-xl px-4 py-3 border ${REPORT_STATUS_CONFIG[report.status].className}`}>
                            {(() => { const StatusIcon = REPORT_STATUS_CONFIG[report.status].icon; return <StatusIcon className="size-5 flex-shrink-0" /> })()}
                            <p className="text-sm flex-1">
                                Загружен {new Date(report.uploadedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <span className="text-xs font-bold uppercase tracking-wide">{REPORT_STATUS_CONFIG[report.status].label}</span>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center gap-3 bg-warning-bg border border-warning-border rounded-xl px-4 py-3">
                            <Clock className="size-5 text-warning flex-shrink-0" />
                            <p className="text-sm text-warning">Отчёт ещё не загружен</p>
                        </div>
                    )}

                    <Button variant="brand" onClick={openReportFilePicker} disabled={reportUploading}
                        className="px-5 rounded-lg h-auto flex-shrink-0">
                        {reportUploading
                            ? 'Загружаем…'
                            : report
                                ? <><RotateCw className="size-4" />Заменить отчёт</>
                                : <><Upload className="size-4" />Загрузить отчёт</>}
                    </Button>
                </div>

                {report?.status === 'REJECTED' && report.rejectionReason && (
                    <div className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-danger mb-1">Причина отклонения</p>
                        <p className="text-sm text-danger whitespace-pre-wrap">{report.rejectionReason}</p>
                    </div>
                )}

                {reportError && (
                    <div className="flex items-center gap-2 bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
                        <TriangleAlert className="size-4 text-danger flex-shrink-0" />
                        <p className="text-sm text-danger">{reportError}</p>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-ink">Форматы:</span>
                    {['.pdf', '.doc', '.docx'].map(ext => (
                        <span key={ext} className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border-soft bg-white text-muted-ink">
                            {ext}
                        </span>
                    ))}
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border-soft bg-white text-muted-ink">
                        до {MAX_REPORT_SIZE_BYTES / (1024 * 1024)} МБ
                    </span>
                </div>
            </div>

            {/* ── Документы ── */}
            <div className="flex flex-col gap-4">
                {DOCUMENT_TYPES.map(type => {
                    const fields = DOCUMENT_FIELD_CONFIG[type]
                    const itemReadiness = readinessFor(type)

                    return (
                        <div key={type} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-7 py-5 border-b border-border-soft flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-2">
                                    <h2 className="font-bold text-lg text-ink">{DOCUMENT_TYPE_LABELS[type]}</h2>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-muted-ink">Необходимо заполнить:</span>
                                        {fields.map(field => {
                                            const filled = Boolean((fieldDrafts[draftKey(type, field.key)] ?? '').trim())
                                            return (
                                                <span key={field.key}
                                                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors
                                                        ${filled ? 'bg-success-bg border-success-border text-success' : 'bg-white border-border-soft text-muted-ink'}`}>
                                                    {field.label}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button variant={itemReadiness?.generated ? 'brand-outline' : 'brand'} disabled={!itemReadiness?.ready || generatingType === type}
                                        onClick={() => handleGenerate(type)}
                                        className={`px-5 py-2 rounded-lg h-auto flex-shrink-0 ${!itemReadiness?.ready && !itemReadiness?.generated ? 'bg-gradient-to-br from-border-soft to-surface text-muted-ink shadow-none' : ''}`}>
                                        {generatingType === type
                                            ? 'Формируем…'
                                            : itemReadiness?.generated
                                                ? <><RotateCw className="size-4" />Сформировать заново</>
                                                : 'Сформировать'}
                                    </Button>
                                    {itemReadiness?.generated && itemReadiness.downloadPath && (
                                        <Button variant="brand" onClick={() => handleDownload(itemReadiness.downloadPath!, DOCUMENT_TYPE_LABELS[type])}
                                            className="px-5 py-2 rounded-lg h-auto flex-shrink-0">
                                            <Download className="size-4" />Скачать
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {generateError?.type === type && (
                                <div className="mx-7 mt-4 bg-danger-bg border border-danger-border rounded-xl px-4 py-3 flex items-start gap-3">
                                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-danger">{generateError.message}</p>
                                </div>
                            )}

                            <div className="px-7 py-5 grid grid-cols-2 gap-4">
                                {fields.map(field => {
                                    const key = draftKey(type, field.key)
                                    const canEdit = field.owner === 'STUDENT'
                                    const value = fieldDrafts[key] ?? ''
                                    return (
                                        <div key={field.key} className={`flex flex-col gap-1.5 ${field.multiline ? 'col-span-2' : ''}`}>
                                            <label htmlFor={canEdit ? key : undefined} className="text-xs font-medium text-muted-ink flex items-center justify-between gap-2">
                                                <span className="inline-flex items-center gap-2">
                                                    {field.label}
                                                    {savingKey === key && <span className="text-[10px] text-muted-ink">сохраняем…</span>}
                                                </span>
                                                {!canEdit && (
                                                    <span className="text-[10px] font-medium text-muted-ink bg-surface border border-border-soft rounded-full px-2 py-0.5">
                                                        заполняет куратор
                                                    </span>
                                                )}
                                            </label>
                                            {canEdit ? (field.multiline ? (
                                                <textarea
                                                    id={key}
                                                    value={value}
                                                    onChange={e => handleFieldChange(type, field.key, e.target.value)}
                                                    onBlur={() => handleFieldBlur(type, field.key)}
                                                    rows={5}
                                                    className="w-full text-sm rounded-lg"
                                                    style={{ resize: 'vertical' }}
                                                />
                                            ) : (
                                                <input
                                                    id={key}
                                                    type="text"
                                                    value={value}
                                                    onChange={e => handleFieldChange(type, field.key, e.target.value)}
                                                    onBlur={() => handleFieldBlur(type, field.key)}
                                                    className="w-full text-sm rounded-lg"
                                                />
                                            )) : (
                                                <p className="rounded-lg border border-border-soft bg-surface px-4 py-[18px] max-h-[220px] overflow-y-auto text-sm text-ink whitespace-pre-wrap">
                                                    {value || <span className="text-faint-ink italic">Пока не заполнено</span>}
                                                </p>
                                            )}
                                            {fieldError?.key === key && (
                                                <span className="inline-flex items-center gap-1 text-xs text-danger">
                                                    <TriangleAlert className="size-3.5 flex-shrink-0" />{fieldError.message}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
