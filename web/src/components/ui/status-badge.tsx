import { cn } from '@/lib/cn'

const statusConfig: Record<string, { label: string; className: string }> = {
  recruiting: { label: '모집중', className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  ended: { label: '종료', className: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' },
  completed: { label: '완료', className: 'bg-primary/10 text-primary' },
  closed: { label: '마감', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = statusConfig[status] || statusConfig.closed
  return (
    <span className={cn('px-2 py-1 rounded-lg text-xs font-medium', className)}>
      {label}
    </span>
  )
}
