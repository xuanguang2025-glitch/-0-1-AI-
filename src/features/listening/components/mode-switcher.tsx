'use client'

/**
 * ModeSwitcher：7 种训练模式切换（T14 验收 3）。
 *
 * - Phase 2 可用 6 种；RETELL 需录音，**Phase 3** → 展示「即将上线」且禁用；
 * - 模式有适用强度档（CLOZE/KEYWORD 仅 2-4 档），不适用时禁用并给出原因。
 */
import { cn } from '@/lib/utils/cn'
import { MODE_META, type ListeningModeKey } from '../types'

export interface ModeSwitcherProps {
  value: ListeningModeKey
  onChange: (mode: ListeningModeKey) => void
  intensityLevel: number
  className?: string
}

const ORDER: ListeningModeKey[] = ['EXTENSIVE', 'CHOICE', 'CLOZE', 'KEYWORD', 'INTENSIVE', 'DICTATION', 'RETELL']

export function ModeSwitcher({ value, onChange, intensityLevel, className }: ModeSwitcherProps): React.JSX.Element {
  return (
    <div
      className={cn('flex gap-1 overflow-x-auto rounded-xl bg-muted p-1', className)}
      role="tablist"
      aria-label="训练模式"
    >
      {ORDER.map((mode) => {
        const meta = MODE_META[mode]
        const levelOk = meta.levels.includes(intensityLevel)
        const disabled = !meta.available || !levelOk
        const active = value === mode
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
            data-testid={`mode-${mode.toLowerCase()}`}
            title={
              !meta.available
                ? '复述模式需要录音评分，Phase 3 上线'
                : !levelOk
                  ? `该模式适用于强度档 ${meta.levels.join(' / ')}`
                  : undefined
            }
            className={cn(
              'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
            )}
          >
            {meta.nameZh}
            {!meta.available ? <span className="text-[10px] text-muted-foreground">Phase 3</span> : null}
          </button>
        )
      })}
    </div>
  )
}
