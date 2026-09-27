'use client'

/**
 * Tabs（radix-free：context + aria-selected）。
 */
import { createContext, useContext, useState, type HTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

interface TabsContextValue {
  value: string
  setValue: (v: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  className,
  children,
}: {
  defaultValue: string
  value?: string
  onValueChange?: (v: string) => void
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const [internal, setInternal] = useState(defaultValue)
  const value = controlled ?? internal
  const setValue = (v: string): void => {
    if (controlled === undefined) setInternal(v)
    onValueChange?.(v)
  }
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn('inline-flex h-10 items-center justify-center rounded-xl bg-surface-muted p-1 text-muted-foreground', className)}
      {...props}
    />
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const ctx = useContext(TabsContext)
  const active = ctx?.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx?.setValue(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-surface text-foreground shadow-sm' : 'hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const ctx = useContext(TabsContext)
  if (ctx?.value !== value) return <></>
  return (
    <div role="tabpanel" className={cn('mt-4 focus-visible:outline-none', className)}>
      {children}
    </div>
  )
}
