'use client'

/**
 * ExampleCard：语法例句卡片（T16）。
 * 展示 en / zh / 结构拆解（structure）。
 */
import { Volume2 } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import type { GrammarExample } from '../types'

export interface ExampleCardProps {
  example: GrammarExample
  index?: number
  className?: string
}

export function ExampleCard({ example, index, className }: ExampleCardProps): React.JSX.Element {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface p-3', className)}
      data-testid={index === undefined ? 'example-card' : `example-card-${index}`}
    >
      <p className="text-sm font-medium leading-6">{example.en}</p>
      {example.zh ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{example.zh}</p> : null}
      {example.structure ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-primary">
          <Volume2 className="h-3 w-3" aria-hidden />
          {example.structure}
        </p>
      ) : null}
    </div>
  )
}
