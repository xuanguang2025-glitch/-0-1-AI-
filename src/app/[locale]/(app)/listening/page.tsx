'use client'

/**
 * /listening — 听力材料列表（L1，T14）。
 *
 * 三态齐备（Skeleton / Empty / Error+Retry）；筛选：强度档 / 分类 / 难度。
 * 顶部明示「AI 合成语音（Phase 2）」——§5.1 要求的诚实标注。
 */
import { useCallback, useState } from 'react'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChipFilter, type ChipOption } from '@/components/common/chip-filter'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { useListeningList } from '@/features/listening/hooks'
import { INTENSITY_NAMES, type ListeningMaterialListItem } from '@/features/listening/types'
import { ROUTES } from '@/lib/constants/routes'

type IntensityFilter = '' | '1' | '2' | '3' | '4'

const INTENSITY_OPTIONS: ChipOption<IntensityFilter>[] = [
  { value: '', label: '全部强度' },
  { value: '1', label: 'L1 泛听入门' },
  { value: '2', label: 'L2 CET-4' },
  { value: '3', label: 'L3 CET-6' },
  { value: '4', label: 'L4 高阶话题' },
]

function rateLabel(m: ListeningMaterialListItem): string {
  const ready = m.audioUrls.length
  return ready > 0 ? `${ready} 档语速` : '音频待生成'
}

export default function ListeningListPage(): React.JSX.Element {
  const [intensity, setIntensity] = useState<IntensityFilter>('')
  const { data, loading, error, reload } = useListeningList(
    intensity === '' ? {} : { intensity: Number(intensity) },
  )

  const onFilter = useCallback((v: IntensityFilter) => setIntensity(v), [])

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="听力训练"
          description="6 种训练模式 · 三档语速 · 逐词听写批改"
          actions={<Badge variant="secondary">AI 合成语音（Phase 2）</Badge>}
        />

        <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
          当前音频由 TTS 合成，无自然语调与真实连读；优势是可无限次重复精听。真人音频规划 Phase 3。
        </p>

        {/* ChipFilter 自身只接受 className，无障碍名由外层 group 提供 */}
        <div className="mt-4" role="group" aria-label="强度档筛选">
          <ChipFilter options={INTENSITY_OPTIONS} value={intensity} onChange={onFilter} />
        </div>

        {/* 三态 */}
        {loading ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} className="h-40" />
            ))}
          </div>
        ) : error ? (
          <ErrorState className="mt-6" message={error} onRetry={reload} />
        ) : (data?.materials.length ?? 0) === 0 ? (
          <EmptyState
            className="mt-6"
            emoji="🎧"
            title="暂无听力材料"
            description="换个强度档试试，或稍后再来。"
            action={<Button variant="outline" onClick={reload}>刷新</Button>}
          />
        ) : (
          <>
            <p className="mt-4 text-xs text-muted-foreground">共 {data?.total ?? 0} 篇</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="listening-list">
              {(data?.materials ?? []).map((m) => (
                <Card key={m.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug">{m.title}</h3>
                    <Badge variant="outline">L{m.intensityLevel}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {INTENSITY_NAMES[m.intensityLevel] ?? `档位 ${m.intensityLevel}`} · {m.durationSec}s · {m.wordCount} 词
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{m.category}</Badge>
                    <Badge variant="outline">{rateLabel(m)}</Badge>
                    {m.bestAccuracy !== null ? <Badge variant="success">最佳 {Math.round(m.bestAccuracy)}%</Badge> : null}
                    {m.progress?.completed ? <Badge variant="secondary">已完成</Badge> : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {/* Button 为原生 button（无 asChild）；跳转用 Link + 按钮样式，保持语义与可访问性 */}
                    <Link
                      href={`${ROUTES.listening}/player/${m.id}`}
                      className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                      精听
                    </Link>
                    <Link
                      href={`${ROUTES.listening}/training/${m.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium transition-colors hover:bg-surface-muted"
                    >
                      训练
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
