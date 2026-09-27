'use client'

/**
 * LazyBarChart：柱状图（dynamic ssr:false）。
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'

export interface BarChartPoint {
  label: string
  value: number
}

export default function LazyBarChart({
  data,
  height = 240,
  color = 'hsl(var(--primary))',
}: {
  data: BarChartPoint[]
  height?: number
  color?: string
}): React.JSX.Element {
  return (
    <div style={{ height }} role="img" aria-label="柱状图">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <RTooltip
            contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
          />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
