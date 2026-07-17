'use client'

import { useEffect, useRef, useState } from 'react'
import {
    createCohort,
    deleteCohort,
    getCohort,
    saveCohortDraft,
    updateTrackTestTask,
    uploadTestTaskFile,
    type Cohort,
    type CohortStatus,
    type Track,
    type Question,
    type TestTask,
} from '@/services/api/cohorts'
import { useCohortWorkspace } from '../cohort-context'
import { describeApiErrors } from '@/lib/api/error-messages'
import { downloadProtectedFile } from '@/lib/api/download'

type EditTab = 'general' | 'tracks' | 'survey' | 'invitation'

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

const STATUS_LABELS: Record<CohortStatus, string> = {
    draft: 'Черновик',
    active: 'Активна',
    closed: 'Закрыта',
}

const STATUS_STYLES: Record<CohortStatus, string> = {
    draft: 'bg-[#F5F4FD] border-[#E4E2F4] text-[#6B6880]',
    active: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]',
    closed: 'bg-[#FFF5F5] border-[#F0BABA] text-[#C93B3B]',
}

const QUESTION_TYPES = [
    { value: 'text', label: 'Текст (строка)' },
    { value: 'textarea', label: 'Текст (абзац)' },
    { value: 'select', label: 'Выпадающий список' },
    { value: 'radio', label: 'Один из вариантов' },
    { value: 'checkbox', label: 'Несколько вариантов' },
]

