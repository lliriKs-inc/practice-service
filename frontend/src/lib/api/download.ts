// lib/api/download.ts
//
// Все защищённые файлы (тестовое задание, решение, отчёт, сгенерированные
// документы) отдаются backend-ом только с валидным JWT в заголовке
// Authorization — обычный `<a href="...">` клик браузер шлёт БЕЗ этого
// заголовка (токен лежит в localStorage, не в куках), поэтому такая ссылка
// всегда получала бы 401. Вместо ссылки — авторизованный fetch + Blob URL.


const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

// Backend кладёт настоящее имя файла (с расширением) в Content-Disposition,
// но фронт и backend — разные origin (порты 3002/3001), а CORS по умолчанию
// не открывает этот заголовок для чтения из JS кросс-доменных ответов (нет
// Access-Control-Expose-Headers на backend) — res.headers.get(...) молча
// вернёт null, даже если заголовок реально пришёл по сети. Поэтому основной
// источник имени — Content-Type (он в дефолтном CORS-safelist и виден
// всегда), с fallback на расширение по MIME-типу.
const EXTENSION_BY_MIME: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
}

function filenameFromContentDisposition(header: string | null): string | null {
    if (!header) return null
    const match = /filename="?([^"]+)"?/i.exec(header)
    return match ? match[1] : null
}

function guessFilename(contentType: string | null, suggestedFilename?: string): string {
    const base = suggestedFilename?.trim() || 'file'
    if (/\.[a-z0-9]+$/i.test(base)) return base // уже есть расширение
    const extension = contentType ? EXTENSION_BY_MIME[contentType.split(';')[0].trim()] : undefined
    return extension ? `${base}${extension}` : base
}

export async function downloadProtectedFile(path: string, suggestedFilename?: string): Promise<void> {
    const res = await fetch(`${API_URL}${path}`, {
        credentials: 'include',
    })
    if (!res.ok) {
        throw new Error(res.status === 404 ? 'Файл не найден' : `Не удалось скачать файл (${res.status})`)
    }
    // The backend deliberately uses an ASCII-safe fallback in
    // Content-Disposition. When the API has supplied the original filename,
    // prefer it so Cyrillic and other Unicode names are preserved.
    const filename = suggestedFilename?.trim()
        ? guessFilename(res.headers.get('Content-Type'), suggestedFilename)
        : filenameFromContentDisposition(res.headers.get('Content-Disposition')) ??
          guessFilename(res.headers.get('Content-Type'))
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}
