'use client'

/**
 * /vocabulary/review — 复习模式：review.store 驱动（队列 → 自评 → SM-2 提交 → 结果反馈）。
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { EmptyState } from '@/components/common/empty-state'
import { ROUTES } from '@/lib/constants/routes'
import { ApiClientError } from '@/features/auth/api'
import { vocabularyApi } from '@/features/vocabulary/api'
import { useReviewStore, newIdempotencyKey } from '@/stores/review.store'
import { queueItemToSummary, firstDefinition, stageLabel } from '@/features/vocabulary/components/word-card'
import { SelfRatingBar } from '@/features/vocabulary/components/self-rating-bar'
import { IntervalHint } from '@/features/vocabulary/components/interval-hint'

export default function VocabularyReviewPage(): React.JSX.Element {
  const router = useRouter()
  const { queue, index, shownAt, session, busy, lastResult, setQueue, next, markShown, recordResult, setBusy } =
    useReviewStore()

  const current = queue[index]
  const finished = queue.length > 0 && index >= queue.length

  useEffect(() => {
    let cancelled = false
    vocabularyApi
      .reviewQueue()
      .then((q) => {
        if (!cancelled) setQueue(q.items)
      })
      .catch(() => {
        // 未登录等：由 middleware 兜底；这里保留空态
      })
    return () => {
      cancelled = true
    }
  }, [setQueue])

  // 每次展示新卡重置计时
  useEffect(() => {
    markShown()
  }, [index, markShown])

  const submit = async (rating: number): Promise<void> => {
    if (!current || busy) return
    setBusy(true)
    try {
      const result = await vocabularyApi.review({
        userVocabId: current.userVocabId,
        rating,
        responseMs: Math.min(600_000, Date.now() - shownAt),
        idempotencyKey: newIdempotencyKey(),
      })
      recordResult(result, rating >= 3)
      // 结果停留 1.2s 再进入下一张
      window.setTimeout(() => next(), 1200)
    } catch (e) {
      setBusy(false)
      if (e instanceof ApiClientError && e.status === 409) {
        // 重复提交：直接跳下一张
        next()
        return
      }
      // 其他错误保留当前卡，稍后重试
    }
  }

  return (
    <AppShell>
      <PageContainer narrow>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">复习</h1>
          <span className="text-xs text-muted-foreground">
            本次 {session.total} · 对 {session.correct} · 错 {session.wrong}
          </span>
        </div>

        <div className="mt-6">
          {queue.length === 0 && !busy ? (
            <EmptyState
              emoji="🌱"
              title="没有到期的复习"
              description="记忆曲线安排的复习会在到期后出现在这里"
              action={
                <Button size="sm" onClick={() => router.push(ROUTES.vocabulary.root)}>
                  去学新词
                </Button>
              }
            />
          ) : null}

          {queue.length > 0 && !finished && current ? (
            <>
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((index / queue.length) * 100)}%` }}
                />
              </div>
              <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-4xl font-bold tracking-tight">{current.vocabulary.word}</h2>
                  <Badge variant="secondary">{stageLabel(current.stage)}</Badge>
                </div>
                {current.vocabulary.phoneticUk ? (
                  <p className="mt-1 text-sm text-muted-foreground">/{current.vocabulary.phoneticUk}/</p>
                ) : null}

                {lastResult ? (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-success">
                      {lastResult.path === 'MASTERED' ? '已掌握！🎉' : lastResult.path === 'LAPSE' ? '有点忘了，明天再来一次' : '进步了！'}
                    </p>
                    <IntervalHint result={lastResult} />
                  </div>
                ) : (
                  <>
                    <p className="mt-4 text-sm text-muted-foreground">{firstDefinition(queueItemToSummary(current))}</p>
                    <p className="mt-8 mb-3 text-xs text-muted-foreground">回忆得怎么样？</p>
                    <SelfRatingBar disabled={busy} onSelect={(r) => void submit(r)} />
                  </>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                还剩 {queue.length - index} 张
              </p>
            </>
          ) : null}

          {finished ? (
            <EmptyState
              emoji="✅"
              title={`复习完成！共 ${session.total} 张`}
              description={`正确 ${session.correct} · 遗忘 ${session.wrong}，间隔已按记忆曲线自动安排`}
              action={
                <Button onClick={() => router.push(ROUTES.dashboard)}>回主页</Button>
              }
            />
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  )
}
