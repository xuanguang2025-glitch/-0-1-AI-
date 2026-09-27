'use client'

/**
 * ErrorState：错误态（带重试；配合 retry-boundary 使用）。
 */
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export function ErrorState({
  title = '加载失败',
  message,
  onRetry,
  retryLabel = '重试',
  action,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  action?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {message ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p> : null}
      <div className="mt-5 flex items-center gap-2">
        {onRetry ? (
          <Button onClick={onRetry} variant="outline">
            {retryLabel}
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  )
}
