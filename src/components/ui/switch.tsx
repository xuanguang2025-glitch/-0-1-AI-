'use client'

/**
 * Switch（radix-free：button[role=switch]）。
 */
import { useState } from 'react'

import { cn } from '@/lib/utils/cn'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Switch({
  checked: controlled,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: SwitchProps): React.JSX.Element {
  const [internal, setInternal] = useState(defaultChecked)
  const checked = controlled ?? internal

  const toggle = (): void => {
    if (disabled) return
    const next = !checked
    if (controlled === undefined) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-surface-muted',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}
