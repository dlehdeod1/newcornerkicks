'use client'
import { cn } from '@/lib/cn'

export interface SortChip {
  key: string
  label: string
}

export function SortChips({
  chips, activeKey, onSelect,
}: {
  chips: SortChip[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onSelect(chip.key)}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
            activeKey === chip.key
              ? 'bg-brand-green text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary'
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
