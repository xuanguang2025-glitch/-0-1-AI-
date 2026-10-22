'use client'

/**
 * RolePicker / ScenePicker：角色 × 场景选择（T19）。
 */
import { cn } from '@/lib/utils/cn'
import { DIFFICULTY_NAMES, type SpeakingCatalogItem } from '../types'

export interface PickerProps {
  items: SpeakingCatalogItem[]
  selected: string | null
  onSelect: (key: string) => void
  testPrefix: string
  className?: string
}

export function RolePicker({ items, selected, onSelect, testPrefix, className }: PickerProps): React.JSX.Element {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)} data-testid={testPrefix}>
      {items.map((item) => (
        <button
          key={item.roleKey}
          type="button"
          onClick={() => onSelect(item.roleKey)}
          className={cn(
            'rounded-xl border p-3 text-left transition-colors',
            selected === item.roleKey ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-muted',
          )}
          data-testid={`${testPrefix}-${item.roleKey}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-[10px] text-muted-foreground">{DIFFICULTY_NAMES[item.difficulty] ?? item.difficulty}</span>
          </div>
          {item.description !== null ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
        </button>
      ))}
    </div>
  )
}

/** 场景（带 sceneKey 的目录项） */
export interface ScenePickerProps {
  scenes: Array<{ sceneKey: string; name: string; description: string | null; difficulty: string }>
  selected: string | null
  onSelect: (sceneKey: string) => void
  className?: string
}

export function ScenePicker({ scenes, selected, onSelect, className }: ScenePickerProps): React.JSX.Element {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)} data-testid="scene-picker">
      {scenes.map((s) => (
        <button
          key={s.sceneKey}
          type="button"
          onClick={() => onSelect(s.sceneKey)}
          className={cn(
            'rounded-xl border p-3 text-left transition-colors',
            selected === s.sceneKey ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-muted',
          )}
          data-testid={`scene-${s.sceneKey}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{s.name}</span>
            <span className="text-[10px] text-muted-foreground">{DIFFICULTY_NAMES[s.difficulty] ?? s.difficulty}</span>
          </div>
          {s.description !== null ? <p className="mt-1 text-xs text-muted-foreground">{s.description}</p> : null}
        </button>
      ))}
    </div>
  )
}
