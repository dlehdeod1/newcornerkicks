import { cn } from '@/lib/cn'

export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-muted',
        className
      )}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <SkeletonBox className="h-4 w-3/4" />
      <SkeletonBox className="h-3 w-1/2" />
      <SkeletonBox className="h-3 w-full" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <SkeletonBox className="h-8 w-8 rounded-full" />
      <SkeletonBox className="h-4 flex-1" />
      <SkeletonBox className="h-4 w-16" />
    </div>
  )
}
