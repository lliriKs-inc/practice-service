import { beforeEach, describe, expect, it } from 'vitest'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from './invitation'
import {
    getReadiness,
    getDocuments,
    updateDocumentField,
    generateDocument,
    getReport,
    uploadReport,
    validateReportFile,
    describeMissingField,
    DocumentValidationError,
    MAX_REPORT_SIZE_BYTES,
} from './documents'

const APPLICATION_ID = 'app-1'

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function seedApprovedApplication() {
    const app: Application = {
        id: APPLICATION_ID,
        status: 'approved',
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: {
            id: 'cohort-1',
            title: 'Практика 2027',
            start_date: '2027-07-19T00:00:00.000Z',
            end_date: '2027-07-30T00:00:00.000Z',
        },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }
    localStorage.setItem('mock_applications', JSON.stringify([app]))
}

function makeFile(name: string, sizeBytes: number, type = 'application/pdf'): File {
    const file = new File(['x'.repeat(Math.min(sizeBytes, 1024))], name, { type })
    Object.defineProperty(file, 'size', { value: sizeBytes })
    return file
}

describe('validateReportFile', () => {
    it('пропускает разрешённый формат в пределах лимита', () => {
        expect(() => validateReportFile(makeFile('report.pdf', 1024))).not.toThrow()
        expect(() => validateReportFile(makeFile('report.docx', 1024))).not.toThrow()
    })

    it('отклоняет неразрешённое расширение (.zip не входит в reports)', () => {
        expect(() => validateReportFile(makeFile('report.zip', 1024))).toThrow(DocumentValidationError)
    })

    it('отклоняет файл больше лимита', () => {
        expect(() => validateReportFile(makeFile('report.pdf', MAX_REPORT_SIZE_BYTES + 1))).toThrow(DocumentValidationError)
    })
})

describe('documents API (моки)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
        seedApprovedApplication()
    })

    it('заводит все 4 типа документов при первом обращении, изначально ни один не готов', async () => {
        const readiness = await getReadiness(APPLICATION_ID)
        expect(readiness.documents).toHaveLength(4)
        expect(readiness.documents.every(d => !d.ready)).toBe(true)
        expect(readiness.documents.every(d => !d.generated)).toBe(true)
    })

    it('сохраняет студенческое поле и оно видно при повторной загрузке', async () => {
        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'student_fio', 'Иванов Иван')
        const docs = await getDocuments(APPLICATION_ID)
        const notice = docs.find(d => d.type === 'NOTICE')!
        expect(notice.fieldValues.find(f => f.key === 'student_fio')?.value).toBe('Иванов Иван')
    })

    it('отклоняет попытку сохранить admin-owned поле (REVIEW) от лица студента', async () => {
        await expect(updateDocumentField(APPLICATION_ID, 'REVIEW', 'review_grade', '5')).rejects.toThrow()
    })

    it('NOTICE становится готов после заполнения всех обязательных полей', async () => {
        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'student_fio', 'Иванов Иван')
        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'group', 'РИ-123')
        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'practice_topic', 'Тема практики')

        const readiness = await getReadiness(APPLICATION_ID)
        const notice = readiness.documents.find(d => d.type === 'NOTICE')!
        expect(notice.ready).toBe(true)
        expect(notice.missingFields).toHaveLength(0)
    })

    it('TITLE_PAGE остаётся неготов без одобренного отчёта, даже если все поля заполнены', async () => {
        await updateDocumentField(APPLICATION_ID, 'TITLE_PAGE', 'student_fio', 'Иванов Иван')
        await updateDocumentField(APPLICATION_ID, 'TITLE_PAGE', 'group', 'РИ-123')
        await updateDocumentField(APPLICATION_ID, 'TITLE_PAGE', 'specialty', 'ПИ')
        await updateDocumentField(APPLICATION_ID, 'TITLE_PAGE', 'practice_topic', 'Тема практики')

        const readiness = await getReadiness(APPLICATION_ID)
        const titlePage = readiness.documents.find(d => d.type === 'TITLE_PAGE')!
        expect(titlePage.ready).toBe(false)
        expect(titlePage.missingFields).toContain('report.status:APPROVED')
        expect(describeMissingField('TITLE_PAGE', 'report.status:APPROVED')).toMatch(/одобрен/)
    })

    it('генерация документа падает, если он не готов, и проходит после заполнения полей', async () => {
        await expect(generateDocument(APPLICATION_ID, 'NOTICE')).rejects.toThrow()

        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'student_fio', 'Иванов Иван')
        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'group', 'РИ-123')
        await updateDocumentField(APPLICATION_ID, 'NOTICE', 'practice_topic', 'Тема практики')

        const result = await generateDocument(APPLICATION_ID, 'NOTICE')
        expect(result.generated).toBe(true)

        const readiness = await getReadiness(APPLICATION_ID)
        expect(readiness.documents.find(d => d.type === 'NOTICE')?.generated).toBe(true)
    })

    it('отчёт отсутствует изначально, появляется после загрузки со статусом PENDING', async () => {
        expect(await getReport(APPLICATION_ID)).toBeNull()

        const report = await uploadReport(APPLICATION_ID, makeFile('otchet.pdf', 2048))
        expect(report.status).toBe('PENDING')
        expect(report.hasFile).toBe(true)

        const reloaded = await getReport(APPLICATION_ID)
        expect(reloaded?.status).toBe('PENDING')
    })

    it('повторная загрузка отчёта заменяет предыдущий, не создавая дубликат', async () => {
        await uploadReport(APPLICATION_ID, makeFile('first.pdf', 1024))
        await uploadReport(APPLICATION_ID, makeFile('second.pdf', 2048))

        const stored = JSON.parse(localStorage.getItem('mock_reports') ?? '[]')
        expect(stored).toHaveLength(1)
        expect(stored[0].fileName).toBe('second.pdf')
    })
})
