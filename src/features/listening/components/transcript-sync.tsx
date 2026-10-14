'use client'

/**
 * TranscriptSync：时间轴字幕（T14 验收 2）。
 *
 * 点击句子 → 音频 seek 到该句 `startSec`（误差 < 0.5s，由 `<audio>.currentTime`
 * 直接赋值保证，不依赖任何估算）。当前句按 `activeIndex` 高亮。
 *
 * 移动端：容器可滚动且限高，避免长字幕把播放器挤出视口。
 */
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils/cn'
import type { ListeningFocusPoint, TimelineLine } from '../types'

export interface TranscriptSyncProps {
  lines: TimelineLine[]
  activeIndex: number
  onSeek: (sec: number, index: number) => void
  focusPoints?: ListeningFocusPoint[]
  className?: string
}

/** 该句是否含考点（用于角标） */
function focusTypesAt(points: ListeningFocusPoint[], startSec: number, endSec: number): ListeningFocusPoint[] {
  return points.filter((p) => p.startSec >= startSec - 0.5 && p.startSec < endSec)
}

export function TranscriptSync({
  lines,
  activeIndex,
  onSeek,
  focusPoints = [],
  className,
}: TranscriptSyncProps): React.JSX.Element {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  // 高亮句滚动进视口（不抢焦点，避免打断键盘操作）
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  if (lines.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>暂无字幕</p>
  }

  return (
    <div className={cn('max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-2', className)}>
      {lines.map((line, i) => {
        const active = i === activeIndex
        const fps = focusTypesAt(focusPoints, line.startSec, line.endSec)
        return (
          <button
            key={`${line.startSec}-${i}`}
            ref={active ? activeRef : null}
            type="button"
            onClick={() => onSeek(line.startSec, i)}
            aria-current={active ? 'true' : undefined}
            data-testid={`transcript-line-${i}`}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left transition-colors',
              active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-surface-muted',
            )}
          >
            <span className="mr-2 select-none text-[10px] tabular-nums opacity-60">
              {line.startSec.toFixed(1)}s
            </span>
            <span className={cn('text-sm', active && 'font-medium')}>{line.en}</span>
            {line.zh ? <span className="mt-0.5 block text-xs text-muted-foreground">{line.zh}</span> : null}
            {fps.length > 0 ? (
              <span className="mt-1 flex flex-wrap gap-1">
                {fps.map((fp) => (
                  <span key={fp.word} className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                    {fp.word}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
