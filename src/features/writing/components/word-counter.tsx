'use client'

/**
 * WordCounter：字数统计 + 字数达标提示（T17 验收 7）。
 *
 * 颜色语义：达标=success；不足/超出=warning（**明确给出差额**，不是只说「不达标」）。
 */
import { cn } from '@/lib/utils/cn'
import type { WritingRequiredWords } from '../types'

export interface WordCounterProps {
  wordCount: number
  required: WritingRequiredWords
  className?: string
}

export function WordCounter({ wordCount, required, className }: WordCounterProps): React.JSX.Element {
  const hasMin = required.min > 0
  const hasMax = required.max > 0
  const under = hasMin && wordCount < required.min
  const over = hasMax && wordCount > required.max
  const ok = !under && !over

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)} data-testid="word-counter">
      <span className={cn('font-medium tabular-nums', ok ? 'text-success' : 'text-warning')} data-testid="word-count">
        {wordCount} 词
      </span>

      {hasMin || hasMax ? (
        <span className="text-muted-foreground">
          要求{hasMin ? ` ≥ ${required.min}` : ''}
          {hasMin && hasMax ? ' 且 ' : ''}
          {hasMax ? ` ≤ ${required.max}` : ''} 词
        </span>
      ) : (
        <span className="text-muted-foreground">无字数要求</span>
      )}

      {under ? (
        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning" data-testid="word-under">
          还差 {required.min - wordCount} 词
        </span>
      ) : null}
      {over ? (
        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning" data-testid="word-over">
          超出 {wordCount - required.max} 词
        </span>
      ) : null}
      {ok && (hasMin || hasMax) ? (
        <span className="rounded bg-success/15 px-1.5 py-0.5 text-success" data-testid="word-ok">
          字数达标
        </span>
      ) : null}
    </div>
  )
}
