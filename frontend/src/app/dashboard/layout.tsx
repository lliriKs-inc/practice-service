'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, FileText, ListChecks, Route } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell'
import { LoadingScreen } from '@/components/shell/LoadingScreen'
import { getMyApplications, type Application } from '@/services/api/invitation'

const NAV_ITEMS: ShellNavItem[] = [
    { href: '/dashboard/applications', matchPath: '/dashboard/applications', icon: ClipboardList, label: 'Заявки' },
    { href: '/dashboard/documents', matchPath: '/dashboard/documents', icon: FileText, label: 'Документы' },
    { href: '/dashboard/tasks', matchPath: '/dashboard/tasks', icon: ListChecks, label: 'Задачи' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth('STUDENT')
    const [applications, setApplications] = useState<Application[]>([])

    useEffect(() => {
        getMyApplications().then(setApplications).catch(() => {})
    }, [])

    if (loading) return <LoadingScreen />

    // Трек показываем в шапке, только если у студента есть ровно один
    // однозначный "рабочий" трек — как только он одобрен, дальше подавать
    // заявки в другие когорты студенту уже нельзя (см. COHORT_ALREADY_LOCKED),
    // поэтому среди одобренных заявок либо одна, либо явно выбранная активная.
    const approvedApplications = applications.filter(a => a.status === 'approved')
    const activeApplication = approvedApplications.find(a => a.id === user?.active_application_id)
        ?? (approvedApplications.length === 1 ? approvedApplications[0] : null)

    return (
        <AppShell navItems={NAV_ITEMS} userName={user?.full_name} userEmail={user?.email}
            trackBadge={activeApplication ? { icon: Route, label: activeApplication.track.title } : undefined}>
            {children}
        </AppShell>
    )
}
