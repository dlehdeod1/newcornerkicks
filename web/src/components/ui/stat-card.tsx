import { cn } from '@/lib/cn'

const colorMap = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
}

type Color = keyof typeof colorMap

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  color: Color
  variant?: 'boxed' | 'flat'
}

export function StatCard({ label, value, icon, color, variant = 'boxed' }: StatCardProps) {
  const c = colorMap[color]

  if (variant === 'flat') {
    return (
      <div className={cn('rounded-xl p-4', c.bg)}>
        <div className={cn('flex items-center gap-2 mb-2 opacity-80', c.text)}>
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <p className={cn('text-2xl font-bold', c.text)}>{value}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800/50">
      {icon && (
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', c.bg, c.text)}>
          {icon}
        </div>
      )}
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
