'use client'

/**
 * ReportHeader：报告头部（T17 验收 4）。
 *
 * **核心行为**：scoreSource 徽章在这里 ——
 *   - `rule` → 黄色「规则评分」徽章 + 说明（AI 不可用时用户知道为什么没有 AI 分）；
 *   - `ai` → 绿色「AI 评分」徽章 + revision。
 * 双轨分数并列展示（AI 总分 / 规则分），任何情况下都有分可看。
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { WritingReport } from '../types'

export interface ReportHeaderProps {
  report: WritingReport
  className?: string
}

export function ReportHeader({ report, className }: ReportHeaderProps): React.JSX.Element {
  const isAi = report.scoreSource === 'ai'
  const mainScore = isAi ? (report.aiTotalScore ?? report.ruleScore) : report.ruleScore

  return (
    <header className={cn('rounded-xl border border-border bg-surface p-4', className)} data-testid="report-header">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{isAi ? 'AI 总分' : '规则评分'}</p>
          <p className="text-3xl font-semibold tabular-nums" data-testid="report-score">
            {mainScore}
          </p>
        </div>

        {/* 验收 4：scoreSource 徽章 */}
        {isAi ? (
          <Badge variant="success" data-testid="score-source-badge">
            AI 评分
          </Badge>
        ) : (
          <Badge variant="warning" data-testid="score-source-badge">
            规则评分
          </Badge>
        )}

        <span className="text-xs text-muted-foreground">第 {report.revision} 轮批改</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {report.wordCount} 词 · {report.paragraphCount} 段
          {isAi && report.ruleScore !== null ? ` · 规则分 ${report.ruleScore}` : ''}
        </span>
      </div>

      {/* 规则轨时的说明：明确告知 AI 不可用，但报告依然完整 */}
      {!isAi ? (
        <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="rule-mode-hint">
          AI 批改暂时不可用，当前展示的是**本地规则引擎**的评分与问题清单（拼写 / 句长 / 连接词 /
          分段 / 被动语态）。作文已保存，稍后可在记录页重新请求 AI 批改。
        </p>
      ) : null}

      {!report.wordCountOk ? (
        <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="word-count-hint">
          字数未达标（{report.wordCount} 词，要求 ≥ {report.requiredWords.min}
          {report.requiredWords.max > 0 ? ` 且 ≤ ${report.requiredWords.max}` : ''}），可能影响评分。
        </p>
      ) : null}
    </header>
  )
}
