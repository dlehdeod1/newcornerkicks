import { cn } from '@/lib/cn'

const statusConfig: Record<string, { label: string; className: string }> = {
  recruiting: { label: '모집중', className: 'bg-primary/10 text-primary' },
  open: { label: '모집중', className: 'bg-primary/10 text-primary' },
  ended: { label: '경기완료', className: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' },
  completed: { label: '정산완료', className: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400' },
  closed: { label: '마감', className: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = statusConfig[status] || statusConfig.closed
  return (
    <span className={cn('px-2 py-1 rounded-lg text-xs font-medium', className)}>
      {label}
    </span>
  )
}
