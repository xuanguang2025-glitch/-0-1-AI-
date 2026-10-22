'use client'

/**
 * ResultTabs：5 档译文 Tab（T18 验收 2）。
 *
 * **核心行为**：AI 给哪档展示哪档；缺的档 Tab 仍渲染但点击后显示
 * 「AI 暂不可用」——**Tab 可切换、不白屏、不隐藏入口**（用户要知道有这个能力）。
 * degraded=true（连 literal 都没有）→ 顶部整体提示。
 */
import { useState } from 'react'

import { cn } from '@/lib/utils/cn'
import { STYLE_NAMES, STYLE_ORDER, type TranslationResult } from '../types'

export interface ResultTabsProps {
  result: TranslationResult | null
  loading?: boolean
  className?: string
}

export function ResultTabs({ result, loading = false, className }: ResultTabsProps): React.JSX.Element | null {
  // 默认选中第一个可用档；无可用档时停在 literal
  const [active, setActive] = useState(0)

  if (loading) {
    return (
      <div className={cn('rounded-lg bg-surface-muted p-3 text-sm text-muted-foreground', className)} data-testid="result-loading">
        翻译中…
      </div>
    )
  }
  if (result === null) return null

  const idx = Math.min(active, STYLE_ORDER.length - 1)
  const style = STYLE_ORDER[idx]!
  const text = result.styles[style]

  return (
    <div className={cn('space-y-2', className)} data-testid="result-tabs">
      {result.degraded ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="translate-degraded">
          AI 翻译暂时不可用，本次未生成译文。
        </p>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="tablist" aria-label="译文风格">
        {STYLE_ORDER.map((s, i) => {
          const available = result.styles[s] !== null
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={i === idx}
              onClick={() => setActive(i)}
              data-testid={`style-tab-${s}`}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                i === idx ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                !available && 'opacity-50',
              )}
            >
              {STYLE_NAMES[s]}
              {available ? '' : ' *'}
            </button>
          )
        })}
      </div>

      <div className="min-h-16 rounded-lg border border-border bg-surface p-3" data-testid={`style-text-${style}`}>
        {text !== null ? (
          <p className="text-sm leading-6">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">AI 暂不可用，该风格未生成。</p>
        )}
      </div>

      {result.notes !== null ? (
        <p className="text-xs leading-5 text-muted-foreground" data-testid="translate-notes">
          {result.notes}
        </p>
      ) : null}
    </div>
  )
}
