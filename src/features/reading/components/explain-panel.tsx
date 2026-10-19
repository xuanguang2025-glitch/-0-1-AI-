'use client'

/**
 * ExplainPanel：AI 句子讲解面板（T15 验收 5）。
 *
 * **核心行为**：`degraded === true` 时渲染 `null` —— 整个 AI 区块直接消失，
 * 其余区块（正文/译文/题目）完整可用。绝不给一句「AI 不可用」占位，也不白屏。
 */
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import type { ReadingExplainResult } from '../types'

export interface ExplainPanelProps {
  result: ReadingExplainResult | null
  loading?: boolean
  className?: string
}

export function ExplainPanel({ result, loading = false, className }: ExplainPanelProps): React.JSX.Element | null {
  if (loading) return <SkeletonCard className={className} />

  // 验收 5：Mock / 降级 → 隐藏整个区块
  if (result === null || result.degraded || result.explanation === null) return null

  return (
    <section
      className={className}
      data-testid="explain-panel"
      aria-label="AI 句子讲解"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">AI 讲解</h3>
        <Badge variant="default">AI 生成</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">讲解句子：{result.sentence}</p>
      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm leading-6" data-testid="explain-text">
        {result.explanation}
      </p>
    </section>
  )
}
