'use client'

/**
 * /writing/[id]/report — 写作报告页（W5，T17 验收 4/5）。
 *
 * **双轨渲染**：
 *   - scoreSource='ai' → ScoreRadar + CorrectionList + RewriteTabs + aiSummary；
 *   - scoreSource='rule' → ReportHeader 的「规则评分」徽章 + 规则问题清单。
 * 两个区块都**按数据有无渲染**：AI 区块缺数据就不渲染（不是占位假数据），
 * 规则区块永远有数据（规则轨是兜底），因此页面永不空白。
 */
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { CorrectionList } from '@/features/writing/components/correction-list'
import { ReportHeader } from '@/features/writing/components/report-header'
import { RewriteTabs } from '@/features/writing/components/rewrite-tabs'
import { ScoreRadar } from '@/features/writing/components/score-radar'
import { RULE_NAMES, type WritingRuleIssue } from '@/features/writing/types'
import { useWritingReport } from '@/features/writing/hooks'
import { ROUTES } from '@/lib/constants/routes'

/** 规则问题清单（rule 轨的主体内容） */
function RuleIssueList({ issues }: { issues: WritingRuleIssue[] }): React.JSX.Element {
  if (issues.length === 0) {
    return (
      <p className="rounded-lg bg-success/10 px-3 py-4 text-center text-sm text-success" data-testid="report-rule-clean">
        规则检查未发现问题
      </p>
    )
  }
  return (
    <ul className="space-y-2" data-testid="report-rule-issues">
      {issues.map((issue) => (
        <li key={issue.rule} className="rounded-lg border border-border bg-surface p-3" data-testid={`report-issue-${issue.rule}`}>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
              {RULE_NAMES[issue.rule] ?? issue.rule}
            </span>
            <span className="text-muted-foreground">-{issue.deduction} 分</span>
          </div>
          <p className="mt-1 text-sm leading-6">{issue.message}</p>
          {issue.excerpt ? <p className="mt-0.5 text-xs text-muted-foreground">{issue.excerpt}</p> : null}
        </li>
      ))}
    </ul>
  )
}

export default function WritingReportPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const submissionId = params.id
  const { data, loading, error, reload } = useWritingReport(submissionId)

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

  if (error || !data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="报告加载失败" message={error ?? '该作文可能已删除。'} onRetry={reload} />
        </PageContainer>
      </AppShell>
    )
  }

  const isAi = data.scoreSource === 'ai'

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="写作报告"
          description={`${data.taskTitle} · 第 ${data.revision} 轮批改`}
          actions={
            <Link
              href={`${ROUTES.writing}/${data.submissionId}`}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              返回编辑
            </Link>
          }
        />

        <div className="space-y-4">
          {/* 头部：scoreSource 徽章 + 双轨分数 + 字数达标提示（验收 4） */}
          <ReportHeader report={data} />

          {/* AI 摘要（仅 ai 轨） */}
          {isAi && data.aiSummary !== null ? (
            <section className="rounded-xl border border-border bg-surface p-4" data-testid="report-summary">
              <h2 className="mb-2 text-sm font-semibold">总评</h2>
              <p className="text-sm leading-6">{data.aiSummary}</p>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* AI 轨：雷达 + 修正 + 改写（缺数据即不渲染） */}
            {isAi ? (
              <>
                <section className="rounded-xl border border-border bg-surface p-4">
                  <h2 className="mb-2 text-sm font-semibold">维度评分</h2>
                  <ScoreRadar scores={data.aiScores} />
                  {data.aiTotalScore !== null ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      总分 <span className="font-semibold text-foreground">{data.aiTotalScore}</span>
                    </p>
                  ) : null}
                </section>
                <section className="rounded-xl border border-border bg-surface p-4">
                  <h2 className="mb-2 text-sm font-semibold">规则检查（本地算法）</h2>
                  <RuleIssueList issues={data.ruleIssues} />
                </section>
              </>
            ) : null}

            {/* 规则轨主体：问题清单（永远有数据） */}
            {!isAi ? (
              <section className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
                <h2 className="mb-2 text-sm font-semibold">规则检查结果</h2>
                <RuleIssueList issues={data.ruleIssues} />
              </section>
            ) : null}
          </div>

          {/* AI 轨：逐句建议 + 多档改写 */}
          <CorrectionList corrections={data.corrections} />
          <RewriteTabs rewrites={data.rewrites} />

          <div className="flex gap-2 pb-8">
            <Link
              href={ROUTES.writing}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              返回写作任务
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.reload()
              }}
              data-testid="report-reanalyze"
            >
              重新请求批改
            </Button>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}
