import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    validateReportFile,
    describeMissingField,
    DocumentValidationError,
    MAX_REPORT_SIZE_BYTES,
    generateDocument,
} from './documents'

afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
})

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

    it('отклоняет пустой файл', () => {
        expect(() => validateReportFile(makeFile('report.pdf', 0))).toThrow(DocumentValidationError)
    })

    it('отклоняет файл больше лимита', () => {
        expect(() => validateReportFile(makeFile('report.pdf', MAX_REPORT_SIZE_BYTES + 1))).toThrow(DocumentValidationError)
    })
})

describe('describeMissingField', () => {
    it('переводит специальный маркер отчёта в человекочитаемое сообщение', () => {
        expect(describeMissingField('TITLE_PAGE', 'report.status:APPROVED')).toMatch(/одобрен/)
    })

    it('возвращает лейбл обычного поля', () => {
        expect(describeMissingField('NOTICE', 'student_fio')).toBe('ФИО студента')
    })
})

describe('generateDocument', () => {
    it('uses POST and the uppercase DocumentType contract value', async () => {
        localStorage.setItem('jwt', 'student-token')
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('docx', { status: 200 })
        )

        await generateDocument('application-1', 'INDIVIDUAL_TASK')

        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:3001/api/v1/me/applications/application-1/documents/INDIVIDUAL_TASK/generate',
            {
                method: 'POST',
                headers: { Authorization: 'Bearer student-token' },
            }
        )
    })
})
