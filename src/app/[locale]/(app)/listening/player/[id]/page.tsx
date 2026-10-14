'use client'

/**
 * /listening/player/[id] — 精听页（L2，T14）。
 *
 * 组成：AudioPlayer（三档变速 / seek / A-B 循环）+ TranscriptSync（逐句高亮与跳转）
 *       + FocusPointRail（考点定位 / 标为生词）。
 *
 * R2-9：换档时整套切换该档的「时间基准」（`detail.timebases[rate]`）——
 * 三档音频是三个独立 mp3、时长不同，字幕与考点必须落在当前档的真实时间轴上；
 * 所有换算都在服务端完成，本页不做任何时间计算。
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { AbLoopBar } from '@/features/listening/components/ab-loop-bar'
import { AudioPlayer, type AudioPlayerHandle } from '@/features/listening/components/audio-player'
import { FocusPointRail } from '@/features/listening/components/focus-point-rail'
import { TranscriptSync } from '@/features/listening/components/transcript-sync'
import { useListeningDetail, useSaveProgress } from '@/features/listening/hooks'
import { INTENSITY_NAMES, type ListeningTimebase } from '@/features/listening/types'
import { ROUTES } from '@/lib/constants/routes'

export default function ListeningPlayerPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const materialId = params.id
  const { data, loading, error, reload } = useListeningDetail(materialId)
  const { save } = useSaveProgress(materialId)

  const playerRef = useRef<AudioPlayerHandle | null>(null)
  /** null = 尚未初始化，用详情里的推荐档 */
  const [rate, setRate] = useState<number | null>(null)
  const [current, setCurrent] = useState(0)

  const activeRate = rate ?? data?.recommendedRate ?? 1
  const timebase: ListeningTimebase | undefined = data?.timebases[String(activeRate)]

  const activeIndex = useMemo(() => {
    const lines = timebase?.transcript ?? []
    if (lines.length === 0) return -1
    const i = lines.findIndex((l) => current >= l.startSec && current < l.endSec)
    // 停在末尾（播完 / 越界）时高亮最后一句，避免高亮突然消失
    return i >= 0 ? i : current >= (lines[lines.length - 1]?.endSec ?? 0) ? lines.length - 1 : -1
  }, [timebase, current])

  const onTime = useCallback(
    (sec: number) => {
      setCurrent(sec)
      // L7 防抖 2s：拖动进度条不会打爆接口
      save(sec, activeRate, false)
    },
    [save, activeRate],
  )

  const onEnded = useCallback(() => {
    // 播完：标记完成并把位置归零，下次进入从头开始（而不是停在结尾）
    save(0, activeRate, true)
  }, [save, activeRate])

  const onRateChange = useCallback(
    (next: number) => {
      setRate(next)
      save(playerRef.current?.currentTime() ?? current, next, false)
    },
    [save, current],
  )

  const onSeek = useCallback((sec: number) => {
    playerRef.current?.seek(sec)
    setCurrent(sec)
  }, [])

  // ---- 三态 ----
  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-24" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
            <SkeletonCard className="h-72" />
            <SkeletonCard className="h-72" />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="材料加载失败" message={error} onRetry={reload} />
        </PageContainer>
      </AppShell>
    )
  }

  if (!data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="材料不存在" message="该听力材料可能已下架。" />
        </PageContainer>
      </AppShell>
    )
  }

  const lines = timebase?.transcript ?? []
  const focusPoints = timebase?.focusPoints ?? []
  const noAudio = data.audioUrls.length === 0

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={data.title}
          description={`${INTENSITY_NAMES[data.intensityLevel] ?? `档位 ${data.intensityLevel}`} · ${data.wordCount} 词 · 约 ${data.durationSec}s`}
          actions={
            <Link
              href={`${ROUTES.listening}/training/${data.id}`}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              去训练
            </Link>
          }
        />

        {/* 音频缺失时如实提示（不伪造播放器） */}
        {noAudio ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            该材料音频尚未生成（Edge TTS 受限），可先阅读字幕与考点；音频补齐后自动可用。
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <AudioPlayer
              ref={playerRef}
              src={data.audioUrl}
              rates={data.audioUrls}
              defaultRate={data.recommendedRate}
              onRateChange={onRateChange}
              onTimeUpdate={onTime}
              onEnded={onEnded}
            />

            <AbLoopBar player={playerRef} lines={lines} activeIndex={activeIndex} />

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">字幕</h2>
                <Badge variant="outline">{activeRate}× 时间基准</Badge>
              </div>
              <TranscriptSync
                lines={lines}
                activeIndex={activeIndex}
                onSeek={(sec) => onSeek(sec)}
                focusPoints={focusPoints}
              />
            </section>
          </div>

          <aside className="space-y-3">
            <h2 className="text-sm font-semibold">生词与考点</h2>
            <FocusPointRail
              points={focusPoints}
              onSeek={(sec) => onSeek(sec)}
            />
            <p className="text-xs text-muted-foreground">
              点击考点可定位到出现位置；在训练页可把生词随作答一起提交。
            </p>
          </aside>
        </div>
      </PageContainer>
    </AppShell>
  )
}
