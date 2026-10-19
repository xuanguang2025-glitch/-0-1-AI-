'use client'

/**
 * ExplainPanel：AI 讲解面板（T16 验收 3）。
 *
 * **与阅读不同**：语法讲解是学习主体，Mock/降级时**不能整个隐藏**，
 * 因此服务端已回落静态知识点（`source='static'`），本组件只负责展示并标明来源。
 */
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import type { GrammarExplainResult } from '../types'

export interface GrammarExplainPanelProps {
  result: GrammarExplainResult | null
  loading?: boolean
  className?: string
}

export function ExplainPanel({ result, loading = false, className }: GrammarExplainPanelProps): React.JSX.Element | null {
  if (loading) return <SkeletonCard className={className} />
  if (result === null) return null

  return (
    <section className={className} data-testid="grammar-explain-panel" aria-label="知识点讲解">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">讲解 · {result.pointTitle}</h3>
        <Badge variant={result.source === 'ai' ? 'default' : 'secondary'} data-testid="grammar-explain-source">
          {result.source === 'ai' ? 'AI 生成' : '静态知识点（AI 不可用）'}
        </Badge>
      </div>
      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm leading-6" data-testid="grammar-explain-text">
        {result.explanation}
      </p>
    </section>
  )
}
