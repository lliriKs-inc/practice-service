'use client'

import { createContext, useContext } from 'react'
import type { Cohort } from '@/services/api/cohorts'

export interface CohortWorkspaceContextValue {
    cohorts: Cohort[]
    cohortsLoading: boolean
    cohortsError: string
    selectedCohortId: string | null
    selectedCohort: Cohort | null
    setSelectedCohortId: (id: string) => void
    refetchCohorts: () => Promise<void>
}

export const CohortWorkspaceContext = createContext<CohortWorkspaceContextValue | null>(null)

export function useCohortWorkspace(): CohortWorkspaceContextValue {
    const ctx = useContext(CohortWorkspaceContext)
    if (!ctx) throw new Error('useCohortWorkspace должен использоваться внутри admin layout')
    return ctx
}
