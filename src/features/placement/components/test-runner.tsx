'use client'

/**
 * Placement 测试组件集：test-intro / timer / question-area / answer-sheet / submit-bar。
 */
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/separator'
import { cn } from '@/lib/utils/cn'
import type { PlacementQuestion } from '../api'

// ---------- test-intro ----------

export function TestIntro({
  questionCount = 30,
  onStart,
  loading,
  error,
}: {
  questionCount?: number
  onStart: () => void
  loading: boolean
  error: string | null
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="text-5xl" aria-hidden>🎯</div>
      <h1 className="mt-4 text-2xl font-bold">英语水平测试</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {questionCount} 道题 · 约 8 分钟 · 覆盖词汇 / 语法 / 阅读 / 听力四个维度。
        完成后生成你的 CEFR 等级与四六级分数估算，并据此定制学习计划。
      </p>
      <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-left text-sm text-muted-foreground">
        <li>· 每题限时 10 分钟内作答，凭第一感觉最快最准</li>
        <li>· 答错不影响后续，做完即可看到报告</li>
        <li>· 中途刷新页面可恢复进度</li>
      </ul>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <Button className="mt-6 w-full" onClick={onStart} disabled={loading}>
        {loading ? '准备中…' : '开始测试'}
      </Button>
    </div>
  )
}

// ---------- timer ----------

export function Timer({ seconds, warnAtSec = 60 }: { seconds: number; warnAtSec?: number }): React.JSX.Element {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const warn = seconds <= warnAtSec
  return (
    <span
      className={cn(
        'rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums',
        warn ? 'bg-destructive/10 text-destructive' : 'bg-surface-muted text-muted-foreground',
      )}
      role="timer"
    >
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

/** 计时 hook：从挂载开始累计秒数 */
export function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  return seconds
}

// ---------- question-area ----------

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export function QuestionArea({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: PlacementQuestion | null
  index: number
  total: number
  selected: string | undefined
  onSelect: (questionId: string, option: string) => void
}): React.JSX.Element | null {
  if (!question) return null
  // options 规范化：对象 {A:'..',B:'..'} 或数组 [{key,text}]
  let options: Array<{ key: string; text: string }> = []
  if (Array.isArray(question.options)) {
    options = question.options
  } else if (question.options && typeof question.options === 'object') {
    options = Object.entries(question.options as Record<string, string>).map(([key, text]) => ({ key, text }))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          第 {index + 1} / {total} 题 · {question.category}
        </span>
      </div>
      <Progress value={((index + 1) / total) * 100} className="mb-6" />
      <p className="text-lg font-medium leading-relaxed">{question.stem}</p>
      <div className="mt-6 space-y-3" role="radiogroup" aria-label="选项">
        {options.map((o, i) => {
          const key = o.key || OPTION_KEYS[i] || String.fromCharCode(65 + i)
          const active = selected === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(question.id, key)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all',
                active
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-primary/40',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  active ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted-foreground',
                )}
              >
                {key}
              </span>
              <span className="text-sm">{o.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- answer-sheet ----------

export function AnswerSheet({
  total,
  answered,
  current,
  onJump,
}: {
  total: number
  answered: Record<string, string>
  current: number
  onJump: (index: number) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="答题卡">
      {Array.from({ length: total }).map((_, i) => {
        const q = i
        const done = answered[String(q)] !== undefined
        void done
        return null
      })}
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          aria-label={`跳到第 ${i + 1} 题`}
          className={cn(
            'h-8 w-8 rounded-lg text-xs font-medium transition-colors',
            i === current
              ? 'bg-primary text-primary-foreground'
              : i < Object.keys(answered).length
                ? 'bg-success/20 text-success'
                : 'bg-surface-muted text-muted-foreground',
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}

// ---------- submit-bar ----------

export function SubmitBar({
  answeredCount,
  total,
  allAnswered,
  submitting,
  onSubmit,
}: {
  answeredCount: number
  total: number
  allAnswered: boolean
  submitting: boolean
  onSubmit: () => void
}): React.JSX.Element {
  return (
    <div className="sticky bottom-16 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/95 p-4 backdrop-blur lg:bottom-4">
      <span className="text-sm text-muted-foreground">
        已答 <b className="text-foreground">{answeredCount}</b> / {total}
        {!allAnswered ? '（未答完也可交卷，未答题计 0 分）' : ''}
      </span>
      <Button onClick={onSubmit} disabled={submitting || answeredCount === 0}>
        {submitting ? '评分中…' : '交卷并生成报告'}
      </Button>
    </div>
  )
}
