'use client'

/**
 * /vocabulary/learn — 专注学词模式：卡片式逐词学习（释义先隐藏，点开 → 标记学会）。
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { EmptyState } from '@/components/common/empty-state'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ROUTES } from '@/lib/constants/routes'
import { ApiClientError } from '@/features/auth/api'
import { vocabularyApi } from '@/features/vocabulary/api'
import type { WordSummary } from '@/features/vocabulary/types'
import { ModeSwitcher } from '@/features/vocabulary/components/mode-switcher'

export default function VocabularyLearnPage(): React.JSX.Element {
  const router = useRouter()
  const [words, setWords] = useState<WordSummary[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [learnedCount, setLearnedCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    vocabularyApi
      .today()
      .then((d) => {
        if (!cancelled) setWords(d.words)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiClientError ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const current = words[index]

  const markLearned = async (): Promise<void> => {
    if (!current || busy) return
    setBusy(true)
    try {
      await vocabularyApi.learn(current.id)
      setLearnedCount((c) => c + 1)
      setRevealed(false)
      setIndex((i) => i + 1)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '提交失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <PageContainer narrow>
        <ModeSwitcher />

        <div className="mt-6">
          {loading ? <SkeletonList rows={3} /> : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!loading && !current ? (
            <EmptyState
              emoji="🎉"
              title={learnedCount > 0 ? `本次学了 ${learnedCount} 个新词` : '今日暂无新词'}
              description="去复习巩固一下，记忆更牢"
              action={
                <Button onClick={() => router.push(ROUTES.vocabulary.review)}>开始复习</Button>
              }
            />
          ) : null}

          {current ? (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
              <p className="text-xs text-muted-foreground">
                {index + 1} / {words.length}
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight">{current.word}</h1>
              {current.phoneticUk ? <p className="mt-1 text-sm text-muted-foreground">/{current.phoneticUk}/</p> : null}

              {revealed ? (
                <div className="mt-6 space-y-2 text-left">
                  {(current.definitions ?? []).map((d, i) => (
                    <p key={i} className="text-sm">
                      {d.pos ? <Badge variant="secondary" className="mr-2">{d.pos}</Badge> : null}
                      {d.zh ?? d.en}
                    </p>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setRevealed(false)}>
                    再看一眼单词
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="mt-6" onClick={() => setRevealed(true)}>
                  点击显示释义
                </Button>
              )}

              <div className="mt-8 flex justify-center gap-3">
                <Button variant="ghost" onClick={() => setIndex((i) => Math.min(words.length - 1, i + 1))} disabled={index === words.length - 1}>
                  跳过
                </Button>
                <Button onClick={() => void markLearned()} disabled={busy || !revealed}>
                  {busy ? '提交中…' : '学会了，下一个'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  )
}
