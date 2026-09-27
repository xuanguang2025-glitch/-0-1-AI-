'use client'

/**
 * AbilityRadar：六维能力雷达（业务包装 lazy-radar-chart，Profile.abilityVector 数据）。
 */
import dynamic from 'next/dynamic'

import { ChartSkeleton } from './lazy-chart'
import type { RadarPoint } from './lazy-radar-chart'

const Radar = dynamic(() => import('./lazy-radar-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={280} />,
})

/** 六维固定顺序（Profile.abilityVector JSON 键） */
const DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: 'vocabulary', label: '词汇' },
  { key: 'listening', label: '听力' },
  { key: 'speaking', label: '口语' },
  { key: 'reading', label: '阅读' },
  { key: 'writing', label: '写作' },
  { key: 'grammar', label: '语法' },
]

export function AbilityRadar({
  abilityVector,
  className,
}: {
  /** {vocabulary: 0-100, ...} */
  abilityVector: Record<string, number> | null
  className?: string
}): React.JSX.Element {
  const data: RadarPoint[] = DIMENSIONS.map((d) => ({
    dimension: d.label,
    score: Math.min(100, Math.max(0, abilityVector?.[d.key] ?? 0)),
  }))
  return (
    <div className={className}>
      <Radar data={data} />
    </div>
  )
}
