'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/api/auth'

type Tab = 'applications' | 'documents' | 'tasks'
type TaskStatus = 'done' | 'review' | 'empty'

interface TaskItem {
    title: string
    status: TaskStatus
    hours: number
    artifact: string
}

const initialTasks: Record<string, TaskItem> = {
    '2026-07-06': { title: 'Настройка окружения, изучение кодовой базы', status: 'done', hours: 6, artifact: 'https://github.com/' },
    '2026-07-07': { title: 'Реализация эндпоинта авторизации', status: 'review', hours: 8, artifact: '' },
    '2026-07-08': { title: '', status: 'empty', hours: 0, artifact: '' },
    '2026-07-09': { title: '', status: 'empty', hours: 0, artifact: '' },
    '2026-07-10': { title: '', status: 'empty', hours: 0, artifact: '' },
}

const mockAuditTrail = [
    { id: 1, date: '06.07.2026 14:15', user: 'Игорь Родионов (Студент)', action: 'Создал задачу и описал выполненную работу' },
    { id: 2, date: '07.07.2026 11:30', user: 'Езуб А.С. (Руководитель)', action: 'Перевёл задачу на статус "На ревью", оставил комментарий: "Проверь обработку ошибок"' },
]

const initialDocFields = [
    { id: 'fio', label: 'ФИО студента', value: 'Иванов Иван Иванович', filled: true },
    { id: 'group', label: 'Группа', value: 'РИ-330948', filled: true },
    { id: 'direction_code', label: 'Код направления', value: '09.03.04', filled: true },
    { id: 'direction_name', label: 'Наименование направления', value: 'Программная инженерия', filled: true },
    { id: 'program_name', label: 'Наименование образовательной программы', value: '', filled: false },
    { id: 'practice_topic', label: 'Тема индивидуального задания', value: '', filled: false },
    { id: 'main_stage_tasks', label: 'Перечень работ основного этапа', value: '', filled: false },
]

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth()

    // Основные стейты
    const [tab, setTab] = useState<Tab>('applications')
    const [tasks, setTasks] = useState<Record<string, TaskItem>>(initialTasks)
    const [fields, setFields] = useState(initialDocFields)
    const [uploadedReport, setUploadedReport] = useState<string | null>(null)

    // Стейты для попапа редактирования задачи
    const [taskPopup, setTaskPopup] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editHours, setEditHours] = useState(0)
    const [editArtifact, setEditArtifact] = useState('')
    const [urlError, setUrlError] = useState(false)

    // Инициализация из localStorage
    useEffect(() => {
        setTimeout(() => {
            const savedTasks = localStorage.getItem('student_tasks')
            const savedFields = localStorage.getItem('student_fields')
            const savedReport = localStorage.getItem('student_report')
            
            if (savedTasks) setTasks(JSON.parse(savedTasks))
            if (savedFields) setFields(JSON.parse(savedFields))
            if (savedReport) setUploadedReport(savedReport)
        }, 0)
    }, [])

    // Расчет прогресса заполнения документов
    const filledCount = fields.filter(f => f.filled).length
    const progressPercent = Math.round((filledCount / fields.length) * 100)
    const allDocFilled = filledCount === fields.length

    function openTaskPopup(date: string) {
        const currentTask = tasks[date]
        setTaskPopup(date)
        setEditTitle(currentTask?.title || '')
        setEditHours(currentTask?.hours || 0)
        setEditArtifact(currentTask?.artifact || '')
        setUrlError(false)
    }

    function handleSaveTask() {
        if (!taskPopup) return

        if (editArtifact.trim() !== '') {
            const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/
            if (!urlPattern.test(editArtifact)) {
                setUrlError(true)
                return
            }
        }

        // Вычисляем статус отдельно, чтобы TypeScript понял, что это TaskStatus
        const newStatus: TaskStatus = editTitle.trim() === '' 
            ? 'empty' 
            : (tasks[taskPopup]?.status === 'empty' ? 'review' : tasks[taskPopup].status)

        const updatedTasks: Record<string, TaskItem> = {
            ...tasks,
            [taskPopup]: {
                title: editTitle,
                hours: editHours,
                artifact: editArtifact,
                status: newStatus
            }
        }

        setTasks(updatedTasks)
        localStorage.setItem('student_tasks', JSON.stringify(updatedTasks))
        setTaskPopup(null)
    }

    function handleFieldChange(id: string, value: string) {
        const updatedFields = fields.map(f => 
            f.id === id ? { ...f, value, filled: value.trim() !== '' } : f
        )
        setFields(updatedFields)
        localStorage.setItem('student_fields', JSON.stringify(updatedFields))
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const fileName = e.target.files[0].name
            setUploadedReport(fileName)
            localStorage.setItem('student_report', fileName)
        }
    }

    // СКЕЛЕTON ЗАГРУЗКИ
    if (authLoading) return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col animate-pulse">
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-5 flex justify-between items-center">
                <div className="w-32 h-6 bg-slate-200 rounded-lg" />
                <div className="w-40 h-8 bg-slate-200 rounded-full" />
            </header>
            <div className="flex flex-1">
                <aside className="w-56 bg-white border-r border-[#E4E2F4] p-4 space-y-3">
                    <div className="w-full h-10 bg-slate-100 rounded-xl" />
                    <div className="w-full h-10 bg-slate-100 rounded-xl" />
                    <div className="w-full h-10 bg-slate-100 rounded-xl" />
                </aside>
                <main className="flex-1 p-8 space-y-6">
                    <div className="w-48 h-8 bg-slate-200 rounded-lg" />
                    <div className="w-full h-32 bg-white rounded-2xl border border-[#E4E2F4]" />
                    <div className="w-full h-48 bg-white rounded-2xl border border-[#E4E2F4]" />
                </main>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">

            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">{user?.email ?? '…'}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white text-sm font-bold flex items-center justify-center">
                        {user?.email?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            </header>

            <div className="flex flex-1">

                {/* SIDEBAR */}
                <aside className="w-56 bg-white border-r border-[#E4E2F4] flex flex-col p-4 gap-1 sticky top-[65px] h-[calc(100vh-65px)]">
                    {[
                        { id: 'applications', icon: '📋', label: 'Заявки' },
                        { id: 'documents', icon: '📄', label: 'Документы' },
                        { id: 'tasks', icon: '✅', label: 'Задачи' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id as Tab)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                ${tab === item.id ? 'bg-[#EBE9FF] text-[#4A42D4]' : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}
                        >
                            <span>{item.icon}</span> {item.label}
                        </button>
                    ))}
                    <div className="mt-auto pt-4 border-t border-[#E4E2F4]">
                        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left">
                            <span>🚪</span> Выйти
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <main className="flex-1 p-8 flex flex-col gap-6">

                    {/* ── ЗАЯВКИ (Вернули как было!) ── */}
                    {tab === 'applications' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Мои заявки</h1>
                                <p className="text-sm text-[#6B6880]">История всех твоих заявок на практику.</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#E4E2F4]">
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Текущая заявка</p>
                                        <h2 className="font-bold text-lg text-[#1C1A3A]">Поток 2026</h2>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EDFBF4] border border-[#7EE8B8]">
                                        <div className="w-2 h-2 rounded-full bg-[#2CB87A]" />
                                        <span className="text-xs font-semibold text-[#1A7A5A]">Одобрена</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 divide-x divide-[#E4E2F4]">
                                    {[
                                        { label: 'Роль', value: 'Backend-разработчик' },
                                        { label: 'Период', value: '1 июля — 31 авг 2026' },
                                        { label: 'Руководитель', value: 'Езуб А.С.' },
                                    ].map((item, i) => (
                                        <div key={i} className="px-6 py-4 flex flex-col gap-1">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">{item.label}</span>
                                            <span className="text-sm font-semibold text-[#1C1A3A]">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#E4E2F4]">
                                <div className="px-7 py-5 border-b border-[#E4E2F4]">
                                    <p className="text-xs font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Архив</p>
                                    <h2 className="font-bold text-lg text-[#1C1A3A]">Прошлые заявки</h2>
                                </div>
                                {[
                                    { year: 'Поток 2025', role: 'Frontend-разработчик', status: 'Одобрена', color: 'text-[#1A7A5A] bg-[#EDFBF4] border-[#7EE8B8]' },
                                    { year: 'Поток 2024', role: 'Дизайнер', status: 'Отклонена', color: 'text-[#D94F4F] bg-[#FFF5F5] border-[#F0BABA]' },
                                ].map((item, i) => (
                                    <div key={i} className="px-7 py-4 border-b border-[#E4E2F4] last:border-b-0 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-[#1C1A3A]">{item.year}</p>
                                            <p className="text-xs text-[#6B6880]">{item.role}</p>
                                        </div>
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${item.color}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ДОКУМЕНТЫ (Прогресс-бар и драг-н-дроп) ── */}
                    {tab === 'documents' && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Документы</h1>
                                <p className="text-sm text-[#6B6880]">Заполнение информации для автогенерации документов.</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm p-6 border border-[#E4E2F4] flex flex-col gap-3">
                                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#1C1A3A]">
                                    <span>Прогресс заполнения карточки</span>
                                    <span className="text-[#6C63FF]">{progressPercent}%</span>
                                </div>
                                <div className="w-full bg-[#F5F4FD] h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-gradient-to-r from-[#6C63FF] to-[#9B8FFF] h-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm p-7 border border-[#E4E2F4]">
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]"> Данные для документов </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {fields.map(f => (
                                        <div key={f.id} className={`flex flex-col gap-1.5 ${f.id === 'main_stage_tasks' ? 'col-span-2' : ''}`}>
                                            <label className="text-xs font-medium text-[#6B6880]">{f.label}</label>
                                            <div className="relative">
                                                {f.id === 'main_stage_tasks' ? (
                                                    <textarea
                                                        value={f.value}
                                                        placeholder="Перечислите задачи через точку с запятой"
                                                        rows={3}
                                                        onChange={e => handleFieldChange(f.id, e.target.value)}
                                                        className="w-full text-sm rounded-xl border-[#E4E2F4] focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]"
                                                        style={{ resize: 'vertical' }}
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={f.value}
                                                        placeholder={`Введите ${f.label.toLowerCase()}`}
                                                        onChange={e => handleFieldChange(f.id, e.target.value)}
                                                        className="w-full text-sm rounded-xl border-[#E4E2F4] focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]"
                                                    />
                                                )}
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">{f.filled ? '✅' : ''}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#E4E2F4]">
                                <div className="px-7 py-5 border-b border-[#E4E2F4]">
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Генерация документов</p>
                                    <h2 className="font-bold text-lg text-[#1C1A3A]">Скачать готовые формы</h2>
                                </div>
                                <div className="px-7 py-5 border-b border-[#E4E2F4] flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[#1C1A3A] mb-0.5">Индивидуальное задание</p>
                                        <p className="text-xs text-[#A9A7BB]">Формируется автоматически после заполнения всех полей выше.</p>
                                    </div>
                                    <button disabled={!allDocFilled} className={`text-sm font-semibold px-5 py-2 rounded-lg transition-all ${allDocFilled ? 'bg-[#6C63FF] text-white shadow-md hover:bg-[#4A42D4]' : 'bg-[#F5F4FD] text-[#A9A7BB] border border-[#E4E2F4] cursor-not-allowed'}`}>
                                        {allDocFilled ? '⬇ Скачать DOCX' : 'Заполните поля'}
                                    </button>
                                </div>

                                <div className="p-7 bg-slate-50/50 border-t border-[#E4E2F4]">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[#A9A7BB] mb-3">📁 Сдача итогового отчета по практике</p>
                                    <label className="border-2 border-dashed border-[#E4E2F4] hover:border-[#6C63FF] bg-white rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-colors group">
                                        <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileUpload} />
                                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📤</span>
                                        <span className="text-xs font-semibold text-[#1C1A3A]">{uploadedReport ? `Загружено: ${uploadedReport}` : 'Перетащите отчет сюда или нажмите для выбора'}</span>
                                        <span className="text-[10px] text-[#A9A7BB] mt-1">Доступные форматы: PDF, DOCX (макс. 15мб)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ЗАДАЧИ (Сетка с сохранением и часами) ── */}
                    {tab === 'tasks' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Дневник задач</h1>
                                    <p className="text-sm text-[#6B6880]">Неделя 1 · 6 — 10 июля 2026</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 text-sm font-medium border border-[#E4E2F4] rounded-lg bg-white text-[#6B6880] hover:bg-[#F5F4FD]">← Пред.</button>
                                    <button className="px-4 py-2 text-sm font-medium border border-[#E4E2F4] rounded-lg bg-white text-[#6B6880] hover:bg-[#F5F4FD]">След. →</button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#E4E2F4]">
                                <div className="grid grid-cols-5 border-b border-[#E4E2F4]">
                                    {['Пн 6.07', 'Вт 7.07', 'Ср 8.07', 'Чт 9.07', 'Пт 10.07'].map((d, i) => (
                                        <div key={i} className="px-5 py-3 border-r border-[#E4E2F4] last:border-r-0">
                                            <span className="text-xs font-bold text-[#A9A7BB] uppercase tracking-wide">{d}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-5 divide-x divide-[#E4E2F4] min-h-[240px]">
                                    {Object.entries(tasks).map(([date, task]) => (
                                        <div 
                                            key={date} 
                                            onClick={() => openTaskPopup(date)}
                                            className="p-4 flex flex-col justify-between relative group cursor-pointer hover:bg-[#F5F4FD]/50 transition-colors"
                                        >
                                            <div className="flex flex-col gap-2">
                                                <div className={`inline-flex self-start items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full
                                                    ${task.status === 'done' ? 'bg-[#EDFBF4] text-[#1A7A5A]' : task.status === 'review' ? 'bg-[#FFF8ED] text-[#7A5C1A]' : 'bg-slate-100 text-slate-400'}`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'done' ? 'bg-[#2CB87A]' : task.status === 'review' ? 'bg-[#F59E0B]' : 'bg-slate-300'}`} />
                                                    {task.status === 'done' ? 'Выполнено' : task.status === 'review' ? 'На ревью' : 'Пусто'}
                                                </div>
                                                <p className="text-xs text-[#6B6880] leading-relaxed line-clamp-4">{task.title || 'Нажмите, чтобы добавить описание работы...'}</p>
                                            </div>
                                            {task.hours > 0 && (
                                                <div className="mt-3 pt-2 border-t border-slate-100/70 text-right text-[10px] font-semibold text-[#A9A7BB]">
                                                    ⏱ {task.hours} ч.
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {[
                                    { color: 'bg-[#2CB87A]', label: 'Выполнено' },
                                    { color: 'bg-[#F59E0B]', label: 'На ревью' },
                                    { color: 'bg-[#E4E2F4]', label: 'Не заполнено' },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                        <span className="text-xs text-[#6B6880]">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* ПОП-АП С АНИМАЦИЕЙ, ЧАСАМИ, ПОДТВЕРЖДЕНИЕМ ССЫЛОК И АУДИТОМ */}
            {taskPopup && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setTaskPopup(null)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-lg mx-4 max-h-[95vh] flex flex-col overflow-hidden transform scale-in-animation"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5 flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-lg text-[#1C1A3A]">Редактирование карточки дня</h3>
                                <p className="text-xs font-bold text-[#6C63FF] uppercase mt-0.5">{taskPopup}</p>
                            </div>
                            <button onClick={() => setTaskPopup(null)} className="text-[#A9A7BB] hover:text-[#1C1A3A] text-xl leading-none">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-[#A9A7BB]">Что сделано сегодня</label>
                                <textarea
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Опиши выполненную работу детально..."
                                    rows={3}
                                    className="w-full text-sm rounded-xl border-[#E4E2F4] focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-[#A9A7BB]">Затрачено времени (в часах)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={24}
                                    value={editHours}
                                    onChange={e => setEditHours(Number(e.target.value))}
                                    className="w-full text-sm rounded-xl border-[#E4E2F4] focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-[#A9A7BB]">Ссылка на артефакт</label>
                                <input
                                    type="text"
                                    placeholder="GitHub, Figma, Google Drive..."
                                    value={editArtifact}
                                    onChange={e => { setEditArtifact(e.target.value); setUrlError(false); }}
                                    className={`w-full text-sm rounded-xl focus:ring-1 ${urlError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[#E4E2F4] focus:border-[#6C63FF] focus:ring-[#6C63FF]'}`}
                                />
                                {urlError ? (
                                    <span className="text-[10px] text-red-500 font-semibold">⚠️ Введите корректный URL-адрес (например, https://github.com)</span>
                                ) : (
                                    <span className="text-[10px] text-[#A9A7BB]">Необязательно. Ссылка на коммит, репозиторий или макет.</span>
                                )}
                            </div>

                            {tasks[taskPopup]?.title && (
                                <div className="pt-4 border-t border-[#E4E2F4]">
                                    <label className="text-xs font-bold uppercase tracking-wider text-[#A9A7BB] block mb-3">⏱ История изменений</label>
                                    <div className="relative border-l-[1.5px] border-[#E4E2F4] ml-2 pl-4 space-y-3">
                                        {mockAuditTrail.map(log => (
                                            <div key={log.id} className="text-xs relative">
                                                <div className="absolute -left-[21.5px] top-1 w-2.5 h-2.5 bg-white border border-[#A9A7BB] rounded-full" />
                                                <div className="flex items-center gap-2 text-[#6B6880] mb-0.5">
                                                    <span className="font-mono text-[10px]">{log.date}</span>
                                                    <span className="font-bold text-[#1C1A3A] text-[11px]">{log.user}</span>
                                                </div>
                                                <p className="text-[#6B6880] bg-[#F5F4FD]/70 p-2 rounded-lg border border-[#E4E2F4]/50">{log.action}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#E4E2F4] flex-shrink-0">
                            <button onClick={() => setTaskPopup(null)} className="px-5 py-2 text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] rounded-lg">Отмена</button>
                            <button onClick={handleSaveTask} className="px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-md" style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .scale-in-animation {
                    animation: scaleIn 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    )
}