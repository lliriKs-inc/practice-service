'use client'

import { useEffect, useRef, useState } from 'react'
import {
    createCohort,
    createInvitation,
    createTrack,
    copySurvey,
    deleteCohort,
    deleteInvitation,
    getCohort,
    regenerateInvitation,
    saveCohortDraft,
    updateTrackTestTask,
    uploadTestTaskFile,
    type Cohort,
    type CohortStatus,
    type Track,
    type Question,
    type TestTask,
} from '@/services/api/cohorts'
import { Info, Star, Route, Link as LinkIcon, ClipboardCheck, ClipboardX, Plus, Pencil, TriangleAlert, Settings, FileText, X, RotateCw, Paperclip, Download, Copy, ChevronDown, Type, Layers, Trash2, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const STATUS_DOTS: Record<CohortStatus, string> = {
    draft: 'bg-muted-ink',
    active: 'bg-success-dot',
    closed: 'bg-danger-dot',
}

const STATUS_STYLES: Record<CohortStatus, string> = {
    draft: 'bg-surface border-border-soft text-muted-ink',
    active: 'bg-success-bg border-success-border text-success',
    closed: 'bg-danger-bg border-danger-border text-danger',
}

const QUESTION_TYPES = [
    { value: 'text', label: 'Текст (строка)' },
    { value: 'textarea', label: 'Текст (абзац)' },
    { value: 'select', label: 'Выпадающий список' },
    { value: 'radio', label: 'Один из вариантов' },
    { value: 'checkbox', label: 'Несколько вариантов' },
]

const COHORT_DATE_MIN = '2000-01-01'
const COHORT_DATE_MAX = '2100-12-31'
const COHORT_DATE_ERROR = 'Укажите даты с четырёхзначным годом в диапазоне от 2000 до 2100.'

function isAllowedCohortDate(value: string | null | undefined): boolean {
    if (!value) return false
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return false
    const year = date.getUTCFullYear()
    return year >= 2000 && year <= 2100
}

function toDateInput(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    return !isAllowedCohortDate(iso) || Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function formatCohortDate(iso: string | null | undefined): string {
    if (!isAllowedCohortDate(iso)) return 'Некорректная дата'
    return new Date(iso!).toLocaleDateString('ru')
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
    const [showCopySurveyModal, setShowCopySurveyModal] = useState(false)
    const [copyTargetCohortId, setCopyTargetCohortId] = useState('')
    const [copySurveyLoading, setCopySurveyLoading] = useState(false)
    const [copySurveyErrors, setCopySurveyErrors] = useState<string[]>([])

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
    const copySurveyModalOverlay = useOverlayClose(() => closeCopySurveyModal())

    // ── Редактирование: локальный черновик ────────────────────────
    // Все правки в модалке применяются только к editDraft. Ничего не
    // улетает на "сервер" (моки), пока не нажата кнопка "Сохранить".
    const [editDraft, setEditDraft] = useState<Cohort | null>(null)
    // Статус когорты НА МОМЕНТ ОТКРЫТИЯ окна — переходы разрешаем относительно
    // него, а не относительно editDraft.status, который меняется при каждом
    // клике по кнопке статуса. Иначе после клика "Закрыта" её уже нельзя
    // вернуть обратно на "Активна" до сохранения — хотя это ещё черновик правок.
    const [originalStatus, setOriginalStatus] = useState<CohortStatus | null>(null)
    const [editTab, setEditTab] = useState<EditTab>('general')
    const [editSaving, setEditSaving] = useState(false)
    const [invitationSaving, setInvitationSaving] = useState(false)
    const [invitationSavingStage, setInvitationSavingStage] = useState<'tracks' | 'invitation' | null>(null)
    const [editErrors, setEditErrors] = useState<string[]>([])
    const [newTrackTitle, setNewTrackTitle] = useState('')
    const [newTrackError, setNewTrackError] = useState('')
    const [trackTitleErrors, setTrackTitleErrors] = useState<Record<string, string>>({})

    // Автоскролл к только что добавленному треку/вопросу, если список большой
    // и новый элемент появляется за пределами видимой области.
    const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const questionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const prevEditDraftId = useRef<string | null>(null)
    const prevTracksLen = useRef(0)
    const prevQuestionsLen = useRef(0)

    useEffect(() => {
        if (!editDraft) {
            prevEditDraftId.current = null
            return
        }
        const tracksLen = editDraft.tracks.length
        const questionsLen = editDraft.survey?.questions.length ?? 0

        // Модалка только открылась (или открыта другая когорта) — запоминаем
        // текущие длины без скролла, иначе при открытии когорты с большим
        // числом треков/вопросов страница дёргалась бы к последнему элементу.
        if (prevEditDraftId.current !== editDraft.id) {
            prevEditDraftId.current = editDraft.id
            prevTracksLen.current = tracksLen
            prevQuestionsLen.current = questionsLen
            return
        }

        if (tracksLen > prevTracksLen.current) {
            const last = editDraft.tracks[tracksLen - 1]
            trackRefs.current.get(last.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        prevTracksLen.current = tracksLen

        if (questionsLen > prevQuestionsLen.current) {
            const last = editDraft.survey!.questions[questionsLen - 1]
            questionRefs.current.get(last.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        prevQuestionsLen.current = questionsLen
    }, [editDraft])

    // Пока открыта любая модалка — блокируем скролл страницы позади неё,
    // иначе движение мыши за пределы модалки листает фон.
    useEffect(() => {
        if (showCreateModal || editDraft || cohortToDelete || showCopySurveyModal) {
            const previousOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = previousOverflow }
        }
    }, [showCreateModal, editDraft, cohortToDelete, showCopySurveyModal])

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
            setCreateErrors(['Заполните название и все 4 даты'])
            return
        }
        if (![newCohort.application_start, newCohort.application_end, newCohort.start_date, newCohort.end_date].every(isAllowedCohortDate)) {
            setCreateErrors([COHORT_DATE_ERROR])
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

    function openCopySurveyModal() {
        if (!editDraft?.survey) return
        const sourceSurvey = cohorts.find(cohort => cohort.id === editDraft.id)?.survey
        if (sourceSurvey?.id !== editDraft.survey.id) {
            setEditErrors(['Сначала сохраните анкету, затем откройте когорту снова для копирования.'])
            return
        }

        const target = cohorts.find(cohort => cohort.id !== editDraft.id && !cohort.survey)
        setCopyTargetCohortId(target?.id ?? '')
        setCopySurveyErrors([])
        setShowCopySurveyModal(true)
    }

    function closeCopySurveyModal() {
        if (!copySurveyLoading) setShowCopySurveyModal(false)
    }

    async function handleCopySurvey() {
        if (!editDraft?.survey || !copyTargetCohortId) return
        setCopySurveyLoading(true)
        setCopySurveyErrors([])
        try {
            await copySurvey(editDraft.survey.id, copyTargetCohortId)
            await refetchCohorts()
            setShowCopySurveyModal(false)
        } catch (err: unknown) {
            setCopySurveyErrors(describeApiErrors(err, 'Не удалось скопировать анкету'))
        } finally {
            setCopySurveyLoading(false)
        }
    }

    // ── Открыть/закрыть редактирование ─────────────────────────────
    function openEdit(cohort: Cohort) {
        // Глубокая копия — правки идут в черновик, исходная когорта в
        // списке не трогается, пока не нажата "Сохранить"
        setEditDraft(JSON.parse(JSON.stringify(cohort)))
        setOriginalStatus(cohort.status)
        setEditTab('general')
        setEditErrors([])
        setNewTrackTitle('')
        setNewTrackError('')
        setTrackTitleErrors({})
    }

    function closeEdit() {
        // Черновик просто выбрасывается — все несохранённые правки исчезают
        setEditDraft(null)
        setOriginalStatus(null)
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
        if (![editDraft.application_start, editDraft.application_end, editDraft.start_date, editDraft.end_date].every(isAllowedCohortDate)) {
            setEditTab('general')
            setEditErrors([COHORT_DATE_ERROR])
            return
        }
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
        if (!editDraft || !originalStatus || !canSetStatus(originalStatus, status)) return
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

    // ── Приглашение ────────────────────────────────────────────────
    function getInvitationUrl(token: string) {
        if (typeof window === 'undefined') return ''
        return `${window.location.origin}/apply/${token}`
    }

    function copyInvitation(token: string) {
        navigator.clipboard.writeText(getInvitationUrl(token))
    }

    async function createDraftInvitation() {
        if (!editDraft) return
        if (!editDraft.tracks.some(track => track.title.trim().length > 0)) {
            setEditErrors(['Сначала добавьте хотя бы один трек, затем создайте ссылку-приглашение.'])
            return
        }
        const duplicateTitle = getDuplicateTrackTitle(editDraft.tracks)
        if (duplicateTitle) {
            setEditTab('tracks')
            setEditErrors([`Трек «${duplicateTitle}» добавлен больше одного раза. Исправьте названия перед созданием ссылки.`])
            return
        }
        setInvitationSaving(true)
        setInvitationSavingStage('tracks')
        setEditErrors([])
        try {
            const persisted = await getCohort(editDraft.id)
            const persistedTrackIds = new Set(persisted.tracks.map(track => track.id))
            const createdTrackIds = new Map<string, string>()

            for (const track of editDraft.tracks) {
                if (persistedTrackIds.has(track.id) || !track.title.trim()) continue

                const created = await createTrack(editDraft.id, track.title.trim())
                createdTrackIds.set(track.id, created.id)
                persistedTrackIds.add(created.id)

                // Сразу заменяем локальный id после каждого успешного запроса.
                // Если следующий трек сохранить не удастся, повторная попытка
                // не создаст уже сохранённый трек ещё раз.
                setEditDraft(previous => previous ? {
                    ...previous,
                    tracks: previous.tracks.map(item => item.id === track.id ? { ...item, id: created.id } : item),
                } : previous)
            }

            setInvitationSavingStage('invitation')
            const invitation = await createInvitation(editDraft.id)
            setEditDraft(previous => previous ? {
                ...previous,
                invitation,
                tracks: previous.tracks.map(track => ({
                    ...track,
                    id: createdTrackIds.get(track.id) ?? track.id,
                })),
            } : previous)
            await refetchCohorts()
        } catch (err: unknown) {
            setEditErrors(describeApiErrors(err, 'Не удалось создать ссылку-приглашение'))
            try {
                const fresh = await getCohort(editDraft.id)
                setEditDraft(previous => previous ? reconcileDraftIds(previous, fresh) : previous)
                await refetchCohorts()
            } catch {
                // Основная ошибка уже показана. Локальный черновик сохраняем,
                // если дополнительная синхронизация тоже недоступна.
            }
        } finally {
            setInvitationSaving(false)
            setInvitationSavingStage(null)
        }
    }

    async function regenerateDraftInvitation() {
        if (!editDraft) return
        setInvitationSaving(true)
        setEditErrors([])
        try {
            const invitation = await regenerateInvitation(editDraft.id)
            patchDraft({ invitation })
            await refetchCohorts()
        } catch (err: unknown) {
            setEditErrors(describeApiErrors(err, 'Не удалось перегенерировать ссылку-приглашение'))
        } finally {
            setInvitationSaving(false)
        }
    }

    // [FIX] Раньше ссылку нельзя было убрать после создания — только
    // перегенерировать. Добавлена возможность удалить её полностью.
    async function deleteDraftInvitation() {
        if (!editDraft) return
        setInvitationSaving(true)
        setEditErrors([])
        try {
            await deleteInvitation(editDraft.id)
            patchDraft({ invitation: null })
            await refetchCohorts()
        } catch (err: unknown) {
            setEditErrors(describeApiErrors(err, 'Не удалось удалить ссылку-приглашение'))
        } finally {
            setInvitationSaving(false)
        }
    }

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Когорты</h1>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center size-6 rounded-full border border-border-soft text-muted-ink cursor-help flex-shrink-0"
                            title="Удалить можно только когорту в статусе «Черновик».">
                            <Info className="size-3.5" />
                        </span>
                        <Button variant="brand" onClick={openCreateModal} className="px-5 py-2.5 rounded-xl h-auto">
                            <Plus className="size-4" />Создать когорту
                        </Button>
                    </div>
                </div>

                {cohortsLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-ink">
                        <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                        Загружаем когорты…
                    </div>
                )}

                {cohortsError && (
                    <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex items-start gap-3">
                        <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-danger">{cohortsError}</p>
                    </div>
                )}

                {deleteErrors.length > 0 && (
                    <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4 flex flex-col gap-1.5">
                        {deleteErrors.map(message => (
                            <div key={message} className="flex items-start gap-3">
                                <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-danger">{message}</p>
                            </div>
                        ))}
                    </div>
                )}

                {!cohortsLoading && !cohortsError && cohorts.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-brand-subtle text-brand-hover flex items-center justify-center mb-4">
                            <FolderKanban className="size-5" />
                        </div>
                        <p className="font-semibold text-ink mb-1">Когорт пока нет</p>
                        <p className="text-sm text-muted-ink">Создайте первый поток практики</p>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {[...cohorts]
                        .sort((a, b) => {
                            const aSelected = a.id === selectedCohortId
                            const bSelected = b.id === selectedCohortId
                            return aSelected === bSelected ? 0 : aSelected ? -1 : 1
                        })
                        .map(cohort => {
                        const isWorking = cohort.id === selectedCohortId
                        return (
                        <div key={cohort.id} className={`bg-white rounded-2xl overflow-hidden ${isWorking ? 'border-t-[3px] border-brand-hover shadow-md' : 'shadow-sm'}`}>
                            <div className="px-7 py-5 border-b border-border-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
                                    <h2 className="font-extrabold text-xl text-ink tracking-tight uppercase">{cohort.title}</h2>
                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[cohort.status]}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[cohort.status]}`} />
                                            {STATUS_LABELS[cohort.status]}
                                        </span>
                                        {isWorking && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning bg-warning-bg border border-warning-border rounded-full px-2.5 py-1">
                                                <Star className="size-3.5 fill-warning-dot text-warning-dot" />Рабочая когорта
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                    {!isWorking && (
                                        <button onClick={() => setSelectedCohortId(cohort.id)}
                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle transition-colors duration-300">
                                            Сделать рабочей
                                        </button>
                                    )}
                                    <Button variant="brand" onClick={() => openEdit(cohort)} className="px-4 py-1.5 rounded-lg h-auto text-xs">
                                        <Pencil className="size-3.5" /> Редактировать
                                    </Button>
                                    {cohort.status === 'draft' && (
                                        <Button
                                            variant="danger"
                                            type="button"
                                            onClick={() => openDeleteModal(cohort)}
                                            disabled={deletingCohortId === cohort.id}
                                            className="px-4 py-1.5 rounded-lg h-auto text-xs">
                                            {deletingCohortId === cohort.id ? 'Удаляем…' : 'Удалить'}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 divide-x divide-border-soft">
                                {[
                                    {
                                        label: 'Период приёма заявок',
                                        value: cohort.application_start && cohort.application_end
                                            ? `${formatCohortDate(cohort.application_start)} — ${formatCohortDate(cohort.application_end)}`
                                            : 'Не задан',
                                    },
                                    {
                                        label: 'Период практики',
                                        value: `${formatCohortDate(cohort.start_date)} — ${formatCohortDate(cohort.end_date)}`,
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="px-6 py-4 flex flex-col gap-1">
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-ink">{item.label}</span>
                                        <span className="text-sm text-ink">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            {cohort.tracks.length > 0 && (
                                <div className="px-7 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap border-t border-border-soft">
                                    <span className="text-sm font-semibold text-ink sm:mr-1">Треки:</span>
                                    {cohort.tracks.map((track, i) => (
                                        <span key={track.id} className="flex sm:inline-flex w-full sm:w-auto min-w-0 items-center justify-start gap-1.5 text-xs font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-2.5 py-1">
                                            <span className="flex items-center justify-center size-4 rounded-full bg-brand text-white text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                                            <Route className="size-3.5 flex-shrink-0" />
                                            <span className="truncate min-w-0">{track.title}</span>
                                            <span className={`inline-flex items-center gap-1 border-l border-brand-subtle-border pl-1.5 ml-auto flex-shrink-0 ${track.testTask?.publishedAt ? 'text-success' : 'text-muted-ink'}`}
                                                title={track.testTask?.publishedAt ? 'Тестовое задание опубликовано' : 'Тестовое задание не опубликовано'}>
                                                {track.testTask?.publishedAt
                                                    ? <ClipboardCheck className="size-4" strokeWidth={2.75} />
                                                    : <ClipboardX className="size-4" strokeWidth={1.5} />}
                                                <span className={track.testTask?.publishedAt ? 'text-[11px] font-extrabold tracking-wide' : 'text-[11px] font-medium tracking-wide'}>ТЗ</span>
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {cohort.invitation && (
                                <div className="px-7 py-3 border-t border-border-soft flex items-center gap-3 bg-surface min-w-0">
                                    <LinkIcon className="size-3.5 text-muted-ink flex-shrink-0" />
                                    <span className="text-xs text-muted-ink flex-shrink-0">Ссылка для кандидатов:</span>
                                    <code className="hidden sm:block text-xs text-brand-hover flex-1 min-w-0 truncate">/apply/{cohort.invitation.token}</code>
                                    <div className="ml-auto sm:ml-0 flex items-center gap-2 flex-shrink-0">
                                        {cohort.status !== 'active' && (
                                            <span className="inline-flex items-center justify-center text-warning cursor-help flex-shrink-0"
                                                title="Кандидаты не увидят анкету, пока когорта не переведена в статус «Активна»">
                                                <TriangleAlert className="size-3.5" />
                                            </span>
                                        )}
                                        <button onClick={() => copyInvitation(cohort.invitation!.token)}
                                            className="text-xs font-semibold text-brand-hover bg-gradient-to-r from-brand-hover to-brand-hover bg-no-repeat bg-left-bottom bg-[length:0%_1px] pb-0.5 hover:bg-[length:100%_1px] transition-[background-size] duration-300 shrink-0">
                                            Копировать
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        )
                    })}
                </div>
            </div>

            {cohortToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    {...deleteModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto text-center"
                        onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-xl text-ink mb-3">Удалить когорту?</h3>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-danger bg-danger-bg border border-danger-border rounded-full px-3 py-1.5 mb-6">
                            <Trash2 className="size-4" />{cohortToDelete.title}
                        </span>
                        <p className="text-sm text-muted-ink leading-relaxed text-left">
                            Когорта будет удалена безвозвратно, вместе с ней — треки, анкета, приглашение, все
                            отклонённые заявки и связанные с ними файлы.
                        </p>
                        <div className="mt-7 flex justify-end items-center gap-5">
                            <button type="button" onClick={closeDeleteModal} disabled={Boolean(deletingCohortId)}
                                className="text-sm font-semibold text-muted-ink hover:text-ink transition-colors disabled:opacity-50">
                                Отмена
                            </button>
                            <Button variant="danger" type="button" onClick={handleDeleteCohort} disabled={Boolean(deletingCohortId)}
                                className="px-4 py-2 rounded-lg h-auto">
                                {deletingCohortId ? 'Удаляем…' : 'Удалить'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showCopySurveyModal && editDraft?.survey && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    {...copySurveyModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto text-center"
                        onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-xl text-ink mb-3">Скопировать анкету?</h3>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-hover bg-brand-subtle border border-brand-subtle-border rounded-full px-3 py-1.5 mb-6">
                            <FileText className="size-4" />{editDraft.title}
                        </span>
                        <p className="text-sm text-muted-ink leading-relaxed text-left">
                            Будут скопированы название анкеты, вопросы, их типы, обязательность и варианты ответов.
                        </p>

                        <div className="flex flex-col gap-1.5 text-left mt-5">
                            <label className="text-sm font-medium text-ink">Целевая когорта</label>
                            <div className={`relative flex items-center h-9 gap-2 pl-3 pr-8 rounded-lg border border-border-soft bg-white focus-within:border-brand
                                ${copySurveyLoading || !cohorts.some(cohort => cohort.id !== editDraft.id && !cohort.survey) ? 'opacity-50' : 'cursor-pointer'}`}>
                                <Layers className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                                <span className="text-sm font-semibold text-ink truncate pointer-events-none flex-1">
                                    {cohorts.find(c => c.id === copyTargetCohortId)?.title ?? 'Выберите когорту'}
                                </span>
                                <ChevronDown className="size-3.5 text-muted-ink absolute right-3 pointer-events-none" />
                                <select value={copyTargetCohortId} onChange={e => setCopyTargetCohortId(e.target.value)}
                                    disabled={copySurveyLoading || !cohorts.some(cohort => cohort.id !== editDraft.id && !cohort.survey)}
                                    aria-label="Выбор целевой когорты"
                                    className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                                    {cohorts.filter(cohort => cohort.id !== editDraft.id && !cohort.survey).length === 0 ? (
                                        <option value="">Нет когорт без анкеты</option>
                                    ) : (
                                        cohorts.filter(cohort => cohort.id !== editDraft.id && !cohort.survey).map(cohort => (
                                            <option key={cohort.id} value={cohort.id}>{cohort.title}</option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="mt-2 bg-surface border border-border-soft rounded-xl px-4 py-2.5 text-left">
                            <p className="text-xs text-muted-ink">
                                Скопировать можно только в когорту, у которой ещё нет собственной анкеты.
                            </p>
                        </div>
                        {copySurveyErrors.length > 0 && (
                            <div className="mt-4 bg-danger-bg border border-danger-border rounded-xl px-4 py-3 text-left flex flex-col gap-1.5">
                                {copySurveyErrors.map(message => (
                                    <div key={message} className="flex items-start gap-2">
                                        <TriangleAlert className="size-4 text-danger flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-danger">{message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-7 flex justify-end items-center gap-5">
                            <button type="button" onClick={closeCopySurveyModal} disabled={copySurveyLoading}
                                className="text-sm font-semibold text-muted-ink hover:text-ink transition-colors disabled:opacity-50">
                                Отмена
                            </button>
                            <Button type="button" variant="brand" onClick={handleCopySurvey}
                                disabled={copySurveyLoading || !copyTargetCohortId}
                                className="px-4 py-2 rounded-lg h-auto">
                                {copySurveyLoading ? 'Копируем…' : 'Скопировать'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── МОДАЛКА: СОЗДАТЬ КОГОРТУ ── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    {...createModalOverlay}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-extrabold text-2xl text-ink tracking-tight">Новая когорта</h3>
                            <button onClick={closeCreateModal}
                                className="text-muted-ink hover:text-ink text-2xl leading-none">×</button>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-ink">Название потока <span className="text-brand-hover">*</span></label>
                                <input type="text" placeholder="Практика 2027" required
                                    value={newCohort.title}
                                    onChange={e => setNewCohort(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full text-sm rounded-xl" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Начало приёма заявок <span className="text-brand-hover">*</span></label>
                                    <input type="date" required min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={newCohort.application_start}
                                        onChange={e => setNewCohort(prev => ({ ...prev, application_start: e.target.value }))}
                                        className="w-full text-sm rounded-xl" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Конец приёма заявок <span className="text-brand-hover">*</span></label>
                                    <input type="date" required min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={newCohort.application_end}
                                        onChange={e => setNewCohort(prev => ({ ...prev, application_end: e.target.value }))}
                                        className="w-full text-sm rounded-xl" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Начало практики <span className="text-brand-hover">*</span></label>
                                    <input type="date" required min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={newCohort.start_date}
                                        onChange={e => setNewCohort(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full text-sm rounded-xl" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Конец практики <span className="text-brand-hover">*</span></label>
                                    <input type="date" required min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={newCohort.end_date}
                                        onChange={e => setNewCohort(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="w-full text-sm rounded-xl" />
                                </div>
                            </div>

                            <div className="bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                                <p className="text-xs text-muted-ink">
                                    После создания когорта будет в статусе «Черновик». Треки, анкету и тестовое задание
                                    можно добавить через кнопку «Редактировать».
                                </p>
                            </div>

                            {createErrors.map((message, i) => (
                                <div key={i} className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3 flex items-start gap-3">
                                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-danger">{message}</p>
                                </div>
                            ))}

                            <div className="flex justify-end gap-3 mt-2">
                                <Button variant="ghost" onClick={closeCreateModal}
                                    className="px-5 py-2.5 rounded-xl h-auto text-sm text-muted-ink hover:bg-surface hover:text-ink">
                                    Отмена
                                </Button>
                                <Button variant="brand" disabled={createLoading || !isCreateFormComplete()} onClick={handleCreateCohort}
                                    className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                    {createLoading ? 'Создаём…' : 'Создать'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── МОДАЛКА: РЕДАКТИРОВАТЬ КОГОРТУ (черновик) ── */}
            {editDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center sm:bg-black/30 sm:backdrop-blur-sm"
                    {...editModalOverlay}>
                    <div className="bg-white sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-w-2xl sm:mx-4 sm:max-h-[96vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>

                        {/* Шапка */}
                        <div className="px-8 pt-7 pb-5 border-b border-border-soft shrink-0">
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="font-extrabold text-2xl text-ink tracking-tight">{editDraft.title}</h3>
                                <button onClick={closeEdit} className="text-muted-ink hover:text-ink text-2xl leading-none">×</button>
                            </div>

                            <div className="grid grid-cols-2 sm:flex gap-1">
                                {([
                                    { id: 'general', label: 'Основное', icon: Settings },
                                    { id: 'tracks', label: 'Треки', icon: Route },
                                    { id: 'survey', label: 'Анкета', icon: FileText },
                                    { id: 'invitation', label: 'Приглашение', icon: LinkIcon },
                                ] as const).map(t => (
                                    <button key={t.id} onClick={() => setEditTab(t.id)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-300 inline-flex items-center justify-center sm:justify-start gap-1.5
                                            ${editTab === t.id ? 'bg-gradient-to-br from-brand to-brand-light text-white shadow-sm' : 'text-muted-ink hover:bg-surface'}`}>
                                        <t.icon className="size-4" />{t.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                                <p className="text-xs text-muted-ink">
                                    Изменения на этой вкладке применятся после нажатия «Сохранить». При создании приглашения новые треки сохранятся автоматически.
                                </p>
                            </div>

                            {/* ── ТРЕКИ: пояснение и добавление — закреплены сверху, вне скролла списка ── */}
                            {editTab === 'tracks' && (
                                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border-soft -mx-8 px-8">
                                    <div className="bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                                        <p className="text-xs text-muted-ink">
                                            У каждого трека — своё тестовое задание. Кандидат выбирает трек при заполнении анкеты.
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Название трека, напр. Backend"
                                            value={newTrackTitle}
                                            onChange={e => setNewTrackTitle(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addTrack()}
                                            className="flex-1 text-sm rounded-xl" />
                                        <Button variant="brand" onClick={addTrack} className="px-4 py-2 rounded-xl h-auto text-sm">
                                            <Plus className="size-4" />Трек
                                        </Button>
                                    </div>

                                    {newTrackError && (
                                        <p className="inline-flex items-center gap-1.5 text-xs text-danger">
                                            <TriangleAlert className="size-3.5 flex-shrink-0" />{newTrackError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ── АНКЕТА: заголовок и кнопки — закреплены сверху, вне скролла списка ── */}
                            {editTab === 'survey' && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-border-soft -mx-8 px-8">
                                    <p className="text-sm font-medium text-ink">Вопросы публичной анкеты когорты</p>
                                    <div className="flex gap-2 flex-shrink-0">
                                        {editDraft.survey && (
                                            <button onClick={openCopySurveyModal}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle transition-colors duration-300 whitespace-nowrap inline-flex items-center gap-1.5">
                                                <Copy className="size-3.5" />Копировать в когорту
                                            </button>
                                        )}
                                        <Button variant="brand" onClick={addQuestion} className="px-4 py-1.5 rounded-lg h-auto text-xs whitespace-nowrap">
                                            <Plus className="size-3.5" />Вопрос
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Контент таба */}
                        <div className="flex-1 overflow-y-auto px-8 py-6">

                            {/* ── ОСНОВНОЕ ── */}
                            {editTab === 'general' && (
                                <div className="flex flex-col gap-5">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <label className="text-sm font-medium text-ink flex-shrink-0">Статус когорты</label>
                                            <div className="flex gap-2">
                                                {(['draft', 'active', 'closed'] as CohortStatus[]).map(s => {
                                                    const allowed = Boolean(originalStatus) && canSetStatus(originalStatus!, s)
                                                    return (
                                                        <button key={s} disabled={!allowed} onClick={() => handleStatusChange(s)}
                                                            title={!allowed ? 'Такой переход статуса недоступен' : undefined}
                                                            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors duration-300
                                                                ${editDraft.status === s
                                                                    ? STATUS_STYLES[s] + ' border-current'
                                                                    : allowed
                                                                        ? 'text-muted-ink border-border-soft hover:bg-surface'
                                                                        : 'text-faint-ink border-border-soft opacity-50 cursor-not-allowed'}`}>
                                                            {STATUS_LABELS[s]}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5 bg-surface border border-border-soft rounded-xl px-4 py-3">
                                            <div className="flex items-center gap-2 text-xs text-muted-ink">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOTS.draft}`} />Черновик — невидим для кандидатов
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-ink">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOTS.active}`} />Активна — принимаются заявки
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-ink">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOTS.closed}`} />Закрыта — только архив
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-ink mt-1 pt-1.5 border-t border-border-soft">
                                                <TriangleAlert className="size-3.5 flex-shrink-0" />Переходы статуса односторонние — закрытую или активную когорту в черновик не вернуть
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-ink">Название потока</label>
                                        <input type="text" value={editDraft.title}
                                            onChange={e => patchDraft({ title: e.target.value })}
                                            className="w-full text-sm rounded-xl" />
                                    </div>

                            {editDraft.status !== 'draft' && (
                                <div className="flex items-center gap-2 text-xs text-muted-ink bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                                    <TriangleAlert className="size-3.5 flex-shrink-0" />
                                    Периоды дат можно менять только у когорты в статусе «Черновик»
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Начало приёма заявок</label>
                                    <input type="date" min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={toDateInput(editDraft.application_start ?? '')}
                                        onChange={e => patchDraft({ application_start: e.target.value })}
                                        disabled={editDraft.status !== 'draft'}
                                        className="w-full text-sm rounded-xl disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-ink">Конец приёма заявок</label>
                                    <input type="date" min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={toDateInput(editDraft.application_end ?? '')}
                                        onChange={e => patchDraft({ application_end: e.target.value })}
                                        disabled={editDraft.status !== 'draft'}
                                        className="w-full text-sm rounded-xl disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-medium text-ink">Начало практики</label>
                                            <input type="date" min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={toDateInput(editDraft.start_date)}
                                                onChange={e => patchDraft({ start_date: e.target.value })}
                                                disabled={editDraft.status !== 'draft'}
                                                className="w-full text-sm rounded-xl disabled:opacity-60 disabled:cursor-not-allowed" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-medium text-ink">Конец практики</label>
                                            <input type="date" min={COHORT_DATE_MIN} max={COHORT_DATE_MAX} value={toDateInput(editDraft.end_date)}
                                                onChange={e => patchDraft({ end_date: e.target.value })}
                                                disabled={editDraft.status !== 'draft'}
                                                className="w-full text-sm rounded-xl disabled:opacity-60 disabled:cursor-not-allowed" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── ТРЕКИ ── */}
                            {editTab === 'tracks' && (
                                <div className="flex flex-col gap-5">
                                    {editDraft.tracks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-border-soft px-4 py-8 text-center">
                                            <p className="text-sm text-muted-ink">Треков пока нет. Добавьте первое направление.</p>
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
                                                    registerRef={el => {
                                                        if (el) trackRefs.current.set(track.id, el)
                                                        else trackRefs.current.delete(track.id)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── АНКЕТА ── */}
                            {editTab === 'survey' && (
                                <div className="flex flex-col gap-5">
                                    {(!editDraft.survey || editDraft.survey.questions.length === 0) ? (
                                        <div className="rounded-xl border border-dashed border-border-soft px-4 py-8 text-center">
                                            <p className="text-sm text-muted-ink">Вопросов пока нет. Добавьте первый.</p>
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
                                                    registerRef={el => {
                                                        if (el) questionRefs.current.set(q.id, el)
                                                        else questionRefs.current.delete(q.id)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ПРИГЛАШЕНИЕ ── */}
                            {editTab === 'invitation' && (
                                <div className="flex flex-col gap-5">
                                    <div className="bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                                        <p className="text-xs text-muted-ink">
                                            Общая ссылка-приглашение для всех кандидатов этой когорты. Новые треки будут сохранены автоматически.
                                        </p>
                                    </div>

                                    {editDraft.invitation ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-ink">Ссылка для кандидатов</label>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input type="text" readOnly
                                                        value={getInvitationUrl(editDraft.invitation.token)}
                                                        className="flex-1 text-sm font-mono bg-surface rounded-xl" />
                                                    <Button variant="brand" onClick={() => copyInvitation(editDraft.invitation!.token)} disabled={invitationSaving}
                                                        className="px-4 py-2 rounded-lg h-auto text-sm shrink-0 justify-center">
                                                        Копировать
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={regenerateDraftInvitation} disabled={invitationSaving}
                                                    className="flex-1 sm:flex-initial text-xs font-semibold px-4 py-1.5 rounded-lg border border-brand text-brand-hover hover:bg-brand-subtle transition-colors duration-300 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                                                    <RotateCw className="size-3.5" />{invitationSaving ? 'Сохранение…' : 'Перегенерировать токен'}
                                                </button>
                                                <Button variant="danger" onClick={deleteDraftInvitation} disabled={invitationSaving}
                                                    className="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg h-auto text-xs justify-center">
                                                    <Trash2 className="size-3.5" />Удалить ссылку
                                                </Button>
                                            </div>
                                            <div className="bg-warning-bg border border-warning-border rounded-xl px-4 py-3 flex items-start gap-3">
                                                <TriangleAlert className="size-4 text-warning flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-warning">
                                                    После сохранения с новым токеном старая ссылка перестанет работать.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <div className="rounded-xl border border-dashed border-border-soft px-4 py-8 text-center">
                                                <p className="text-sm text-muted-ink">Ссылка ещё не создана.</p>
                                            </div>
                                            <Button variant="brand" onClick={createDraftInvitation} disabled={invitationSaving}
                                                className="self-start px-5 py-2.5 rounded-xl h-auto text-sm">
                                                {invitationSavingStage === 'tracks'
                                                    ? 'Сохраняем треки…'
                                                    : invitationSavingStage === 'invitation'
                                                        ? 'Создаём ссылку…'
                                                        : 'Создать ссылку-приглашение'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {editErrors.map((message, i) => (
                                <div key={i} className="bg-danger-bg border border-danger-border rounded-xl px-4 py-3 mt-5 flex items-start gap-3">
                                    <TriangleAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-danger">{message}</p>
                                </div>
                            ))}
                        </div>

                        {/* Футер */}
                        <div className="px-8 py-5 border-t border-border-soft flex justify-end gap-3 shrink-0">
                            <Button variant="ghost" onClick={closeEdit} disabled={editSaving}
                                className="px-5 py-2.5 rounded-xl h-auto text-sm text-muted-ink hover:bg-surface hover:text-ink">
                                Отмена
                            </Button>
                            <Button variant="brand" onClick={handleSaveEdit} disabled={editSaving} className="px-5 py-2.5 rounded-xl h-auto text-sm">
                                {editSaving ? 'Сохраняем…' : 'Сохранить'}
                            </Button>
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
    registerRef,
}: {
    cohortId: string
    track: Track
    titleError?: string
    onRemove: () => void
    onTitleChange: (title: string) => void
    onSaveTestTask: (patch: Partial<NonNullable<Track['testTask']>>) => void
    onPublish: () => void
    onFileUploaded: (task: TestTask) => void
    registerRef?: (el: HTMLDivElement | null) => void
}) {
    const [title, setTitle] = useState(track.testTask?.title ?? '')
    const [description, setDescription] = useState(track.testTask?.description ?? '')
    const [fileUploading, setFileUploading] = useState(false)
    const [fileErrors, setFileErrors] = useState<string[]>([])
    // Свёрнуто по умолчанию для пустого задания (экономит скролл при
    // нескольких треках) — но если задание уже что-то содержит, сразу
    // показываем его развёрнутым, чтобы не прятать существующие данные.
    // На мобильных экранах — всегда свёрнуто изначально, даже если задание
    // уже заполнено: там скролл гораздо дороже, а развернуть можно кликом.
    const [expanded, setExpanded] = useState(() => {
        const hasContent = Boolean(track.testTask?.title || track.testTask?.description || track.testTask?.hasFile)
        if (typeof window === 'undefined') return hasContent
        const isMobile = window.matchMedia('(max-width: 639px)').matches
        return hasContent && !isMobile
    })

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
        <div ref={registerRef} className="rounded-xl border border-border-soft bg-surface-alt p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-subtle flex items-center justify-center text-brand-hover shrink-0"><Route className="size-4" /></div>
                <input type="text" value={track.title} onChange={e => onTitleChange(e.target.value)}
                    className="flex-1 min-w-0 text-sm font-semibold rounded-xl" />
                <button onClick={onRemove}
                    className="self-stretch w-11 flex items-center justify-center text-danger bg-danger-bg border border-danger-border rounded-lg hover:bg-danger-border/40 transition-colors flex-shrink-0">
                    <X className="size-4" />
                </button>
            </div>
            {titleError && (
                <p className="pl-10 -mt-2 inline-flex items-center gap-1.5 text-xs text-danger">
                    <TriangleAlert className="size-3.5 flex-shrink-0" />{titleError}
                </p>
            )}

            <div className="flex flex-col gap-3 pl-10">
                <button type="button" onClick={() => setExpanded(v => !v)} className="flex items-center justify-between gap-2 w-full text-left">
                    <span className="text-xs font-bold tracking-widest uppercase text-muted-ink">Тестовое задание</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {track.testTask?.publishedAt ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-success-bg border border-success-border text-success">
                                Опубликовано
                                <span className="cursor-help" title="Чтобы снять с публикации, нужно удалить всё задание.">
                                    <Info className="size-3.5" />
                                </span>
                            </span>
                        ) : (
                            <span className="text-xs text-muted-ink">Не опубликовано</span>
                        )}
                        <ChevronDown className={`size-4 text-muted-ink transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {expanded && (
                    <>
                        <input type="text" value={title}
                            onChange={e => { setTitle(e.target.value); onSaveTestTask({ title: e.target.value }) }}
                            placeholder="Заголовок задания" className="w-full text-sm rounded-xl" />

                        <textarea rows={4} value={description}
                            onChange={e => { setDescription(e.target.value); onSaveTestTask({ description: e.target.value }) }}
                            placeholder="Опишите задание для этого трека…"
                            className="w-full text-sm resize-none rounded-xl border border-border-soft bg-white px-3.5 py-2.5 focus:outline-none focus:border-brand" />

                        <div className="flex items-center gap-3">
                            <label className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-colors duration-300 cursor-pointer inline-flex items-center gap-1.5
                                ${track.testTask?.hasFile
                                    ? 'border-brand text-brand-hover bg-transparent hover:bg-brand-subtle active:bg-brand-subtle-border'
                                    : 'border-0 text-white bg-gradient-to-br from-brand to-brand-light shadow-md hover:brightness-110 active:brightness-90'}
                                ${fileUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                {fileUploading
                                    ? 'Загружаем…'
                                    : track.testTask?.hasFile
                                        ? <><RotateCw className="size-3.5" />Заменить файл</>
                                        : <><Paperclip className="size-3.5" />Прикрепить файл</>}
                                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.zip" onChange={handleFileSelected} disabled={fileUploading} />
                            </label>
                            {track.testTask?.hasFile && track.testTask.downloadPath && (
                                <button onClick={() => downloadProtectedFile(track.testTask!.downloadPath!, track.testTask!.title || 'Тестовое задание').catch(err => setFileErrors([err instanceof Error ? err.message : 'Не удалось скачать файл']))}
                                    className="text-xs font-semibold text-white px-4 py-2 rounded-lg bg-gradient-to-br from-brand to-brand-light shadow-md hover:brightness-110 active:brightness-90 inline-flex items-center gap-1.5">
                                    <Download className="size-3.5" />Скачать текущий
                                </button>
                            )}
                        </div>

                        {fileErrors.map((message, i) => (
                            <div key={i} className="bg-danger-bg border border-danger-border rounded-lg px-3 py-2 flex items-start gap-2">
                                <TriangleAlert className="size-4 text-danger flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-danger">{message}</p>
                            </div>
                        ))}

                        {!track.testTask?.publishedAt && (
                            <button onClick={onPublish} disabled={!title && !description}
                                className="self-start text-xs font-semibold px-4 py-1.5 rounded-lg border transition-colors duration-300 disabled:opacity-40 border-brand text-brand-hover hover:bg-brand-subtle">
                                Опубликовать
                            </button>
                        )}
                    </>
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
    registerRef,
}: {
    question: Question
    index: number
    onSave: (patch: Partial<Question>) => void
    onRemove: () => void
    registerRef?: (el: HTMLDivElement | null) => void
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
        <div ref={registerRef} className="rounded-2xl border border-border-soft bg-surface-alt p-4 flex flex-col gap-3">
            <div className="flex items-stretch gap-2">
                <span className="text-xs font-bold tracking-widest uppercase text-muted-ink flex items-center w-7 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                </span>
                <input type="text" value={question.label}
                    onChange={e => onSave({ label: e.target.value })}
                    placeholder="Текст вопроса" className="flex-1 text-sm rounded-xl" />
                <button onClick={onRemove}
                    className="self-stretch w-11 flex items-center justify-center text-danger bg-danger-bg border border-danger-border rounded-lg hover:bg-danger-border/40 transition-colors shrink-0">
                    <X className="size-4" />
                </button>
            </div>

            <div className="pl-9 flex flex-col gap-2">
                <div className="flex flex-col sm:inline-flex sm:flex-row sm:items-center gap-2 sm:gap-0 sm:rounded-lg sm:border sm:border-border-soft sm:bg-white sm:overflow-hidden w-full sm:w-fit">
                    <div className="relative flex items-center h-8 gap-2 pl-3 pr-7 flex-shrink-0 cursor-pointer rounded-lg border border-border-soft bg-white sm:rounded-none sm:border-0 w-full sm:w-48">
                        <Type className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
                        <span className="text-xs font-semibold text-ink truncate pointer-events-none">
                            {QUESTION_TYPES.find(t => t.value === question.type)?.label}
                        </span>
                        <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
                        <select value={question.type}
                            onChange={e => onSave({ type: e.target.value as Question['type'] })}
                            aria-label="Тип вопроса"
                            className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                            {QUESTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <button type="button" onClick={() => onSave({ required: !question.required })}
                        className="flex items-center gap-1.5 text-xs text-muted-ink cursor-pointer select-none px-3 h-8 rounded-lg border border-border-soft sm:rounded-none sm:border-0 sm:border-l sm:border-border-soft flex-shrink-0 whitespace-nowrap w-full sm:w-auto">
                        <span className={`w-3.5 h-3.5 min-w-[14px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors flex-shrink-0 ${question.required ? 'bg-brand border-brand' : 'border-border-soft bg-surface'}`}>
                            {question.required && (
                                <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4L3.8 7L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </span>
                        Обязательный
                    </button>
                </div>

                {['select', 'radio', 'checkbox'].includes(question.type) && (
                    <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-ink">Варианты ответа</label>
                            <Button variant="brand" type="button" onClick={addOption} className="px-3 py-1 rounded-lg h-auto text-xs">
                                <Plus className="size-3.5" />Вариант
                            </Button>
                        </div>

                        {question.options.length === 0 && (
                            <p className="text-xs text-muted-ink">Вариантов пока нет — добавь первый.</p>
                        )}

                        <div className="flex flex-col gap-2">
                            {question.options.map((opt, i) => (
                                <div key={i} className="flex items-stretch gap-2">
                                    <input type="text" value={opt}
                                        onChange={e => updateOption(i, e.target.value)}
                                        placeholder={`Вариант ${i + 1}`}
                                        className="flex-1 text-sm rounded-xl" />
                                    <button type="button" onClick={() => removeOption(i)}
                                        className="w-11 flex items-center justify-center text-danger bg-danger-bg border border-danger-border rounded-lg hover:bg-danger-border/40 transition-colors shrink-0"
                                        aria-label="Удалить вариант">
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
