'use client'

/**
 * CorrectionList：AI 逐句修改建议（T17 验收 5）。
 *
 * **scoreSource='rule' 时渲染 null**——规则引擎给不了逐句改写，
 * 用占位符假装有内容是造假；此时报告页由规则问题清单撑起。
 */
import { cn } from '@/lib/utils/cn'

export interface CorrectionListProps {
  corrections: Array<{ original: string; issue: string; fixed: string; reason: string }> | null
  className?: string
}

export function CorrectionList({ corrections, className }: CorrectionListProps): React.JSX.Element | null {
  if (corrections === null || corrections.length === 0) return null

  return (
    <section className={cn('space-y-2', className)} data-testid="correction-list">
      <h3 className="text-sm font-semibold">逐句修改建议</h3>
      <ul className="space-y-2">
        {corrections.map((c, i) => (
          <li key={i} className="rounded-lg border border-border bg-surface p-3" data-testid={`correction-${i}`}>
            {c.original ? <p className="text-sm line-through decoration-destructive/60">{c.original}</p> : null}
            {c.fixed ? <p className="mt-1 text-sm font-medium">{c.fixed}</p> : null}
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {c.issue}
              {c.reason ? ` —— ${c.reason}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
