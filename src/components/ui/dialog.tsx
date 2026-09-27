'use client'

/**
 * Dialog（radix-free）：portal + overlay，Esc 关闭。
 * 两种用法：
 *  1) 属性式：<Dialog open title description>{children}</Dialog>
 *  2) 组合式：<Dialog open onOpenChange><DialogContent><DialogHeader><DialogTitle/>
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils/cn'
import { useMounted } from '@/hooks/use-mounted'

interface DialogContextValue {
  onOpenChange?: (open: boolean) => void
}

const DialogCloseContext = { onOpenChange: undefined } as DialogContextValue

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

  // 属性式：内部组装 DialogContent
  const usePropsStyle = title !== undefined || description !== undefined

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      {usePropsStyle ? (
        <DialogContent className={className} onInteractOutside={() => onOpenChange(false)}>
          {title ? <DialogTitle>{title}</DialogTitle> : null}
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
          {children}
        </DialogContent>
      ) : (
        children
      )}
    </div>,
    document.body,
  )
}

/** 卡片容器（组合式：直接作为 Dialog 的子节点） */
export function DialogContent({
  children,
  className,
  onInteractOutside,
}: {
  children: ReactNode
  className?: string
  onInteractOutside?: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      onClick={
        onInteractOutside
          ? (e) => {
              if (ref.current && !ref.current.contains(e.target as Node)) onInteractOutside()
            }
          : undefined
      }
      className={cn(
        'relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DialogHeader({ className, children }: { className?: string; children: ReactNode }): React.JSX.Element {
  return <div className={cn('mb-3 flex flex-col space-y-1.5', className)}>{children}</div>
}

export function DialogTitle({ className, children }: { className?: string; children: ReactNode }): React.JSX.Element {
  return <h2 className={cn('text-lg font-semibold leading-none', className)}>{children}</h2>
}

export function DialogDescription({ className, children }: { className?: string; children: ReactNode }): React.JSX.Element {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
}

export function DialogFooter({ className, children }: { className?: string; children: ReactNode }): React.JSX.Element {
  return <div className={cn('mt-6 flex justify-end gap-2', className)}>{children}</div>
}

// 占位引用避免未使用告警
void DialogCloseContext
