'use client'

/**
 * Dialog（radix-free：原生 <dialog> 不用，portal + overlay 实现，Esc 关闭）。
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils/cn'
import { useMounted } from '@/hooks/use-mounted'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  className?: string
  children?: ReactNode
}

export function Dialog({ open, onOpenChange, title, description, className, children }: DialogProps): React.JSX.Element | null {
  const mounted = useMounted()
  const overlayRef = useRef<HTMLDivElement>(null)

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    },
    [onOpenChange],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onKeyDown])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl',
          className,
        )}
      >
        {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </div>,
    document.body,
  )
}
