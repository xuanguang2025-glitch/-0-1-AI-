'use client'

/**
 * ExerciseRunner：语法练习作答器（T16 验收 2/5）。
 *
 * 只收集作答，**判分在服务端 G4 完成**（前端永远拿不到答案）。
 * 提交后由页面切到报告视图（逐题解析 + 掌握度变化）。
 */
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { GrammarExerciseItem } from '../types'

export interface ExerciseRunnerProps {
  questions: GrammarExerciseItem[]
  submitting?: boolean
  onSubmit: (answers: Array<{ questionId: string; userAnswer: string }>) => void
  className?: string
}

export function ExerciseRunner({ questions, submitting = false, onSubmit, className }: ExerciseRunnerProps): React.JSX.Element {
  if (questions.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>该知识点暂无练习题</p>
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
    <form onSubmit={handle} className={cn('space-y-4', className)} data-testid="exercise-runner">
      {questions.map((q, i) => {
        const options = Array.isArray(q.options) ? q.options : []
        return (
          <fieldset key={q.id} className="rounded-xl border border-border bg-surface p-3">
            <legend className="px-1 text-sm font-medium">
              <span className="mr-1 text-muted-foreground">{i + 1}.</span>
              {q.stem}
            </legend>
            {options.length > 0 ? (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  return (
                    <label
                      key={letter}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={letter}
                        className="accent-[hsl(var(--primary))]"
                        data-testid={`exercise-${q.id}-${letter}`}
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
                data-testid={`exercise-${q.id}`}
              />
            )}
          </fieldset>
        )
      })}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting} data-testid="exercise-submit">
          {submitting ? '提交中…' : `提交（${questions.length} 题）`}
        </Button>
        <span className="text-xs text-muted-foreground">判分在服务端完成，错题会自动进入错题本</span>
      </div>
    </form>
  )
}
