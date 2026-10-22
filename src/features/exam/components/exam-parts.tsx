'use client'

/**
 * 专项卷组件：ExamHeader（含验收 3 范围标注）+ PracticeScopeNotice + AnswerSheet + SubmitDialog + ReportScoreCard。
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { ExamReportResult, ExamSectionScore } from '../types'

/** 验收 3：报告/作答页显式标注「专项训练卷，非 CET 全真模考」 */
export function PracticeScopeNotice({ className }: { className?: string }): React.JSX.Element {
  return (
    <p
      className={cn('rounded-lg bg-warning/10 px-3 py-2 text-xs leading-5 text-warning', className)}
      data-testid="practice-scope-notice"
    >
      专项训练卷，非 CET 全真模考：仅覆盖单类能力（听力/阅读/语法/词汇其一），
      题量与时长不同于真题，成绩不代表 710 分制水平，也不提供 CET 分数换算。
    </p>
  )
}

/** 作答页头部：标题 + 倒计时基准信息 */
export function ExamHeader({ title, durationMin, questionCount }: { title: string; durationMin: number; questionCount: number }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-4" data-testid="exam-header">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline">{durationMin} 分钟</Badge>
        <Badge variant="secondary">{questionCount} 题</Badge>
      </div>
      <PracticeScopeNotice className="mt-2" />
    </div>
  )
}

/** 答题卡：题号格子（已答/未答一目了然），点击滚动定位 */
export function AnswerSheet({
  total,
  answered,
  onJump,
}: {
  total: number
  answered: number
  onJump: (index: number) => void
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-3" data-testid="answer-sheet">
      <p className="mb-2 text-xs text-muted-foreground">
        答题卡（已答 {answered}/{total}）
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const done = i < answered
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                'h-7 w-7 rounded text-xs tabular-nums transition-colors',
                done ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted-foreground hover:bg-surface',
              )}
              data-testid={`answer-sheet-${i + 1}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 自动保存指示器（验收 2） */
export function ExamAutosaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }): React.JSX.Element {
  if (saving) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="exam-autosave-saving">
        保存中…
      </span>
    )
  }
  if (saved) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="exam-autosave-saved">
        已自动保存
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground" data-testid="exam-autosave-idle">
      作答后自动保存
    </span>
  )
}

/** 交卷确认对话框（防误触） */
export function SubmitDialog({
  open,
  answered,
  total,
  submitting,
  onConfirm,
  onCancel,
}: {
  open: boolean
  answered: number
  total: number
  submitting: boolean
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null
  const unanswered = total - answered
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal data-testid="submit-dialog">
      <div className="w-[22rem] rounded-xl border border-border bg-surface p-4 shadow-lg">
        <h3 className="text-base font-semibold">确认交卷？</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          已答 {answered}/{total} 题
          {unanswered > 0 ? `，还有 ${unanswered} 题未作答（未答题判 0 分）` : ''}。交卷后立即判分并生成报告。
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="submit-cancel">
            继续作答
          </Button>
          <Button type="button" onClick={onConfirm} disabled={submitting} data-testid="submit-confirm">
            {submitting ? '判分中…' : '确认交卷'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const SECTION_NAMES: Record<string, string> = {
  LISTENING: '听力',
  READING: '阅读',
  GRAMMAR: '语法',
  VOCAB: '词汇',
}

/** 报告分数卡：正确率 + 分项（**非 CET 换算**） */
export function ReportScoreCard({ report }: { report: ExamReportResult }): React.JSX.Element {
  const entries = Object.entries(report.sectionScores) as Array<[string, ExamSectionScore]>
  return (
    <div className="rounded-xl border border-border bg-surface p-4" data-testid="report-score-card">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-muted-foreground">正确率</p>
          <p className="text-3xl font-semibold tabular-nums" data-testid="exam-accuracy">
            {report.accuracy}%
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {report.correctCount}/{report.totalQuestions} 题 · 得分 {report.totalScore}
        </span>
        {report.idempotent ? <Badge variant="outline">重复交卷已幂等返回</Badge> : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map(([section, s]) => (
          <div key={section} className="rounded-lg bg-surface-muted p-2.5">
            <p className="text-xs text-muted-foreground">{SECTION_NAMES[section] ?? section}</p>
            <p className="text-sm font-semibold tabular-nums">
              {s.correct}/{s.total}
            </p>
            <p className="text-[10px] text-muted-foreground">得分 {s.score}</p>
          </div>
        ))}
      </div>

      {/* 验收 4：不出现 710 分制换算 */}
      <p className="mt-2 text-[10px] text-muted-foreground" data-testid="no-cet-estimate">
        分项为原始正确数与卷面得分，**未做 710 分制 CET 换算**（专项卷无标定样本）。
      </p>
    </div>
  )
}
