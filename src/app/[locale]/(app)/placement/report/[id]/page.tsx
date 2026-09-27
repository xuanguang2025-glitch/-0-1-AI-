'use client'

/**
 * Placement 报告页：六区块（分数卡 / CEFR 徽章 / 雷达 / AI 建议 / 错题 / ETA）。
 * AI 建议区块独立降级，失败不影响其余区块。
 */
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { AiReportBlock, CefrBadge, EtaTime, ProblemsList, RadarReport, ScoreCards } from '@/features/placement/components/report'
import { placementApi, type PlacementReport } from '@/features/placement/api'
import { ROUTES } from '@/lib/constants/routes'

export default function PlacementReportPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const testId = params.id
  const [report, setReport] = useState<PlacementReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    placementApi
      .report(testId)
      .then((r) => {
        if (!cancelled) setReport(r)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [testId])

  return (
    <AppShell>
      <PageContainer>
        {error ? <ErrorState title="报告加载失败" message={error} /> : null}

        {!error && !report ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {report ? (
          <div className="space-y-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">水平测评报告</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {report.completedAt ? `完成于 ${new Date(report.completedAt).toLocaleString('zh-CN')}` : ''}
                </p>
              </div>
              <CefrBadge cefr={report.cefr} />
            </header>

            {/* ① 分数卡 + CET 估算 */}
            <ScoreCards scores={report.scores} cet={report.cet} />

            {/* ② 雷达图 */}
            <section>
              <h2 className="mb-2 text-lg font-semibold">能力画像</h2>
              <RadarReport scores={report.scores} />
            </section>

            {/* ③ AI 建议（独立降级区块） */}
            <AiReportBlock report={report} />

            {/* ④ 错题列表 */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">错题回顾</h2>
              <ProblemsList problems={report.problems} />
            </section>

            {/* ⑤ ETA 预估 */}
            <EtaTime
              etaWeeks={report.aiReport?.etaWeeks ?? null}
              cefr={report.cefr}
              targetExam="CET4"
            />

            <div className="flex justify-center gap-3 pb-8">
              <Button onClick={() => router(ROUTES.dashboard)}>进入学习仪表盘</Button>
              <Link
                href={ROUTES.vocabulary.root}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
              >
                直接开始背单词
              </Link>
            </div>
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  )
}

function router(path: string): void {
  window.location.assign(path)
}
