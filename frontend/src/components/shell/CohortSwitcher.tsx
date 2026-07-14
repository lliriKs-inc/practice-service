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
        return <span className="text-xs text-[#6B6880]">Загружаем когорты…</span>
    }

    if (cohorts.length === 0) {
        return <span className="text-xs text-[#6B6880]">Когорт пока нет</span>
    }

    return (
        <label className="flex items-center gap-2 text-xs text-[#6B6880]">
            <span className="hidden sm:inline">Когорта:</span>
            <select
                value={selectedCohortId ?? ''}
                onChange={e => onChange(e.target.value)}
                aria-label="Выбор рабочей когорты"
                className="text-xs font-semibold rounded-lg border border-[#E4E2F4] bg-white px-3 py-1.5 focus:outline-none focus:border-[#6C63FF] max-w-[180px]"
            >
                {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                ))}
            </select>
        </label>
    )
}
