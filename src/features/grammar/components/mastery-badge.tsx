'use client'

/**
 * MasteryBadge：掌握度徽章（T16 验收 4）。
 *
 * 三态：未练习（灰）/ 练习中（黄，按掌握度分段）/ 已掌握（绿）。
 * `mastered` 由服务端按「累计正确率 ≥80 且练习 ≥3 次」判定。
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

export interface MasteryBadgeProps {
  /** 0-100；null = 未练习 */
  mastery: number | null
  mastered?: boolean
  /** 紧凑模式（只显示徽章，不显示百分比文字） */
  compact?: boolean
  className?: string
}

export function MasteryBadge({ mastery, mastered = false, compact = false, className }: MasteryBadgeProps): React.JSX.Element {
  const size = compact ? 'text-[10px]' : 'text-xs'
  if (mastery === null) {
    return (
      <Badge variant="outline" className={cn('shrink-0', size, className)} data-testid="mastery-none">
        未练习
      </Badge>
    )
  }

  const variant = mastered ? 'success' : mastery >= 50 ? 'warning' : 'secondary'
  const label = mastered ? '已掌握' : `${mastery}%`

  return (
    <Badge variant={variant} className={cn('shrink-0 tabular-nums', size, className)} data-testid="mastery-badge">
      {label}
    </Badge>
  )
}
