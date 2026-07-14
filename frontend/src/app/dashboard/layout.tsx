'use client'

import { useAuth } from '@/hooks/useAuth'
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell'
import { LoadingScreen } from '@/components/shell/LoadingScreen'

const NAV_ITEMS: ShellNavItem[] = [
    { href: '/dashboard/applications', matchPath: '/dashboard/applications', icon: '📋', label: 'Заявки' },
    { href: '/dashboard/documents', matchPath: '/dashboard/documents', icon: '📄', label: 'Документы' },
    { href: '/dashboard/tasks', matchPath: '/dashboard/tasks', icon: '✅', label: 'Задачи' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth('STUDENT')

    if (loading) return <LoadingScreen />

    return (
        <AppShell navItems={NAV_ITEMS} userEmail={user?.email}>
            {children}
        </AppShell>
    )
}
