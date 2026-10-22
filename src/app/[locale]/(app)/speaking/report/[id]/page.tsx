'use client'

/**
 * /speaking/report/[id] — 口语评分报告页（T19 验收 6）。
 * Mock 阶段 scoreSource='rule'：S6 真实统计 + 4 维派生分，**无"发音"维度**。
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { SpeakingReportHeader, RuleStatsPanel, SpeakingScoreRadar } from '@/features/speaking/components/report-parts'
import { speakingApi } from '@/features/speaking/api'
import type { SpeakingSessionReport } from '@/features/speaking/types'
import { ROUTES } from '@/lib/constants/routes'

export default function SpeakingReportPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const sessionId = params.id
  const [report, setReport] = useState<SpeakingSessionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void speakingApi
      .report(sessionId)
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
  }, [sessionId])

  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-24" />
          <SkeletonCard className="mt-4 h-64" />
        </PageContainer>
      </AppShell>
    )
  }

  if (error !== null || report === null) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="报告加载失败" message={error ?? '该会话可能不存在。'} onRetry={() => window.location.reload()} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="口语报告"
          description={`${report.roleName} × ${report.sceneName} · 第 ${report.messageCount} 条消息`}
          actions={
            <Link
              href={ROUTES.speaking}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              再练一次
            </Link>
          }
        />

        <div className="space-y-4">
          <SpeakingReportHeader report={report} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">口语统计（S6 真实计算）</h2>
              {report.ruleStats !== null ? (
                <RuleStatsPanel stats={report.ruleStats} />
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">暂无统计数据</p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">能力雷达（4 维）</h2>
              <SpeakingScoreRadar scores={report.scores} />
            </section>
          </div>

          {report.aiSummary !== null ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">总评</h2>
              <p className="text-sm leading-6">{report.aiSummary}</p>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">对话记录</h2>
            <div className="space-y-2">
              {report.messages.map((m) => (
                <p key={m.id} className="rounded bg-surface-muted px-2 py-1.5 text-xs leading-5">
                  <span className="mr-1.5 font-medium">{m.speaker === 'USER' ? '我' : 'AI'}</span>
                  {m.textContent}
                </p>
              ))}
            </div>
          </section>
        </div>
      </PageContainer>
    </AppShell>
  )
}
