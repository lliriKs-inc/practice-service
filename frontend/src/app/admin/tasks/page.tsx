'use client'

import { useEffect, useState, useCallback } from 'react'
import { getCohortWeekProgress, getMissedProgress, type CohortWeekProgress, type MissedProgress } from '@/services/api/tasks'
import { useCohortWorkspace } from '../cohort-context'

function getMondayOfWeek(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setUTCDate(d.getUTCDate() + diff)
    return d
}

function toISODate(date: Date): string {
    return date.toISOString().split('T')[0]
}

function addDays(date: Date, n: number): Date {
    const d = new Date(date)
    d.setUTCDate(d.getUTCDate() + n)
    return d
}

function isWeekendUTC(date: Date): boolean {
    const day = date.getUTCDay()
    return day === 0 || day === 6
}

// [FIX] Как и в студенческом дневнике задач: если период практики начинается/
// заканчивается в выходной, обычный Monday-of-week уводит на неделю целиком
// вне границ практики — ищем первый/последний будний день.
function firstPracticeWeekMonday(practiceStartIso: string): Date {
    let d = new Date(practiceStartIso)
    d.setUTCHours(0, 0, 0, 0)
    while (isWeekendUTC(d)) d = addDays(d, 1)
    return getMondayOfWeek(d)
}

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']

export default function AdminTasksPage() {
    const { selectedCohort } = useCohortWorkspace()

    const [weekStart, setWeekStart] = useState<string>(() => toISODate(getMondayOfWeek(new Date())))

    // При выборе рабочей когорты сразу открываем первую рабочую неделю практики,
    // а не "сегодня" (которое почти наверняка вне диапазона практики)
    useEffect(() => {
        (() => {
            if (!selectedCohort) return
            const practiceMonday = toISODate(firstPracticeWeekMonday(selectedCohort.start_date))
            setWeekStart(() => practiceMonday)
        })()
    }, [selectedCohort])
    const [progress, setProgress] = useState<CohortWeekProgress | null>(null)
    const [missed, setMissed] = useState<MissedProgress | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!selectedCohort) return
        setLoading(true)
        setError('')
        try {
            const [progressData, missedData] = await Promise.all([
                getCohortWeekProgress(selectedCohort.id, weekStart),
                getMissedProgress(selectedCohort.id, weekStart),
            ])
            setProgress(progressData)
            setMissed(missedData)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки прогресса')
        } finally {
            setLoading(false)
        }
    }, [selectedCohort, weekStart])

    useEffect(() => {
        (async () => { await load() })()
    }, [load])

    function goPrevWeek() {
        setWeekStart(prev => toISODate(addDays(new Date(prev), -7)))
    }

    function goNextWeek() {
        setWeekStart(prev => toISODate(addDays(new Date(prev), 7)))
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-extrabold text-2xl tracking-tight text-ink mb-1">Прогресс</h1>
                    <p className="text-sm text-muted-ink">
                        {selectedCohort ? `Дневник задач когорты «${selectedCohort.title}»` : 'Выберите рабочую когорту в шапке.'}
                    </p>
                </div>
                {selectedCohort && (
                    <div className="flex gap-2">
                        <button onClick={goPrevWeek} className="px-4 py-2 text-sm font-medium border border-border-soft rounded-lg bg-white text-muted-ink hover:bg-surface">← Пред.</button>
                        <button onClick={goNextWeek} className="px-4 py-2 text-sm font-medium border border-border-soft rounded-lg bg-white text-muted-ink hover:bg-surface">След. →</button>
                    </div>
                )}
            </div>

            {!selectedCohort && (
                <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                    <div className="text-4xl mb-4">🗂️</div>
                    <p className="font-semibold text-ink mb-1">Выберите рабочую когорту</p>
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-ink">
                    <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Загружаем…
                </div>
            )}

            {error && (
                <div className="bg-danger-bg border border-danger-border rounded-xl px-5 py-4">
                    <p className="text-sm text-danger">⚠️ {error}</p>
                </div>
            )}

            {selectedCohort && !loading && !error && progress && (
                progress.students.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                        <div className="text-4xl mb-4">✅</div>
                        <p className="font-semibold text-ink mb-1">Одобренных заявок пока нет</p>
                        <p className="text-sm text-muted-ink">Дневник задач появится после одобрения заявок кандидатов.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-soft">
                                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-ink uppercase whitespace-nowrap">Студент</th>
                                    {progress.days.map((date, i) => {
                                        const d = new Date(date)
                                        return (
                                            <th key={date} className="text-center px-3 py-3 text-xs font-bold text-muted-ink uppercase whitespace-nowrap">
                                                {DAYS_RU[i]} {d.getUTCDate()}.{String(d.getUTCMonth() + 1).padStart(2, '0')}
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {progress.students.map(student => (
                                    <tr key={student.applicationId} className="border-b border-border-soft last:border-b-0">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="font-semibold text-ink">{student.student.email}</p>
                                            <p className="text-xs text-muted-ink">{student.track.title}</p>
                                        </td>
                                        {student.tasks.map(day => (
                                            <td key={day.date} className="text-center px-3 py-3">
                                                {!day.task ? (
                                                    <span className="text-faint-ink">—</span>
                                                ) : day.task.description ? (
                                                    <span title={day.task.description} className="inline-flex w-2.5 h-2.5 rounded-full bg-success-dot" />
                                                ) : (
                                                    <span className="inline-flex w-2.5 h-2.5 rounded-full bg-border-soft" />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {selectedCohort && !loading && !error && missed && missed.missed.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-7 py-5 border-b border-border-soft">
                        <h2 className="font-bold text-lg text-ink">⚠️ Пропущенные дни на этой неделе</h2>
                    </div>
                    <div className="flex flex-col divide-y divide-border-soft">
                        {missed.missed.map(m => (
                            <div key={m.taskId} className="px-7 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-ink">{m.student.email}</p>
                                    <p className="text-xs text-muted-ink">{m.track.title}</p>
                                </div>
                                <span className="text-xs text-danger">{new Date(m.taskDate).toLocaleDateString('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' })}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
