// lib/api/error-messages.ts
//
// Backend возвращает технические message/code (`Request validation failed`,
// `ACTIVE_COHORT_EXISTS`, Zod issues и т.д.) — этот модуль переводит их в
// понятные пользователю русские сообщения там, где мы уже знаем конкретную
// причину ошибки. Незнакомые ошибки не подменяются на выдумку — падаем на
// исходное сообщение бэка либо на fallback, переданный вызывающим кодом.

import { ApiError } from './http'

interface BackendErrorBody {
    code?: string
    message?: string
    details?: { path: string; message: string }[] | unknown
}

// Коды ошибок, у которых ровно один смысл независимо от исходного текста.
const CODE_MESSAGES: Record<string, string> = {
    ACTIVE_COHORT_EXISTS: 'Уже есть другая активная когорта — активной может быть только одна одновременно.',
    COHORT_NOT_FOUND: 'Когорта не найдена — возможно, её уже изменили в другой вкладке.',
    COHORT_NOT_DRAFT: 'Удалить можно только когорту в статусе «Черновик».',
    COHORT_HAS_APPLICATIONS: 'Нельзя удалить когорту, пока в ней есть заявки на рассмотрении или одобренные заявки.',
    APPLICATION_NOT_FOUND: 'Заявка не найдена.',
    SURVEY_NOT_FOUND: 'У этой когорты ещё нет анкеты.',
    TOKEN_EXPIRED: 'Срок действия ссылки-приглашения истёк.',
    INVALID_TOKEN: 'Ссылка-приглашение недействительна.',
    APPLICATION_WINDOW_CLOSED: 'Приём заявок в эту когорту сейчас закрыт.',
    AUTH_TOKEN_MISSING: 'Нужно войти в аккаунт.',
    AUTH_TOKEN_INVALID: 'Сессия истекла — войди заново.',
    AUTH_SESSION_INVALID: 'Сессия больше недействительна — войдите в аккаунт заново.',
    INVALID_CREDENTIALS: 'Неверный e-mail или пароль.',
    INSUFFICIENT_PERMISSIONS: 'У этого аккаунта нет доступа к этому действию.',
    RATE_LIMIT_EXCEEDED: 'Слишком много запросов подряд — подожди немного и попробуй снова.',
    AUTH_RATE_LIMIT_EXCEEDED: 'Слишком много попыток входа — подожди немного и попробуй снова.',
    TRACK_ALREADY_EXISTS: 'Трек с таким названием уже есть в этой когорте.',
    COHORT_TRACK_REQUIRED: 'Сначала добавьте хотя бы один трек, затем создайте ссылку-приглашение.',
    APPLICATION_ALREADY_EXISTS: 'Заявка на этот трек уже была подана.',
    TRACK_HAS_APPLICATIONS: 'Нельзя удалить трек — по нему уже есть заявки.',
    SURVEY_ALREADY_EXISTS: 'У этой когорты уже есть анкета.',
    TARGET_SURVEY_ALREADY_EXISTS: 'У целевой когорты уже есть анкета.',
    QUESTION_NOT_FOUND: 'Вопрос анкеты не найден.',
    INVALID_QUESTION_ORDER: 'Порядок вопросов указан некорректно.',
    TEST_TASK_NOT_FOUND: 'Сначала сохрани заголовок и описание задания кнопкой «Сохранить» внизу окна — только после этого можно прикрепить файл.',
    TEST_TASK_ALREADY_PUBLISHED: 'Задание уже опубликовано.',
    TRACK_NOT_FOUND: 'Сначала сохрани трек кнопкой «Сохранить» внизу окна, потом сможешь прикрепить файл к заданию.',
}

