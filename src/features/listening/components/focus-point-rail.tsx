'use client'

/**
 * FocusPointRail：生词/考点侧栏（§5.2 focusPoints）。
 * 点击考点 → 音频定位到该考点出现的时间点。
 */
import { cn } from '@/lib/utils/cn'
import type { ListeningFocusPoint } from '../types'

const TYPE_LABEL: Record<string, string> = {
  NEW_WORD: '生词',
  KEY_WORD: '关键词',
  PHRASE: '短语',
  GRAMMAR: '语法',
}

export interface FocusPointRailProps {
  points: ListeningFocusPoint[]
  onSeek?: (sec: number) => void
  /** 用户勾选「标记为生词」，提交时随 unknownWords 上报 */
  onToggleUnknown?: (point: ListeningFocusPoint) => void
  unknownWords?: string[]
  className?: string
}

export function FocusPointRail({
  points,
  onSeek,
  onToggleUnknown,
  unknownWords = [],
  className,
}: FocusPointRailProps): React.JSX.Element {
  if (points.length === 0) {
    return <p className={cn('py-4 text-center text-sm text-muted-foreground', className)}>本篇暂无考点标注</p>
  }

  return (
    <ul className={cn('space-y-1.5', className)}>
      {points.map((p) => {
        const marked = unknownWords.includes(p.word)
        return (
          <li
            key={`${p.word}-${p.startSec}`}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2"
            data-testid={`focus-point-${p.word}`}
          >
            <button
              type="button"
              onClick={() => onSeek?.(p.startSec)}
              className="min-w-0 flex-1 text-left"
              title={`定位到 ${p.startSec.toFixed(1)}s`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{p.word}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                  {TYPE_LABEL[p.type] ?? p.type}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{p.meaning}</span>
            </button>
            {onToggleUnknown ? (
              <button
                type="button"
                onClick={() => onToggleUnknown(p)}
                aria-pressed={marked}
                className={cn(
                  'shrink-0 rounded-md border px-2 py-1 text-[10px] transition-colors',
                  marked ? 'border-warning bg-warning/15 text-warning' : 'border-border text-muted-foreground',
                )}
                data-testid={`focus-unknown-${p.word}`}
              >
                {marked ? '已标记' : '标为生词'}
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
