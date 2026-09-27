'use client'

/**
 * Placement 报告组件集：score-cards / cefr-badge / radar-report / problems-list / eta-time。
 */
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { RadarChartLazy } from '@/components/charts'
import { ProgressRing } from '@/components/charts/progress-ring'
import type { PlacementReport } from '../api'

// ---------- cefr-badge ----------

const CEFR_COLOR: Record<string, string> = {
  A1: 'bg-muted text-muted-foreground',
  A2: 'bg-success/15 text-success',
  B1: 'bg-primary/10 text-primary',
  B2: 'bg-primary/20 text-primary',
  C1: 'bg-warning/15 text-warning',
  C2: 'bg-destructive/10 text-destructive',
}

export function CefrBadge({ cefr }: { cefr: string | null }): React.JSX.Element {
  if (!cefr) return <></>
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-lg font-bold ${CEFR_COLOR[cefr] ?? CEFR_COLOR.A2}`}
    >
      CEFR {cefr}
    </span>
  )
}

// ---------- score-cards ----------

export function ScoreCards({
  scores,
  cet,
}: {
  scores: PlacementReport['scores']
  cet: PlacementReport['cet']
}): React.JSX.Element {
  if (!scores) return <></>
  const items = [
    { label: '词汇', value: scores.vocabulary },
    { label: '语法', value: scores.grammar },
    { label: '阅读', value: scores.reading },
    { label: '听力', value: scores.listening },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <ProgressRing value={scores.overall} size={120} label={`${scores.overall}`} />
        <div>
          <h3 className="text-lg font-semibold">综合得分 {scores.overall} / 100</h3>
          {cet ? (
            <p className="mt-1 text-sm text-muted-foreground">
              四级估算 <b className="text-foreground">{cet.cet4}</b> 分 · 六级估算{' '}
              <b className="text-foreground">{cet.cet6}</b> 分（710 分制）
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <div className="text-2xl font-bold tabular-nums">{item.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------- radar-report ----------

export function RadarReport({ scores }: { scores: PlacementReport['scores'] }): React.JSX.Element | null {
  if (!scores) return null
  return (
    <RadarChartLazy
      data={[
        { dimension: '词汇', score: scores.vocabulary },
        { dimension: '语法', score: scores.grammar },
        { dimension: '阅读', score: scores.reading },
        { dimension: '听力', score: scores.listening },
        { dimension: '综合', score: scores.overall },
        { dimension: '写作', score: Math.max(20, scores.grammar) },
      ]}
    />
  )
}

// ---------- problems-list ----------

export function ProblemsList({
  problems,
}: {
  problems: PlacementReport['problems']
}): React.JSX.Element | null {
  if (problems.length === 0) {
    return <p className="text-sm text-muted-foreground">全部答对，没有错题 —— 很扎实！</p>
  }
  return (
    <div className="space-y-3">
      {problems.slice(0, 10).map((p, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{p.stem}</p>
            <Badge variant="secondary">{p.dimension}</Badge>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-destructive">
              你的答案：<b>{p.userAnswer}</b>
            </p>
            <p className="text-success">
              正确答案：<b>{p.correctAnswer}</b>
            </p>
            {p.explanation ? <p className="text-muted-foreground">解析：{p.explanation}</p> : null}
          </div>
        </Card>
      ))}
      {problems.length > 10 ? (
        <p className="text-xs text-muted-foreground">仅展示前 10 道错题，完整清单见错题本。</p>
      ) : null}
    </div>
  )
}

// ---------- eta-time ----------

export function EtaTime({
  etaWeeks,
  cefr,
  targetExam,
}: {
  etaWeeks: number | null | undefined
  cefr: string | null
  targetExam: 'CET4' | 'CET6'
}): React.JSX.Element | null {
  if (etaWeeks == null) return null
  return (
    <Alert variant="info" title="备考时间预估">
      按 CEFR {cefr ?? '-'} 起点测算，以每日 30 分钟节奏备考{targetExam === 'CET4' ? '四级' : '六级'}，
      约需 <b>{etaWeeks} 周</b> 达到目标线（425 分）。
    </Alert>
  )
}

/** AI 建议区块：独立降级 —— 报告其余区块不受影响 */
export function AiReportBlock({ report }: { report: PlacementReport }): React.JSX.Element | null {
  if (report.aiDegraded && !report.aiReport) {
    return (
      <Alert variant="warning" title="AI 建议暂不可用">
        其余报告内容不受影响，可稍后重新生成建议。
      </Alert>
    )
  }
  const ai = report.aiReport
  if (!ai) return null
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">AI 个性化建议</h3>
        {report.aiDegraded ? <Badge variant="warning">降级</Badge> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {ai.strengths?.length ? (
          <div>
            <h4 className="mb-1 text-sm font-medium text-success">优势</h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {ai.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {ai.problems?.length ? (
          <div>
            <h4 className="mb-1 text-sm font-medium text-warning">待提升</h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {ai.problems.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {ai.suggestions?.length ? (
          <div>
            <h4 className="mb-1 text-sm font-medium text-primary">建议</h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {ai.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
