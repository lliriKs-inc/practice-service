'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/shell/LoadingScreen'

export default function AdminIndexPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/admin/cohorts')
    }, [router])

    return <LoadingScreen />
}
