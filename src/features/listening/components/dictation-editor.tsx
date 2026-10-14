'use client'

/**
 * DictationEditor：听写作答区（T14 验收 4）。
 *
 * 输入即通过 L8（`/api/listening/dictation-check`，**纯本地 diff、不调 AI**）做
 * 实时比对预览，逐词着色：正确 / 听错 / 漏听 / 多写。预览与正式提交（L4）走
 * 同一个 diff 算法，因此两边结果一致。
 */
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useDictationCheck } from '../hooks'
import type { DictationToken } from '../types'

export interface DictationEditorProps {
  /** 原文（材料字幕拼接） */
  original: string
  submitting?: boolean
  onSubmit: (dictationText: string) => void
  className?: string
}

const TYPE_STYLE: Record<DictationToken['type'], string> = {
  correct: 'text-foreground',
  wrong: 'bg-destructive/15 text-destructive line-through',
  missing: 'bg-warning/15 text-warning',
  extra: 'bg-muted text-muted-foreground line-through',
}

const TYPE_LABEL: Record<DictationToken['type'], string> = {
  correct: '正确',
  wrong: '听错',
  missing: '漏听',
  extra: '多写',
}

export function DictationEditor({ original, submitting = false, onSubmit, className }: DictationEditorProps): React.JSX.Element {
  const [text, setText] = useState('')
  const { result, checking } = useDictationCheck(original, text)

  const counts = useMemo(() => {
    const c = { correct: 0, wrong: 0, missing: 0, extra: 0 }
    for (const t of result?.diff ?? []) c[t.type] += 1
    return c
  }, [result])

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium" htmlFor="dictation-input">
        把你听到的内容写下来
      </label>
      <textarea
        id="dictation-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="边听边写，写完点提交。上面会实时标出对错。"
        className="w-full rounded-lg border border-border bg-surface p-3 text-sm"
        data-testid="dictation-input"
      />

      {/* 实时 diff 预览 */}
      <div className="min-h-16 rounded-lg border border-border bg-surface-muted p-3" data-testid="dictation-preview">
        {checking ? (
          <p className="text-xs text-muted-foreground">比对中…</p>
        ) : result === null ? (
          <p className="text-xs text-muted-foreground">开始输入后显示逐词比对结果</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              正确率 <span className="font-semibold text-foreground" data-testid="dictation-live-accuracy">{result.accuracy}%</span>
              {' · '}对 {counts.correct} / 错 {counts.wrong} / 漏 {counts.missing} / 多 {counts.extra}
            </p>
            <div className="flex flex-wrap gap-1">
              {result.diff.map((t) => (
                <span
                  key={t.index}
                  className={cn('rounded px-1.5 py-0.5 text-sm', TYPE_STYLE[t.type])}
                  title={t.type === 'wrong' ? `你写的是：${t.actual ?? ''}` : TYPE_LABEL[t.type]}
                  data-testid={`dictation-token-${t.index}`}
                >
                  {t.token}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => onSubmit(text)} disabled={submitting || text.trim().length === 0} data-testid="dictation-submit">
          {submitting ? '提交中…' : '提交听写'}
        </Button>
        <span className="text-xs text-muted-foreground">比对为本地字符串 diff，不调用 AI</span>
      </div>
    </div>
  )
}
