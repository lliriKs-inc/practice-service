'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { FolderKanban, FileText, TriangleAlert, Download, CheckCircle2, ChevronDown, Route, ListFilter, Users, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Оверлей модалки закрывается только по клику НАЧАВШЕМУСЯ и ЗАКОНЧИВШЕМУСЯ на
// самом оверлее — иначе выделение текста мышью, отпущенной за пределами
// модалки (mouseup на оверлее), тоже засчитывалось бы как клик по нему и
// закрывало окно посреди выделения.
function useOverlayClose(onClose: () => void) {
    const mouseDownOnOverlay = useRef(false)
    return {
        onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
            mouseDownOnOverlay.current = e.target === e.currentTarget
        },
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget && mouseDownOnOverlay.current) onClose()
        },
    }
}
import { getAdminDocuments, updateAdminDocumentField, updateReportStatus, type AdminDocumentSummary, type AdminDocumentsFilter } from '@/services/api/admin'
import { getAdminApplicationDocumentDetail } from '@/services/api/documents'
import {
    DOCUMENT_TYPES,
    DOCUMENT_TYPE_LABELS,
    DOCUMENT_FIELD_CONFIG,
    describeMissingField,
    type DocumentType,
    type DocumentFieldValue,
    type DocumentReadinessItem,
} from '@/services/api/documents'
import { useCohortWorkspace } from '../cohort-context'
import { downloadProtectedFile } from '@/lib/api/download'

const REPORT_STATUS_LABELS: Record<string, { label: string; className: string; dot: string }> = {
    PENDING: { label: 'На проверке', className: 'bg-warning-bg border-warning-border text-warning', dot: 'bg-warning-dot' },
    APPROVED: { label: 'Одобрен', className: 'bg-success-bg border-success-border text-success', dot: 'bg-success-dot' },
    REJECTED: { label: 'Отклонён', className: 'bg-danger-bg border-danger-border text-danger', dot: 'bg-danger-dot' },
    MISSING: { label: 'Не загружен', className: 'bg-surface border-border-soft text-muted-ink', dot: 'bg-faint-ink' },
}

function describeReadinessTooltip(d: DocumentReadinessItem): string {
    const reportApprovalMissing = d.missingFields.includes('report.status:APPROVED')
    const fieldKeys = d.missingFields.filter(m => m !== 'report.status:APPROVED')
    const studentLabels = fieldKeys
        .filter(key => DOCUMENT_FIELD_CONFIG[d.type].find(f => f.key === key)?.owner === 'STUDENT')
        .map(key => describeMissingField(d.type, key))
    const adminLabels = fieldKeys
        .filter(key => DOCUMENT_FIELD_CONFIG[d.type].find(f => f.key === key)?.owner === 'ADMIN')
        .map(key => describeMissingField(d.type, key))

    const lines: string[] = []
    if (studentLabels.length > 0) lines.push(`Студенту необходимо заполнить поля: ${studentLabels.join(', ')}.`)
    if (adminLabels.length > 0) lines.push(`Куратору необходимо заполнить поля: ${adminLabels.join(', ')}.`)
    if (reportApprovalMissing) lines.push('Отчёт должен быть проверен и одобрен куратором.')
    return lines.join('\n')
}

function pluralizeApplications(n: number): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'заявка'
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'заявки'
    return 'заявок'
}

function studentKey(doc: AdminDocumentSummary): string {
    return doc.student?.email ?? doc.student?.id ?? doc.applicationId
}

