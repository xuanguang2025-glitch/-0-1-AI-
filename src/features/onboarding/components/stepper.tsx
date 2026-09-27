'use client'

/**
 * Stepper：8 步进度条（单屏单步导航）。
 */
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export function Stepper({ total, current, onJump }: { total: number; current: number; onJump?: (step: number) => void }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current
        const active = i === current
        return (
          <button
            key={i}
            type="button"
            disabled={!onJump || i > current}
            onClick={() => onJump?.(i)}
            aria-label={`第 ${i + 1} 步`}
            className={cn(
              'h-2 rounded-full transition-all',
              active ? 'w-8 bg-primary' : done ? 'w-4 bg-primary/50 hover:bg-primary/70' : 'w-4 bg-surface-muted',
            )}
          >
            {done ? <Check className="hidden" /> : null}
          </button>
        )
      })}
      <span className="ml-2 text-xs text-muted-foreground">
        {current + 1} / {total}
      </span>
    </div>
  )
}
