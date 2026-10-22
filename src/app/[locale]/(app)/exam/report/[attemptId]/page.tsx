'use client'

/**
 * /exam/report/[attemptId] — 专项卷报告页（正确率 + 分项 + 逐题解析 + 范围标注）。
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { PracticeScopeNotice, ReportScoreCard } from '@/features/exam/components/exam-parts'
import { examApi } from '@/features/exam/api'
import type { ExamReportResult } from '@/features/exam/types'
import { ROUTES } from '@/lib/constants/routes'

export default function ExamReportPage(): React.JSX.Element {
  const params = useParams<{ attemptId: string }>()
  const attemptId = params.attemptId
  const [report, setReport] = useState<ExamReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void examApi
      .report(attemptId)
      .then((r) => {
        if (!cancelled) setReport(r)
      })
      .catch(() => {
        if (!cancelled) setError('报告加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attemptId])

  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-24" />
        </PageContainer>
      </AppShell>
    )
  }

  if (error !== null || report === null) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="报告加载失败" message={error ?? '该考试记录可能不存在。'} onRetry={() => window.location.reload()} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="专项练习报告"
          description={report.paperTitle}
          actions={
            <Link
              href={ROUTES.exam}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              返回试卷列表
            </Link>
          }
        />

        <div className="space-y-4">
          {/* 验收 3：显式范围标注 */}
          <PracticeScopeNotice />
          <ReportScoreCard report={report} />

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">逐题解析</h2>
            <ul className="space-y-2">
              {report.answers.map((a, i) => (
                <li key={a.examQuestionId} className="rounded-lg bg-surface-muted p-3" data-testid={`exam-answer-${i}`}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={a.isCorrect ? 'text-success' : 'text-destructive'}>{a.isCorrect ? '✓' : '✗'}</span>
                    <span className="min-w-0 flex-1 truncate">{a.stem}</span>
                    <span className="text-xs text-muted-foreground">你的答案：</span>
                    <span className="text-xs font-medium">{a.userAnswer || '（空）'}</span>
                    {!a.isCorrect && a.correctAnswer !== '' ? (
                      <>
                        <span className="text-xs text-muted-foreground">正确：</span>
                        <span className="text-xs font-medium text-success">{a.correctAnswer}</span>
                      </>
                    ) : null}
                  </div>
                  {a.explanation !== null ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{a.explanation}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PageContainer>
    </AppShell>
  )
}
