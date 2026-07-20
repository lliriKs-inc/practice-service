'use client'

import { Layers, ChevronDown } from 'lucide-react'
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

    const selected = cohorts.find(c => c.id === selectedCohortId)

    return (
        <div className="relative flex items-center h-8 gap-2 pl-3 pr-7 rounded-lg border border-border-soft bg-white flex-shrink-0 focus-within:border-brand cursor-pointer">
            <Layers className="size-3.5 text-muted-ink flex-shrink-0 pointer-events-none" />
            <span className="text-xs font-semibold text-ink truncate max-w-[160px] pointer-events-none">{selected?.title ?? ''}</span>
            <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 pointer-events-none" />
            <select
                value={selectedCohortId ?? ''}
                onChange={e => onChange(e.target.value)}
                aria-label="Выбор рабочей когорты"
                className="absolute inset-0 w-full h-full !p-0 !border-0 opacity-0 cursor-pointer text-sm"
            >
                {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                ))}
            </select>
        </div>
    )
}
