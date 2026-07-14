'use client'

import { useState } from 'react'

// ── Документы: моковые данные (пока не подключены к новой архитектуре) ──
const docFields = [
    { id: 'fio', label: 'ФИО студента', value: 'Иванов Иван Иванович', filled: true },
    { id: 'group', label: 'Группа', value: 'РИ-330948', filled: true },
    { id: 'direction_code', label: 'Код направления', value: '09.03.04', filled: true },
    { id: 'direction_name', label: 'Наименование направления', value: 'Программная инженерия', filled: true },
    { id: 'program_name', label: 'Наименование образовательной программы', value: '', filled: false },
    { id: 'practice_topic', label: 'Тема индивидуального задания', value: '', filled: false },
    { id: 'main_stage_tasks', label: 'Перечень работ основного этапа', value: '', filled: false },
]

export default function DashboardDocumentsPage() {
    const [fields, setFields] = useState(docFields)
    const allDocFilled = fields.every(f => f.filled)

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Документы</h1>
                <p className="text-sm text-[#6B6880]">Заполни поля — документы сформируются автоматически.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-7">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-5 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">
                    Данные для документов
                </p>
                <div className="grid grid-cols-2 gap-4">
                    {fields.map(f => (
                        <div key={f.id} className={`flex flex-col gap-1.5 ${f.id === 'main_stage_tasks' ? 'col-span-2' : ''}`}>
                            <label className="text-xs font-medium text-[#6B6880]">{f.label}</label>
                            <div className="relative">
                                {f.id === 'main_stage_tasks' ? (
                                    <textarea
                                        defaultValue={f.value}
                                        placeholder="Перечислите задачи через точку с запятой"
                                        rows={3}
                                        onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, value: e.target.value, filled: e.target.value.trim() !== '' } : x))}
                                        className="w-full text-sm"
                                        style={{ resize: 'vertical' }}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        defaultValue={f.value}
                                        placeholder={`Введите ${f.label.toLowerCase()}`}
                                        onChange={e => setFields(prev => prev.map(x => x.id === f.id ? { ...x, value: e.target.value, filled: e.target.value.trim() !== '' } : x))}
                                        className="w-full text-sm"
                                    />
                                )}
                                {f.filled && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">✅</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-[#E4E2F4]">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB] mb-1">Готовые документы</p>
                    <h2 className="font-bold text-lg text-[#1C1A3A]">Сформировать и скачать</h2>
                </div>
                {[
                    { title: 'Индивидуальное задание', desc: 'Формируется автоматически после заполнения всех полей', ready: allDocFilled },
                    { title: 'Отзыв руководителя', desc: 'Доступен после того как руководитель заполнит отзыв', ready: false },
                    { title: 'Титульный лист отчёта', desc: 'Доступен после загрузки отчёта и одобрения руководителем', ready: false },
                    { title: 'Извещение', desc: 'Формируется вместе с остальными документами', ready: false },
                ].map((doc, i) => (
                    <div key={i} className="px-7 py-5 border-b border-[#E4E2F4] last:border-b-0 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-[#1C1A3A] mb-0.5">{doc.title}</p>
                            <p className="text-xs text-[#A9A7BB]">{doc.desc}</p>
                        </div>
                        <button disabled={!doc.ready}
                            className={`text-sm font-semibold px-5 py-2 rounded-lg flex-shrink-0 transition-all
                                ${doc.ready
                                    ? 'bg-[#6C63FF] text-white shadow-md hover:bg-[#4A42D4]'
                                    : 'bg-[#F5F4FD] text-[#A9A7BB] border border-[#E4E2F4] cursor-not-allowed'}`}>
                            {doc.ready ? '⬇ Скачать' : 'Не готов'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
