'use client'

import { useState, useEffect } from 'react'

type State = 'waiting' | 'task'

export default function TestTaskPage() {
  const [state, setState] = useState<State>('task')
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    function update() {
      const deadline = new Date('2026-06-20T23:59:00')
      const diff = deadline.getTime() - Date.now()
      if (diff <= 0) { setCountdown('Истёк'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      setCountdown(`${d} д ${h} ч`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen">

      {/* LEFT */}
      <aside className="hidden lg:flex w-[30%] flex-col sticky top-0 h-screen overflow-hidden text-white p-14"
        style={{ background: 'linear-gradient(155deg, #6C63FF 0%, #9B8FFF 55%, #C4BEFF 100%)' }}>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'rgba(255,255,255,0.22)' }}>🎓</div>
          <span className="font-bold text-base">Практика УрФУ</span>
        </div>

        <div className="flex flex-col justify-center flex-1">
          <p className="text-xs font-semibold tracking-widest uppercase opacity-60 mb-5">Набор 2026</p>
          <h2 className="font-extrabold text-5xl leading-tight tracking-tight mb-5">
            Почти<br />готово
          </h2>
          <p className="text-sm leading-relaxed opacity-80 mb-12 max-w-xs">
            Анкета принята. Выполни тестовое задание и жди результата.
          </p>

          <div className="flex flex-col gap-4">
            {[
              { n: '✓', label: 'Анкета', sub: 'Отправлена', done: true },
              { n: '2', label: 'Тестовое задание', sub: 'Выполни и отправь', active: true },
              { n: '3', label: 'Результат', sub: 'Одобрение / отказ' },
            ].map((step, i) => (
              <div key={i} className={`flex items-center gap-4 ${step.active ? 'opacity-100' : step.done ? 'opacity-75' : 'opacity-50'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0
                  ${step.active ? 'bg-white text-[#6C63FF] border-white' : 'border-white/40 bg-white/20'}`}>
                  {step.n}
                </div>
                <div>
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-xs opacity-60">{step.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs opacity-50">Приём заявок: 1 июня — 30 июня 2026</p>
      </aside>

      {/* RIGHT */}
      <main className="flex-1 flex justify-center overflow-y-auto bg-[#F5F4FD]">
        <div className="w-[75%] py-14 flex flex-col">

          {/* success banner */}
          <div className="flex items-center gap-3 bg-[#EDFBF4] border-[1.5px] border-[#7EE8B8] rounded-xl px-5 py-4 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#2CB87A] text-white flex items-center justify-center text-sm flex-shrink-0">✓</div>
            <p className="text-sm text-[#1A5C3A]"><strong>Анкета отправлена!</strong> Мы получили твою заявку и скоро свяжемся.</p>
          </div>

          {/* demo toggle */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setState('task')}
              className={`text-xs font-medium px-4 py-1.5 rounded-full border-[1.5px] transition-all
                ${state === 'task' ? 'bg-[#EBE9FF] border-[#6C63FF] text-[#4A42D4]' : 'bg-[#F5F4FD] border-[#E4E2F4] text-[#6B6880]'}`}>
              📋 Задание опубликовано
            </button>
            <button onClick={() => setState('waiting')}
              className={`text-xs font-medium px-4 py-1.5 rounded-full border-[1.5px] transition-all
                ${state === 'waiting' ? 'bg-[#EBE9FF] border-[#6C63FF] text-[#4A42D4]' : 'bg-[#F5F4FD] border-[#E4E2F4] text-[#6B6880]'}`}>
              ⏳ Задание ещё не вышло
            </button>
          </div>

          {/* WAITING */}
          {state === 'waiting' && (
            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#EBE9FF] flex items-center justify-center text-3xl mb-6">⏳</div>
              <h2 className="font-bold text-xl text-[#1C1A3A] mb-3">Задание ещё не опубликовано</h2>
              <p className="text-sm text-[#6B6880] leading-relaxed max-w-sm mb-7">
                Как только организаторы опубликуют тестовое задание — ты сразу получишь письмо на e-mail.
              </p>
              <div className="flex items-center gap-2 text-sm text-[#A9A7BB] bg-[#F5F4FD] border-[1.5px] border-[#E4E2F4] rounded-full px-5 py-2">
                📬 Уведомление придёт на <strong className="text-[#1C1A3A] ml-1">ivan@urfu.ru</strong>
              </div>
            </div>
          )}

          {/* TASK */}
          {state === 'task' && (
            <div className="flex flex-col gap-5">
              <div className="mb-1">
                <h1 className="font-extrabold text-3xl tracking-tight text-[#1C1A3A] mb-2">Тестовое задание</h1>
                <p className="text-sm text-[#6B6880]">Внимательно прочитай условие и отправь результат до дедлайна.</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

                {/* card header */}
                <div className="p-8 text-white" style={{ background: 'linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)' }}>
                  <p className="text-xs font-semibold tracking-widest uppercase opacity-70 mb-2">Набор 2026 · Тестовое задание</p>
                  <h2 className="font-extrabold text-xl mb-1">Разработка REST API сервиса</h2>
                  <p className="text-sm opacity-80">Реализуй небольшой бэкенд-сервис по описанному заданию</p>
                </div>

                {/* meta */}
                <div className="grid grid-cols-3 border-b border-[#E4E2F4]">
                  {[
                    { label: 'Опубликовано', value: '10 июня 2026', red: false },
                    { label: 'Дедлайн', value: '20 июня 2026', red: true },
                    { label: 'Осталось', value: countdown, red: false },
                  ].map((item, i) => (
                    <div key={i} className="px-6 py-4 border-r border-[#E4E2F4] last:border-r-0 flex flex-col gap-1">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[#A9A7BB]">{item.label}</span>
                      <span className={`text-sm font-bold ${item.red ? 'text-[#D94F4F]' : 'text-[#1C1A3A]'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* body */}
                <div className="p-8 flex flex-col gap-7">

                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">Описание</p>
                    <p className="text-sm text-[#6B6880] leading-relaxed">
                      Необходимо реализовать REST API для управления списком задач (To-Do).
                      Сервис должен поддерживать создание, чтение, обновление и удаление задач,
                      а также базовую авторизацию пользователей через JWT.
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">Что нужно реализовать</p>
                    <ul className="flex flex-col gap-3">
                      {[
                        'Регистрация и вход пользователя (email + пароль), выдача JWT-токена',
                        'CRUD-эндпоинты для задач: создать, получить список, обновить, удалить',
                        'Каждая задача принадлежит только своему пользователю',
                        'Валидация входящих данных и понятные сообщения об ошибках',
                        'README с инструкцией по запуску проекта',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-[#6B6880]">
                          <div className="w-5 h-5 rounded-full bg-[#EBE9FF] border-[1.5px] border-[#6C63FF] flex-shrink-0 mt-0.5"
                            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='7' viewBox='0 0 9 7' fill='none'%3E%3Cpath d='M1 3.5L3.3 6L8 1' stroke='%236C63FF' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#6C63FF] mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#E4E2F4]">Стек</p>
                    <div className="flex flex-wrap gap-2">
                      {['Node.js', 'Express / Fastify', 'PostgreSQL', 'JWT', 'любой ORM'].map(tag => (
                        <span key={tag} className="text-xs font-medium px-3 py-1.5 bg-[#F5F4FD] border-[1.5px] border-[#E4E2F4] rounded-full text-[#6B6880]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>

                {/* footer */}
                <div className="flex items-center justify-between gap-5 px-8 py-5 bg-[#F5F4FD] border-t border-[#E4E2F4]">
                  <div className="text-sm text-[#6B6880] leading-relaxed">
                    <strong className="text-[#1C1A3A]">Как отправить результат</strong><br />
                    Опубликуй код на GitHub и пришли ссылку на <strong className="text-[#1C1A3A]">practice@urfu.ru</strong>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D94F4F] bg-[#FFF0F0] border border-[#F0BABA] rounded-full px-3 py-1 mt-2 ml-2">
                      ⏰ Дедлайн: 20 июня 2026
                    </div>
                  </div>
                  <a href="mailto:practice@urfu.ru"
                    className="flex-shrink-0 bg-[#6C63FF] hover:bg-[#4A42D4] text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md transition-colors flex items-center gap-2">
                    Написать на почту →
                  </a>
                </div>

              </div>

              {/* warning notice */}
              <div className="flex items-start gap-3 p-4 bg-[#FFF8ED] border-l-4 border-[#F59E0B] rounded-xl">
                <span className="text-lg">⚠️</span>
                <p className="text-sm text-[#7A5C1A] leading-relaxed">
                  Не откладывай до последнего — <strong>результаты отправленные после дедлайна не рассматриваются.</strong>
                </p>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  )
}