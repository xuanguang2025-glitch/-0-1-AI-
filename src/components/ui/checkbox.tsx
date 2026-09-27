'use client'

/**
 * Checkbox（radix-free：button[role=checkbox]）。
 */
import { Check } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils/cn'

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
  className?: string
  id?: string
}

export function Checkbox({
  checked: controlled,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  label,
  className,
  id,
}: CheckboxProps): React.JSX.Element {
  const [internal, setInternal] = useState(defaultChecked)
  const checked = controlled ?? internal

  const toggle = (): void => {
    if (disabled) return
    const next = !checked
    if (controlled === undefined) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface',
        )}
      >
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </button>
      {label ? (

        <label htmlFor={id} className="cursor-pointer select-none text-sm" onClick={toggle}>
          {label}
        </label>
      ) : null}
    </span>
  )
}
