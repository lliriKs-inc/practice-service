'use client'

import type { Cohort } from '@/services/api/cohorts'

export function CohortSwitcher({
    cohorts,
    loading,
    selectedCohortId,
    onChange,
}: {
    cohorts: Cohort[]
    loading: boolean
    selectedCohortId: string | null
    onChange: (id: string) => void
}) {
    if (loading) {
        return <span className="text-xs text-muted-ink">Загружаем когорты…</span>
    }

    if (cohorts.length === 0) {
        return <span className="text-xs text-muted-ink">Когорт пока нет</span>
    }

    return (
        <label className="flex items-center gap-2 text-xs text-muted-ink">
            <span className="hidden sm:inline">Когорта:</span>
            <select
                value={selectedCohortId ?? ''}
                onChange={e => onChange(e.target.value)}
                aria-label="Выбор рабочей когорты"
                className="text-xs font-semibold rounded-lg border border-border-soft bg-white px-3 py-1.5 focus:outline-none focus:border-brand max-w-[180px]"
            >
                {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                ))}
            </select>
        </label>
    )
}
