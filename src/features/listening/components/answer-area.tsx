'use client'

/**
 * AnswerArea：客观题作答区（CHOICE / CLOZE / EXTENSIVE）。
 *
 * 只负责收集作答；**判分在服务端 L4 完成**，因此本组件不接收答案，
 * 提交时把 `{questionId, userAnswer}` 原样上报。
 */
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { ListeningQuestion } from '../types'

export interface AnswerAreaProps {
  questions: ListeningQuestion[]
  submitting?: boolean
  onSubmit: (answers: Array<{ questionId: string; userAnswer: string }>) => void
  className?: string
}

export function AnswerArea({ questions, submitting = false, onSubmit, className }: AnswerAreaProps): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})

  const set = (id: string, v: string): void => setValues((prev) => ({ ...prev, [id]: v }))

  const answered = questions.filter((q) => (values[q.id] ?? '').trim().length > 0).length
  const canSubmit = answered > 0 && !submitting

  if (questions.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>该模式暂无题目</p>
  }

  return (
    <div className={cn('space-y-4', className)}>
      {questions.map((q, i) => {
        const isChoice = Array.isArray(q.options) && q.options.length > 0
        return (
          <div key={q.id} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-sm font-medium">
              <span className="mr-1 text-muted-foreground">{i + 1}.</span>
              {q.stem}
            </p>
            {isChoice ? (
              <div className="mt-2 space-y-1.5" role="radiogroup" aria-label={q.stem}>
                {q.options!.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const checked = values[q.id] === letter
                  return (
                    <label
                      key={letter}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        checked ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-muted',
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={letter}
                        checked={checked}
                        onChange={() => set(q.id, letter)}
                        className="accent-[hsl(var(--primary))]"
                        data-testid={`answer-${q.id}-${letter}`}
                      />
                      <span className="font-medium text-muted-foreground">{letter}.</span>
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <input
                type="text"
                value={values[q.id] ?? ''}
                onChange={(e) => set(q.id, e.target.value)}
                placeholder="输入你听到的内容"
                className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                data-testid={`answer-${q.id}`}
              />
            )}
          </div>
        )
      })}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => onSubmit(questions.map((q) => ({ questionId: q.id, userAnswer: values[q.id] ?? '' })))} disabled={!canSubmit} data-testid="answer-submit">
          {submitting ? '提交中…' : `提交（${answered}/${questions.length}）`}
        </Button>
        <span className="text-xs text-muted-foreground">判分在服务端完成，提交后查看报告</span>
      </div>
    </div>
  )
}
