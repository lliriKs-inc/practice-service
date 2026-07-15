'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAdminDocuments, updateAdminDocumentField, updateReportStatus, type AdminDocumentSummary, type AdminDocumentsFilter } from '@/services/api/admin'
import { getAdminApplicationDocumentDetail } from '@/services/api/documents'
import {
    DOCUMENT_TYPES,
    DOCUMENT_TYPE_LABELS,
    DOCUMENT_FIELD_CONFIG,
    describeMissingField,
    type DocumentType,
    type DocumentFieldValue,
} from '@/services/api/documents'
import { useCohortWorkspace } from '../cohort-context'
import { downloadProtectedFile } from '@/lib/api/download'

const REPORT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'На проверке', className: 'bg-[#FFF8ED] text-[#7A5C1A]' },
    APPROVED: { label: 'Одобрен', className: 'bg-[#EDFBF4] text-[#1A7A5A]' },
    REJECTED: { label: 'Отклонён', className: 'bg-[#FFF5F5] text-[#C93B3B]' },
    MISSING: { label: 'Не загружен', className: 'bg-[#F5F4FD] text-[#6B6880]' },
}

export default function AdminDocumentsPage() {
    const { cohorts, selectedCohort } = useCohortWorkspace()
    const sourceCohort = selectedCohort ? cohorts.find(c => c.id === selectedCohort.id) : null

    const [documents, setDocuments] = useState<AdminDocumentSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [trackFilter, setTrackFilter] = useState('')
    const [search, setSearch] = useState('')
    const [reportStatusFilter, setReportStatusFilter] = useState<AdminDocumentsFilter['reportStatus'] | ''>('')
    const [readinessFilter, setReadinessFilter] = useState<AdminDocumentsFilter['readiness'] | ''>('')

    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [fieldValuesById, setFieldValuesById] = useState<Record<string, { type: DocumentType; values: DocumentFieldValue[] }[]>>({})
    const [detailLoading, setDetailLoading] = useState<string | null>(null)

    const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({})
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const [reportActionId, setReportActionId] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!selectedCohort) return
        setLoading(true)
        setError('')
        try {
            const data = await getAdminDocuments(selectedCohort.id, {
                trackId: trackFilter || undefined,
                search: search.trim() || undefined,
                reportStatus: reportStatusFilter || undefined,
                readiness: readinessFilter || undefined,
            })
            setDocuments(data)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки документов')
        } finally {
            setLoading(false)
        }
    }, [selectedCohort, trackFilter, search, reportStatusFilter, readinessFilter])

    useEffect(() => {
        (async () => { await load() })()
    }, [load])

    function reviewKey(applicationId: string, fieldKey: string): string {
        return `${applicationId}__${fieldKey}`
    }

    async function toggleExpand(applicationId: string) {
        if (expandedId === applicationId) {
            setExpandedId(null)
            return
        }
        setExpandedId(applicationId)
        if (fieldValuesById[applicationId] || !selectedCohort) return
        setDetailLoading(applicationId)
        try {
            const detail = await getAdminApplicationDocumentDetail(selectedCohort.id, applicationId)
            setFieldValuesById(prev => ({ ...prev, [applicationId]: detail.fieldValues }))
            const drafts: Record<string, string> = {}
            const reviewValues = detail.fieldValues.find(d => d.type === 'REVIEW')?.values ?? []
            for (const field of reviewValues) {
                drafts[reviewKey(applicationId, field.key)] = field.value
            }
            setReviewDrafts(prev => ({ ...prev, ...drafts }))
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить поля документов')
        } finally {
            setDetailLoading(null)
        }
    }

    async function handleReviewFieldBlur(applicationId: string, fieldKey: string) {
        if (!selectedCohort) return
        const key = reviewKey(applicationId, fieldKey)
        const value = reviewDrafts[key] ?? ''
        const existing = fieldValuesById[applicationId]?.find(d => d.type === 'REVIEW')?.values.find(f => f.key === fieldKey)?.value ?? ''
        if (value === existing) return

        setSavingKey(key)
        try {
            await updateAdminDocumentField(selectedCohort.id, applicationId, 'REVIEW', fieldKey, value)
            const detail = await getAdminApplicationDocumentDetail(selectedCohort.id, applicationId)
            setFieldValuesById(prev => ({ ...prev, [applicationId]: detail.fieldValues }))
            await load()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось сохранить поле отзыва')
        } finally {
            setSavingKey(null)
        }
    }

    async function handleReportDecision(applicationId: string, status: 'APPROVED' | 'REJECTED') {
        if (!selectedCohort) return
        setReportActionId(applicationId)
        try {
            await updateReportStatus(selectedCohort.id, applicationId, status)
            await load()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось обновить статус отчёта')
        } finally {
            setReportActionId(null)
        }
    }

    async function handleDownload(path: string, suggestedFilename?: string) {
        try {
            await downloadProtectedFile(path, suggestedFilename)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось скачать файл')
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Документы</h1>
                <p className="text-sm text-[#6B6880]">
                    {selectedCohort ? `Готовность документов когорты «${selectedCohort.title}»` : 'Выбери рабочую когорту в шапке.'}
                </p>
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">🗂️</div>
                    <p className="font-semibold text-[#1C1A3A] mb-1">Выбери рабочую когорту</p>
                </div>
            )}

            {selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                    <select aria-label="Фильтр по треку" value={trackFilter} onChange={e => setTrackFilter(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4]">
                        <option value="">Все треки</option>
                        {sourceCohort?.tracks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                    <select aria-label="Фильтр по статусу отчёта" value={reportStatusFilter} onChange={e => setReportStatusFilter(e.target.value as AdminDocumentsFilter['reportStatus'] | '')}
                        className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4]">
                        <option value="">Любой статус отчёта</option>
                        <option value="MISSING">Не загружен</option>
                        <option value="PENDING">На проверке</option>
                        <option value="APPROVED">Одобрен</option>
                        <option value="REJECTED">Отклонён</option>
                    </select>
                    <select aria-label="Фильтр по готовности документов" value={readinessFilter} onChange={e => setReadinessFilter(e.target.value as AdminDocumentsFilter['readiness'] | '')}
                        className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4]">
                        <option value="">Любая готовность</option>
                        <option value="READY">Все документы готовы</option>
                        <option value="INCOMPLETE">Есть незаполненные</option>
                    </select>
                    <input type="text" aria-label="Поиск по email" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по email…" className="text-sm px-3 py-2 rounded-lg border border-[#E4E2F4] flex-1 min-w-[180px]" />
                </div>
            )}

            {/* Спиннер только на самой первой загрузке — при фоновом обновлении
                (после автосейва поля) список остаётся на месте, не мигает и
                не сбрасывает скролл наверх. */}
            {loading && documents.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-[#6B6880]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                    Загружаем…
                </div>
            )}

            {error && (
                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                    <p className="text-sm text-[#C93B3B]">⚠️ {error}</p>
                </div>
            )}

            {selectedCohort && !loading && !error && documents.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="font-semibold text-[#1C1A3A] mb-1">Ничего не найдено</p>
                    <p className="text-sm text-[#6B6880]">Документы появляются только у одобренных заявок.</p>
                </div>
            )}

            {selectedCohort && !error && documents.length > 0 && (
                <div className="flex flex-col gap-4">
                    {documents.map(doc => {
                        const reportStatus = doc.report?.status ?? 'MISSING'
                        const detail = fieldValuesById[doc.applicationId]

                        return (
                            <div key={doc.applicationId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#6B6880] mb-1">{doc.track.title}</p>
                                        <h2 className="font-bold text-lg text-[#1C1A3A]">{doc.student?.email ?? 'Неизвестный кандидат'}</h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${REPORT_STATUS_LABELS[reportStatus].className}`}>
                                            Отчёт: {REPORT_STATUS_LABELS[reportStatus].label}
                                        </span>
                                        {doc.report?.status === 'PENDING' && (
                                            <>
                                                <button
                                                    disabled={reportActionId === doc.applicationId}
                                                    onClick={() => handleReportDecision(doc.applicationId, 'REJECTED')}
                                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#F0BABA] text-[#C93B3B] hover:bg-[#FFF5F5] disabled:opacity-50">
                                                    Отклонить
                                                </button>
                                                <button
                                                    disabled={reportActionId === doc.applicationId}
                                                    onClick={() => handleReportDecision(doc.applicationId, 'APPROVED')}
                                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                                    Одобрить
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="px-7 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-[#E4E2F4]">
                                    {doc.documents.map(d => (
                                        <div key={d.type} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                                            {d.ready ? (
                                                <span className="text-xs text-[#1A7A5A]">✅ Готов</span>
                                            ) : (
                                                <span className="text-xs text-[#6B6880]">Не готов</span>
                                            )}
                                            {d.generated && d.downloadPath && (
                                                <button onClick={() => handleDownload(d.downloadPath!, DOCUMENT_TYPE_LABELS[d.type])} className="text-xs text-[#4A42D4] hover:underline text-left">⬇ Скачать</button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="px-7 py-3">
                                    <button onClick={() => toggleExpand(doc.applicationId)} className="text-xs font-semibold text-[#4A42D4] hover:underline">
                                        {expandedId === doc.applicationId ? '▲ Скрыть детали' : '▼ Показать детали и отзыв'}
                                    </button>

                                    {expandedId === doc.applicationId && (
                                        <div className="mt-4 flex flex-col gap-5">
                                            {detailLoading === doc.applicationId ? (
                                                <p className="text-xs text-[#6B6880]">Загружаем…</p>
                                            ) : (
                                                DOCUMENT_TYPES.map(type => {
                                                    const values = detail?.find(d => d.type === type)?.values ?? []
                                                    const fields = DOCUMENT_FIELD_CONFIG[type]
                                                    const readiness = doc.documents.find(d => d.type === type)
                                                    const isReview = type === 'REVIEW'

                                                    return (
                                                        <div key={type} className="border border-[#E4E2F4] rounded-xl p-4 flex flex-col gap-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-[#1C1A3A]">{DOCUMENT_TYPE_LABELS[type]}</span>
                                                                {readiness && !readiness.ready && (
                                                                    <span className="text-[11px] text-[#6B6880]">
                                                                        Не хватает: {readiness.missingFields.map(m => describeMissingField(type, m)).join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {fields.map(field => {
                                                                    const value = values.find(v => v.key === field.key)?.value ?? ''
                                                                    const key = reviewKey(doc.applicationId, field.key)
                                                                    if (isReview) {
                                                                        return (
                                                                            <div key={field.key} className={`flex flex-col gap-1 ${field.multiline ? 'col-span-2' : ''}`}>
                                                                                <label htmlFor={key} className="text-[11px] text-[#6B6880] flex items-center gap-2">
                                                                                    {field.label}
                                                                                    {savingKey === key && <span className="text-[10px] text-[#6B6880]">сохраняем…</span>}
                                                                                </label>
                                                                                {field.multiline ? (
                                                                                    <textarea id={key} rows={2} className="w-full text-sm"
                                                                                        value={reviewDrafts[key] ?? value}
                                                                                        onChange={e => setReviewDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                                                                                        onBlur={() => handleReviewFieldBlur(doc.applicationId, field.key)} />
                                                                                ) : (
                                                                                    <input id={key} type="text" className="w-full text-sm"
                                                                                        value={reviewDrafts[key] ?? value}
                                                                                        onChange={e => setReviewDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                                                                                        onBlur={() => handleReviewFieldBlur(doc.applicationId, field.key)} />
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    }
                                                                    return (
                                                                        <div key={field.key} className="flex flex-col gap-0.5">
                                                                            <span className="text-[11px] text-[#6B6880]">{field.label}</span>
                                                                            <span className="text-sm text-[#1C1A3A]">{value || '—'}</span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
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
