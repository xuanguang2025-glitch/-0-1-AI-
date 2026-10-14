'use client'

/**
 * AudioPlayer：听力播放器（架构 §5.2 / T14 验收 1）。
 *
 * 能力：播放/暂停、0.75-1.25× 三档变速、进度条 seek、逐句跳转、时间显示。
 *
 * 关键实现说明（验收 1「变速后字幕高亮不错位」）：
 *   字幕高亮由 `<audio>.currentTime` 经 `timeupdate` 驱动，而 `playbackRate`
 *   **只改变播放速度、不改变 currentTime 的时间轴语义**，因此高亮天然不会错位。
 *   唯一需要处理的是「换档会换文件」（每档是独立 mp3）：切档时按**播放比例**
 *   （currentTime/duration）在新文件上恢复位置，而不是按绝对秒数——否则慢档
 *   会比快档短，按秒 seek 会越界或倒退。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import type { ListeningAudioUrl } from '../types'

/** 暴露给外部（字幕同步 / A-B 循环）的命令式句柄 */
export interface AudioPlayerHandle {
  seek: (sec: number) => void
  play: () => Promise<void>
  pause: () => void
  toggle: () => void
  setRate: (rate: number) => void
  currentTime: () => number
  duration: () => number
}

export interface AudioPlayerProps {
  src: string
  /** 三档音频资产（rate + url） */
  rates: ListeningAudioUrl[]
  defaultRate?: number
  className?: string
  onTimeUpdate?: (sec: number) => void
  onEnded?: () => void
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { src, rates, defaultRate = 1, className, onTimeUpdate, onEnded },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState(defaultRate)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  /** 切档时待恢复的播放比例（0-1），metadata 加载后应用 */
  const pendingRatioRef = useRef<number | null>(null)

  // 当前档位对应的音频地址
  const activeUrl = rates.find((r) => r.rate === rate)?.url ?? src

  const emitTime = useCallback(
    (sec: number) => {
      setCurrent(sec)
      onTimeUpdate?.(sec)
    },
    [onTimeUpdate],
  )

  // ---- 播放器事件 ----
  useEffect(() => {
    const el = audioRef.current
    if (!el) return undefined
    const onTime = (): void => emitTime(el.currentTime)
    const onMeta = (): void => {
      setDuration(el.duration || 0)
      // 切档后按比例恢复位置
      const ratio = pendingRatioRef.current
      if (ratio !== null) {
        pendingRatioRef.current = null
        el.currentTime = Math.max(0, Math.min((el.duration || 0) * ratio, (el.duration || 0) - 0.05))
      }
    }
    const onEnd = (): void => {
      setPlaying(false)
      onEnded?.()
    }
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [emitTime, onEnded])

  // 换档：记住播放比例，换 src 后由 onMeta 恢复
  const applyRate = useCallback((next: number) => {
    const el = audioRef.current
    if (el && el.duration > 0) {
      pendingRatioRef.current = el.currentTime / el.duration
    }
    el?.pause()
    setRateState(next)
    if (el) el.playbackRate = next
  }, [])

  useImperativeHandle(
    ref,
    (): AudioPlayerHandle => ({
      seek: (sec: number) => {
        const el = audioRef.current
        if (!el) return
        el.currentTime = Math.max(0, Math.min(sec, el.duration || sec))
        emitTime(el.currentTime)
      },
      play: async () => {
        try {
          await audioRef.current?.play()
        } catch {
          // 自动播放被浏览器拦截（无用户手势）——静默，交由用户点击播放
          setPlaying(false)
        }
      },
      pause: () => audioRef.current?.pause(),
      toggle: () => {
        const el = audioRef.current
        if (!el) return
        if (el.paused) void el.play().catch(() => setPlaying(false))
        else el.pause()
      },
      setRate: applyRate,
      currentTime: () => audioRef.current?.currentTime ?? 0,
      duration: () => audioRef.current?.duration ?? 0,
    }),
    [applyRate, emitTime],
  )

  const onScrub = (value: number): void => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = value
    emitTime(value)
  }

  const rateOptions = (rates.length > 0 ? rates : [{ rate: 1, url: src, durationSec: null }]).map((r) => ({
    value: String(r.rate),
    label: `${r.rate}×`,
  }))

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-3', className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- 字幕由 TranscriptSync 独立渲染，避免双重时间轴 */}
      <audio ref={audioRef} src={activeUrl} preload="metadata" data-testid="listening-audio" />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="default"
          onClick={() => audioRef.current?.paused === false ? audioRef.current?.pause() : void audioRef.current?.play().catch(() => setPlaying(false))}
          aria-label={playing ? '暂停' : '播放'}
          data-testid="listening-play-toggle"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onScrub(0)}
          aria-label="重新播放"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <span className="tabular-nums text-xs text-muted-foreground" data-testid="listening-time">
          {formatTime(current)} / {formatTime(duration)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">语速</span>
          <Select
            className="h-8 w-20 py-0 text-xs"
            options={rateOptions}
            value={String(rate)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => applyRate(Number(e.target.value))}
            aria-label="播放语速"
            data-testid="listening-rate"
          />
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={0.1}
        value={Math.min(current, duration || current)}
        onChange={(e) => onScrub(Number(e.target.value))}
        className="mt-3 w-full accent-[hsl(var(--primary))]"
        aria-label="播放进度"
        data-testid="listening-seek"
      />
    </div>
  )
})
