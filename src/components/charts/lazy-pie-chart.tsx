'use client'

/**
 * LazyPieChart：占比环形图（dynamic ssr:false）。
 */
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'

export interface PieSlice {
  name: string
  value: number
  color: string
}

export default function LazyPieChart({
  data,
  height = 240,
  innerRadius = 56,
}: {
  data: PieSlice[]
  height?: number
  innerRadius?: number
}): React.JSX.Element {
  return (
    <div style={{ height }} role="img" aria-label="占比图">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius="80%" paddingAngle={2}>
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <RTooltip
            contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
