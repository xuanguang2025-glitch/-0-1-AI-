/**
 * Separator / Skeleton / Progress（轻量原子组件）。
 */
import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

export const Separator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }>(
  ({ className, orientation = 'horizontal', ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
      {...props}
    />
  ),
)
Separator.displayName = 'Separator'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-lg bg-surface-muted', className)} {...props} />
}

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0-100 */
  value: number
  /** 语义色：primary | success | warning */
  tone?: 'primary' | 'success' | 'warning'
}

export function Progress({ value, tone = 'primary', className, ...props }: ProgressProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, value))
  const toneClass = tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-primary'
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-muted', className)}
      {...props}
    >
      <div className={cn('h-full rounded-full transition-all duration-500', toneClass)} style={{ width: `${clamped}%` }} />
    </div>
  )
}