// До выбора рабочего трека (и до старта практики) бэкенд отдаёт по одной
// карточке документов на КАЖДУЮ одобренную заявку студента — считаем,
// сколько их у одного и того же студента, чтобы показать это явно.
function countByStudent(documents: AdminDocumentSummary[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const doc of documents) {
        const key = studentKey(doc)
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
}

export default function AdminDocumentsPage() {
    const { cohorts, selectedCohort } = useCohortWorkspace()
    const sourceCohort = selectedCohort ? cohorts.find(c => c.id === selectedCohort.id) : null

    const [documents, setDocuments] = useState<AdminDocumentSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const searchParams = useSearchParams()
    const [trackFilter, setTrackFilter] = useState('')
    // Приходя по ссылке «Документы студента» с карточки заявки — сразу
    // подставляем email студента в поиск, чтобы не искать его заново.
    const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
    const [reportStatusFilter, setReportStatusFilter] = useState<AdminDocumentsFilter['reportStatus'] | ''>('')
    const [readinessFilter, setReadinessFilter] = useState<AdminDocumentsFilter['readiness'] | ''>('')

    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [fieldValuesById, setFieldValuesById] = useState<Record<string, { type: DocumentType; values: DocumentFieldValue[] }[]>>({})
    const [detailLoading, setDetailLoading] = useState<string | null>(null)

    const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({})
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const [reportActionId, setReportActionId] = useState<string | null>(null)
    const [rejectingReportId, setRejectingReportId] = useState<string | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [rejectionReasonError, setRejectionReasonError] = useState('')
    const rejectReportModalOverlay = useOverlayClose(() => setRejectingReportId(null))

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

    async function handleReportDecision(applicationId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
        if (!selectedCohort) return
        setReportActionId(applicationId)
        try {
            if (reason === undefined) {
                await updateReportStatus(selectedCohort.id, applicationId, status)
            } else {
                await updateReportStatus(selectedCohort.id, applicationId, status, reason)
            }
            await load()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось обновить статус отчёта')
        } finally {
            setReportActionId(null)
        }
    }

    async function confirmReportRejection() {
        if (!rejectingReportId) return
        const reason = rejectionReason.trim()
        if (!reason) {
            setRejectionReasonError('Укажите причину отклонения отчёта')
            return
        }
        await handleReportDecision(rejectingReportId, 'REJECTED', reason)
        setRejectingReportId(null)
        setRejectionReason('')
        setRejectionReasonError('')
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
                <h1 className="font-extrabold text-2xl tracking-tight text-ink">
                    {selectedCohort ? <>Документы по когорте «{selectedCohort.title}»</> : 'Документы'}
                </h1>
                {!selectedCohort && (
                    <p className="text-sm text-muted-ink mt-1">Выберите рабочую когорту в шапке.</p>
                )}
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                        <FolderKanban className="size-5" />
                    </div>
                    <p className="font-semibold text-ink mb-1">Выберите рабочую когорту</p>
                </div>
            )}

            {selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-3">
                    <div className="relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white w-full sm:w-auto sm:flex-shrink-0 focus-within:border-brand cursor-pointer">
                        <Route className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-sm font-medium text-ink truncate pointer-events-none">
                            {sourceCohort?.tracks.find(t => t.id === trackFilter)?.title ?? 'Все треки'}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select aria-label="Фильтр по треку" value={trackFilter} onChange={e => setTrackFilter(e.target.value)}
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            <option value="">Все треки</option>
                            {sourceCohort?.tracks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                    <div className="relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white w-full sm:w-auto sm:flex-shrink-0 focus-within:border-brand cursor-pointer">
                        <ListFilter className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-sm font-medium text-ink truncate pointer-events-none">
                            {reportStatusFilter ? REPORT_STATUS_LABELS[reportStatusFilter].label : 'Любой статус отчёта'}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select aria-label="Фильтр по статусу отчёта" value={reportStatusFilter}
                            onChange={e => setReportStatusFilter(e.target.value as AdminDocumentsFilter['reportStatus'] | '')}
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            <option value="">Любой статус отчёта</option>
                            <option value="MISSING">Не загружен</option>
                            <option value="PENDING">На проверке</option>
                            <option value="APPROVED">Одобрен</option>
                            <option value="REJECTED">Отклонён</option>
                        </select>
                    </div>
                    <div className="relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white w-full sm:w-auto sm:flex-shrink-0 focus-within:border-brand cursor-pointer">
                        <ListFilter className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-sm font-medium text-ink truncate pointer-events-none">
                            {readinessFilter === 'READY' ? 'Все документы готовы' : readinessFilter === 'INCOMPLETE' ? 'Есть незаполненные' : 'Любая готовность'}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select aria-label="Фильтр по готовности документов" value={readinessFilter}
                            onChange={e => setReadinessFilter(e.target.value as AdminDocumentsFilter['readiness'] | '')}
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            <option value="">Любая готовность</option>
                            <option value="READY">Все документы готовы</option>
                            <option value="INCOMPLETE">Есть незаполненные</option>
                        </select>
                    </div>
                    <input type="text" aria-label="Поиск по ФИО или email" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по ФИО или email…" className="h-9 text-sm px-3 rounded-lg border border-border-soft flex-1 min-w-[180px]" />
                </div>
            )}

            {/* Спиннер только на самой первой загрузке — при фоновом обновлении
                (после автосейва поля) список остаётся на месте, не мигает и
                не сбрасывает скролл наверх. */}
            {loading && documents.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-ink">
                    <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Загружаем…
                </div>
            )}

            {error && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex items-start gap-3">
                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{error}</p>
                </div>
            )}

            {selectedCohort && !loading && !error && documents.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                        <FileText className="size-5" />
                    </div>
                    <p className="font-semibold text-ink mb-1">Ничего не найдено</p>
                    <p className="text-sm text-muted-ink">Документы появляются только у одобренных заявок.</p>
                </div>
            )}

            {selectedCohort && !error && documents.length > 0 && (
                <div className="flex flex-col gap-4">
                    {(() => {
                        const counts = countByStudent(documents)
                        return documents.map(doc => {
                        const reportStatus = doc.report?.status ?? 'MISSING'
                        const detail = fieldValuesById[doc.applicationId]
                        const applicationsCount = counts.get(studentKey(doc)) ?? 1

                        return (
                            <div key={doc.applicationId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-7 py-5 border-b border-border-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:whitespace-nowrap">
                                    <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1 flex-shrink-0">
                                        <Route className="size-3.5" />{doc.track.title}
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border flex-shrink-0 ${REPORT_STATUS_LABELS[reportStatus].className}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${REPORT_STATUS_LABELS[reportStatus].dot}`} />
                                        <span className="text-xs font-semibold">Отчёт: {REPORT_STATUS_LABELS[reportStatus].label}</span>
                                    </div>
                                    {doc.report?.downloadPath && (
                                        <button type="button" onClick={() => handleDownload(doc.report!.downloadPath)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle transition-colors duration-300">
                                            <Download className="size-3.5" />Скачать отчёт
                                        </button>
                                    )}
                                    {doc.report?.status === 'PENDING' && (
                                        <>
                                            <Button variant="brand" disabled={reportActionId === doc.applicationId}
                                                onClick={() => handleReportDecision(doc.applicationId, 'APPROVED')}
                                                className="px-3 py-1.5 rounded-lg h-auto text-xs">
                                                Одобрить
                                            </Button>
                                            <Button variant="danger" disabled={reportActionId === doc.applicationId}
                                                onClick={() => { setRejectingReportId(doc.applicationId); setRejectionReason(''); setRejectionReasonError('') }}
                                                className="px-3 py-1.5 rounded-lg h-auto text-xs">
                                                Отклонить
                                            </Button>
                                        </>
                                    )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border-soft border-b border-border-soft">
                                    <div className="px-7 py-5 flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                                        <h2 className="font-bold text-lg text-ink">{doc.student?.full_name || 'Неизвестный кандидат'}</h2>
                                        {applicationsCount > 1 && (
                                            <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border-soft bg-surface text-muted-ink"
                                                title="У этого студента несколько одобренных заявок в этой когорте — рабочий трек ещё не выбран.">
                                                <Users className="size-3 flex-shrink-0" />{applicationsCount} {pluralizeApplications(applicationsCount)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="px-7 py-5 flex items-center">
                                        <span className="font-bold text-lg text-ink">{doc.student?.email ?? '—'}</span>
                                    </div>
                                </div>

                                <div className="px-7 py-4 grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-border-soft">
                                    {doc.documents.map(d => (
                                        <div key={d.type} className="rounded-xl border border-border-soft p-4 flex flex-col gap-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                                                {d.ready ? (
                                                    d.generated ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-bg border border-success-border rounded-full px-2 py-0.5 flex-shrink-0">
                                                            <CheckCircle2 className="size-3" />Готов
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-bg border border-success-border rounded-full px-2 py-0.5 flex-shrink-0">
                                                            <span className="cursor-help inline-flex" title="Студент ещё не сформировал документ.">
                                                                <Info className="size-3" />
                                                            </span>
                                                            Готов
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-ink bg-surface border border-border-soft rounded-full px-2 py-0.5 flex-shrink-0">
                                                        <span className="cursor-help inline-flex" title={describeReadinessTooltip(d)}>
                                                            <Info className="size-3" />
                                                        </span>
                                                        Не готов
                                                    </span>
                                                )}
                                            </div>
                                            {d.generated && d.downloadPath ? (
                                                <Button variant="brand-outline" onClick={() => handleDownload(d.downloadPath!, DOCUMENT_TYPE_LABELS[d.type])}
                                                    className="h-auto rounded-lg px-3 py-1.5 text-xs justify-center w-full">
                                                    <Download className="size-3.5" />Скачать
                                                </Button>
                                            ) : (
                                                <Button variant="brand-outline" disabled
                                                    className="h-auto rounded-lg px-3 py-1.5 text-xs justify-center w-full border-border-soft text-muted-ink">
                                                    <Download className="size-3.5" />Скачать
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <button type="button" onClick={() => toggleExpand(doc.applicationId)}
                                        className="w-full px-7 py-4 flex items-center justify-between text-left hover:bg-surface transition-colors">
                                        <span className="text-sm font-semibold text-ink">Детали документов</span>
                                        <ChevronDown className={`size-4 text-muted-ink transition-transform ${expandedId === doc.applicationId ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedId === doc.applicationId && (
                                      <div className="px-7 pb-7">
                                        <div className="mt-7 flex flex-col gap-5">
                                            {detailLoading === doc.applicationId ? (
                                                <p className="text-xs text-muted-ink">Загружаем…</p>
                                            ) : (
                                                DOCUMENT_TYPES.map(type => {
                                                    const values = detail?.find(d => d.type === type)?.values ?? []
                                                    const fields = DOCUMENT_FIELD_CONFIG[type]
                                                    const isReview = type === 'REVIEW'

                                                    return (
                                                        <div key={type} className="border border-border-soft rounded-xl overflow-hidden flex flex-col">
                                                            <div className="px-4 pt-4 pb-3 flex flex-col gap-2 border-b border-border-soft">
                                                                <span className="font-bold text-lg text-ink">{DOCUMENT_TYPE_LABELS[type]}</span>
                                                                {isReview && (
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="text-xs text-muted-ink">Необходимо заполнить:</span>
                                                                        {fields.filter(field => field.owner === 'ADMIN').map(field => {
                                                                            const rawValue = values.find(v => v.key === field.key)?.value ?? ''
                                                                            const filled = Boolean((reviewDrafts[reviewKey(doc.applicationId, field.key)] ?? rawValue).trim())
                                                                            return (
                                                                                <span key={field.key}
                                                                                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors
                                                                                        ${filled ? 'bg-success-bg border-success-border text-success' : 'bg-white border-border-soft text-muted-ink'}`}>
                                                                                    {field.label}
                                                                                </span>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="px-4 pt-3 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {fields.map(field => {
                                                                    const value = values.find(v => v.key === field.key)?.value ?? ''
                                                                    const key = reviewKey(doc.applicationId, field.key)
                                                                    if (isReview && field.owner === 'ADMIN') {
                                                                        return (
                                                                            <div key={field.key} className={`flex flex-col gap-1.5 ${field.multiline ? 'sm:col-span-2' : ''}`}>
                                                                                <label htmlFor={key} className="text-xs font-medium text-muted-ink flex items-center gap-2">
                                                                                    {field.label}
                                                                                    {savingKey === key && <span className="text-[10px] text-muted-ink">сохраняем…</span>}
                                                                                </label>
                                                                                {field.multiline ? (
                                                                                    <textarea id={key} rows={2} className="w-full text-sm rounded-lg"
                                                                                        value={reviewDrafts[key] ?? value}
                                                                                        onChange={e => setReviewDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                                                                                        onBlur={() => handleReviewFieldBlur(doc.applicationId, field.key)} />
                                                                                ) : (
                                                                                    <input id={key} type="text" className="w-full text-sm rounded-lg"
                                                                                        value={reviewDrafts[key] ?? value}
                                                                                        onChange={e => setReviewDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                                                                                        onBlur={() => handleReviewFieldBlur(doc.applicationId, field.key)} />
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    }
                                                                    return (
                                                                        <div key={field.key} className={`flex flex-col gap-1.5 ${field.multiline ? 'sm:col-span-2' : ''}`}>
                                                                            <span className="text-xs font-medium text-muted-ink flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                                                                {field.label}
                                                                                <span className="self-start text-[10px] font-medium text-muted-ink bg-surface border border-border-soft rounded-full px-2 py-0.5">
                                                                                    заполняет студент
                                                                                </span>
                                                                            </span>
                                                                            <p className="rounded-lg border border-border-soft bg-surface px-4 py-[18px] max-h-[220px] overflow-y-auto text-sm text-ink whitespace-pre-wrap">
                                                                                {value || <span className="text-faint-ink italic">Пока не заполнено</span>}
                                                                            </p>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                            </div>
                        )
                        })
                    })()}
                </div>
            )}

            {rejectingReportId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
                    role="dialog" aria-modal="true" aria-label="Отклонение отчёта" {...rejectReportModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h3 className="font-extrabold text-2xl text-ink tracking-tight mb-3">Отклонить отчёт?</h3>
                        <p className="text-sm text-muted-ink">Студент увидит причину и сможет заменить отчёт после доработки.</p>

                        <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-ink">
                            Причина отклонения
                            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={4} maxLength={2000}
                                className="w-full text-sm rounded-xl" placeholder="Опишите причину отклонения..." />
                        </label>
                        {rejectionReasonError && (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-danger">
                                <TriangleAlert className="size-3.5 flex-shrink-0" />{rejectionReasonError}
                            </p>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="ghost" onClick={() => setRejectingReportId(null)} disabled={reportActionId === rejectingReportId}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm text-muted-ink hover:bg-surface hover:text-ink">
                                Отмена
                            </Button>
                            <Button variant="danger" disabled={reportActionId === rejectingReportId} onClick={confirmReportRejection}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                {reportActionId === rejectingReportId ? 'Отклоняем…' : 'Отклонить'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
