'use client'

/**
 * DropdownMenu（radix-free：受控开关 + 点击外部关闭）。
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

interface DropdownContextValue {
  open: boolean
  setOpen: (v: boolean) => void
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

export function DropdownMenu({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={rootRef} className={cn('relative inline-block', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

export function DropdownMenuTrigger({ children }: { children: ReactNode }): React.JSX.Element {
  const ctx = useContext(DropdownContext)
  return (
    <span onClick={() => ctx?.setOpen(!ctx.open)} className="inline-flex cursor-pointer">
      {children}
    </span>
  )
}

export function DropdownMenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
}): React.JSX.Element | null {
  const ctx = useContext(DropdownContext)
  if (!ctx?.open) return null
  return (
    <div
      role="menu"
      className={cn(
        'absolute z-40 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg',
        align === 'end' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({
  children,
  onSelect,
  destructive,
}: {
  children: ReactNode
  onSelect?: () => void
  destructive?: boolean
}): React.JSX.Element {
  const ctx = useContext(DropdownContext)
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        ctx?.setOpen(false)
        onSelect?.()
      }}
      className={cn(
        'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted',
        destructive ? 'text-destructive' : 'text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator(): React.JSX.Element {
  return <div className="my-1 h-px bg-border" role="separator" />
}
