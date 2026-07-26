'use client'

import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

export interface FilterSelectOption {
    value: string
    label: string
}

interface FilterSelectProps {
    icon: LucideIcon
    ariaLabel: string
    value: string
    onChange: (value: string) => void
    options: FilterSelectOption[]
    placeholder: string
    /** Статичная приставка перед текущим значением, например "Фильтр дат" —
     * поясняет, что регулирует это поле, когда само значение не очевидно. */
    baseLabel?: string
    /** false — у поля нет состояния "не выбрано" (value всегда один из options),
     * поэтому синтетический пустой вариант не добавляется (иначе в списке он
     * дублировал бы текст того же option, у которого value совпал с placeholder). */
    allowEmpty?: boolean
}

// Обёртка над нативным <select>, где видимая "таблетка" всегда по ширине
// самого длинного из возможных вариантов (а не только текущего выбранного) —
// иначе поле "прыгает" по ширине при переключении и обрезает длинные варианты.
// Приём: все варианты (включая невидимые) кладём в одну grid-ячейку —
// grid сам считает ширину по самому широкому ребёнку.
export function FilterSelect({ icon: Icon, ariaLabel, value, onChange, options, placeholder, baseLabel, allowEmpty = true }: FilterSelectProps) {
    const currentLabel = options.find(o => o.value === value)?.label ?? placeholder
    const withPrefix = (label: string) => baseLabel ? `${baseLabel}: ${label}` : label
    const allLabels = allowEmpty ? [placeholder, ...options.map(o => o.label)] : options.map(o => o.label)

    return (
        <div className="relative grid w-full sm:w-fit h-9 rounded-lg border border-border-soft bg-white focus-within:border-brand cursor-pointer">
            {allLabels.map((label, i) => (
                <div key={`${label}-${i}`} aria-hidden className="col-start-1 row-start-1 invisible flex items-center gap-2 pl-3 pr-8 whitespace-nowrap">
                    <Icon className="size-3.5 flex-shrink-0" />
                    <span className="text-sm font-medium">{withPrefix(label)}</span>
                </div>
            ))}
            <div className="col-start-1 row-start-1 flex items-center gap-2 pl-3 pr-8 pointer-events-none whitespace-nowrap">
                <Icon className="size-3.5 text-muted-ink flex-shrink-0" />
                <span className="text-sm font-medium text-ink">{withPrefix(currentLabel)}</span>
            </div>
            <ChevronDown className="size-3.5 text-muted-ink absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}
                className="col-start-1 row-start-1 w-full !p-0 !border-0 opacity-0 cursor-pointer text-sm">
                {allowEmpty && <option value="">{placeholder}</option>}
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    )
}
