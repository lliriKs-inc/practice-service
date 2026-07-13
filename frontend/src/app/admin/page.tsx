'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/api/auth'
import { getAllApplications, updateApplicationStatus, type Application } from '@/services/api/invitation'
import {
    getCohorts,
    createCohort,
    saveCohortDraft,
    type Cohort,
    type CohortStatus,
    type Track,
    type Question,
} from '@/services/api/cohorts'

type AdminTab = 'cohorts' | 'applications' | 'documents' | 'tasks'
type EditTab = 'general' | 'tracks' | 'survey' | 'invitation'

const STATUS_LABELS: Record<CohortStatus, string> = {
    draft: 'Черновик',
    active: 'Активна',
    closed: 'Закрыта',
}

const STATUS_STYLES: Record<CohortStatus, string> = {
    draft: 'bg-[#F5F4FD] border-[#E4E2F4] text-[#6B6880]',
    active: 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]',
    closed: 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]',
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

export default function AdminPage() {
    const { user, loading } = useAuth('ADMIN')

    const [tab, setTab] = useState<AdminTab>('cohorts')
    const [cohorts, setCohorts] = useState<Cohort[]>([])
    const [cohortsLoading, setCohortsLoading] = useState(true)
    const [cohortsError, setCohortsError] = useState('')

    // Создание когорты
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [createError, setCreateError] = useState('')
    const [newCohort, setNewCohort] = useState({ title: '', start_date: '', end_date: '' })

    // ── Редактирование: локальный черновик ────────────────────────
    // Все правки в модалке применяются только к editDraft. Ничего не
    // улетает на "сервер" (моки), пока не нажата кнопка "Сохранить".
    const [editDraft, setEditDraft] = useState<Cohort | null>(null)
    const [editTab, setEditTab] = useState<EditTab>('general')
    const [editSaving, setEditSaving] = useState(false)
    const [editError, setEditError] = useState('')
    const [newTrackTitle, setNewTrackTitle] = useState('')

    // ── Заявки (реальные данные всех студентов) ─────────────────────
    const [applications, setApplications] = useState<Application[]>([])
    const [applicationsLoading, setApplicationsLoading] = useState(false)
    const [applicationsError, setApplicationsError] = useState('')
    const [applicationActionId, setApplicationActionId] = useState<string | null>(null)

    async function loadApplications() {
        setApplicationsLoading(true)
        setApplicationsError('')
        try {
            const data = await getAllApplications()
            setApplications(data)
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Ошибка загрузки заявок')
        } finally {
            setApplicationsLoading(false)
        }
    }

    useEffect(() => {
        (async () => {
            if (tab === 'applications' && !loading) await loadApplications()
        })()
    }, [tab, loading])

    async function handleApplicationDecision(id: string, status: 'approved' | 'rejected') {
        setApplicationActionId(id)
        try {
            await updateApplicationStatus(id, status)
            await loadApplications()
        } catch (err: unknown) {
            setApplicationsError(err instanceof Error ? err.message : 'Не удалось изменить статус заявки')
        } finally {
            setApplicationActionId(null)
        }
    }

    // ── Загрузка когорт ────────────────────────────────────────────
    async function loadCohorts() {
        setCohortsLoading(true)
        setCohortsError('')
        try {
            const data = await getCohorts()
            setCohorts(data)
        } catch (err: unknown) {
            setCohortsError(err instanceof Error ? err.message : 'Ошибка загрузки когорт')
        } finally {
            setCohortsLoading(false)
        }
    }

    useEffect(() => {
        (async () => {
            if (loading) return
            await loadCohorts()
        })()
    }, [loading])

    // ── Создание когорты (отдельная модалка, без изменений) ───────
    async function handleCreateCohort() {
        if (!newCohort.title) return
        setCreateLoading(true)
        setCreateError('')
        try {
            await createCohort({
                title: newCohort.title,
                start_date: newCohort.start_date || new Date().toISOString().slice(0, 10),
                end_date: newCohort.end_date || new Date().toISOString().slice(0, 10),
            })
            await loadCohorts()
            setShowCreateModal(false)
            setNewCohort({ title: '', start_date: '', end_date: '' })
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : 'Ошибка создания когорты')
        } finally {
            setCreateLoading(false)
        }
    }

    // ── Открыть/закрыть редактирование ─────────────────────────────
    function openEdit(cohort: Cohort) {
        // Глубокая копия — правки идут в черновик, исходная когорта в
        // списке не трогается, пока не нажата "Сохранить"
        setEditDraft(JSON.parse(JSON.stringify(cohort)))
        setEditTab('general')
        setEditError('')
        setNewTrackTitle('')
    }

    function closeEdit() {
        // Черновик просто выбрасывается — все несохранённые правки исчезают
        setEditDraft(null)
    }

    function patchDraft(patch: Partial<Cohort>) {
        setEditDraft(prev => (prev ? { ...prev, ...patch } : prev))
    }

    async function handleSaveEdit() {
        if (!editDraft) return
        setEditSaving(true)
        setEditError('')
        try {
            await saveCohortDraft(editDraft.id, editDraft)
            await loadCohorts()
            setEditDraft(null)
        } catch (err: unknown) {
            setEditError(err instanceof Error ? err.message : 'Не удалось сохранить изменения')
        } finally {
            setEditSaving(false)
        }
    }

    // ── Статус (теперь тоже часть черновика) ───────────────────────
    function handleStatusChange(status: CohortStatus) {
        patchDraft({ status })
    }

    // ── Треки (локально, без сети) ─────────────────────────────────
    function addTrack() {
        if (!newTrackTitle.trim() || !editDraft) return
        const track: Track = { id: uid(), title: newTrackTitle.trim(), testTask: null }
        patchDraft({ tracks: [...editDraft.tracks, track] })
        setNewTrackTitle('')
    }

    function removeTrack(trackId: string) {
        if (!editDraft) return
        patchDraft({ tracks: editDraft.tracks.filter(t => t.id !== trackId) })
    }

    function updateTrackTitle(trackId: string, title: string) {
        if (!editDraft) return
        patchDraft({ tracks: editDraft.tracks.map(t => t.id === trackId ? { ...t, title } : t) })
    }

    function saveTrackTestTask(trackId: string, patch: Partial<NonNullable<Track['testTask']>>) {
        if (!editDraft) return
        patchDraft({
            tracks: editDraft.tracks.map(t => {
                if (t.id !== trackId) return t
                const current = t.testTask ?? { title: '', description: '', fileUrl: null, publishedAt: null }
                return { ...t, testTask: { ...current, ...patch } }
            }),
        })
    }

    function toggleTrackPublish(trackId: string) {
        if (!editDraft) return
        patchDraft({
            tracks: editDraft.tracks.map(t => {
                if (t.id !== trackId || !t.testTask) return t
                const isPublished = !!t.testTask.publishedAt
                return { ...t, testTask: { ...t.testTask, publishedAt: isPublished ? null : new Date().toISOString() } }
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

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD]">
            <p className="text-sm text-[#6B6880]">Загрузка…</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">

            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-[#1C1A3A] rounded-full ml-2">
                        <span className="text-xs font-semibold text-white">Админ</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">{user?.email ?? '…'}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white text-sm font-bold flex items-center justify-center">
                        {user?.email?.[0]?.toUpperCase() ?? 'А'}
                    </div>
                </div>
            </header>

            <div className="flex flex-1">

                {/* SIDEBAR */}
                <aside className="w-56 bg-white border-r border-[#E4E2F4] flex flex-col p-4 gap-1 sticky top-[65px] h-[calc(100vh-65px)]">
                    {[
                        { id: 'cohorts', icon: '🗂️', label: 'Когорты' },
                        { id: 'applications', icon: '📋', label: 'Заявки' },
                        { id: 'documents', icon: '📄', label: 'Документы' },
                        { id: 'tasks', icon: '✅', label: 'Задачи' },
                    ].map(item => (
                        <button key={item.id} onClick={() => setTab(item.id as AdminTab)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                ${tab === item.id ? 'bg-[#EBE9FF] text-[#4A42D4]' : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}>
                            <span>{item.icon}</span>{item.label}
                        </button>
                    ))}
                    <div className="mt-auto pt-4 border-t border-[#E4E2F4]">
                        <button onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left">
                            <span>🚪</span> Выйти
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <main className="flex-1 p-8 flex flex-col gap-6">

                    {/* ── КОГОРТЫ ── */}
                    {tab === 'cohorts' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Когорты</h1>
                                    <p className="text-sm text-[#6B6880]">Управление потоками практики.</p>
                                </div>
                                <button onClick={() => setShowCreateModal(true)}
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
                                    <p className="text-sm text-[#D94F4F]">⚠️ {cohortsError}</p>
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
                                {cohorts.map(cohort => (
                                    <div key={cohort.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                        <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <h2 className="font-bold text-lg text-[#1C1A3A]">{cohort.title}</h2>
                                                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[cohort.status]}`}>
                                                    {STATUS_LABELS[cohort.status]}
                                                </span>
                                            </div>
                                            <button onClick={() => openEdit(cohort)}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF] transition-all inline-flex items-center gap-1.5">
                                                <span className="text-sm leading-none">✎</span> Редактировать
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 divide-x divide-[#E4E2F4]">
                                            {[
                                                { label: 'Начало практики', value: new Date(cohort.start_date).toLocaleDateString('ru') },
                                                { label: 'Конец практики', value: new Date(cohort.end_date).toLocaleDateString('ru') },
                                            ].map((item, i) => (
                                                <div key={i} className="px-6 py-4 flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">{item.label}</span>
                                                    <span className="text-sm font-semibold text-[#1C1A3A]">{item.value}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {cohort.tracks.length > 0 && (
                                            <div className="px-7 py-4 flex items-center gap-2 flex-wrap border-t border-[#E4E2F4]">
                                                <span className="text-xs text-[#A9A7BB] font-medium mr-1">Треки:</span>
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
                                                <span className="text-xs text-[#A9A7BB]">🔗 Ссылка для кандидатов:</span>
                                                <code className="text-xs text-[#4A42D4] flex-1 truncate">/apply/{cohort.invitation.token}</code>
                                                <button onClick={() => copyInvitation(cohort.invitation!.token)}
                                                    className="text-xs font-semibold text-[#6C63FF] hover:underline shrink-0">
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
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ЗАЯВКИ ── */}
                    {tab === 'applications' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Заявки</h1>
                                <p className="text-sm text-[#6B6880]">Все заявки кандидатов по всем когортам.</p>
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
                                    <p className="text-sm text-[#6B6880]">Как только кандидат подаст заявку по ссылке-приглашению, она появится здесь.</p>
                                </div>
                            )}

                            {!applicationsLoading && !applicationsError && applications.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    {applications.map(app => {
                                        // [FIX] Раньше админ не видел ни ответов анкеты, ни тестового
                                        // задания трека — ищем их прямо из уже загруженного списка когорт
                                        const sourceCohort = cohorts.find(c => c.id === app.cohort.id)
                                        const trackTestTask = sourceCohort?.tracks.find(t => t.id === app.track.id)?.testTask

                                        return (
                                        <div key={app.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                            <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">
                                                        {app.cohort.title} · {app.track.title}
                                                    </p>
                                                    <h2 className="font-bold text-lg text-[#1C1A3A]">{app.student?.email ?? 'Неизвестный кандидат'}</h2>
                                                </div>
                                                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border
                                                    ${app.status === 'pending' ? 'bg-[#FFF8ED] border-[#F5D9A0] text-[#7A5C1A]'
                                                        : app.status === 'approved' ? 'bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]'
                                                        : 'bg-[#FFF5F5] border-[#F0BABA] text-[#D94F4F]'}`}>
                                                    <div className={`w-2 h-2 rounded-full
                                                        ${app.status === 'pending' ? 'bg-[#F59E0B]' : app.status === 'approved' ? 'bg-[#2CB87A]' : 'bg-[#D94F4F]'}`} />
                                                    <span className="text-xs font-semibold">
                                                        {app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Одобрена' : 'Отклонена'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Ответы анкеты */}
                                            {app.answers && app.answers.length > 0 && (
                                                <div className="px-7 py-4 border-b border-[#E4E2F4] flex flex-col gap-2.5">
                                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Ответы анкеты</span>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {app.answers.map((a, i) => (
                                                            <div key={i} className="flex flex-col gap-0.5">
                                                                <span className="text-xs text-[#A9A7BB]">{a.label}</span>
                                                                <span className="text-sm text-[#1C1A3A]">{a.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Тестовое задание трека */}
                                            {trackTestTask && (trackTestTask.title || trackTestTask.description) && (
                                                <div className="px-7 py-4 border-b border-[#E4E2F4] flex flex-col gap-1.5 bg-[#FBFAFF]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">Тестовое задание трека</span>
                                                        {trackTestTask.publishedAt ? (
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDFBF4] border border-[#7EE8B8] text-[#1A7A5A]">Опубликовано</span>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F4FD] border border-[#E4E2F4] text-[#A9A7BB]">Черновик</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-[#1C1A3A]">{trackTestTask.title || '—'}</p>
                                                    {trackTestTask.description && (
                                                        <p className="text-xs text-[#6B6880] leading-relaxed">{trackTestTask.description}</p>
                                                    )}
                                                    <p className="text-[11px] text-[#A9A7BB] mt-1">
                                                        Загрузка решения кандидатом пока не реализована — эта часть появится отдельно.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="px-7 py-4 flex items-center justify-between">
                                                <span className="text-xs text-[#A9A7BB]">
                                                    Подана {new Date(app.submitted_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                                {app.status === 'pending' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            disabled={applicationActionId === app.id}
                                                            onClick={() => handleApplicationDecision(app.id, 'rejected')}
                                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#F0BABA] text-[#D94F4F] hover:bg-[#FFF5F5] disabled:opacity-50">
                                                            Отклонить
                                                        </button>
                                                        <button
                                                            disabled={applicationActionId === app.id}
                                                            onClick={() => handleApplicationDecision(app.id, 'approved')}
                                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white shadow-sm disabled:opacity-50"
                                                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                                            {applicationActionId === app.id ? 'Сохраняем…' : 'Одобрить'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ДОКУМЕНТЫ ── */}
                    {tab === 'documents' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Документы</h1>
                                <p className="text-sm text-[#6B6880]">Статус документов практикантов · активная когорта</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                <div className="text-4xl mb-4">📄</div>
                                <p className="font-semibold text-[#1C1A3A] mb-1">Ждём новый API</p>
                                <p className="text-sm text-[#6B6880]">GET /cohorts/:id/documents · новая архитектура</p>
                            </div>
                        </div>
                    )}

                    {/* ── ЗАДАЧИ ── */}
                    {tab === 'tasks' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Задачи</h1>
                                <p className="text-sm text-[#6B6880]">Прогресс практикантов · активная когорта</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                <div className="text-4xl mb-4">✅</div>
                                <p className="font-semibold text-[#1C1A3A] mb-1">Ждём новый API</p>
                                <p className="text-sm text-[#6B6880]">GET /cohorts/:id/progress · новая архитектура</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ── МОДАЛКА: СОЗДАТЬ КОГОРТУ ── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg mx-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-[#1C1A3A]">Новая когорта</h3>
                            <button onClick={() => setShowCreateModal(false)}
                                className="text-[#A9A7BB] hover:text-[#1C1A3A] text-2xl leading-none">×</button>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Название потока</label>
                                <input type="text" placeholder="Практика 2027"
                                    value={newCohort.title}
                                    onChange={e => setNewCohort(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full text-sm" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Начало практики</label>
                                    <input type="date" value={newCohort.start_date}
                                        onChange={e => setNewCohort(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full text-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Конец практики</label>
                                    <input type="date" value={newCohort.end_date}
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

                            {createError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {createError}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-2">
                                <button onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl">
                                    Отмена
                                </button>
                                <button disabled={createLoading || !newCohort.title} onClick={handleCreateCohort}
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
                    onClick={closeEdit}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>

                        {/* Шапка */}
                        <div className="px-8 pt-7 pb-5 border-b border-[#E4E2F4] shrink-0">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-xl text-[#1C1A3A]">{editDraft.title}</h3>
                                    <p className="text-sm text-[#6B6880] mt-0.5">Редактирование потока практики</p>
                                </div>
                                <button onClick={closeEdit} className="text-[#A9A7BB] hover:text-[#1C1A3A] text-2xl leading-none">×</button>
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
                                            {(['draft', 'active', 'closed'] as CohortStatus[]).map(s => (
                                                <button key={s} onClick={() => handleStatusChange(s)}
                                                    className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all
                                                        ${editDraft.status === s
                                                            ? STATUS_STYLES[s] + ' border-current'
                                                            : 'text-[#6B6880] border-[#E4E2F4] hover:bg-[#F5F4FD]'}`}>
                                                    {STATUS_LABELS[s]}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-[#A9A7BB]">
                                            Черновик — невидим для кандидатов · Активна — принимаются заявки · Закрыта — только архив
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

                                    {editDraft.tracks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-[#E4E2F4] px-4 py-8 text-center">
                                            <p className="text-sm text-[#A9A7BB]">Треков пока нет. Добавьте первое направление.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {editDraft.tracks.map(track => (
                                                <TrackEditor
                                                    key={track.id}
                                                    track={track}
                                                    onRemove={() => removeTrack(track.id)}
                                                    onTitleChange={title => updateTrackTitle(track.id, title)}
                                                    onSaveTestTask={patch => saveTrackTestTask(track.id, patch)}
                                                    onTogglePublish={() => toggleTrackPublish(track.id)}
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
                                            className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF] transition-all whitespace-nowrap">
                                            + Вопрос
                                        </button>
                                    </div>

                                    {(!editDraft.survey || editDraft.survey.questions.length === 0) ? (
                                        <div className="rounded-xl border border-dashed border-[#E4E2F4] px-4 py-8 text-center">
                                            <p className="text-sm text-[#A9A7BB]">Вопросов пока нет. Добавьте первый.</p>
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
                                                        className="px-4 py-2 text-sm font-semibold border border-[#6C63FF] text-[#6C63FF] rounded-lg hover:bg-[#EBE9FF] shrink-0">
                                                        Копировать
                                                    </button>
                                                </div>
                                                <span className="text-xs text-[#A9A7BB]">Появится по этому адресу только после сохранения.</span>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={regenerateDraftInvitation}
                                                    className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#E4E2F4] text-[#6B6880] hover:bg-[#F5F4FD] transition-all">
                                                    🔄 Перегенерировать токен
                                                </button>
                                                <button onClick={deleteDraftInvitation}
                                                    className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#F0BABA] text-[#D94F4F] hover:bg-[#FFF5F5] transition-all">
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
                                                <p className="text-sm text-[#A9A7BB]">Ссылка ещё не создана.</p>
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

                            {editError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3 mt-5">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {editError}</p>
                                </div>
                            )}
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
        </div>
    )
}

// ── Редактор трека (название + тестовое задание) — правки идут в draft ──
function TrackEditor({
    track,
    onRemove,
    onTitleChange,
    onSaveTestTask,
    onTogglePublish,
}: {
    track: Track
    onRemove: () => void
    onTitleChange: (title: string) => void
    onSaveTestTask: (patch: Partial<NonNullable<Track['testTask']>>) => void
    onTogglePublish: () => void
}) {
    const [title, setTitle] = useState(track.testTask?.title ?? '')
    const [description, setDescription] = useState(track.testTask?.description ?? '')

    return (
        <div className="rounded-xl border border-[#E4E2F4] bg-[#FBFAFF] p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EBE9FF] flex items-center justify-center text-[#6C63FF] text-sm font-bold shrink-0">🛤</div>
                <input type="text" value={track.title} onChange={e => onTitleChange(e.target.value)}
                    className="flex-1 text-sm font-semibold" />
                <button onClick={onRemove} className="text-[#A9A7BB] hover:text-[#D94F4F] text-xl leading-none px-1">×</button>
            </div>

            <div className="flex flex-col gap-3 pl-10">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB]">Тестовое задание</span>
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

                <button onClick={onTogglePublish} disabled={!title && !description}
                    className={`self-start text-xs font-semibold px-4 py-1.5 rounded-lg border transition-all disabled:opacity-40
                        ${track.testTask?.publishedAt
                            ? 'border-[#D94F4F] text-[#D94F4F] hover:bg-[#FFF5F5]'
                            : 'border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF]'}`}>
                    {track.testTask?.publishedAt ? 'Снять с публикации' : 'Опубликовать'}
                </button>
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
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB] pt-2.5 w-6 shrink-0">
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
                                    className="text-xs font-semibold text-[#6C63FF] hover:underline">
                                    + Вариант
                                </button>
                            </div>

                            {question.options.length === 0 && (
                                <p className="text-xs text-[#A9A7BB]">Вариантов пока нет — добавь первый.</p>
                            )}

                            <div className="flex flex-col gap-2">
                                {question.options.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input type="text" value={opt}
                                            onChange={e => updateOption(i, e.target.value)}
                                            placeholder={`Вариант ${i + 1}`}
                                            className="flex-1 text-sm" />
                                        <button type="button" onClick={() => removeOption(i)}
                                            className="text-[#A9A7BB] hover:text-[#D94F4F] text-lg leading-none px-1 shrink-0"
                                            aria-label="Удалить вариант">
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={onRemove} className="text-[#A9A7BB] hover:text-[#D94F4F] text-xl leading-none px-1 shrink-0">×</button>
            </div>
        </div>
    )
}
