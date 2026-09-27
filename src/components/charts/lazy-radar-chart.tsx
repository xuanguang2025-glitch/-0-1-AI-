'use client'

/**
 * LazyRadarChart：能力雷达图（dynamic ssr:false，六维能力向量）。
 */
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'

export interface RadarPoint {
  /** 维度名：词汇/听力/口语/阅读/写作/语法 */
  dimension: string
  /** 0-100 */
  score: number
}

export default function LazyRadarChart({
  data,
  height = 280,
}: {
  data: RadarPoint[]
  height?: number
}): React.JSX.Element {
  return (
    <div style={{ height }} role="img" aria-label="能力雷达图">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <RTooltip
            contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
          />
          <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
