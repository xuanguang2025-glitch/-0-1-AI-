'use client'

/**
 * KeywordBlank：关键词捕捉模式作答区（§5.2，判分方式 = 字符串模糊匹配）。
 *
 * 服务端用 `fuzzyMatch`（容忍 1 个字符）判分，因此这里明确提示用户
 * 「拼写差一个字符也算对」——避免用户以为必须完全一致而不敢提交。
 */
import { Button } from '@/components/ui/button'
import type { ListeningQuestion } from '../types'

export interface KeywordBlankProps {
  questions: ListeningQuestion[]
  submitting?: boolean
  onSubmit: (answers: Array<{ questionId: string; userAnswer: string }>) => void
}

export function KeywordBlank({ questions, submitting = false, onSubmit }: KeywordBlankProps): React.JSX.Element {
  if (questions.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">本篇暂无关键词考点</p>

  const handle = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const answers = questions.map((q) => ({
      questionId: q.id,
      userAnswer: String(data.get(q.id) ?? ''),
    }))
    onSubmit(answers)
  }

  return (
    <form onSubmit={handle} className="space-y-3">
      <p className="text-xs text-muted-foreground">听音填空：拼写与答案相差 1 个字符也算正确</p>
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-border bg-surface p-3">
          <label className="block text-sm font-medium" htmlFor={`kw-${q.id}`}>
            <span className="mr-1 text-muted-foreground">{i + 1}.</span>
            {q.stem}
          </label>
          <input
            id={`kw-${q.id}`}
            name={q.id}
            type="text"
            autoComplete="off"
            className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            placeholder="输入听到的关键词"
            data-testid={`keyword-${q.id}`}
          />
        </div>
      ))}
      <Button type="submit" disabled={submitting} data-testid="keyword-submit">
        {submitting ? '提交中…' : '提交关键词'}
      </Button>
    </form>
  )
}
