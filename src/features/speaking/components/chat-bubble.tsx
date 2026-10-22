'use client'

/**
 * ChatBubble：对话气泡（T19）。
 */
import { cn } from '@/lib/utils/cn'

export interface ChatBubbleProps {
  speaker: 'USER' | 'AI'
  text: string
  className?: string
}

export function ChatBubble({ speaker, text, className }: ChatBubbleProps): React.JSX.Element {
  const isUser = speaker === 'USER'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start', className)} data-speaker={speaker}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-6',
          isUser ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-surface-muted text-foreground',
        )}
      >
        {text}
      </div>
    </div>
  )
}
