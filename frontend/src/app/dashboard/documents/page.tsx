'use client'

import { useEffect, useState, useCallback } from 'react'
import { getMyApplications, type Application } from '@/services/api/invitation'
import {
    getReadiness,
    getDocuments,
    updateDocumentField,
    generateDocument,
    getReport,
    uploadReport,
    describeMissingField,
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

const REPORT_STATUS_CONFIG: Record<ReportInfo['status'], { label: string; className: string }> = {
    PENDING: { label: 'На проверке', className: 'bg-warning-bg border-warning-border text-warning' },
    APPROVED: { label: 'Одобрен', className: 'bg-success-bg border-success-border text-success' },
    REJECTED: { label: 'Отклонён', className: 'bg-danger-bg border-danger-border text-danger' },
}

export default function DashboardDocumentsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
    const [applicationsLoading, setApplicationsLoading] = useState(true)

    useEffect(() => {
        (async () => {
            try {
                const [data, user] = await Promise.all([getMyApplications(), getMe()])
                setApplications(data)
                setActiveApplicationId(user.active_application_id ?? null)
            } finally {
                setApplicationsLoading(false)
            }
        })()
    }, [])

    const approvedApplications = applications.filter(a => a.status === 'approved')
    const approvedApplication = approvedApplications.find(a => a.id === activeApplicationId)
        ?? approvedApplications[0]
        ?? null

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

    function draftKey(type: DocumentType, fieldKey: string): string {
        return `${type}__${fieldKey}`
    }

    function handleFieldChange(type: DocumentType, fieldKey: string, value: string) {
        setFieldDrafts(prev => ({ ...prev, [draftKey(type, fieldKey)]: value }))
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
            const [readinessData, documentsData] = await Promise.all([
                getReadiness(approvedApplication.id),
                getDocuments(approvedApplication.id),
            ])
            setReadiness(readinessData)
            setDocuments(documentsData)
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
            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                <div className="text-4xl mb-4">🔒</div>
                <p className="font-semibold text-ink mb-1">Документы пока недоступны</p>
                <p className="text-sm text-muted-ink max-w-sm mb-4">
                    Они откроются, как только одна из ваших заявок будет одобрена.
                </p>
                <a href="/dashboard/applications"
                    className="text-xs font-semibold px-4 py-2 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle">
                    Посмотреть мои заявки
                </a>
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
                <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Документы</h1>
                <p className="text-sm text-muted-ink">Заполните поля — документы сформируются автоматически.</p>
                <p className="text-sm text-muted-ink">Текущий трек: {approvedApplication.track.title}</p>
            </div>

            {error && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4">
                    <p className="text-sm text-danger">⚠️ {error}</p>
                </div>
            )}

            {/* ── Отчёт о практике ── */}
            <div className="bg-white rounded-2xl shadow-sm p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase text-brand-hover mb-1">Отчёт о практике</p>
                        <p className="text-xs text-muted-ink">PDF, DOC или DOCX, до {MAX_REPORT_SIZE_BYTES / (1024 * 1024)} МБ</p>
                    </div>
                    {report && (
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${REPORT_STATUS_CONFIG[report.status].className}`}>
                            <span className="text-xs font-semibold">{REPORT_STATUS_CONFIG[report.status].label}</span>
                        </div>
                    )}
                </div>

                {report ? (
                    <p className="text-sm text-ink">
                        Загружен {new Date(report.uploadedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                ) : (
                    <p className="text-sm text-warning">Отчёт ещё не загружен</p>
                )}

                {reportError && (
                    <div className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
                        <p className="text-sm text-danger">⚠️ {reportError}</p>
                    </div>
                )}

                <label className="self-start text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-sm cursor-pointer disabled:opacity-60 bg-gradient-to-br from-brand to-brand-light">
                    {reportUploading ? 'Загружаем…' : report ? '🔄 Заменить отчёт' : '📤 Загрузить отчёт'}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleReportUpload} disabled={reportUploading} />
                </label>
            </div>

            {/* ── Документы ── */}
            <div className="flex flex-col gap-4">
                {DOCUMENT_TYPES.map(type => {
                    const fields = DOCUMENT_FIELD_CONFIG[type]
                    const isStudentEditable = fields.every(f => f.owner === 'STUDENT')
                    const itemReadiness = readinessFor(type)

                    return (
                        <div key={type} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-7 py-5 border-b border-border-soft flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="font-bold text-lg text-ink">{DOCUMENT_TYPE_LABELS[type]}</h2>
                                    {itemReadiness && (
                                        <p className="text-xs mt-1">
                                            {itemReadiness.ready ? (
                                                <span className="text-success">✅ Готов к формированию</span>
                                            ) : (
                                                <span className="text-muted-ink">
                                                    Не хватает: {itemReadiness.missingFields.map(m => describeMissingField(type, m)).join(', ')}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    {itemReadiness?.generated && itemReadiness.downloadPath && (
                                        <button onClick={() => handleDownload(itemReadiness.downloadPath!, DOCUMENT_TYPE_LABELS[type])}
                                            className="text-xs font-semibold text-brand-hover hover:underline">
                                            ⬇ Скачать
                                        </button>
                                    )}
                                    <button
                                        disabled={!itemReadiness?.ready || generatingType === type}
                                        onClick={() => handleGenerate(type)}
                                        className={`text-sm font-semibold px-5 py-2 rounded-lg flex-shrink-0 transition-all
                                            ${itemReadiness?.ready
                                                ? 'bg-brand text-white shadow-md hover:bg-brand-hover disabled:opacity-60'
                                                : 'bg-surface text-muted-ink border border-border-soft cursor-not-allowed'}`}>
                                        {generatingType === type ? 'Формируем…' : itemReadiness?.generated ? '🔄 Сформировать заново' : 'Сформировать'}
                                    </button>
                                </div>
                            </div>

                            {generateError?.type === type && (
                                <div className="mx-7 mt-4 bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
                                    <p className="text-sm text-danger">⚠️ {generateError.message}</p>
                                </div>
                            )}

                            {isStudentEditable ? (
                                <div className="px-7 py-5 grid grid-cols-2 gap-4">
                                    {fields.map(field => {
                                        const key = draftKey(type, field.key)
                                        return (
                                            <div key={field.key} className={`flex flex-col gap-1.5 ${field.multiline ? 'col-span-2' : ''}`}>
                                                <label htmlFor={key} className="text-xs font-medium text-muted-ink flex items-center gap-2">
                                                    {field.label}
                                                    {savingKey === key && <span className="text-[10px] text-muted-ink">сохраняем…</span>}
                                                </label>
                                                {field.multiline ? (
                                                    <textarea
                                                        id={key}
                                                        value={fieldDrafts[key] ?? ''}
                                                        onChange={e => handleFieldChange(type, field.key, e.target.value)}
                                                        onBlur={() => handleFieldBlur(type, field.key)}
                                                        rows={3}
                                                        className="w-full text-sm"
                                                        style={{ resize: 'vertical' }}
                                                    />
                                                ) : (
                                                    <input
                                                        id={key}
                                                        type="text"
                                                        value={fieldDrafts[key] ?? ''}
                                                        onChange={e => handleFieldChange(type, field.key, e.target.value)}
                                                        onBlur={() => handleFieldBlur(type, field.key)}
                                                        className="w-full text-sm"
                                                    />
                                                )}
                                                {fieldError?.key === key && (
                                                    <span className="text-xs text-danger">⚠️ {fieldError.message}</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="px-7 py-5">
                                    <p className="text-sm text-muted-ink">Заполняется куратором практики — доступно только для просмотра.</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
