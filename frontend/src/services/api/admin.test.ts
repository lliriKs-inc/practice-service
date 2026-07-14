import { beforeEach, describe, expect, it } from 'vitest'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from './invitation'
import { getAdminApplications, getAdminApplicationDetail, getAdminDocuments } from './admin'
import { updateDocumentField } from './documents'

const COHORT_ID = 'cohort-1'
const APP_APPROVED = 'app-approved'
const APP_PENDING = 'app-pending'

function loginAsAdmin() {
    saveToken('mock-jwt-admin-1')
    saveUser({ id: 'admin-1', email: 'admin@urfu.ru', role: 'ADMIN', created_at: '2026-01-01' })
}

function seedApplications() {
    const apps: Application[] = [
        {
            id: APP_APPROVED,
            status: 'approved',
            submitted_at: '2027-07-01T00:00:00.000Z',
            track: { id: 'track-1', title: 'Backend' },
            cohort: { id: COHORT_ID, title: 'Практика 2027', start_date: '2027-07-19T00:00:00.000Z', end_date: '2027-07-30T00:00:00.000Z' },
            student: { id: 'student-1', email: 'anna@urfu.ru' },
            answers: [{ label: 'О себе', value: 'Люблю бэкенд' }],
        },
        {
            id: APP_PENDING,
            status: 'pending',
            submitted_at: '2027-07-02T00:00:00.000Z',
            track: { id: 'track-2', title: 'Frontend' },
            cohort: { id: COHORT_ID, title: 'Практика 2027', start_date: '2027-07-19T00:00:00.000Z', end_date: '2027-07-30T00:00:00.000Z' },
            student: { id: 'student-2', email: 'boris@urfu.ru' },
            answers: [],
        },
    ]
    localStorage.setItem('mock_applications', JSON.stringify(apps))
}

describe('admin API (моки)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsAdmin()
        seedApplications()
    })

    it('возвращает все заявки когорты без фильтров', async () => {
        const apps = await getAdminApplications(COHORT_ID)
        expect(apps).toHaveLength(2)
    })

    it('фильтрует по статусу', async () => {
        const apps = await getAdminApplications(COHORT_ID, { status: 'pending' })
        expect(apps).toHaveLength(1)
        expect(apps[0].applicationId).toBe(APP_PENDING)
    })

    it('фильтрует по треку', async () => {
        const apps = await getAdminApplications(COHORT_ID, { trackId: 'track-1' })
        expect(apps).toHaveLength(1)
        expect(apps[0].applicationId).toBe(APP_APPROVED)
    })

    it('фильтрует по поиску (email, регистронезависимо)', async () => {
        const apps = await getAdminApplications(COHORT_ID, { search: 'ANNA' })
        expect(apps).toHaveLength(1)
        expect(apps[0].student?.email).toBe('anna@urfu.ru')
    })

    it('считает пропущенные дни только для одобренных заявок', async () => {
        const apps = await getAdminApplications(COHORT_ID)
        const pending = apps.find(a => a.applicationId === APP_PENDING)!
        expect(pending.missedDays).toBe(0)
        expect(pending.report).toBeNull()
    })

    it('detail заявки возвращает ответы анкеты', async () => {
        const detail = await getAdminApplicationDetail(COHORT_ID, APP_APPROVED)
        expect(detail.answers).toEqual([{ label: 'О себе', value: 'Люблю бэкенд' }])
    })

    it('getAdminDocuments показывает только одобренные заявки', async () => {
        const docs = await getAdminDocuments(COHORT_ID)
        expect(docs).toHaveLength(1)
        expect(docs[0].applicationId).toBe(APP_APPROVED)
    })

    it('getAdminDocuments фильтрует по readiness=READY только после заполнения полей', async () => {
        let ready = await getAdminDocuments(COHORT_ID, { readiness: 'READY' })
        expect(ready).toHaveLength(0)

        await updateDocumentField(APP_APPROVED, 'NOTICE', 'student_fio', 'Анна А.')
        await updateDocumentField(APP_APPROVED, 'NOTICE', 'group', 'РИ-1')
        await updateDocumentField(APP_APPROVED, 'NOTICE', 'practice_topic', 'Тема')

        ready = await getAdminDocuments(COHORT_ID, { readiness: 'READY', documentType: 'NOTICE' })
        expect(ready).toHaveLength(1)
    })
})
