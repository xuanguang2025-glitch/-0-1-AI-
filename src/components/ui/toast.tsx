'use client'

/**
 * Toast（ui.store 驱动 + Toaster 渲染；sonner 替代实现，零依赖）。
 */
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils/cn'
import { useMounted } from '@/hooks/use-mounted'
import { useUiStore, type ToastVariant } from '@/stores/ui.store'

const VARIANT_STYLE: Record<ToastVariant, string> = {
  info: 'border-border bg-surface text-foreground',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export function Toaster(): React.JSX.Element | null {
  const mounted = useMounted()
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismissToast)
  if (!mounted) return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto w-full rounded-xl border p-4 text-left shadow-lg backdrop-blur transition-all',
            VARIANT_STYLE[t.variant],
          )}
        >
          <div className="text-sm font-medium">{t.title}</div>
          {t.description ? <div className="mt-0.5 text-xs opacity-80">{t.description}</div> : null}
        </button>
      ))}
    </div>,
    document.body,
  )
}
