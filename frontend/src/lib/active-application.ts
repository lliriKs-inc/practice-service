const ACTIVE_APPLICATION_STORAGE_KEY = 'active_application_id'

export function getActiveApplicationId(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ACTIVE_APPLICATION_STORAGE_KEY)
}

export function setActiveApplicationId(applicationId: string): void {
    localStorage.setItem(ACTIVE_APPLICATION_STORAGE_KEY, applicationId)
}

export function clearActiveApplicationId(): void {
    localStorage.removeItem(ACTIVE_APPLICATION_STORAGE_KEY)
}
