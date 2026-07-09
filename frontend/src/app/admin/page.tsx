'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/api/auth'
import {
    getCohorts,
    getActiveCohort,
    createCohort as apiCreateCohort,
    activateCohort,
    createRole,
    getRoles,
    type Cohort,
} from '@/services/api/cohorts'

type Tab = 'cohorts' | 'applications' | 'documents' | 'tasks'

interface CohortWithRoles extends Cohort {
    roles: string[]
    isActive?: boolean
}

type FieldType = 'text' | 'select'

interface SurveyFieldDraft {
    id: string
    label: string
    type: FieldType
    options: string[]
}

interface EditForm {
    name: string
    application_start: string
    application_end: string
    practice_start: string
    practice_end: string
    roles: string[]
    testTaskContent: string
    testTaskPublished: boolean
    fields: SurveyFieldDraft[]
}

// части без бэкенда держим в черновике на когорту, чтобы не терялись при повторном открытии в рамках сессии
type DraftExtras = Record<string, {
    testTaskContent: string
    testTaskPublished: boolean
    fields: SurveyFieldDraft[]
}>

function uid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

// ISO → YYYY-MM-DD для <input type="date">
function toDateInput(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

// YYYY-MM-DD → ISO (с фолбэком на прежнее значение)
function fromDateInput(value: string, fallbackIso: string): string {
    if (!value) return fallbackIso
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? fallbackIso : d.toISOString()
}

export default function AdminPage() {
    const { user, loading } = useAuth('ADMIN')

    const [tab, setTab] = useState<Tab>('cohorts')
    const [cohorts, setCohorts] = useState<CohortWithRoles[]>([])
    const [cohortsLoading, setCohortsLoading] = useState(true)
    const [cohortsError, setCohortsError] = useState('')

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [createError, setCreateError] = useState('')
    const [newRole, setNewRole] = useState('')
    const [newCohort, setNewCohort] = useState({
        name: '',
        application_start: '',
        application_end: '',
        practice_start: '',
        practice_end: '',
        roles: [] as string[],
    })

    // ── редактирование когорты ──
    const [editCohortId, setEditCohortId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<EditForm | null>(null)
    const [editRole, setEditRole] = useState('')
    const [editSaving, setEditSaving] = useState(false)
    const [editError, setEditError] = useState('')
    const [activating, setActivating] = useState(false)
    const [draftExtras, setDraftExtras] = useState<DraftExtras>({})

    const editingCohort = cohorts.find(c => c.id === editCohortId) ?? null

    // загрузка когорт
    useEffect(() => {
        if (loading) return
        const fetchCohorts = async () => {
            try {
                const [data, activeData] = await Promise.all([
                    getCohorts(),
                    getActiveCohort(),
                ])

                const activeCohortId = activeData.active_cohort_id

                // если есть активная — загружаем её роли
                let activeRoles: string[] = []
                if (activeCohortId) {
                    const roles = await getRoles()
                    activeRoles = roles.map(r => r.name)
                }

                setCohorts(data.map(c => ({
                    ...c,
                    roles: c.id === activeCohortId ? activeRoles : [],
                    isActive: c.id === activeCohortId,
                })))
            } catch (err: unknown) {
                setCohortsError(err instanceof Error ? err.message : 'Ошибка загрузки')
            } finally {
                setCohortsLoading(false)
            }
        }
        fetchCohorts()
    }, [loading])

    function addRole() {
        if (!newRole.trim()) return
        setNewCohort(prev => ({ ...prev, roles: [...prev.roles, newRole.trim()] }))
        setNewRole('')
    }

    function removeRole(role: string) {
        setNewCohort(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }))
    }

    async function handleCreateCohort() {
        if (!newCohort.name) return
        setCreateLoading(true)
        setCreateError('')
        try {
            // 1. создаём когорту
            const cohort = await apiCreateCohort({
                name: newCohort.name,
                application_start: new Date(newCohort.application_start).toISOString(),
                application_end: new Date(newCohort.application_end).toISOString(),
                practice_start: new Date(newCohort.practice_start).toISOString(),
                practice_end: new Date(newCohort.practice_end).toISOString(),
            })

            // 2. активируем чтобы добавить роли
            await activateCohort(cohort.id)

            // 3. создаём роли
            for (const role of newCohort.roles) {
                await createRole(role)
            }

            // 4. добавляем в список
            setCohorts(prev => [{ ...cohort, roles: newCohort.roles }, ...prev])
            setShowCreateModal(false)
            setNewCohort({ name: '', application_start: '', application_end: '', practice_start: '', practice_end: '', roles: [] })
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : 'Ошибка создания когорты')
        } finally {
            setCreateLoading(false)
        }
    }

    function openEdit(cohort: CohortWithRoles) {
        const extras = draftExtras[cohort.id]
        setEditCohortId(cohort.id)
        setEditForm({
            name: cohort.name,
            application_start: toDateInput(cohort.application_start),
            application_end: toDateInput(cohort.application_end),
            practice_start: toDateInput(cohort.practice_start),
            practice_end: toDateInput(cohort.practice_end),
            roles: [...cohort.roles],
            testTaskContent: extras?.testTaskContent ?? '',
            testTaskPublished: extras?.testTaskPublished ?? false,
            fields: extras?.fields.map(f => ({ ...f, options: [...f.options] })) ?? [],
        })
        setEditRole('')
        setEditError('')
    }

    function closeEdit() {
        setEditCohortId(null)
        setEditForm(null)
    }

    function patchEdit(patch: Partial<EditForm>) {
        setEditForm(prev => (prev ? { ...prev, ...patch } : prev))
    }

    // активация — есть реальный эндпоинт
    async function handleActivateInEdit() {
        if (!editCohortId) return
        setActivating(true)
        setEditError('')
        try {
            await activateCohort(editCohortId)
            const roles = await getRoles()
            const roleNames = roles.map(r => r.name)
            setCohorts(prev => prev.map(c => ({
                ...c,
                isActive: c.id === editCohortId,
                roles: c.id === editCohortId ? roleNames : c.roles,
            })))
            // подтягиваем реальные роли когорты в форму, не теряя добавленных в черновике
            patchEdit({ roles: Array.from(new Set([...roleNames, ...(editForm?.roles ?? [])])) })
        } catch (err: unknown) {
            setEditError(err instanceof Error ? err.message : 'Не удалось активировать когорту')
        } finally {
            setActivating(false)
        }
    }

    // роли — createRole/getRoles работают в контексте активной когорты
    async function addEditRole() {
        const value = editRole.trim()
        if (!value || !editForm) return
        if (editForm.roles.includes(value)) { setEditRole(''); return }
        patchEdit({ roles: [...editForm.roles, value] })
        setEditRole('')
        if (editingCohort?.isActive) {
            try {
                await createRole(value)
                setCohorts(prev => prev.map(c =>
                    c.id === editCohortId ? { ...c, roles: [...c.roles, value] } : c
                ))
            } catch (err: unknown) {
                setEditError(err instanceof Error ? err.message : 'Не удалось сохранить роль')
            }
        }
    }

    function removeEditRole(role: string) {
        if (!editForm) return
        patchEdit({ roles: editForm.roles.filter(r => r !== role) })
    }

    // поля анкеты — пока только локально
    function addField() {
        if (!editForm) return
        const field: SurveyFieldDraft = { id: uid(), label: '', type: 'text', options: [] }
        patchEdit({ fields: [...editForm.fields, field] })
    }

    function updateField(id: string, patch: Partial<SurveyFieldDraft>) {
        if (!editForm) return
        patchEdit({ fields: editForm.fields.map(f => (f.id === id ? { ...f, ...patch } : f)) })
    }

    function removeField(id: string) {
        if (!editForm) return
        patchEdit({ fields: editForm.fields.filter(f => f.id !== id) })
    }

    function handleSaveEdit() {
        if (!editForm || !editCohortId) return
        setEditSaving(true)
        // бэкенда для названия/дат/анкеты/тестового пока нет — отражаем изменения локально,
        // чтобы карточка и повторное открытие показывали актуальные данные в рамках сессии
        setCohorts(prev => prev.map(c =>
            c.id === editCohortId
                ? {
                    ...c,
                    name: editForm.name,
                    application_start: fromDateInput(editForm.application_start, c.application_start),
                    application_end: fromDateInput(editForm.application_end, c.application_end),
                    practice_start: fromDateInput(editForm.practice_start, c.practice_start),
                    practice_end: fromDateInput(editForm.practice_end, c.practice_end),
                    roles: editForm.roles,
                }
                : c
        ))
        setDraftExtras(prev => ({
            ...prev,
            [editCohortId]: {
                testTaskContent: editForm.testTaskContent,
                testTaskPublished: editForm.testTaskPublished,
                fields: editForm.fields,
            },
        }))
        setEditSaving(false)
        closeEdit()
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
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                    >
                        🎓
                    </div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-[#1C1A3A] rounded-full ml-2">
                        <span className="text-xs font-semibold text-white">Админ</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">
                            {user?.email ?? '…'}
                        </span>
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
                        { id: 'cohorts',      icon: '🗂️', label: 'Когорты' },
                        { id: 'applications', icon: '📋', label: 'Заявки' },
                        { id: 'documents',    icon: '📄', label: 'Документы' },
                        { id: 'tasks',        icon: '✅', label: 'Задачи' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id as Tab)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                ${tab === item.id
                                    ? 'bg-[#EBE9FF] text-[#4A42D4]'
                                    : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                    <div className="mt-auto pt-4 border-t border-[#E4E2F4]">
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left"
                        >
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
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl shadow-md"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                >
                                    + Создать когорту
                                </button>
                            </div>

                            {cohortsLoading && (
                                <p className="text-sm text-[#6B6880]">Загрузка когорт…</p>
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
                                                <h2 className="font-bold text-lg text-[#1C1A3A]">{cohort.name}</h2>
                                                {cohort.isActive && (
                                                    <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]">
                                                        Активна
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => openEdit(cohort)}
                                                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF] transition-all inline-flex items-center gap-1.5"
                                            >
                                                <span className="text-sm leading-none">✎</span>
                                                Редактировать
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-4 divide-x divide-[#E4E2F4]">
                                            {[
                                                { label: 'Приём заявок с', value: new Date(cohort.application_start).toLocaleDateString('ru') },
                                                { label: 'Приём заявок по', value: new Date(cohort.application_end).toLocaleDateString('ru') },
                                                { label: 'Практика с', value: new Date(cohort.practice_start).toLocaleDateString('ru') },
                                                { label: 'Практика по', value: new Date(cohort.practice_end).toLocaleDateString('ru') },
                                            ].map((item, i) => (
                                                <div key={i} className="px-6 py-4 flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">{item.label}</span>
                                                    <span className="text-sm font-semibold text-[#1C1A3A]">{item.value}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {cohort.roles.length > 0 && (
                                            <div className="px-7 py-4 flex items-center gap-2 flex-wrap border-t border-[#E4E2F4]">
                                                <span className="text-xs text-[#A9A7BB] font-medium mr-1">Роли:</span>
                                                {cohort.roles.map(role => (
                                                    <span key={role} className="text-xs font-medium px-3 py-1 bg-[#F5F4FD] border border-[#E4E2F4] rounded-full text-[#6B6880]">
                                                        {role}
                                                    </span>
                                                ))}
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
                                <p className="text-sm text-[#6B6880]">Входящие заявки · активная когорта</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                <div className="text-4xl mb-4">📋</div>
                                <p className="font-semibold text-[#1C1A3A] mb-1">Заявки появятся позже</p>
                                <p className="text-sm text-[#6B6880]">Эндпоинт /applications ещё не реализован на бэке</p>
                            </div>
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
                                <p className="font-semibold text-[#1C1A3A] mb-1">Документы появятся позже</p>
                                <p className="text-sm text-[#6B6880]">Нужен список студентов из /applications</p>
                            </div>
                        </div>
                    )}

                    {/* ── ЗАДАЧИ ── */}
                    {tab === 'tasks' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Задачи</h1>
                                <p className="text-sm text-[#6B6880]">Все задачи практикантов · активная когорта</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                                <div className="text-4xl mb-4">✅</div>
                                <p className="font-semibold text-[#1C1A3A] mb-1">Задачи загружаются с бэка</p>
                                <p className="text-sm text-[#6B6880]">Активируй когорту чтобы увидеть задачи участников</p>
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* CREATE COHORT MODAL */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setShowCreateModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-[#1C1A3A]">Новая когорта</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-[#A9A7BB] hover:text-[#1C1A3A] text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[#1C1A3A]">Название потока</label>
                                <input
                                    type="text"
                                    placeholder="Поток 2027"
                                    value={newCohort.name}
                                    onChange={e => setNewCohort(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Приём заявок с', key: 'application_start' },
                                    { label: 'Приём заявок по', key: 'application_end' },
                                    { label: 'Практика с', key: 'practice_start' },
                                    { label: 'Практика по', key: 'practice_end' },
                                ].map(field => (
                                    <div key={field.key} className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-[#1C1A3A]">{field.label}</label>
                                        <input
                                            type="date"
                                            value={newCohort[field.key as keyof typeof newCohort] as string}
                                            onChange={e => setNewCohort(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            className="w-full text-sm"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-[#1C1A3A]">Роли / треки</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Например: Backend"
                                        value={newRole}
                                        onChange={e => setNewRole(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addRole()}
                                        className="flex-1 text-sm"
                                    />
                                    <button
                                        onClick={addRole}
                                        className="px-4 py-2 text-sm font-semibold text-white rounded-lg"
                                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                    >
                                        +
                                    </button>
                                </div>
                                {newCohort.roles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {newCohort.roles.map(role => (
                                            <div key={role} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#EBE9FF] border border-[#6C63FF] text-[#4A42D4] rounded-full">
                                                {role}
                                                <button onClick={() => removeRole(role)} className="text-[#6C63FF] hover:text-[#4A42D4] leading-none">×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {createError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {createError}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleCreateCohort}
                                    disabled={createLoading}
                                    className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                >
                                    {createLoading ? 'Создаём…' : 'Создать'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT COHORT MODAL */}
            {editCohortId && editForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={closeEdit}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* header */}
                        <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-xl text-[#1C1A3A]">Редактирование потока</h3>
                                {editingCohort?.isActive && (
                                    <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-[#EDFBF4] border-[#7EE8B8] text-[#1A7A5A]">
                                        Активна
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={closeEdit}
                                className="text-[#A9A7BB] hover:text-[#1C1A3A] text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <p className="text-sm text-[#6B6880] mb-6">{editForm.name || 'Без названия'}</p>

                        {/* honest note about persistence */}
                        <div className="bg-[#F5F4FD] border border-[#E4E2F4] rounded-xl px-4 py-3 mb-7">
                            <p className="text-xs text-[#6B6880] leading-relaxed">
                                Активация и роли сохраняются на сервере. Название, даты, тестовое задание и поля анкеты
                                пока хранятся локально — эндпоинты для них ещё не реализованы на бэке.
                            </p>
                        </div>

                        <div className="flex flex-col gap-7">

                            {/* ── АКТИВНОСТЬ ── */}
                            <section className="flex flex-col gap-3">
                                <div>
                                    <h4 className="font-bold text-[15px] text-[#1C1A3A]">Активность</h4>
                                    <p className="text-xs text-[#A9A7BB] mt-0.5">Активная когорта — та, чью анкету видят кандидаты по публичной ссылке.</p>
                                </div>
                                {editingCohort?.isActive ? (
                                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#EDFBF4] border border-[#7EE8B8]">
                                        <div className="w-2 h-2 rounded-full bg-[#1A7A5A]" />
                                        <span className="text-sm font-semibold text-[#1A7A5A]">Эта когорта сейчас активна</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleActivateInEdit}
                                        disabled={activating}
                                        className="self-start text-sm font-semibold text-white px-5 py-2.5 rounded-xl shadow-md disabled:opacity-60"
                                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                    >
                                        {activating ? 'Активируем…' : 'Сделать активной'}
                                    </button>
                                )}
                            </section>

                            {/* ── ОСНОВНОЕ ── */}
                            <section className="flex flex-col gap-4">
                                <div>
                                    <h4 className="font-bold text-[15px] text-[#1C1A3A]">Основное</h4>
                                    <p className="text-xs text-[#A9A7BB] mt-0.5">Название потока и ключевые даты.</p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Название потока</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => patchEdit({ name: e.target.value })}
                                        placeholder="Поток 2027"
                                        className="w-full text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {([
                                        { label: 'Приём заявок с', key: 'application_start' },
                                        { label: 'Приём заявок по', key: 'application_end' },
                                        { label: 'Практика с', key: 'practice_start' },
                                        { label: 'Практика по', key: 'practice_end' },
                                    ] as const).map(field => (
                                        <div key={field.key} className="flex flex-col gap-1.5">
                                            <label className="text-sm font-medium text-[#1C1A3A]">{field.label}</label>
                                            <input
                                                type="date"
                                                value={editForm[field.key]}
                                                onChange={e => patchEdit({ [field.key]: e.target.value } as Partial<EditForm>)}
                                                className="w-full text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* ── РОЛИ / ТРЕКИ ── */}
                            <section className="flex flex-col gap-2">
                                <div>
                                    <h4 className="font-bold text-[15px] text-[#1C1A3A]">Роли / треки</h4>
                                    <p className="text-xs text-[#A9A7BB] mt-0.5">
                                        {editingCohort?.isActive
                                            ? 'Новые роли сразу сохраняются на сервере.'
                                            : 'Роли сохранятся на сервере после активации когорты.'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Например: Backend"
                                        value={editRole}
                                        onChange={e => setEditRole(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addEditRole()}
                                        className="flex-1 text-sm"
                                    />
                                    <button
                                        onClick={addEditRole}
                                        className="px-4 py-2 text-sm font-semibold text-white rounded-lg"
                                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                    >
                                        +
                                    </button>
                                </div>
                                {editForm.roles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {editForm.roles.map(role => (
                                            <div key={role} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#EBE9FF] border border-[#6C63FF] text-[#4A42D4] rounded-full">
                                                {role}
                                                <button onClick={() => removeEditRole(role)} className="text-[#6C63FF] hover:text-[#4A42D4] leading-none">×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* ── ТЕСТОВОЕ ЗАДАНИЕ ── */}
                            <section className="flex flex-col gap-3">
                                <div>
                                    <h4 className="font-bold text-[15px] text-[#1C1A3A]">Тестовое задание</h4>
                                    <p className="text-xs text-[#A9A7BB] mt-0.5">Кандидат увидит его только после отправки анкеты.</p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-[#1C1A3A]">Текст задания</label>
                                    <textarea
                                        rows={4}
                                        value={editForm.testTaskContent}
                                        onChange={e => patchEdit({ testTaskContent: e.target.value })}
                                        placeholder="Опишите тестовое задание для кандидатов…"
                                        className="w-full text-sm rounded-lg border border-[#E4E2F4] px-3.5 py-2.5 resize-none focus:outline-none focus:border-[#6C63FF]"
                                    />
                                </div>
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={editForm.testTaskPublished}
                                        onChange={e => patchEdit({ testTaskPublished: e.target.checked })}
                                        className="w-4 h-4 accent-[#6C63FF]"
                                    />
                                    <span className="text-sm text-[#1C1A3A]">Опубликовать — кандидаты получат уведомление на e-mail</span>
                                </label>
                            </section>

                            {/* ── ПОЛЯ АНКЕТЫ ── */}
                            <section className="flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-bold text-[15px] text-[#1C1A3A]">Поля анкеты</h4>
                                        <p className="text-xs text-[#A9A7BB] mt-0.5">Вопросы публичной анкеты когорты.</p>
                                    </div>
                                    <button
                                        onClick={addField}
                                        className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF] transition-all whitespace-nowrap"
                                    >
                                        + Поле
                                    </button>
                                </div>

                                {editForm.fields.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[#E4E2F4] px-4 py-6 text-center">
                                        <p className="text-sm text-[#A9A7BB]">Полей пока нет. Добавьте первый вопрос анкеты.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {editForm.fields.map((field, idx) => (
                                            <div key={field.id} className="rounded-xl border border-[#E4E2F4] bg-[#FBFAFF] p-4 flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB] w-6 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={e => updateField(field.id, { label: e.target.value })}
                                                        placeholder="Текст вопроса, напр. Желаемая роль"
                                                        className="flex-1 text-sm"
                                                    />
                                                    <select
                                                        value={field.type}
                                                        onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                                                        className="text-sm rounded-lg border border-[#E4E2F4] px-2.5 py-2 bg-white focus:outline-none focus:border-[#6C63FF]"
                                                    >
                                                        <option value="text">Текст</option>
                                                        <option value="select">Список</option>
                                                    </select>
                                                    <button
                                                        onClick={() => removeField(field.id)}
                                                        className="text-[#A9A7BB] hover:text-[#D94F4F] text-xl leading-none px-1 shrink-0"
                                                        aria-label="Удалить поле"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                                {field.type === 'select' && (
                                                    <div className="flex flex-col gap-1.5 pl-8">
                                                        <label className="text-xs font-medium text-[#6B6880]">Варианты ответа (через запятую)</label>
                                                        <input
                                                            type="text"
                                                            value={field.options.join(', ')}
                                                            onChange={e => updateField(field.id, {
                                                                options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                                            })}
                                                            placeholder="Frontend, Backend, Аналитик"
                                                            className="w-full text-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {editError && (
                                <div className="bg-[#FFF5F5] border border-[#F0BABA] rounded-xl px-4 py-3">
                                    <p className="text-sm text-[#D94F4F]">⚠️ {editError}</p>
                                </div>
                            )}

                            {/* footer */}
                            <div className="flex justify-end gap-3 border-t border-[#E4E2F4] pt-5 mt-1">
                                <button
                                    onClick={closeEdit}
                                    className="px-5 py-2.5 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-xl"
                                >
                                    Закрыть
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={editSaving}
                                    className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
                                >
                                    {editSaving ? 'Сохраняем…' : 'Сохранить'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
