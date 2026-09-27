'use client'

/**
 * MasteryBar：掌握度分stage进度条（NEW/LEARNING/FAMILIAR/MASTERED 分段着色）。
 */
import { cn } from '@/lib/utils/cn'

import type { MasteryOverview } from '../types'

const SEGMENTS: Array<{ key: string; label: string; className: string }> = [
  { key: 'NEW', label: '新词', className: 'bg-muted-foreground/40' },
  { key: 'LEARNING', label: '学习中', className: 'bg-warning' },
  { key: 'FAMILIAR', label: '熟悉', className: 'bg-primary' },
  { key: 'MASTERED', label: '已掌握', className: 'bg-success' },
]

export function MasteryBar({ data, className }: { data: MasteryOverview | null; className?: string }): React.JSX.Element {
  const total = data?.total ?? 0
  const get = (key: string): number => data?.byStage?.[key] ?? 0

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {total > 0 ? (
          SEGMENTS.map((seg) => {
            const count = get(seg.key)
            if (count === 0) return null
            return <div key={seg.key} className={cn('h-full', seg.className)} style={{ width: `${(count / total) * 100}%` }} />
          })
        ) : (
          <div className="h-full w-full" />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SEGMENTS.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5">
            <span className={cn('inline-block h-2 w-2 rounded-full', seg.className)} />
            {seg.label} {get(seg.key)}
          </span>
        ))}
        <span className="ml-auto">共 {total} 词</span>
      </div>
    </div>
  )
}
