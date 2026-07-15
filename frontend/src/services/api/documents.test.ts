import { describe, expect, it } from 'vitest'
import { validateReportFile, describeMissingField, DocumentValidationError, MAX_REPORT_SIZE_BYTES } from './documents'

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
