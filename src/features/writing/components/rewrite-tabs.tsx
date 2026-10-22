'use client'

/**
 * RewriteTabs：改写档位切换（T17 验收 5）。
 *
 * AI 返回什么档就展示什么档（basic/college/cet/advanced/spoken/modelEssay…），
 * **scoreSource='rule' 时渲染 null**——与 CorrectionList 同理，不造假数据。
 */
import { useState } from 'react'

import { cn } from '@/lib/utils/cn'

export interface RewriteTabsProps {
  rewrites: Record<string, string> | null
  className?: string
}

const STYLE_NAMES: Record<string, string> = {
  basic: '基础版',
  college: '大学版',
  cet: '四六级版',
  advanced: '进阶版',
  spoken: '口语版',
  modelEssay: '范文',
}

export function RewriteTabs({ rewrites, className }: RewriteTabsProps): React.JSX.Element | null {
  const keys = rewrites === null ? [] : Object.keys(rewrites)
  const [active, setActive] = useState(0)

  if (keys.length === 0) return null

  const idx = Math.min(active, keys.length - 1)
  const currentKey = keys[idx]!

  return (
    <section className={cn('space-y-2', className)} data-testid="rewrite-tabs">
      <h3 className="text-sm font-semibold">多档改写</h3>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="tablist" aria-label="改写风格">
        {keys.map((k, i) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={i === idx}
            onClick={() => setActive(i)}
            data-testid={`rewrite-tab-${k}`}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              i === idx ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {STYLE_NAMES[k] ?? k}
          </button>
        ))}
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm leading-6" data-testid={`rewrite-text-${currentKey}`}>
        {rewrites?.[currentKey] ?? ''}
      </p>
    </section>
  )
}
