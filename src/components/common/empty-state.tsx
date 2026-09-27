/**
 * EmptyState：空态（VOCAB_QUEUE_EMPTY 等场景统一视觉）。
 */
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export function EmptyState({
  emoji = '📚',
  title,
  description,
  action,
  className,
}: {
  emoji?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 text-5xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
