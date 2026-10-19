'use client'

/**
 * KeyWordRail：重点词侧栏（T15）。
 *
 * 点击重点词 → 回调由页面转成「划词查词」（同一套词典直查），
 * 不额外请求；同时提供「收藏」入口。
 */
import { cn } from '@/lib/utils/cn'
import type { ReadingKeyWord } from '../types'

export interface KeyWordRailProps {
  words: ReadingKeyWord[]
  onLookup?: (word: string) => void
  onCollect?: (word: string) => void
  collected?: string[]
  className?: string
}

export function KeyWordRail({
  words,
  onLookup,
  onCollect,
  collected = [],
  className,
}: KeyWordRailProps): React.JSX.Element {
  if (words.length === 0) {
    return <p className={cn('py-4 text-center text-sm text-muted-foreground', className)}>本篇暂无重点词标注</p>
  }

  return (
    <ul className={cn('space-y-1.5', className)} data-testid="key-word-rail">
      {words.map((w) => {
        const marked = collected.includes(w.word)
        return (
          <li
            key={`${w.word}-${w.pos}`}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2"
            data-testid={`key-word-${w.word}`}
          >
            <button
              type="button"
              onClick={() => onLookup?.(w.word)}
              className="min-w-0 flex-1 text-left"
              title={`查询 ${w.word}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{w.word}</span>
                {w.pos ? <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">{w.pos}</span> : null}
              </span>
              {w.meaning ? <span className="mt-0.5 block text-xs text-muted-foreground">{w.meaning}</span> : null}
            </button>
            {onCollect ? (
              <button
                type="button"
                onClick={() => onCollect(w.word)}
                aria-pressed={marked}
                className={cn(
                  'shrink-0 rounded-md border px-2 py-1 text-[10px] transition-colors',
                  marked ? 'border-warning bg-warning/15 text-warning' : 'border-border text-muted-foreground',
                )}
                data-testid={`key-word-collect-${w.word}`}
              >
                {marked ? '已收藏' : '收藏'}
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
