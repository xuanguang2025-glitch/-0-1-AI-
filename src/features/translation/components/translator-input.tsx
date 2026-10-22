'use client'

/**
 * TranslatorInput：翻译输入区（T18 验收 1：≤500 字符 + 方向切换）。
 */
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { MAX_SOURCE_LEN } from '../types'

export interface TranslatorInputProps {
  text: string
  direction: 'zh2en' | 'en2zh'
  loading?: boolean
  onTextChange: (text: string) => void
  onDirectionChange: (direction: 'zh2en' | 'en2zh') => void
  onSubmit: () => void
  className?: string
}

export function TranslatorInput({
  text,
  direction,
  loading = false,
  onTextChange,
  onDirectionChange,
  onSubmit,
  className,
}: TranslatorInputProps): React.JSX.Element {
  const over = text.length > MAX_SOURCE_LEN
  return (
    <div className={cn('space-y-2', className)} data-testid="translator-input">
      <div className="flex items-center gap-2" role="group" aria-label="翻译方向">
        <Button
          type="button"
          size="sm"
          variant={direction === 'zh2en' ? 'default' : 'outline'}
          onClick={() => onDirectionChange('zh2en')}
          data-testid="direction-zh2en"
        >
          中 → 英
        </Button>
        <Button
          type="button"
          size="sm"
          variant={direction === 'en2zh' ? 'default' : 'outline'}
          onClick={() => onDirectionChange('en2zh')}
          data-testid="direction-en2zh"
        >
          英 → 中
        </Button>
        <span className={cn('ml-auto text-xs tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')} data-testid="char-count">
          {text.length}/{MAX_SOURCE_LEN}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={4}
        placeholder={direction === 'zh2en' ? '输入要翻译成英文的中文…' : 'Type English text to translate…'}
        className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-6"
        data-testid="translator-text"
      />

      <div className="flex items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={loading || text.trim().length === 0 || over} data-testid="translate-submit">
          {loading ? '翻译中…' : '翻译'}
        </Button>
        {over ? <span className="text-xs text-destructive">超过 {MAX_SOURCE_LEN} 字符上限</span> : null}
      </div>
    </div>
  )
}
