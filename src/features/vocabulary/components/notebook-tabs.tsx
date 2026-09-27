'use client'

/**
 * NotebookTabs：生词本页签（全部 / 到期复习 / 已掌握）。
 */
import { cn } from '@/lib/utils/cn'

export type NotebookTab = 'all' | 'due' | 'mastered'

const TABS: Array<{ key: NotebookTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'due', label: '待复习' },
  { key: 'mastered', label: '已掌握' },
]

export function NotebookTabs({
  value,
  onChange,
}: {
  value: NotebookTab
  onChange: (tab: NotebookTab) => void
}): React.JSX.Element {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            value === t.key ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
