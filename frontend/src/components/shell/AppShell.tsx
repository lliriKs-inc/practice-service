'use client'

import { useState } from 'react'
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
    // [FIX] У сайдбара не было мобильного брейкпоинта вообще — на узких
    // экранах (< md) он занимал фиксированные 224px рядом с контентом,
    // из-за чего элементы наезжали друг на друга и часть UI была недоступна
    // для клика. Теперь на мобильных сайдбар скрыт за гамбургер-меню.
    const [mobileNavOpen, setMobileNavOpen] = useState(false)

    return (
        <div className="min-h-screen bg-[#F5F4FD] flex flex-col">
            {/* NAVBAR */}
            <header className="bg-white border-b border-[#E4E2F4] px-4 md:px-8 py-4 flex items-center justify-between gap-3 sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setMobileNavOpen(v => !v)} aria-label="Открыть меню навигации"
                        className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 text-[#1C1A3A] hover:bg-[#F5F4FD]">
                        {mobileNavOpen ? '✕' : '☰'}
                    </button>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                    <span className="hidden sm:inline font-extrabold text-base text-[#1C1A3A] tracking-tight truncate">Практика УрФУ</span>
                    {roleBadge && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#1C1A3A] rounded-full ml-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-white">{roleBadge}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {headerRight}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#EBE9FF] rounded-full min-w-0">
                        <div className="w-2 h-2 rounded-full bg-[#6C63FF] flex-shrink-0" />
                        <span className="text-xs font-semibold text-[#4A42D4] truncate">{userEmail ?? '…'}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                        {userEmail?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            </header>

            {/* MOBILE NAV (гамбургер-меню) */}
            {mobileNavOpen && (
                <nav className="md:hidden bg-white border-b border-[#E4E2F4] flex flex-col p-4 gap-1 sticky top-[65px] z-10">
                    {navItems.map(item => {
                        const active = pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
                        return (
                            <Link key={item.matchPath} href={item.href} onClick={() => setMobileNavOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                    ${active ? 'bg-[#EBE9FF] text-[#4A42D4]' : 'text-[#6B6880] hover:bg-[#F5F4FD]'}`}>
                                <span>{item.icon}</span>{item.label}
                            </Link>
                        )
                    })}
                    <div className="mt-2 pt-2 border-t border-[#E4E2F4]">
                        <button onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#6B6880] hover:bg-[#F5F4FD] w-full text-left">
                            <span>🚪</span> Выйти
                        </button>
                    </div>
                </nav>
            )}

            <div className="flex flex-1 min-w-0">
                {/* SIDEBAR — только от md и выше, на мобильных заменён гамбургер-меню сверху */}
                <aside className="hidden md:flex w-56 bg-white border-r border-[#E4E2F4] flex-col p-4 gap-1 sticky top-[65px] h-[calc(100vh-65px)] flex-shrink-0">
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
                <main className="flex-1 min-w-0 p-4 md:p-8 flex flex-col gap-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
