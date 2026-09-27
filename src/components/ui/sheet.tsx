'use client'

/**
 * Sheet（radix-free 侧滑抽屉：mobile-nav-drawer 使用）。
 */
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils/cn'

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: 'left' | 'right'
  className?: string
  children: ReactNode
}

export function Sheet({ open, onOpenChange, side = 'left', className, children }: SheetProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute top-0 h-full w-72 bg-surface p-4 shadow-2xl transition-transform duration-200',
          side === 'left' ? 'left-0 animate-slide-left' : 'right-0 animate-slide-right',
          className,
        )}
      >
        {children}
      </aside>
    </div>,
    document.body,
  )
}
