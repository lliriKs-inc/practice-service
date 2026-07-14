import { beforeEach, describe, expect, it } from 'vitest'
import { validateSubmissionFile, SubmissionValidationError, MAX_SUBMISSION_SIZE_BYTES } from './test-task'

function makeFile(name: string, sizeBytes: number): File {
    const file = new File(['x'], name)
    Object.defineProperty(file, 'size', { value: sizeBytes })
    return file
}

describe('validateSubmissionFile', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('пропускает файл разрешённого формата в пределах лимита', () => {
        expect(() => validateSubmissionFile(makeFile('report.pdf', 1024))).not.toThrow()
        expect(() => validateSubmissionFile(makeFile('report.docx', 1024))).not.toThrow()
        expect(() => validateSubmissionFile(makeFile('report.zip', 1024))).not.toThrow()
    })

    it('отклоняет неразрешённое расширение', () => {
        expect(() => validateSubmissionFile(makeFile('report.exe', 1024))).toThrow(SubmissionValidationError)
    })

    it('отклоняет пустой файл', () => {
        expect(() => validateSubmissionFile(makeFile('report.pdf', 0))).toThrow(SubmissionValidationError)
    })

    it('отклоняет файл больше лимита', () => {
        expect(() => validateSubmissionFile(makeFile('report.pdf', MAX_SUBMISSION_SIZE_BYTES + 1))).toThrow(SubmissionValidationError)
    })

    it('пропускает файл ровно на границе лимита', () => {
        expect(() => validateSubmissionFile(makeFile('report.pdf', MAX_SUBMISSION_SIZE_BYTES))).not.toThrow()
    })
})
