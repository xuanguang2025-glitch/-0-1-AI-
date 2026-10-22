'use client'

/**
 * /exam — 专项训练卷列表（E1 入口页；设计文档列出 2 个页面，本页为导航必需的最小补充）。
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { PracticeScopeNotice } from '@/features/exam/components/exam-parts'
import { examApi } from '@/features/exam/api'
import type { ExamPaperListItem } from '@/features/exam/types'
import { ROUTES } from '@/lib/constants/routes'

export default function ExamListPage(): React.JSX.Element {
  const router = useRouter()
  const [papers, setPapers] = useState<ExamPaperListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void examApi
      .papers()
      .then((r) => {
        if (!cancelled) setPapers(r.papers)
      })
      .catch(() => {
        if (!cancelled) setError('试卷加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onStart = useCallback(async (paperId: string) => {
    setStarting(paperId)
    try {
      const r = await examApi.start(paperId)
      // practice 页从 sessionStorage 恢复题目（attemptId 无法反查 paper）
      sessionStorage.setItem(`exam-attempt-${r.attemptId}`, JSON.stringify(r))
      router.push(`${ROUTES.exam}/practice/${r.attemptId}`)
    } catch {
      setStarting(null)
    }
  }, [router])

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="专项训练卷" description="听力 / 阅读 / 语法 / 词汇 四类专项 · 仅客观题 · 判分在服务端" />
        <PracticeScopeNotice className="mb-4" />

        {loading ? (
          <SkeletonCard className="h-64" />
        ) : error !== null ? (
          <ErrorState title="试卷加载失败" message={error} onRetry={() => window.location.reload()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {papers.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-4" data-testid={`exam-paper-${p.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug">{p.title}</h3>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{p.examType}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {p.section}专项 · {p.questionCount} 题 · {p.durationMin} 分钟
                  {p.myAttemptCount > 0 ? ` · 已做 ${p.myAttemptCount} 次` : ''}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={starting === p.id}
                  onClick={() => void onStart(p.id)}
                  data-testid={`exam-start-${p.id}`}
                >
                  {starting === p.id ? '开始中…' : '开始练习'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
