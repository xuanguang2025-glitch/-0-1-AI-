'use client'

/**
 * AiStreamBubble：对话气泡（流式文本 + 打字机光标 + 降级标记）。
 */
import { cn } from '@/lib/utils/cn'
import { AiThinking } from './ai-thinking'

export function AiStreamBubble({
  text,
  streaming,
  degraded,
  error,
  className,
}: {
  text: string
  streaming?: boolean
  degraded?: boolean
  error?: string | null
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex w-full', className)}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          degraded ? 'border border-warning/40 bg-warning/10 text-foreground' : 'bg-secondary text-secondary-foreground',
        )}
      >
        {text ? (
          <p className="whitespace-pre-wrap">
            {text}
            {streaming ? <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-current align-text-bottom" aria-hidden /> : null}
          </p>
        ) : streaming ? (
          <AiThinking />
        ) : (
          <p className="text-muted-foreground">{error ?? '（空回复）'}</p>
        )}
        {degraded ? <p className="mt-2 text-xs text-warning">⚡ 降级内容 · AI 恢复后自动优化</p> : null}
      </div>
    </div>
  )
}