function toDateInput(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function uid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

function normalizeTrackTitle(title: string): string {
    return title.trim().toLocaleLowerCase('ru-RU')
}

function getDuplicateTrackTitle(tracks: Track[]): string | null {
    const seen = new Set<string>()
    for (const track of tracks) {
        const normalizedTitle = normalizeTrackTitle(track.title)
        if (!normalizedTitle || seen.has(normalizedTitle)) return track.title.trim() || 'Без названия'
        seen.add(normalizedTitle)
    }
    return null
}

export default function AdminCohortsPage() {
    const { cohorts, cohortsLoading, cohortsError, refetchCohorts, selectedCohortId, setSelectedCohortId } = useCohortWorkspace()

    const EMPTY_NEW_COHORT = { title: '', application_start: '', application_end: '', start_date: '', end_date: '' }

    // Создание когорты
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [createErrors, setCreateErrors] = useState<string[]>([])
    const [newCohort, setNewCohort] = useState(EMPTY_NEW_COHORT)
    const [deletingCohortId, setDeletingCohortId] = useState<string | null>(null)
    const [deleteErrors, setDeleteErrors] = useState<string[]>([])
    const [cohortToDelete, setCohortToDelete] = useState<Cohort | null>(null)

    function openCreateModal() {
        setNewCohort(EMPTY_NEW_COHORT)
        setCreateErrors([])
        setShowCreateModal(true)
    }

    function closeCreateModal() {
        setShowCreateModal(false)
        setNewCohort(EMPTY_NEW_COHORT)
        setCreateErrors([])
    }

    const createModalOverlay = useOverlayClose(closeCreateModal)
    const editModalOverlay = useOverlayClose(() => closeEdit())
    const deleteModalOverlay = useOverlayClose(() => closeDeleteModal())

    // ── Редактирование: локальный черновик ────────────────────────
    // Все правки в модалке применяются только к editDraft. Ничего не
    // улетает на "сервер" (моки), пока не нажата кнопка "Сохранить".
    const [editDraft, setEditDraft] = useState<Cohort | null>(null)
    const [editTab, setEditTab] = useState<EditTab>('general')
    const [editSaving, setEditSaving] = useState(false)
    const [editErrors, setEditErrors] = useState<string[]>([])
    const [newTrackTitle, setNewTrackTitle] = useState('')
    const [newTrackError, setNewTrackError] = useState('')
    const [trackTitleErrors, setTrackTitleErrors] = useState<Record<string, string>>({})

    // Пока открыта любая модалка — блокируем скролл страницы позади неё,
    // иначе движение мыши за пределы модалки листает фон.
    useEffect(() => {
        if (showCreateModal || editDraft || cohortToDelete) {
            const previousOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = previousOverflow }
        }
    }, [showCreateModal, editDraft, cohortToDelete])

    // ── Создание когорты (отдельная модалка, без изменений) ───────
    function isCreateFormComplete() {
        return Boolean(
            newCohort.title.trim() &&
            newCohort.application_start &&
            newCohort.application_end &&
            newCohort.start_date &&
            newCohort.end_date
        )
    }

    async function handleCreateCohort() {
        if (!isCreateFormComplete()) {
            setCreateErrors(['Заполни название и все 4 даты'])
            return
        }
        setCreateLoading(true)
        setCreateErrors([])
        try {
            await createCohort({
                title: newCohort.title,
                application_start: newCohort.application_start,
                application_end: newCohort.application_end,
                start_date: newCohort.start_date,
                end_date: newCohort.end_date,
            })
            await refetchCohorts()
            closeCreateModal()
        } catch (err: unknown) {
            setCreateErrors(describeApiErrors(err, 'Ошибка создания когорты'))
        } finally {
            setCreateLoading(false)
        }
    }

    function openDeleteModal(cohort: Cohort) {
        if (cohort.status !== 'draft') return
        setDeleteErrors([])
        setCohortToDelete(cohort)
    }

    function closeDeleteModal() {
        if (!deletingCohortId) setCohortToDelete(null)
    }

    async function handleDeleteCohort() {
        if (!cohortToDelete) return
        const cohort = cohortToDelete

        setDeletingCohortId(cohort.id)
        setDeleteErrors([])
        try {
            await deleteCohort(cohort.id)
            if (editDraft?.id === cohort.id) closeEdit()
            await refetchCohorts()
            setCohortToDelete(null)
        } catch (err: unknown) {
            setDeleteErrors(describeApiErrors(err, 'Не удалось удалить когорту'))
        } finally {
            setDeletingCohortId(null)
        }
    }

    // ── Открыть/закрыть редактирование ─────────────────────────────
    function openEdit(cohort: Cohort) {
        // Глубокая копия — правки идут в черновик, исходная когорта в
        // списке не трогается, пока не нажата "Сохранить"
        setEditDraft(JSON.parse(JSON.stringify(cohort)))
        setEditTab('general')
        setEditErrors([])
        setNewTrackTitle('')
        setNewTrackError('')
        setTrackTitleErrors({})
    }

    function closeEdit() {
        // Черновик просто выбрасывается — все несохранённые правки исчезают
        setEditDraft(null)
        setEditErrors([])
        setNewTrackError('')
        setTrackTitleErrors({})
    }

    function patchDraft(patch: Partial<Cohort>) {
        setEditDraft(prev => (prev ? { ...prev, ...patch } : prev))
    }

    // saveCohortDraft применяет изменения по шагам (трек/вопрос/статус/
    // приглашение отдельными запросами) — если один шаг упал посреди
    // сохранения, предыдущие шаги уже применились на сервере, но черновик в
    // модалке всё ещё думает, что это "новые" (локальные id) записи. Без
    // пересинхронизации повторное «Сохранить» пыталось бы создать их ещё раз
    // и падало с "уже существует". При этом НЕЛЬЗЯ просто заменить весь
    // черновик на свежие данные с сервера — так теряются все несохранённые
    // правки (например, вопрос анкеты, который как раз и не смог сохраниться
    // из-за ошибки валидации). Поэтому патчим только id уже реально созданных
    // на сервере треков/анкеты/вопросов (сопоставляя по названию/тексту), не
    // трогая остальную структуру локального черновика.
    function reconcileDraftIds(local: Cohort, fresh: Cohort): Cohort {
        const freshTrackIds = new Set(fresh.tracks.map(t => t.id))
        const usedFreshTrackIds = new Set<string>()
        const tracks = local.tracks.map(track => {
            if (freshTrackIds.has(track.id)) return track
            const match = fresh.tracks.find(t => t.title === track.title && !usedFreshTrackIds.has(t.id))
            if (!match) return track
            usedFreshTrackIds.add(match.id)
            return { ...track, id: match.id }
        })

        let survey = local.survey
        if (survey && fresh.survey) {
            const surveyId = survey.id === fresh.survey.id ? survey.id : fresh.survey.id
            const freshQuestionIds = new Set(fresh.survey.questions.map(q => q.id))
            const usedFreshQuestionIds = new Set<string>()
            const questions = survey.questions.map(question => {
                if (freshQuestionIds.has(question.id)) return question
                const match = fresh.survey!.questions.find(q => q.label === question.label && !usedFreshQuestionIds.has(q.id))
                if (!match) return question
                usedFreshQuestionIds.add(match.id)
                return { ...question, id: match.id }
            })
            survey = { ...survey, id: surveyId, questions }
        }

        return { ...local, tracks, survey }
    }

    async function handleSaveEdit() {
        if (!editDraft) return
        const duplicateTitle = getDuplicateTrackTitle(editDraft.tracks)
        if (duplicateTitle) {
            const duplicateTrack = editDraft.tracks.find((track, index, tracks) =>
                tracks.slice(0, index).some(existing => normalizeTrackTitle(existing.title) === normalizeTrackTitle(track.title))
            )
            setEditTab('tracks')
            if (duplicateTrack) {
                setTrackTitleErrors(previous => ({
                    ...previous,
                    [duplicateTrack.id]: `Трек «${duplicateTitle}» уже есть в этой когорте.`,
                }))
            }
            return
        }
        setEditSaving(true)
        setEditErrors([])
        try {
            await saveCohortDraft(editDraft.id, editDraft)
            await refetchCohorts()
            setEditDraft(null)
        } catch (err: unknown) {
            setEditErrors(describeApiErrors(err, 'Не удалось сохранить изменения'))
            try {
                const fresh = await getCohort(editDraft.id)
                await refetchCohorts()
                setEditDraft(prev => (prev ? reconcileDraftIds(prev, fresh) : prev))
            } catch {
                // Не удалось обновить черновик — оставляем как есть, пользователь
                // увидит ошибку сохранения и может закрыть/переоткрыть модалку сам.
            }
        } finally {
            setEditSaving(false)
        }
    }

    // ── Статус (теперь тоже часть черновика) ───────────────────────
    // Backend поддерживает переходы строго в одну сторону: Черновик → Активна →
    // Закрыта. Вернуться в «Черновик» нельзя никогда — ни из «Активна», ни из
    // «Закрыта» — поэтому такой переход не должен быть доступен в UI вообще.
    function canSetStatus(current: CohortStatus, target: CohortStatus): boolean {
        if (target === current) return true
        if (target === 'draft') return false
        if (current === 'draft') return target === 'active'
        if (current === 'active') return target === 'closed'
        return false
    }

    function handleStatusChange(status: CohortStatus) {
        if (!editDraft || !canSetStatus(editDraft.status, status)) return
        patchDraft({ status })
    }

    // ── Треки (локально, без сети) ─────────────────────────────────
    function addTrack() {
        if (!newTrackTitle.trim() || !editDraft) return
        const title = newTrackTitle.trim()
        if (editDraft.tracks.some(track => normalizeTrackTitle(track.title) === normalizeTrackTitle(title))) {
            setNewTrackError(`Трек «${title}» уже есть в этой когорте.`)
            return
        }
        const track: Track = { id: uid(), title, testTask: null }
        patchDraft({ tracks: [...editDraft.tracks, track] })
        setNewTrackTitle('')
        setNewTrackError('')
    }

    function removeTrack(trackId: string) {
        if (!editDraft) return
        const tracks = editDraft.tracks.filter(t => t.id !== trackId)
        patchDraft({ tracks })
        setTrackTitleErrors(previous => {
            const next = { ...previous }
            delete next[trackId]
            return next
        })
    }

    function updateTrackTitle(trackId: string, title: string) {
        if (!editDraft) return
        const tracks = editDraft.tracks.map(t => t.id === trackId ? { ...t, title } : t)
        patchDraft({ tracks })
        const duplicate = tracks.some(track =>
            track.id !== trackId && normalizeTrackTitle(track.title) === normalizeTrackTitle(title)
        )
        setTrackTitleErrors(previous => {
            const next = { ...previous }
            if (duplicate) next[trackId] = `Трек «${title.trim()}» уже есть в этой когорте.`
            else delete next[trackId]
            return next
        })
    }

    function saveTrackTestTask(trackId: string, patch: Partial<NonNullable<Track['testTask']>>) {
        if (!editDraft) return
        patchDraft({
            tracks: editDraft.tracks.map(t => {
                if (t.id !== trackId) return t
                const current = t.testTask ?? { title: '', description: '', hasFile: false, downloadPath: null, publishedAt: null }
                return { ...t, testTask: { ...current, ...patch } }
            }),
        })
    }

    // Backend поддерживает только одностороннюю публикацию (POST .../publish
    // кидает "already published", если уже опубликовано) — ручки "снять с
    // публикации" не существует вообще, поэтому кнопка тоже должна быть
    // односторонней, а не тоглом.
    function publishTrack(trackId: string) {
        if (!editDraft) return
        patchDraft({
            tracks: editDraft.tracks.map(t => {
                if (t.id !== trackId || !t.testTask || t.testTask.publishedAt) return t
                return { ...t, testTask: { ...t.testTask, publishedAt: new Date().toISOString() } }
            }),
        })
    }

    // ── Анкета / вопросы (локально) ────────────────────────────────
    function ensureSurvey() {
        if (editDraft?.survey) return editDraft.survey
        const survey = { id: uid(), title: 'Анкета', questions: [] as Question[] }
        patchDraft({ survey })
        return survey
    }

    function addQuestion() {
        const survey = ensureSurvey()
        const q: Question = {
            id: uid(),
            label: '',
            type: 'text',
            required: false,
            options: [],
            order_index: survey.questions.length + 1,
        }
        patchDraft({ survey: { ...survey, questions: [...survey.questions, q] } })
    }

    function saveQuestion(questionId: string, patch: Partial<Question>) {
        if (!editDraft?.survey) return
        patchDraft({
            survey: {
                ...editDraft.survey,
                questions: editDraft.survey.questions.map(q => q.id === questionId ? { ...q, ...patch } : q),
            },
        })
    }

    function removeQuestion(questionId: string) {
        if (!editDraft?.survey) return
        patchDraft({
            survey: { ...editDraft.survey, questions: editDraft.survey.questions.filter(q => q.id !== questionId) },
        })
    }

    // ── Приглашение (локально) ─────────────────────────────────────
    function getInvitationUrl(token: string) {
        if (typeof window === 'undefined') return ''
        return `${window.location.origin}/apply/${token}`
    }

    function copyInvitation(token: string) {
        navigator.clipboard.writeText(getInvitationUrl(token))
    }

    function createDraftInvitation() {
        patchDraft({ invitation: { token: uid().slice(0, 8), expiresAt: null } })
    }

    function regenerateDraftInvitation() {
        patchDraft({ invitation: { token: uid().slice(0, 8), expiresAt: null } })
    }

    // [FIX] Раньше ссылку нельзя было убрать после создания — только
    // перегенерировать. Добавлена возможность удалить её полностью.
    function deleteDraftInvitation() {
        patchDraft({ invitation: null })
    }

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Когорты</h1>
                        <p className="text-sm text-[#6B6880]">Управление потоками практики. Удалить можно только когорту в статусе «Черновик».</p>
                    </div>
                    <button onClick={openCreateModal}
                        className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl shadow-md"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                        + Создать когорту
                    </button>
                </div>

                {cohortsLoading && (
                    <div className="flex items-center gap-2 text-sm text-[#6B6880]">
                        <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                        Загружаем когорты…
                    </div>
                )}

                {cohortsError && (
                    <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                        <p className="text-sm text-[#C93B3B]">⚠️ {cohortsError}</p>
                    </div>
                )}

                {deleteErrors.length > 0 && (
                    <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-5 py-4">
                        {deleteErrors.map(message => (
                            <p key={message} className="text-sm text-[#C93B3B]">⚠️ {message}</p>
                        ))}
                    </div>
                )}

                {!cohortsLoading && !cohortsError && cohorts.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                        <div className="text-4xl mb-4">🗂️</div>
                        <p className="font-semibold text-[#1C1A3A] mb-1">Когорт пока нет</p>
                        <p className="text-sm text-[#6B6880]">Создайте первый поток практики</p>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {cohorts.map(cohort => {
                        const isWorking = cohort.id === selectedCohortId
                        return (
                        <div key={cohort.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isWorking ? 'ring-2 ring-[#6C63FF]' : ''}`}>
                            <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h2 className="font-bold text-lg text-[#1C1A3A]">{cohort.title}</h2>
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[cohort.status]}`}>
                                        {STATUS_LABELS[cohort.status]}
                                    </span>
                                    {isWorking && (
                                        <span className="text-xs font-semibold px-3 py-1 rounded-full border border-[#6C63FF] text-[#4A42D4] bg-[#EBE9FF]">
                                            ⭐ Рабочая когорта
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isWorking && (
                                        <button onClick={() => setSelectedCohortId(cohort.id)}
                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#E4E2F4] text-[#6B6880] hover:bg-[#F5F4FD] transition-all">
                                            Сделать рабочей
                                        </button>
                                    )}
                                    <button onClick={() => openEdit(cohort)}
                                        className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#6C63FF] text-[#4A42D4] hover:bg-[#EBE9FF] transition-all inline-flex items-center gap-1.5">
                                        <span className="text-sm leading-none">✎</span> Редактировать
                                    </button>
                                    {cohort.status === 'draft' && (
                                        <button
                                            type="button"
                                            onClick={() => openDeleteModal(cohort)}
                                            disabled={deletingCohortId === cohort.id}
                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#F0BABA] text-[#C93B3B] hover:bg-[#FFF5F5] transition-all disabled:opacity-50">
                                            {deletingCohortId === cohort.id ? 'Удаляем…' : 'Удалить'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 divide-x divide-[#E4E2F4]">
                                {[
                                    { label: 'Начало практики', value: new Date(cohort.start_date).toLocaleDateString('ru') },
                                    { label: 'Конец практики', value: new Date(cohort.end_date).toLocaleDateString('ru') },
                                ].map((item, i) => (
                                    <div key={i} className="px-6 py-4 flex flex-col gap-1">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880]">{item.label}</span>
                                        <span className="text-sm font-semibold text-[#1C1A3A]">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            {cohort.tracks.length > 0 && (
                                <div className="px-7 py-4 flex items-center gap-2 flex-wrap border-t border-[#E4E2F4]">
                                    <span className="text-xs text-[#6B6880] font-medium mr-1">Треки:</span>
                                    {cohort.tracks.map(track => (
                                        <span key={track.id} className="text-xs font-medium px-3 py-1 bg-[#F5F4FD] border border-[#E4E2F4] rounded-full text-[#6B6880] inline-flex items-center gap-1.5">
                                            {track.title}
                                            {track.testTask?.publishedAt && (
                                                <span className="text-[#1A7A5A] text-[10px]">· ТЗ ✓</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {cohort.invitation && (
                                <div className="px-7 py-3 border-t border-[#E4E2F4] flex items-center gap-3 bg-[#F5F4FD]">
                                    <span className="text-xs text-[#6B6880]">🔗 Ссылка для кандидатов:</span>
                                    <code className="text-xs text-[#4A42D4] flex-1 truncate">/apply/{cohort.invitation.token}</code>
                                    <button onClick={() => copyInvitation(cohort.invitation!.token)}
                                        className="text-xs font-semibold text-[#4A42D4] hover:underline shrink-0">
                                        Копировать
                                    </button>
                                    {cohort.status !== 'active' && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF8ED] border border-[#F5D9A0] text-[#7A5C1A] shrink-0">
                                            заработает после активации
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        )
                    })}
                </div>
            </div>

            {cohortToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    {...deleteModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-[#FFF5F5] flex items-center justify-center text-2xl mb-5">🗑️</div>
                        <h3 className="font-bold text-xl text-[#1C1A3A] mb-2">Удалить когорту?</h3>
                        <p className="text-sm text-[#6B6880] leading-relaxed mb-3">
                            Когорта «{cohortToDelete.title}» будет удалена безвозвратно.
                        </p>
                        <p className="text-sm text-[#6B6880] leading-relaxed">
                            Вместе с ней удалятся треки, анкета, приглашение и другие черновые настройки.
                        </p>
                        <div className="mt-7 flex justify-end gap-3">
                            <button type="button" onClick={closeDeleteModal} disabled={Boolean(deletingCohortId)}
                                className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl disabled:opacity-50">
                                Отмена
                            </button>
                            <button type="button" onClick={handleDeleteCohort} disabled={Boolean(deletingCohortId)}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#C93B3B] hover:bg-[#B72F2F] rounded-xl shadow-sm disabled:opacity-50">
                                {deletingCohortId ? 'Удаляем…' : 'Удалить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── МОДАЛКА: СОЗДАТЬ КОГОРТУ ── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    {...createModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg mx-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-[#1C1A3A]">Новая когорта</h3>
                            <button onClick={closeCreateModal}
                                className="text-[#6B6880] hover:text-[#1C1A3A] text-2xl leading-none">×</button>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Название потока <span className="text-[#4A42D4]">*</span></label>
                                <input type="text" placeholder="Практика 2027" required
                                    value={newCohort.title}
                                    onChange={e => setNewCohort(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full text-sm" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Начало приёма заявок <span className="text-[#4A42D4]">*</span></label>
                                    <input type="date" required value={newCohort.application_start}
                                        onChange={e => setNewCohort(prev => ({ ...prev, application_start: e.target.value }))}
                                        className="w-full text-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Конец приёма заявок <span className="text-[#4A42D4]">*</span></label>
                                    <input type="date" required value={newCohort.application_end}
                                        onChange={e => setNewCohort(prev => ({ ...prev, application_end: e.target.value }))}
                                        className="w-full text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Начало практики <span className="text-[#4A42D4]">*</span></label>
                                    <input type="date" required value={newCohort.start_date}
                                        onChange={e => setNewCohort(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full text-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Конец практики <span className="text-[#4A42D4]">*</span></label>
                                    <input type="date" required value={newCohort.end_date}
                                        onChange={e => setNewCohort(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="w-full text-sm" />
                                </div>
                            </div>

                            <div className="bg-[#EBE9FF] border border-[#C4BEFF] rounded-xl px-4 py-3">
                                <p className="text-xs text-[#4A42D4]">
                                    💡 После создания когорта будет в статусе «Черновик». Треки, анкету и тестовое задание
                                    можно добавить через кнопку «Редактировать».
                                </p>
                            </div>

                            {createErrors.map((message, i) => (
                                <div key={i} className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                    <p className="text-sm text-[#C93B3B]">⚠️ {message}</p>
                                </div>
                            ))}

                            <div className="flex justify-end gap-3 mt-2">
                                <button onClick={closeCreateModal}
                                    className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl">
                                    Отмена
                                </button>
                                <button disabled={createLoading || !isCreateFormComplete()} onClick={handleCreateCohort}
                                    className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                    {createLoading ? 'Создаём…' : 'Создать'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── МОДАЛКА: РЕДАКТИРОВАТЬ КОГОРТУ (черновик) ── */}
            {editDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    {...editModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>

                        {/* Шапка */}
                        <div className="px-8 pt-7 pb-5 border-b border-[#E4E2F4] shrink-0">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-xl text-[#1C1A3A]">{editDraft.title}</h3>
                                    <p className="text-sm text-[#6B6880] mt-0.5">Редактирование потока практики</p>
                                </div>
                                <button onClick={closeEdit} className="text-[#6B6880] hover:text-[#1C1A3A] text-2xl leading-none">×</button>
                            </div>

                            <div className="flex gap-1">
                                {([
                                    { id: 'general', label: '⚙️ Основное' },
                                    { id: 'tracks', label: '🛤 Треки' },
                                    { id: 'survey', label: '📝 Анкета' },
                                    { id: 'invitation', label: '🔗 Приглашение' },
                                ] as const).map(t => (
                                    <button key={t.id} onClick={() => setEditTab(t.id)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all
                                            ${editTab === t.id ? 'bg-[#EBE9FF] text-[#4A42D4]' : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 bg-[#F5F4FD] border border-[#E4E2F4] rounded-xl px-4 py-2.5">
                                <p className="text-xs text-[#6B6880]">
                                    Изменения на этой вкладке применятся только после нажатия «Сохранить» внизу окна.
                                </p>
                            </div>
                        </div>

                        {/* Контент таба */}
                        <div className="flex-1 overflow-y-auto px-8 py-6">

                            {/* ── ОСНОВНОЕ ── */}
                            {editTab === 'general' && (
                                <div className="flex flex-col gap-5">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-[#1C1A3A]">Статус когорты</label>
                                        <div className="flex gap-2">
                                            {(['draft', 'active', 'closed'] as CohortStatus[]).map(s => {
                                                const allowed = canSetStatus(editDraft.status, s)
                                                return (
                                                    <button key={s} disabled={!allowed} onClick={() => handleStatusChange(s)}
                                                        title={!allowed ? 'Такой переход статуса недоступен' : undefined}
                                                        className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all
                                                            ${editDraft.status === s
                                                                ? STATUS_STYLES[s] + ' border-current'
                                                                : allowed
                                                                    ? 'text-[#6B6880] border-[#E4E2F4] hover:bg-[#F5F4FD]'
                                                                    : 'text-[#C7C5D6] border-[#E4E2F4] opacity-50 cursor-not-allowed'}`}>
                                                        {STATUS_LABELS[s]}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <p className="text-xs text-[#6B6880]">
                                            Черновик — невидим для кандидатов · Активна — принимаются заявки · Закрыта — только архив.
                                            Вернуть закрытую или активную когорту в черновик нельзя — переходы статуса односторонние.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-[#1C1A3A]">Название потока</label>
                                        <input type="text" value={editDraft.title}
                                            onChange={e => patchDraft({ title: e.target.value })}
                                            className="w-full text-sm" />
                                    </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Начало приёма заявок</label>
                                    <input type="date" value={toDateInput(editDraft.application_start ?? '')}
                                        onChange={e => patchDraft({ application_start: e.target.value })}
                                        className="w-full text-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Конец приёма заявок</label>
                                    <input type="date" value={toDateInput(editDraft.application_end ?? '')}
                                        onChange={e => patchDraft({ application_end: e.target.value })}
                                        className="w-full text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-medium text-[#1C1A3A]">Начало практики</label>
                                            <input type="date" value={toDateInput(editDraft.start_date)}
                                                onChange={e => patchDraft({ start_date: e.target.value })}
                                                className="w-full text-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-medium text-[#1C1A3A]">Конец практики</label>
                                            <input type="date" value={toDateInput(editDraft.end_date)}
                                                onChange={e => patchDraft({ end_date: e.target.value })}
                                                className="w-full text-sm" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── ТРЕКИ ── */}
                            {editTab === 'tracks' && (
                                <div className="flex flex-col gap-5">
                                    <p className="text-sm text-[#6B6880]">
                                        У каждого трека — своё тестовое задание. Кандидат выбирает трек при заполнении анкеты.
                                    </p>

                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Название трека, напр. Backend"
                                            value={newTrackTitle}
                                            onChange={e => setNewTrackTitle(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addTrack()}
                                            className="flex-1 text-sm" />
                                        <button onClick={addTrack}
                                            className="px-4 py-2 text-sm font-semibold text-white rounded-lg"
                                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                            + Трек
                                        </button>
                                    </div>

                                    {newTrackError && (
                                        <p className="text-xs text-[#C93B3B]">⚠️ {newTrackError}</p>
                                    )}

                                    {editDraft.tracks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-[#E4E2F4] px-4 py-8 text-center">
                                            <p className="text-sm text-[#6B6880]">Треков пока нет. Добавьте первое направление.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {editDraft.tracks.map(track => (
                                                <TrackEditor
                                                    key={track.id}
                                                    cohortId={editDraft.id}
                                                    track={track}
                                                    titleError={trackTitleErrors[track.id]}
                                                    onRemove={() => removeTrack(track.id)}
                                                    onTitleChange={title => updateTrackTitle(track.id, title)}
                                                    onSaveTestTask={patch => saveTrackTestTask(track.id, patch)}
                                                    onPublish={() => publishTrack(track.id)}
                                                    onFileUploaded={task => saveTrackTestTask(track.id, task)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── АНКЕТА ── */}
                            {editTab === 'survey' && (
                                <div className="flex flex-col gap-5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-[#6B6880]">Вопросы публичной анкеты когорты.</p>
                                        <button onClick={addQuestion}
                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#6C63FF] text-[#4A42D4] hover:bg-[#EBE9FF] transition-all whitespace-nowrap">
                                            + Вопрос
                                        </button>
                                    </div>

                                    {(!editDraft.survey || editDraft.survey.questions.length === 0) ? (
                                        <div className="rounded-xl border border-dashed border-[#E4E2F4] px-4 py-8 text-center">
                                            <p className="text-sm text-[#6B6880]">Вопросов пока нет. Добавьте первый.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {editDraft.survey.questions.map((q, idx) => (
                                                <QuestionEditor
                                                    key={q.id}
                                                    question={q}
                                                    index={idx}
                                                    onSave={patch => saveQuestion(q.id, patch)}
                                                    onRemove={() => removeQuestion(q.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ПРИГЛАШЕНИЕ ── */}
                            {editTab === 'invitation' && (
                                <div className="flex flex-col gap-5">
                                    <p className="text-sm text-[#6B6880]">
                                        Общая ссылка-приглашение для кандидатов. Не персональная — кто угодно с этой ссылкой может подать заявку.
                                    </p>

                                    {editDraft.invitation ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-[#1C1A3A]">Ссылка для кандидатов</label>
                                                <div className="flex gap-2">
                                                    <input type="text" readOnly
                                                        value={getInvitationUrl(editDraft.invitation.token)}
                                                        className="flex-1 text-sm font-mono bg-[#F5F4FD]" />
                                                    <button onClick={() => copyInvitation(editDraft.invitation!.token)}
                                                        className="px-4 py-2 text-sm font-semibold border border-[#6C63FF] text-[#4A42D4] rounded-lg hover:bg-[#EBE9FF] shrink-0">
                                                        Копировать
                                                    </button>
                                                </div>
                                                <span className="text-xs text-[#6B6880]">Появится по этому адресу только после сохранения.</span>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={regenerateDraftInvitation}
                                                    className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#E4E2F4] text-[#6B6880] hover:bg-[#F5F4FD] transition-all">
                                                    🔄 Перегенерировать токен
                                                </button>
                                                <button onClick={deleteDraftInvitation}
                                                    className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#F0BABA] text-[#C93B3B] hover:bg-[#FFF5F5] transition-all">
                                                    🗑 Удалить ссылку
                                                </button>
                                            </div>
                                            <div className="bg-[#FFF8ED] border-l-4 border-[#F59E0B] rounded-xl px-4 py-3">
                                                <p className="text-xs text-[#7A5C1A]">
                                                    ⚠️ После сохранения с новым токеном старая ссылка перестанет работать.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <div className="rounded-xl border border-dashed border-[#E4E2F4] px-4 py-8 text-center">
                                                <p className="text-sm text-[#6B6880]">Ссылка ещё не создана.</p>
                                            </div>
                                            <button onClick={createDraftInvitation}
                                                className="self-start text-sm font-semibold text-white px-5 py-2.5 rounded-xl shadow-md"
                                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                                Создать ссылку-приглашение
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {editErrors.map((message, i) => (
                                <div key={i} className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3 mt-5">
                                    <p className="text-sm text-[#C93B3B]">⚠️ {message}</p>
                                </div>
                            ))}
                        </div>

                        {/* Футер */}
                        <div className="px-8 py-5 border-t border-[#E4E2F4] flex justify-end gap-3 shrink-0">
                            <button onClick={closeEdit} disabled={editSaving}
                                className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl disabled:opacity-50">
                                Отмена
                            </button>
                            <button onClick={handleSaveEdit} disabled={editSaving}
                                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md disabled:opacity-60"
                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                {editSaving ? 'Сохраняем…' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

// ── Редактор трека (название + тестовое задание) — правки идут в draft ──
function TrackEditor({
    cohortId,
    track,
    titleError,
    onRemove,
    onTitleChange,
    onSaveTestTask,
    onPublish,
    onFileUploaded,
}: {
    cohortId: string
    track: Track
    titleError?: string
    onRemove: () => void
    onTitleChange: (title: string) => void
    onSaveTestTask: (patch: Partial<NonNullable<Track['testTask']>>) => void
    onPublish: () => void
    onFileUploaded: (task: TestTask) => void
}) {
    const [title, setTitle] = useState(track.testTask?.title ?? '')
    const [description, setDescription] = useState(track.testTask?.description ?? '')
    const [fileUploading, setFileUploading] = useState(false)
    const [fileErrors, setFileErrors] = useState<string[]>([])

    // Файл можно прикрепить только к уже существующему на сервере тестовому
    // заданию — на самом верхнем "Сохранить" когорты это создалось бы само,
    // но заставлять сохранять всю когорту только ради файла неудобно.
    // Поэтому перед загрузкой файла сначала тихо сохраняем (upsert)
    // заголовок/описание отдельным запросом — если сам ТРЕК уже существует
    // на сервере (обычный случай при редактировании уже сохранённой когорты),
    // это делает прикрепление файла одним действием без похода к общей
    // кнопке "Сохранить". Если трек тоже ещё не сохранён (только что
    // добавлен в этой сессии) — запрос упадёт с понятной подсказкой.
    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setFileErrors([])
        setFileUploading(true)
        try {
            await updateTrackTestTask(cohortId, track.id, { title: title.trim() || 'Тестовое задание', description: description.trim() })
            const updated = await uploadTestTaskFile(cohortId, track.id, file)
            setTitle(updated.title)
            setDescription(updated.description)
            onFileUploaded(updated)
        } catch (err: unknown) {
            setFileErrors(describeApiErrors(err, 'Не удалось загрузить файл'))
        } finally {
            setFileUploading(false)
        }
    }

    return (
        <div className="rounded-xl border border-[#E4E2F4] bg-[#FBFAFF] p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EBE9FF] flex items-center justify-center text-[#4A42D4] text-sm font-bold shrink-0">🛤</div>
                <input type="text" value={track.title} onChange={e => onTitleChange(e.target.value)}
                    className="flex-1 text-sm font-semibold" />
                <button onClick={onRemove} className="text-[#6B6880] hover:text-[#C93B3B] text-xl leading-none px-1">×</button>
            </div>
            {titleError && (
                <p className="pl-10 -mt-2 text-xs text-[#C93B3B]">⚠️ {titleError}</p>
            )}

            <div className="flex flex-col gap-3 pl-10">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-widest uppercase text-[#6B6880]">Тестовое задание</span>
                    {track.testTask?.publishedAt && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDFBF4] border border-[#7EE8B8] text-[#1A7A5A]">
                            Опубликовано
                        </span>
                    )}
                </div>

                <input type="text" value={title}
                    onChange={e => { setTitle(e.target.value); onSaveTestTask({ title: e.target.value }) }}
                    placeholder="Заголовок задания" className="w-full text-sm" />

                <textarea rows={3} value={description}
                    onChange={e => { setDescription(e.target.value); onSaveTestTask({ description: e.target.value }) }}
                    placeholder="Опишите задание для этого трека…"
                    className="w-full text-sm resize-none rounded-lg border border-[#E4E2F4] bg-white px-3.5 py-2.5 focus:outline-none focus:border-[#6C63FF]" />

                <div className="flex items-center gap-3">
                    <label className={`text-xs font-semibold px-4 py-1.5 rounded-lg border transition-all cursor-pointer
                        ${fileUploading ? 'opacity-50 pointer-events-none' : 'border-[#E4E2F4] text-[#6B6880] hover:bg-[#F5F4FD]'}`}>
                        {fileUploading ? 'Загружаем…' : track.testTask?.hasFile ? '🔄 Заменить файл' : '📎 Прикрепить файл'}
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.zip" onChange={handleFileSelected} disabled={fileUploading} />
                    </label>
                    {track.testTask?.hasFile && track.testTask.downloadPath && (
                        <button onClick={() => downloadProtectedFile(track.testTask!.downloadPath!, track.testTask!.title || 'Тестовое задание').catch(err => setFileErrors([err instanceof Error ? err.message : 'Не удалось скачать файл']))}
                            className="text-xs font-semibold text-[#4A42D4] hover:underline">
                            ⬇ Скачать текущий
                        </button>
                    )}
                </div>

                {fileErrors.map((message, i) => (
                    <div key={i} className="bg-[#FFF5F5] border border-[#F0BABA] rounded-lg px-3 py-2">
                        <p className="text-xs text-[#C93B3B]">⚠️ {message}</p>
                    </div>
                ))}

                {track.testTask?.publishedAt ? (
                    <span className="self-start text-xs text-[#6B6880]">
                        Опубликовано — backend не поддерживает снятие с публикации, только удаление всего задания.
                    </span>
                ) : (
                    <button onClick={onPublish} disabled={!title && !description}
                        className="self-start text-xs font-semibold px-4 py-1.5 rounded-lg border transition-all disabled:opacity-40 border-[#6C63FF] text-[#4A42D4] hover:bg-[#EBE9FF]">
                        Опубликовать
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Редактор вопроса анкеты — правки идут в draft ──────────────────
function QuestionEditor({
    question,
    index,
    onSave,
    onRemove,
}: {
    question: Question
    index: number
    onSave: (patch: Partial<Question>) => void
    onRemove: () => void
}) {
    function addOption() {
        onSave({ options: [...question.options, ''] })
    }

    function updateOption(optIndex: number, value: string) {
        const next = [...question.options]
        next[optIndex] = value
        onSave({ options: next })
    }

    function removeOption(optIndex: number) {
        onSave({ options: question.options.filter((_, i) => i !== optIndex) })
    }

    return (
        <div className="rounded-xl border border-[#E4E2F4] bg-[#FBFAFF] p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#6B6880] pt-2.5 w-6 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 flex flex-col gap-2">
                    <input type="text" value={question.label}
                        onChange={e => onSave({ label: e.target.value })}
                        placeholder="Текст вопроса" className="w-full text-sm" />
                    <div className="flex items-center gap-3">
                        <select value={question.type}
                            onChange={e => onSave({ type: e.target.value as Question['type'] })}
                            className="text-xs rounded-lg border border-[#E4E2F4] px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#6C63FF]">
                            {QUESTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-[#6B6880] cursor-pointer select-none">
                            <input type="checkbox" checked={question.required}
                                onChange={e => onSave({ required: e.target.checked })}
                                className="accent-[#6C63FF]" />
                            Обязательный
                        </label>
                    </div>

                    {['select', 'radio', 'checkbox'].includes(question.type) && (
                        <div className="flex flex-col gap-2 mt-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-[#6B6880]">Варианты ответа</label>
                                <button type="button" onClick={addOption}
                                    className="text-xs font-semibold text-[#4A42D4] hover:underline">
                                    + Вариант
                                </button>
                            </div>

                            {question.options.length === 0 && (
                                <p className="text-xs text-[#6B6880]">Вариантов пока нет — добавь первый.</p>
                            )}

                            <div className="flex flex-col gap-2">
                                {question.options.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input type="text" value={opt}
                                            onChange={e => updateOption(i, e.target.value)}
                                            placeholder={`Вариант ${i + 1}`}
                                            className="flex-1 text-sm" />
                                        <button type="button" onClick={() => removeOption(i)}
                                            className="text-[#6B6880] hover:text-[#C93B3B] text-lg leading-none px-1 shrink-0"
                                            aria-label="Удалить вариант">
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={onRemove} className="text-[#6B6880] hover:text-[#C93B3B] text-xl leading-none px-1 shrink-0">×</button>
            </div>
        </div>
    )
}
