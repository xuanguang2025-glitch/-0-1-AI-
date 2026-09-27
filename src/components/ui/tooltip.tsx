/**
 * Tooltip（纯 CSS hover 实现，无 portal 依赖）。
 */
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}): React.JSX.Element {
  const pos =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : side === 'bottom'
        ? 'top-full left-1/2 -translate-x-1/2 mt-2'
        : side === 'left'
          ? 'right-full top-1/2 -translate-y-1/2 mr-2'
          : 'left-full top-1/2 -translate-y-1/2 ml-2'
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-40 hidden whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs text-background shadow-md group-hover/tooltip:block',
          pos,
        )}
      >
        {label}
      </span>
    </span>
  )
}
