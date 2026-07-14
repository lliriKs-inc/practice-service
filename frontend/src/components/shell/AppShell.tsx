'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/services/api/auth'

export interface ShellNavItem {
    href: string
    icon: string
    label: string
    /** Базовый путь для подсветки активного пункта (без query-параметров) */
    matchPath: string
}

export function AppShell({
    navItems,
    roleBadge,
    userEmail,
    headerRight,
    children,
}: {
    navItems: ShellNavItem[]
    roleBadge?: string
    userEmail?: string
    headerRight?: React.ReactNode
    children: React.ReactNode
}) {
    const pathname = usePathname()

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">
            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="font-extrabold text-base text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                    {roleBadge && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#1C1A3A] rounded-full ml-2">
                            <span className="text-xs font-semibold text-white">{roleBadge}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {headerRight}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF]" />
                        <span className="text-xs font-semibold text-[#4A42D4]">{userEmail ?? '…'}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white text-sm font-bold flex items-center justify-center">
                        {userEmail?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                {/* SIDEBAR */}
                <aside className="w-56 bg-white border-r border-[#E4E2F4] flex flex-col p-4 gap-1 sticky top-[65px] h-[calc(100vh-65px)]">
                    {navItems.map(item => {
                        const active = pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
                        return (
                            <Link key={item.matchPath} href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                    ${active ? 'bg-[#EBE9FF] text-[#4A42D4]' : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}>
                                <span>{item.icon}</span>{item.label}
                            </Link>
                        )
                    })}
                    <div className="mt-auto pt-4 border-t border-[#E4E2F4]">
                        <button onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left">
                            <span>🚪</span> Выйти
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <main className="flex-1 p-8 flex flex-col gap-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
