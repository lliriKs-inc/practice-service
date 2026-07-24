'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GraduationCap, LogOut, ShieldCheck, Menu, X, type LucideIcon } from 'lucide-react'
import { logout } from '@/services/api/auth'

export interface ShellNavItem {
    href: string
    icon: LucideIcon
    label: string
    /** Базовый путь для подсветки активного пункта (без query-параметров) */
    matchPath: string
}

export function AppShell({
    navItems,
    roleBadge,
    userName,
    userEmail,
    headerRight,
    children,
}: {
    navItems: ShellNavItem[]
    roleBadge?: string
    userName?: string
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
        <div className="min-h-screen bg-surface flex flex-col">
            {/* NAVBAR */}
            <header className="bg-white border-b border-border-soft px-4 md:px-8 py-4 flex items-center justify-between gap-3 sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setMobileNavOpen(v => !v)} aria-label="Открыть меню навигации"
                        className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-ink hover:bg-surface">
                        {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                    </button>
                    <Link href="/" className="group flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 bg-gradient-to-br from-brand to-brand-light"><GraduationCap className="size-4" /></div>
                        <span className="hidden sm:inline font-extrabold text-base text-ink tracking-tight truncate group-hover:text-brand-hover transition-colors">Практика УрФУ</span>
                    </Link>
                    {roleBadge && (
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-ink rounded-full ml-2 flex-shrink-0">
                            <ShieldCheck className="size-3.5 text-white" />
                            <span className="text-xs font-semibold text-white">{roleBadge}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {headerRight}
                    <div className="hidden sm:flex items-center gap-2 min-w-0 px-3.5 py-1.5 bg-brand-subtle border border-brand-subtle-border rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                        <span className="text-sm font-semibold text-brand-hover truncate">{userName ?? userEmail ?? '…'}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-light text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                        {(userName ?? userEmail)?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            </header>

            {/* MOBILE NAV (гамбургер-меню) */}
            {mobileNavOpen && (
                <nav className="md:hidden bg-white border-b border-border-soft flex flex-col p-4 gap-1 sticky top-[65px] z-10">
                    {navItems.map(item => {
                        const active = pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
                        return (
                            <Link key={item.matchPath} href={item.href} onClick={() => setMobileNavOpen(false)}
                                className={`relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-300 text-left border-l-[3px]
                                    ${active ? 'text-white border-brand shadow-sm' : 'text-muted-ink border-transparent hover:bg-surface'}`}>
                                <span className={`absolute inset-0 -z-10 bg-gradient-to-br from-brand to-brand-light transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} />
                                <item.icon className="size-4" />{item.label}
                            </Link>
                        )
                    })}
                    <div className="mt-2 pt-2 border-t border-border-soft">
                        <button onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-ink border-l-[3px] border-transparent hover:bg-surface transition-colors duration-300 w-full text-left">
                            <LogOut className="size-4" /> Выйти
                        </button>
                    </div>
                </nav>
            )}

            <div className="flex flex-1 min-w-0">
                {/* SIDEBAR — только от md и выше, на мобильных заменён гамбургер-меню сверху */}
                <aside className="hidden md:flex w-56 bg-white border-r border-border-soft flex-col p-4 gap-1 sticky top-[65px] h-[calc(100vh-65px)] flex-shrink-0">
                    {navItems.map(item => {
                        const active = pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
                        return (
                            <Link key={item.matchPath} href={item.href}
                                className={`relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-300 text-left border-l-[3px]
                                    ${active ? 'text-white border-brand shadow-sm' : 'text-muted-ink border-transparent hover:bg-surface'}`}>
                                <span className={`absolute inset-0 -z-10 bg-gradient-to-br from-brand to-brand-light transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} />
                                <item.icon className="size-4" />{item.label}
                            </Link>
                        )
                    })}
                    <div className="mt-auto pt-4 border-t border-border-soft">
                        <button onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-ink border-l-[3px] border-transparent hover:bg-surface transition-colors duration-300 w-full text-left">
                            <LogOut className="size-4" /> Выйти
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
