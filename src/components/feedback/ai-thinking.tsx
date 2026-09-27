'use client'

/**
 * AiThinking：AI 思考中动效（三点跳动 + 文案）。
 */
import { cn } from '@/lib/utils/cn'

export function AiThinking({ label = 'AI 思考中', className }: { label?: string; className?: string }): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)} role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      {label}…
    </span>
  )
}
