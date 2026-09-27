/**
 * SkeletonKit：常用骨架组合（列表/卡片/详情页骨架一键复用）。
 */
import { Skeleton } from '@/components/ui/separator'
import { cn } from '@/lib/utils/cn'

/** 卡片骨架：标题 + 两行文本 */
export function SkeletonCard({ className }: { className?: string }): React.JSX.Element {
  return (
    <div className={cn('rounded-2xl border border-border bg-surface p-6', className)}>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
    </div>
  )
}

/** 列表骨架：n 行头像+两行 */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }): React.JSX.Element {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** 统计行骨架：n 个卡片 */
export function SkeletonStats({ cards = 4, className }: { cards?: number; className?: string }): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-3 h-7 w-2/3" />
        </div>
      ))}
    </div>
  )
}

/** 详情页骨架 */
export function SkeletonDetail({ className }: { className?: string }): React.JSX.Element {
  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" style={{ width: `${100 - i * 7}%` }} />
        ))}
      </div>
    </div>
  )
}
