'use client'

/**
 * TrainerReport：训练报告（T14 验收 4/7）。
 *
 * 展示：正确率 / 逐题作答 / 听写四态着色 / 生词清单 / 规则统计，
 * 并可触发 L6 AI 分析（A12）——AI 不可用时展示规则推导结果并标注来源，
 * 绝不给用户一句「AI 不可用」就结束。
 */
import { useCallback, useState } from 'react'
import { Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { cn } from '@/lib/utils/cn'
import { useAnalyzeRecord } from '../hooks'
import type { DictationToken, ListeningAnalyzeResult, ListeningReport } from '../types'

const TOKEN_STYLE: Record<DictationToken['type'], string> = {
  correct: 'text-foreground',
  wrong: 'bg-destructive/15 text-destructive line-through',
  missing: 'bg-warning/15 text-warning',
  extra: 'bg-muted text-muted-foreground line-through',
}

const MODE_NAME: Record<string, string> = {
  EXTENSIVE: '泛听',
  CHOICE: '选择',
  CLOZE: '完形',
  KEYWORD: '关键词捕捉',
  INTENSIVE: '精听',
  DICTATION: '听写',
  RETELL: '复述',
}

function accuracyVariant(accuracy: number): 'success' | 'warning' | 'destructive' {
  if (accuracy >= 85) return 'success'
  if (accuracy >= 60) return 'warning'
  return 'destructive'
}

export interface TrainerReportProps {
  report: ListeningReport
  className?: string
}

export function TrainerReport({ report, className }: TrainerReportProps): React.JSX.Element {
  const { analyze, loading, error } = useAnalyzeRecord()
  const [analysis, setAnalysis] = useState<ListeningAnalyzeResult | null>(null)

  const runAnalyze = useCallback(async () => {
    const r = await analyze(report.recordId)
    if (r) setAnalysis(r)
  }, [analyze, report.recordId])

  return (
    <div className={cn('space-y-4', className)} data-testid="trainer-report">
      {/* 概览 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-xs text-muted-foreground">正确率</p>
          <p className="text-2xl font-semibold tabular-nums" data-testid="report-accuracy">{report.accuracy}%</p>
        </div>
        <Badge variant={accuracyVariant(report.accuracy)}>{report.accuracy >= 85 ? '优秀' : report.accuracy >= 60 ? '良好' : '待加强'}</Badge>
        <Badge variant="outline">{MODE_NAME[report.mode] ?? report.mode}</Badge>
        <span className="text-xs text-muted-foreground">
          答对 {report.correctCount} / {report.totalCount} · 用时 {report.durationSec}s · {report.playbackRate}×
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{report.materialTitle}</span>
      </div>

      {/* 听写逐词 diff */}
      {report.dictationDiff && report.dictationDiff.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">逐词比对</h3>
          <div className="flex flex-wrap gap-1">
            {report.dictationDiff.map((t) => (
              <span
                key={t.index}
                className={cn('rounded px-1.5 py-0.5 text-sm', TOKEN_STYLE[t.type])}
                title={t.type === 'wrong' ? `你写的是：${t.actual ?? ''}` : t.type}
              >
                {t.token}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            听错 {report.ruleStats.substituted ?? 0} · 漏听 {report.ruleStats.missing ?? 0} · 多写 {report.ruleStats.extra ?? 0}
          </p>
        </section>
      ) : null}

      {/* 逐题作答 */}
      {report.answers.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">逐题作答</h3>
          <ul className="space-y-1">
            {report.answers.map((a) => (
              <li key={a.questionId} className="flex items-center gap-2 text-sm">
                <span className={a.isCorrect ? 'text-success' : 'text-destructive'}>{a.isCorrect ? '✓' : '✗'}</span>
                <span className="text-muted-foreground">你的答案：</span>
                <span className="font-medium">{a.userAnswer || '（空）'}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 生词 */}
      {report.unknownWords.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">本篇生词（{report.unknownWords.length}）</h3>
          <div className="flex flex-wrap gap-1.5">
            {report.unknownWords.map((w) => (
              <span key={w.word} className="rounded-md bg-secondary px-2 py-1 text-xs">
                {w.word}
                {w.meaning ? <span className="ml-1 text-muted-foreground">{w.meaning}</span> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* AI 分析 */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">听力分析</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => void runAnalyze()} disabled={loading} data-testid="report-analyze">
            <Sparkles className="h-4 w-4" />
            {loading ? '分析中…' : '生成分析'}
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        {analysis ? (
          <div className="mt-3 space-y-2" data-testid="report-analysis">
            <Badge variant={analysis.source === 'ai' ? 'default' : 'secondary'}>
              {analysis.source === 'ai' ? 'AI 分析' : '规则分析（AI 不可用）'}
            </Badge>
            <div>
              <p className="text-xs font-medium text-muted-foreground">建议</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {analysis.analysis.suggestions.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">弱项</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {analysis.analysis.weakSpots.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            {analysis.analysis.nextMaterials.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">下一步推荐</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {analysis.analysis.nextMaterials.map((m: { id: string; title: string; intensityLevel: number }) => (
                    <li key={m.id}>
                      <a className="text-primary underline-offset-4 hover:underline" href={`${ROUTES.listening}/player/${m.id}`}>
                        {m.title}
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground">强度档 {m.intensityLevel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
