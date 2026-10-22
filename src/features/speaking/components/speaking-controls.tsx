'use client'

/**
 * StartSpeakingButton：开始/停止说话按钮（T19）。
 * 浏览器不支持 SpeechRecognition 时**不渲染**（页面切文本输入模式）。
 */
import { Mic, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export interface StartSpeakingButtonProps {
  listening: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
}

export function StartSpeakingButton({ listening, onToggle, disabled = false, className }: StartSpeakingButtonProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'default'}
      onClick={onToggle}
      disabled={disabled}
      className={cn('gap-2', className)}
      data-testid="start-speaking"
    >
      {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {listening ? '停止' : '开始说话'}
    </Button>
  )
}

/**
 * Waveform：录音波形动画（装饰性，录音中显示）。
 */
export function Waveform({ active }: { active: boolean }): React.JSX.Element {
  return (
    <div className="flex h-6 items-end gap-0.5" data-testid="waveform" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={active ? 'w-1 animate-pulse rounded bg-primary' : 'w-1 rounded bg-muted-foreground/30'}
          style={{ height: active ? `${8 + ((i * 7) % 14)}px` : '4px', animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  )
}
