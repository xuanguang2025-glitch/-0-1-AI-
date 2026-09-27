'use client'

/**
 * StreakCalendar：连续学习日历（最近 N 周，业务包装 lazy-heatmap）。
 */
import dynamic from 'next/dynamic'

import { ChartSkeleton } from './lazy-chart'
import type { HeatmapDay } from './lazy-heatmap'

const Heatmap = dynamic(() => import('./lazy-heatmap').then((m) => ({ default: m.LazyHeatmap })), {
  ssr: false,
  loading: () => <ChartSkeleton height={80} />,
})

export function StreakCalendar({
  days,
  weeks = 16,
}: {
  /** 按 date 升序的每日学习分钟 */
  days: HeatmapDay[]
  weeks?: number
}): React.JSX.Element {
  return <Heatmap days={days} weeks={weeks} />
}
