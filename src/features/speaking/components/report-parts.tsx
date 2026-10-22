'use client'

/**
 * 口语报告组件：RuleStatsPanel（S6 真实统计）+ ScoreRadar（4 维，**无发音维度**）+ ReportHeader。
 */
import { Badge } from '@/components/ui/badge'
import { RadarChartLazy } from '@/components/charts'
import { cn } from '@/lib/utils/cn'
import type { RuleStats, SpeakingSessionReport } from '../types'

/** S6 统计面板：wpm / 填充词 / 平均句长 / 覆盖度 —— 每个数字都是真实计算 */
export function RuleStatsPanel({ stats, className }: { stats: RuleStats; className?: string }): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)} data-testid="rule-stats-panel">
      <Stat label="语速" value={`${stats.wpm} wpm`} hint={stats.wpm >= 100 && stats.wpm <= 150 ? '理想区间' : '偏离 100-150'} />
      <Stat label="填充词" value={`${stats.fillerCount} 个`} hint={stats.fillerCount === 0 ? '无' : '每个扣 12 分'} />
      <Stat label="平均句长" value={`${stats.avgSentenceLen} 词`} hint={stats.avgSentenceLen >= 8 && stats.avgSentenceLen <= 18 ? '理想区间' : '建议 8-18'} />
      <Stat label="目标句覆盖" value={`${Math.round(stats.coverage * 100)}%`} hint="说出场景关键表达的比例" />
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}

/** 4 维雷达：**无"发音"维度**（Phase 2 无音素数据，架构师裁决宁缺毋假） */
export function SpeakingScoreRadar({ scores }: { scores: SpeakingSessionReport['scores'] }): React.JSX.Element | null {
  if (scores === null) return null
  return (
    <div data-testid="speaking-score-radar">
      <RadarChartLazy
        data={[
          { dimension: '语法', score: scores.grammar },
          { dimension: '词汇', score: scores.vocabulary },
          { dimension: '流利度', score: scores.fluency },
          { dimension: '自然度', score: scores.naturalness },
        ]}
      />
    </div>
  )
}

/** 报告头部：scoreSource 徽章 + 总分 + 规则分 */
export function SpeakingReportHeader({ report }: { report: SpeakingSessionReport }): React.JSX.Element {
  const isAi = report.scoreSource === 'ai'
  return (
    <header className="rounded-xl border border-border bg-surface p-4" data-testid="speaking-report-header">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{isAi ? 'AI 评分' : '规则评分（S6）'}</p>
          <p className="text-3xl font-semibold tabular-nums" data-testid="speaking-report-score">
            {report.ruleStats?.score ?? '-'}
          </p>
        </div>
        {isAi ? <Badge variant="success">AI 评分</Badge> : <Badge variant="warning">规则评分</Badge>}
        <span className="text-xs text-muted-foreground">
          {report.roleName} × {report.sceneName} · {Math.round(report.durationSec / 60)} 分钟 · {report.messageCount} 条消息
        </span>
        {report.wasTextInput ? <Badge variant="outline">文本模式</Badge> : null}
      </div>
      <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
        评分为文本级 4 维（语法/词汇/流利度/自然度）。**不含"发音"维度**——浏览器语音接口无音素数据，宁缺毋假。
      </p>
    </header>
  )
}
