'use client'

/**
 * SentenceAnalysis：长难句分析（T15）。
 *
 * 展示 `ReadingArticle.sentences`：原句 / 结构拆解 / 译文。
 * 每句带「AI 讲解」入口，由页面调 R4；**AI 不可用时 ExplainPanel 会渲染 null**，
 * 因此这里只负责发起请求，不预设任何占位文案。
 */
import { useState } from 'react'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { ReadingSentence } from '../types'

export interface SentenceAnalysisProps {
  sentences: ReadingSentence[]
  onExplain?: (sentence: string) => void
  explainingSentence?: string | null
  className?: string
}

export function SentenceAnalysis({
  sentences,
  onExplain,
  explainingSentence = null,
  className,
}: SentenceAnalysisProps): React.JSX.Element {
  const [open, setOpen] = useState<number | null>(null)

  if (sentences.length === 0) {
    return <p className={cn('py-4 text-center text-sm text-muted-foreground', className)}>本篇暂无长难句标注</p>
  }

  return (
    <ul className={cn('space-y-2', className)} data-testid="sentence-analysis">
      {sentences.map((s, i) => {
        const expanded = open === i
        return (
          <li key={i} className="rounded-lg border border-border bg-surface p-3">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : i)}
              className="block w-full text-left"
              data-testid={`sentence-toggle-${i}`}
            >
              <p className="text-sm font-medium leading-6">{s.sentence}</p>
              <span className="mt-1 text-[10px] text-muted-foreground">{expanded ? '收起解析' : '展开解析'}</span>
            </button>

            {expanded ? (
              <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                {s.structure ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">结构：</span>
                    {s.structure}
                  </p>
                ) : null}
                {s.translation ? <p className="text-xs leading-6">{s.translation}</p> : null}
                {onExplain ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onExplain(s.sentence)}
                    disabled={explainingSentence === s.sentence}
                    data-testid={`sentence-explain-${i}`}
                  >
                    <Sparkles className="h-4 w-4" />
                    {explainingSentence === s.sentence ? '讲解中…' : 'AI 讲解'}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
