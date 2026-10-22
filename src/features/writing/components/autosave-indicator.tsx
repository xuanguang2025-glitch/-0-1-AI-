'use client'

/**
 * AutosaveIndicator：自动保存状态指示（T17 验收 6）。
 *
 * 三态：saving（转圈）/ savedAt（显示时间）/ error（红色提示）。
 * 无任何状态时显示「输入后自动保存」，让用户知道有这个机制。
 */
import { cn } from '@/lib/utils/cn'

export interface AutosaveIndicatorProps {
  saving?: boolean
  savedAt: string | null
  error: string | null
  className?: string
}

export function AutosaveIndicator({ saving = false, savedAt, error, className }: AutosaveIndicatorProps): React.JSX.Element {
  if (saving) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)} data-testid="autosave-saving">
        保存中…
      </span>
    )
  }
  if (error !== null) {
    return (
      <span className={cn('text-xs text-destructive', className)} data-testid="autosave-error">
        {error}（继续输入会自动重试）
      </span>
    )
  }
  if (savedAt !== null) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)} data-testid="autosave-saved">
        已自动保存 {new Date(savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    )
  }
  return (
    <span className={cn('text-xs text-muted-foreground', className)} data-testid="autosave-idle">
      输入后自动保存，无需手动操作
    </span>
  )
}
