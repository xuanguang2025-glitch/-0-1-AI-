'use client'

/**
 * AbLoopBar：A-B 循环（T14 验收 1）。
 *
 * 设 A 点 / B 点 → 在该区间内循环播放；到 B 点自动回跳 A 点。
 * 轮询用 `setInterval(200ms)` 而非 rAF：音频位置只在 `timeupdate`（≈4Hz）更新，
 * 200ms 已足够，且页面不可见时 rAF 会停导致循环失效。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Repeat, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { AudioPlayerHandle } from './audio-player'
import type { TimelineLine } from '../types'

export interface AbLoopBarProps {
  player: React.RefObject<AudioPlayerHandle | null>
  /** 当前字幕行（用于「循环本句」快捷按钮） */
  lines?: TimelineLine[]
  activeIndex?: number
  className?: string
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export function AbLoopBar({ player, lines = [], activeIndex = -1, className }: AbLoopBarProps): React.JSX.Element {
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = useCallback(() => {
    setA(null)
    setB(null)
    setEnabled(false)
  }, [])

  // 循环轮询
  useEffect(() => {
    if (!enabled || a === null || b === null || b <= a) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return undefined
    }
    timerRef.current = setInterval(() => {
      const t = player.current?.currentTime() ?? 0
      if (t >= b - 0.05 || t < a - 0.5) {
        player.current?.seek(a)
      }
    }, 200)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [enabled, a, b, player])

  const setPointA = (): void => {
    const t = player.current?.currentTime() ?? 0
    setA(t)
    setEnabled(true)
  }
  const setPointB = (): void => {
    const t = player.current?.currentTime() ?? 0
    setB(t)
    setEnabled(true)
  }

  const loopCurrentLine = (): void => {
    const line = lines[activeIndex]
    if (!line) return
    setA(line.startSec)
    setB(Math.max(line.endSec, line.startSec + 0.5))
    setEnabled(true)
    player.current?.seek(line.startSec)
  }

  const ready = a !== null && b !== null && b > a

  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2', className)}>
      <Repeat className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">A-B 循环</span>

      <Button type="button" size="sm" variant="outline" onClick={setPointA} data-testid="ab-set-a">
        设 A{a !== null ? ` ${fmt(a)}` : ''}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={setPointB} disabled={a === null} data-testid="ab-set-b">
        设 B{b !== null ? ` ${fmt(b)}` : ''}
      </Button>

      <Button
        type="button"
        size="sm"
        variant={enabled && ready ? 'default' : 'secondary'}
        onClick={() => setEnabled((v) => !v)}
        disabled={!ready}
        data-testid="ab-toggle"
      >
        {enabled && ready ? '循环中' : '开始循环'}
      </Button>

      {lines.length > 0 && activeIndex >= 0 ? (
        <Button type="button" size="sm" variant="ghost" onClick={loopCurrentLine} data-testid="ab-loop-line">
          循环本句
        </Button>
      ) : null}

      {a !== null || b !== null ? (
        <Button type="button" size="sm" variant="ghost" onClick={clear} aria-label="清除 A-B" data-testid="ab-clear">
          <X className="h-4 w-4" />
        </Button>
      ) : null}

      {!ready && (a !== null || b !== null) ? (
        <span className="text-xs text-warning">B 点需晚于 A 点</span>
      ) : null}
    </div>
  )
}
