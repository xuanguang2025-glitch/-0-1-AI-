'use client'

/**
 * /vocabulary — 今日学词主页：选词书 → 今日新词列表 → 逐词学习（learn 落库 → 进入复习队列）。
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ROUTES } from '@/lib/constants/routes'
import { ApiClientError } from '@/features/auth/api'
import { vocabularyApi } from '@/features/vocabulary/api'
import type { TodayWords, WordSummary } from '@/features/vocabulary/types'
import { firstDefinition } from '@/features/vocabulary/components/word-card'
import { ModeSwitcher } from '@/features/vocabulary/components/mode-switcher'

export default function VocabularyHomePage(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const book = searchParams.get('book') ?? undefined

  const [data, setData] = useState<TodayWords | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [learned, setLearned] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setData(await vocabularyApi.today(book))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [book])

  useEffect(() => {
    void load()
  }, [load])

  const learn = async (w: WordSummary): Promise<void> => {
    if (busyId) return
    setBusyId(w.id)
    try {
      await vocabularyApi.learn(w.id)
      setLearned((prev) => new Set(prev).add(w.id))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '学习失败，请重试')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="词汇" description="今日新词 + 复习队列，按记忆曲线安排" />
        <ModeSwitcher />

        <div className="mt-6 space-y-4">
          {loading ? <SkeletonList rows={4} /> : null}

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
              <Button size="sm" variant="outline" className="ml-3" onClick={() => void load()}>
                重试
              </Button>
            </div>
          ) : null}

          {data && data.words.length === 0 ? (
            <EmptyState
              emoji="📖"
              title="今日新词已完成"
              description="换个词书继续学，或去复习到期的单词"
              action={
                <Button size="sm" onClick={() => router.push(ROUTES.vocabulary.review)}>
                  去复习
                </Button>
              }
            />
          ) : null}

          {data && data.words.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                词书「{data.book.name}」· 今日新词 {data.words.length} 个 · 已学 {learned.size}
              </p>
              <div className="space-y-2">
                {data.words.map((w) => {
                  const done = learned.has(w.id)
                  return (
                    <div
                      key={w.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-lg font-semibold">{w.word}</span>
                          {w.phoneticUk ? <span className="text-xs text-muted-foreground">/{w.phoneticUk}/</span> : null}
                          <Badge variant="secondary" className="text-[10px]">
                            {w.difficulty}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{firstDefinition(w)}</p>
                      </div>
                      <Button size="sm" variant={done ? 'ghost' : 'outline'} disabled={done || busyId === w.id} onClick={() => void learn(w)}>
                        {done ? '已学 ✓' : busyId === w.id ? '提交中…' : '学会了'}
                      </Button>
                    </div>
                  )
                })}
              </div>
              {learned.size > 0 ? (
                <div className="flex justify-end">
                  <Button onClick={() => router.push(ROUTES.vocabulary.review)}>去复习刚学的词 →</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  )
}
