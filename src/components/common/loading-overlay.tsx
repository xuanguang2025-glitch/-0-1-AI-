'use client'

/**
 * LoadingOverlay：容器内半透明加载层。
 */
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils/cn'

export function LoadingOverlay({
  show,
  label = '加载中…',
  className,
}: {
  show: boolean
  label?: string
  className?: string
}): React.JSX.Element | null {
  if (!show) return null
  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/70 backdrop-blur-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-6 w-6" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
