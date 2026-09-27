'use client'

/**
 * SelfRatingBar：SM-2 自评 0-5（记错了 → 完美），提交复习必经。
 */
import { cn } from '@/lib/utils/cn'

const RATINGS: Array<{ value: number; label: string; tone: string }> = [
  { value: 0, label: '完全忘记', tone: 'hover:border-destructive hover:bg-destructive/10' },
  { value: 1, label: '想不起来', tone: 'hover:border-destructive/70 hover:bg-destructive/5' },
  { value: 2, label: '想起来了', tone: 'hover:border-warning hover:bg-warning/10' },
  { value: 3, label: '有点难', tone: 'hover:border-warning/70 hover:bg-warning/5' },
  { value: 4, label: '记得', tone: 'hover:border-primary hover:bg-primary/10' },
  { value: 5, label: '秒答', tone: 'hover:border-success hover:bg-success/10' },
]

export function SelfRatingBar({
  disabled,
  onSelect,
}: {
  disabled?: boolean
  onSelect: (rating: number) => void
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(r.value)}
          className={cn(
            'rounded-lg border border-border px-2 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50',
            'active:scale-95',
            r.tone,
          )}
        >
          <span className="block text-base font-semibold">{r.value}</span>
          <span className="block text-xs text-muted-foreground">{r.label}</span>
        </button>
      ))}
    </div>
  )
}
