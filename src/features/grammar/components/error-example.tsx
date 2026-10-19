'use client'

/**
 * ErrorExample：错误示例对照（T16）。
 * 三列：错误写法 ✗ / 正确写法 ✓ / 原因说明。
 */
import { X, Check } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import type { GrammarErrorExample } from '../types'

export interface ErrorExampleProps {
  example: GrammarErrorExample
  index?: number
  className?: string
}

export function ErrorExample({ example, index, className }: ErrorExampleProps): React.JSX.Element {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface p-3', className)}
      data-testid={index === undefined ? 'error-example' : `error-example-${index}`}
    >
      <p className="flex items-start gap-1.5 text-sm">
        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <span className="line-through decoration-destructive/60">{example.wrong}</span>
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-sm font-medium">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>{example.right}</span>
      </p>
      {example.reason ? <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{example.reason}</p> : null}
    </div>
  )
}
