'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { logout, type User } from '@/services/api/auth'

function subscribeToSession() {
    return () => undefined
}

function getServerSession(): string | null {
    return null
}

function getSessionSnapshot(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('user')
}

export default function HomePage() {
    const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getServerSession)
    const user = useMemo<User | null>(() => {
        if (!session) return null
        try {
            return JSON.parse(session) as User
        } catch {
            return null
        }
    }, [session])

    const dashboardHref = user?.role === 'ADMIN' ? '/admin/cohorts' : '/dashboard'

    return (
        <div className="min-h-screen bg-white">

            {/* ══════════════ NAVBAR ══════════════ */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#E4E2F4]">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                        <span className="font-extrabold text-[15px] text-[#1C1A3A] tracking-tight">Практика УрФУ</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#how" className="text-sm font-medium text-[#6B6880] hover:text-[#1C1A3A] transition-colors">Как это работает</a>
                        <a href="#features" className="text-sm font-medium text-[#6B6880] hover:text-[#1C1A3A] transition-colors">Возможности</a>
                        <a href="#audience" className="text-sm font-medium text-[#6B6880] hover:text-[#1C1A3A] transition-colors">Кому подходит</a>
                    </nav>

                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                <a href={dashboardHref} className="text-sm font-semibold text-[#1C1A3A] hover:text-[#4A42D4] transition-colors">
                                    В кабинет
                                </a>
                                <button type="button" onClick={logout}
                                    className="text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                    Выйти
                                </button>
                            </>
                        ) : (
                            <>
                                <a href="/login" className="text-sm font-semibold text-[#1C1A3A] hover:text-[#4A42D4] transition-colors">
                                    Войти
                                </a>
                                <a href="/register"
                                    className="text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                                    style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                    Регистрация
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ══════════════ HERO ══════════════ */}
            <section className="relative overflow-hidden">
                <div className="absolute pointer-events-none" style={{ width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)', top: -200, right: -160 }} />
                <div className="absolute pointer-events-none" style={{ width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,240,224,0.30) 0%, transparent 70%)', top: 260, left: -120 }} />

                <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-28 grid lg:grid-cols-2 gap-16 items-center">

                    {/* Левая колонка: текст */}
                    <div className="flex flex-col gap-6">
                        <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-[#EBE9FF] border border-[#C4BEFF]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF]" />
                            <span className="text-xs font-semibold text-[#4A42D4]">Сервис прохождения практики</span>
                        </div>

                        <h1 className="text-5xl font-extrabold tracking-tight text-[#1C1A3A] leading-[1.08]">
                            Практика — от заявки<br />до документов,<br />в одном окне
                        </h1>

                        <p className="text-lg text-[#6B6880] leading-relaxed max-w-md">
                            Подай заявку по ссылке от организатора, пройди тестовое задание, отслеживай статус
                            и веди дневник практики — без бумажной волокиты и почтовой переписки.
                        </p>

                        <div className="flex items-center gap-4 mt-2">
                            <a href={user ? dashboardHref : '/login'}
                                className="text-sm font-semibold text-white px-6 py-3.5 rounded-xl shadow-md hover:opacity-90 transition-opacity"
                                style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>
                                {user ? 'Перейти в кабинет →' : 'Войти в кабинет →'}
                            </a>
                            <a href="#how" className="text-sm font-semibold text-[#1C1A3A] hover:text-[#4A42D4] transition-colors">
                                Как это устроено
                            </a>
                        </div>

                        <p className="text-xs text-[#6B6880] mt-1">
                            Заявку можно подать только по персональной ссылке-приглашению от организатора практики.
                        </p>
                    </div>

                    {/* Правая колонка: превью продукта */}
                    <div className="relative">
                        <div className="rounded-2xl bg-white shadow-2xl border border-[#E4E2F4] overflow-hidden" style={{ boxShadow: '0 30px 70px rgba(28,26,58,0.16)' }}>

                            {/* мини-навбар превью */}
                            <div className="px-5 py-3.5 border-b border-[#E4E2F4] flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F0BABA]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F5D9A0]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-[#7EE8B8]" />
                                <span className="ml-3 text-[11px] font-medium text-[#6B6880]">Личный кабинет</span>
                            </div>

                            <div className="p-5 flex flex-col gap-3">
                                {/* карточка заявки */}
                                <div className="rounded-xl border border-[#E4E2F4] overflow-hidden">
                                    <div className="px-4 py-3 flex items-center justify-between bg-[#FBFAFF]">
                                        <div>
                                            <p className="text-[9px] font-bold tracking-widest uppercase text-[#6B6880]">Практика 2026</p>
                                            <p className="text-sm font-bold text-[#1C1A3A]">Backend-разработчик</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EDFBF4] border border-[#7EE8B8]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#2CB87A]" />
                                            <span className="text-[10px] font-semibold text-[#1A7A5A]">Одобрена</span>
                                        </div>
                                    </div>
                                </div>

                                {/* мини дневник задач */}
                                <div className="rounded-xl border border-[#E4E2F4] overflow-hidden">
                                    <div className="grid grid-cols-5 border-b border-[#E4E2F4]">
                                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт'].map(d => (
                                            <div key={d} className="px-2 py-2 border-r border-[#E4E2F4] last:border-r-0">
                                                <span className="text-[9px] font-bold uppercase text-[#6B6880]">{d}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-5 divide-x divide-[#E4E2F4] h-24">
                                        <div className="p-2 flex flex-col gap-1">
                                            <span className="w-fit text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#EBE9FF] text-[#4A42D4]">Готово</span>
                                            <span className="text-[9px] text-[#1C1A3A] font-medium leading-tight">Настройка окружения</span>
                                        </div>
                                        <div className="p-2 flex items-center justify-center">
                                            <span className="w-5 h-5 rounded-full border border-dashed border-[#C4BEFF] text-[#4A42D4] text-[10px] flex items-center justify-center">+</span>
                                        </div>
                                        <div className="p-2 flex flex-col gap-1">
                                            <span className="w-fit text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#EBE9FF] text-[#4A42D4]">Готово</span>
                                            <span className="text-[9px] text-[#1C1A3A] font-medium leading-tight">Вёрстка форм</span>
                                        </div>
                                        <div className="p-2" />
                                        <div className="p-2" />
                                    </div>
                                </div>

                                {/* мини документы */}
                                <div className="rounded-xl border border-[#E4E2F4] px-4 py-3 flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#1C1A3A]">Индивидуальное задание</span>
                                    <span className="text-[10px] font-semibold text-white px-2.5 py-1 rounded-md" style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>⬇ Скачать</span>
                                </div>
                            </div>
                        </div>

                        {/* декоративная плашка */}
                        <div className="absolute -bottom-5 -left-5 bg-white rounded-xl shadow-lg border border-[#E4E2F4] px-4 py-3 hidden sm:flex items-center gap-2.5">
                            <span className="text-lg">✅</span>
                            <div>
                                <p className="text-[10px] text-[#6B6880] leading-none mb-0.5">Задача сохранена</p>
                                <p className="text-xs font-semibold text-[#1C1A3A] leading-none">2 минуты назад</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════ КАК ЭТО РАБОТАЕТ ══════════════ */}
            <section id="how" className="bg-[#F5F4FD] py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="max-w-xl mb-14">
                        <p className="text-xs font-bold tracking-widest uppercase text-[#4A42D4] mb-3">Процесс</p>
                        <h2 className="text-3xl font-extrabold tracking-tight text-[#1C1A3A] mb-3">Три шага от ссылки до практики</h2>
                        <p className="text-[#6B6880] leading-relaxed">
                            Организатор присылает персональную ссылку — дальше всё происходит в личном кабинете,
                            без писем и созвонов.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                n: '01',
                                title: 'Заявка по ссылке',
                                desc: 'Переходишь по приглашению, входишь или регистрируешься и заполняешь анкету когорты — выбираешь трек и отвечаешь на вопросы.',
                            },
                            {
                                n: '02',
                                title: 'Тестовое задание',
                                desc: 'После отправки анкеты в личном кабинете открывается тестовое задание для выбранного трека — если оно уже опубликовано.',
                            },
                            {
                                n: '03',
                                title: 'Практика и документы',
                                desc: 'После одобрения открывается дневник задач с датами практики и вкладка документов — всё формируется автоматически.',
                            },
                        ].map(step => (
                            <div key={step.n} className="bg-white rounded-2xl p-7 border border-[#E4E2F4] flex flex-col gap-4">
                                <span className="text-3xl font-extrabold text-[#4A42D4]">{step.n}</span>
                                <h3 className="text-lg font-bold text-[#1C1A3A]">{step.title}</h3>
                                <p className="text-sm text-[#6B6880] leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ ВОЗМОЖНОСТИ ══════════════ */}
            <section id="features" className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="max-w-xl mb-14">
                        <p className="text-xs font-bold tracking-widest uppercase text-[#4A42D4] mb-3">Возможности</p>
                        <h2 className="text-3xl font-extrabold tracking-tight text-[#1C1A3A] mb-3">Всё нужное — в личном кабинете</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { icon: '📋', title: 'Статус заявки', desc: 'Видишь решение организатора и историю всех заявок по всем когортам.' },
                            { icon: '✅', title: 'Дневник задач', desc: 'Отмечаешь, что сделал за день, прикрепляешь ссылки на артефакты.' },
                            { icon: '📄', title: 'Документы', desc: 'Индивидуальное задание, отзыв и титульный лист формируются сами.' },
                            { icon: '🔗', title: 'Вход по ссылке', desc: 'Никаких отдельных форм — регистрация встроена в подачу заявки.' },
                        ].map(f => (
                            <div key={f.title} className="rounded-2xl border border-[#E4E2F4] p-6 flex flex-col gap-3 hover:border-[#C4BEFF] hover:shadow-sm transition-all">
                                <div className="w-10 h-10 rounded-xl bg-[#EBE9FF] flex items-center justify-center text-lg">{f.icon}</div>
                                <h3 className="text-sm font-bold text-[#1C1A3A]">{f.title}</h3>
                                <p className="text-xs text-[#6B6880] leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ ДЛЯ КОГО ══════════════ */}
            <section id="audience" className="bg-[#F5F4FD] py-24">
                <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-6">

                    <div className="bg-white rounded-2xl p-8 border border-[#E4E2F4] flex flex-col gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                        <h3 className="text-xl font-bold text-[#1C1A3A]">Практикантам</h3>
                        <p className="text-sm text-[#6B6880] leading-relaxed">
                            Подавай заявку, проходи тестовое задание, следи за статусом и веди дневник практики —
                            всё в одном личном кабинете, доступном с любого устройства.
                        </p>
                        <a href="/login" className="text-sm font-semibold text-[#4A42D4] hover:underline mt-1">Войти в кабинет →</a>
                    </div>

                    <div className="bg-white rounded-2xl p-8 border border-[#E4E2F4] flex flex-col gap-4">
                        <div className="w-11 h-11 rounded-xl bg-[#1C1A3A] flex items-center justify-center text-xl">🗂️</div>
                        <h3 className="text-xl font-bold text-[#1C1A3A]">Организаторам</h3>
                        <p className="text-sm text-[#6B6880] leading-relaxed">
                            Создавай когорты и треки, настраивай анкету и тестовые задания, рассылай ссылку-приглашение
                            и веди все заявки в одном месте.
                        </p>
                        <a href="/login" className="text-sm font-semibold text-[#4A42D4] hover:underline mt-1">Панель администратора →</a>
                    </div>

                </div>
            </section>

            {/* ══════════════ CTA ══════════════ */}
            <section className="py-24">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="rounded-3xl overflow-hidden relative px-10 py-16 text-center flex flex-col items-center gap-5"
                        style={{ background: 'linear-gradient(155deg, #6C63FF 0%, #9B8FFF 55%, #C4BEFF 100%)' }}>
                        <div className="absolute pointer-events-none" style={{ width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', top: -100, right: -60 }} />
                        <h2 className="relative text-3xl font-extrabold text-white tracking-tight max-w-md">
                            Уже есть аккаунт?
                        </h2>
                        <p className="relative text-sm text-white/80 max-w-sm">
                            Войди в личный кабинет, чтобы проверить статус заявки или продолжить дневник практики.
                        </p>
                        <a href="/login"
                            className="relative text-sm font-semibold text-[#4A42D4] bg-white px-7 py-3.5 rounded-xl shadow-md hover:opacity-90 transition-opacity mt-2">
                            Войти →
                        </a>
                    </div>
                </div>
            </section>

            {/* ══════════════ FOOTER ══════════════ */}
            <footer className="border-t border-[#E4E2F4] py-10">
                <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                            style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}>🎓</div>
                        <span className="font-bold text-sm text-[#1C1A3A]">Практика УрФУ</span>
                    </div>
                    <p className="text-xs text-[#6B6880]">© 2026 · Сервис организации практики</p>
                </div>
            </footer>

        </div>
    )
}
