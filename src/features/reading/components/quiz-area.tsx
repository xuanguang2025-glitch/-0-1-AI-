'use client'

/**
 * QuizArea：阅读理解作答区（T15）。
 *
 * 只负责收集作答；**判分在服务端 R3 完成**（前端永远拿不到答案），
 * 提交时把 `{questionId, userAnswer}` 原样上报。
 * 多选题给出「可多选」提示；单题未答也能提交（按未答计错，与听力同口径）。
 */
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { QUESTION_TYPE_NAMES, type ReadingQuestion } from '../types'

export interface QuizAreaProps {
  questions: ReadingQuestion[]
  submitting?: boolean
  onSubmit: (answers: Array<{ questionId: string; userAnswer: string }>) => void
  className?: string
}

export function QuizArea({ questions, submitting = false, onSubmit, className }: QuizAreaProps): React.JSX.Element {
  if (questions.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>本篇暂无阅读理解题</p>
  }

  const handle = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit(
      questions.map((q) => ({
        questionId: q.id,
        userAnswer: String(data.get(q.id) ?? ''),
      })),
    )
  }

  return (
    <form onSubmit={handle} className={cn('space-y-4', className)} data-testid="quiz-area">
      {questions.map((q, i) => {
        const options = Array.isArray(q.options) ? q.options : []
        const isMulti = q.type === 'MULTI_CHOICE'
        return (
          <fieldset key={q.id} className="rounded-xl border border-border bg-surface p-3">
            <legend className="flex items-center gap-2 px-1 text-sm font-medium">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span>{q.stem}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                {QUESTION_TYPE_NAMES[q.type] ?? q.type}
                {isMulti ? '（可多选）' : ''}
              </span>
            </legend>

            {options.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  return (
                    <label
                      key={letter}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
                    >
                      <input
                        type={isMulti ? 'checkbox' : 'radio'}
                        name={q.id}
                        value={letter}
                        className="accent-[hsl(var(--primary))]"
                        data-testid={`quiz-${q.id}-${letter}`}
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
                name={q.id}
                placeholder="输入你的答案"
                className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                data-testid={`quiz-${q.id}`}
              />
            )}
          </fieldset>
        )
      })}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting} data-testid="quiz-submit">
          {submitting ? '提交中…' : `提交（${questions.length} 题）`}
        </Button>
        <span className="text-xs text-muted-foreground">判分在服务端完成，错题会自动进入错题本</span>
      </div>
    </form>
  )
}
