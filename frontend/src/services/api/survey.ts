// services/api/survey.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface SurveyField {
    id: string
    label: string
    type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'CHECKBOX'
    required: boolean
    options: string[] | null
    order: number
    existingAnswer?: string | null
}

// GET /survey-fields — публичный, не требует авторизации
export async function getSurveyFields(): Promise<SurveyField[]> {
    const res = await fetch(`${API_URL}/survey-fields`)
    if (!res.ok) throw new Error('Не удалось загрузить поля анкеты')
    const data = await res.json()
    // Бэк может вернуть {success, data:[]} или просто []
    if (Array.isArray(data)) return data
    if (data.success && Array.isArray(data.data)) return data.data
    return []
}
