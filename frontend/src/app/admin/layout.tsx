'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FolderKanban, ClipboardList, FileText, ListChecks, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getCohorts, type Cohort } from '@/services/api/cohorts'
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell'
import { CohortSwitcher } from '@/components/shell/CohortSwitcher'
import { LoadingScreen } from '@/components/shell/LoadingScreen'
import { CohortWorkspaceContext } from './cohort-context'

const NAV_BASE: { matchPath: string; icon: LucideIcon; label: string }[] = [
    { matchPath: '/admin/cohorts', icon: FolderKanban, label: 'Когорты' },
    { matchPath: '/admin/applications', icon: ClipboardList, label: 'Заявки' },
    { matchPath: '/admin/documents', icon: FileText, label: 'Документы' },
    { matchPath: '/admin/tasks', icon: ListChecks, label: 'Задачи' },
]

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth('ADMIN')
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [cohorts, setCohorts] = useState<Cohort[]>([])
    const [cohortsLoading, setCohortsLoading] = useState(true)
    const [cohortsError, setCohortsError] = useState('')

    const loadCohorts = useCallback(async () => {
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
    }, [])

    useEffect(() => {
        if (authLoading) return
        ;(async () => {
            await loadCohorts()
        })()
    }, [authLoading, loadCohorts])

    const cohortFromQuery = searchParams.get('cohort')
    const fallbackCohortId = cohorts.find(c => c.status === 'active')?.id ?? cohorts[0]?.id ?? null
    const selectedCohortId = (cohortFromQuery && cohorts.some(c => c.id === cohortFromQuery))
        ? cohortFromQuery
        : fallbackCohortId
    const selectedCohort = cohorts.find(c => c.id === selectedCohortId) ?? null

    function setSelectedCohortId(id: string) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('cohort', id)
        router.push(`${pathname}?${params.toString()}`)
    }

    // [FIX] Если в URL нет ?cohort=, а когорты уже загрузились — подставляем
    // выбранную по умолчанию в адрес, чтобы переход между разделами не терял её
    useEffect(() => {
        if (cohortsLoading || !selectedCohortId || cohortFromQuery === selectedCohortId) return
        const params = new URLSearchParams(searchParams.toString())
        params.set('cohort', selectedCohortId)
        router.replace(`${pathname}?${params.toString()}`)
    }, [cohortsLoading, selectedCohortId, cohortFromQuery, pathname, router, searchParams])

    const navItems: ShellNavItem[] = useMemo(() => NAV_BASE.map(item => ({
        ...item,
        href: selectedCohortId ? `${item.matchPath}?cohort=${selectedCohortId}` : item.matchPath,
    })), [selectedCohortId])

    if (authLoading) return <LoadingScreen />

    return (
        <CohortWorkspaceContext.Provider value={{
            cohorts, cohortsLoading, cohortsError,
            selectedCohortId, selectedCohort, setSelectedCohortId,
            refetchCohorts: loadCohorts,
        }}>
            <AppShell
                navItems={navItems}
                roleBadge="Админ"
                userName={user?.full_name}
                userEmail={user?.email}
                headerRight={
                    <CohortSwitcher
                        cohorts={cohorts}
                        loading={cohortsLoading}
                        selectedCohortId={selectedCohortId}
                        onChange={setSelectedCohortId}
                    />
                }
            >
                {children}
            </AppShell>
        </CohortWorkspaceContext.Provider>
    )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </Suspense>
    )
}
