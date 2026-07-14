'use client'

import { useCohortWorkspace } from '../cohort-context'

export default function AdminTasksPage() {
    const { selectedCohort } = useCohortWorkspace()

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-[#1C1A3A] mb-1">Задачи</h1>
                <p className="text-sm text-[#6B6880]">
                    Прогресс практикантов {selectedCohort ? `· когорта «${selectedCohort.title}»` : ''}
                </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-12 flex flex-col items-center text-center">
                <div className="text-4xl mb-4">✅</div>
                <p className="font-semibold text-[#1C1A3A] mb-1">Ждём новый API</p>
                <p className="text-sm text-[#6B6880]">GET /cohorts/:id/progress · новая архитектура</p>
            </div>
        </div>
    )
}
