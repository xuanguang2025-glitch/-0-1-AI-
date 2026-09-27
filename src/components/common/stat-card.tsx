/**
 * StatCard：统计卡片（Dashboard/Analytics 复用）。
 */
import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

export interface StatCardProps {
  label: string
  value: string | number
  /** 相对变化（正=升），undefined 不显示趋势 */
  delta?: number
  hint?: string
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, delta, hint, icon, className }: StatCardProps): React.JSX.Element {
  const trendUp = delta !== undefined && delta >= 0
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trendUp ? 'text-success' : 'text-destructive',
            )}
          >
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}
