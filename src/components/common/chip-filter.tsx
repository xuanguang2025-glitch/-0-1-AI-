'use client'

/**
 * ChipFilter：单选筛选 chips（难度/分类过滤通用）。
 */
import { cn } from '@/lib/utils/cn'

export interface ChipOption<T extends string> {
  value: T
  label: string
}

export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ReadonlyArray<ChipOption<T>>
  value: T
  onChange: (v: T) => void
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
            value === o.value
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