// Один и тот же code бэк использует для разных сообщений (INVALID_COHORT_STATUS,
// INVALID_DATE_RANGE) — переводим по исходному тексту message, не по code.
const MESSAGE_TRANSLATIONS: Record<string, string> = {
    'Only a draft cohort can be activated': 'Активировать можно только когорту в статусе «Черновик».',
    'Only an active cohort can be closed': 'Закрыть можно только активную когорту.',
    'Active cohort requires an application window': 'Перед активацией укажи окно приёма заявок (начало и конец).',
    'Another cohort is already active': 'Уже есть другая активная когорта — одновременно активной может быть только одна.',
    'Practice dates are invalid': 'Дата окончания практики должна быть не раньше даты начала.',
    'Application dates are invalid': 'Дата окончания приёма заявок должна быть не раньше даты начала.',
    'Application window must end before practice starts': 'Приём заявок должен закончиться до начала практики.',
    'practice_end must be after practice_start': 'Дата окончания практики должна быть не раньше даты начала.',
    'application_end must be after application_start': 'Дата окончания приёма заявок должна быть не раньше даты начала.',
    'Date must be between years 2000 and 2100': 'Укажите дату с четырёхзначным годом в диапазоне от 2000 до 2100.',
    'Options are required for choice questions': 'Для вопроса с вариантами ответа нужно указать хотя бы один вариант.',
    'Options are only valid for choice questions': 'Варианты ответа можно указывать только для вопросов типа «список»/«один из вариантов»/«несколько вариантов».',
    'Options must be unique': 'Варианты ответа не должны повторяться.',
    'The order must contain every question exactly once': 'Порядок должен включать каждый вопрос анкеты ровно один раз.',
}

// Человекочитаемые названия полей — для generic-перевода Zod-ошибок вида
// "поле обязательно", когда для конкретного текста нет точного перевода.
const FIELD_LABELS: Record<string, string> = {
    title: 'название',
    label: 'текст вопроса',
    options: 'варианты ответа',
    cohort_id: 'когорта',
    question_ids: 'порядок вопросов',
    target_cohort_id: 'целевая когорта',
}

// Zod v4 генерирует "Too small: expected string to have >=1 characters" (или
// похожий текст) для незаполненных обязательных строковых/массивных полей —
// без кастомного message в схеме. Ловим по смыслу, а не по точному тексту,
// т.к. формат может немного отличаться между версиями zod.
function translateGenericZodMessage(raw: string): string | null {
    if (/too small/i.test(raw) || /at least 1 character/i.test(raw)) return 'обязательно для заполнения'
    if (/at least 1 element/i.test(raw) || /nonempty/i.test(raw)) return 'нужно указать хотя бы один элемент'
    if (/invalid.*date|expected date/i.test(raw)) return 'указана некорректная дата'
    return null
}

// Возвращает КАЖДУЮ причину отказа отдельной строкой — если backend вернул
// несколько Zod-issues сразу, вызывающий код может отрисовать их отдельными
// плашками вместо одной длинной строки через "; ".
export function describeApiErrors(err: unknown, fallback: string): string[] {
    if (err instanceof ApiError) {
        const body = err.details as BackendErrorBody | undefined
        const code = body?.code
        const rawMessage = body?.message ?? err.message

        if (code === 'VALIDATION_ERROR' && Array.isArray(body?.details) && body.details.length > 0) {
            return body.details.map(issue => {
                if (MESSAGE_TRANSLATIONS[issue.message]) return MESSAGE_TRANSLATIONS[issue.message]
                const field = FIELD_LABELS[issue.path] ?? issue.path
                const generic = translateGenericZodMessage(issue.message)
                return generic ? `Поле «${field}»: ${generic}` : `Поле «${field}»: ${issue.message}`
            })
        }
        if (rawMessage && MESSAGE_TRANSLATIONS[rawMessage]) return [MESSAGE_TRANSLATIONS[rawMessage]]
        if (code && CODE_MESSAGES[code]) return [CODE_MESSAGES[code]]
        if (rawMessage && rawMessage !== 'Request validation failed') return [rawMessage]
    }
    if (err instanceof Error && err.message) return [err.message]
    return [fallback]
}

export function describeApiError(err: unknown, fallback: string): string {
    return describeApiErrors(err, fallback).join('; ')
}
