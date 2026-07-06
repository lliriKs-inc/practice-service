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

    async function handleActivate(cohortId: string) {
        try {
            await activateCohort(cohortId)
            // загружаем роли активной когорты
            const roles = await getRoles()
            setCohorts(prev => prev.map(c => ({
                ...c,
                isActive: c.id === cohortId,
                roles: c.id === cohortId ? roles.map(r => r.name) : c.roles,
            })))
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Ошибка активации')
        }
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
                                                onClick={() => handleActivate(cohort.id)}
                                                className={`text-xs font-semibold px-4 py-1.5 rounded-lg border transition-all
                                                    ${cohort.isActive
                                                        ? 'border-[#E4E2F4] text-[#A9A7BB] cursor-default'
                                                        : 'border-[#6C63FF] text-[#6C63FF] hover:bg-[#EBE9FF]'}`}
                                                disabled={cohort.isActive}
                                            >
                                                {cohort.isActive ? 'Выбрана' : 'Активировать'}
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

        </div>
    )
}
