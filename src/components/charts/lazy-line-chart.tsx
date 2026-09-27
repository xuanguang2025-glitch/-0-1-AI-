'use client'

/**
 * LazyLineChart：趋势折线图（dynamic ssr:false）。
 */
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'

export interface LineChartPoint {
  label: string
  value: number
}

export default function LazyLineChart({
  data,
  height = 240,
  color = 'hsl(var(--primary))',
}: {
  data: LineChartPoint[]
  height?: number
  color?: string
}): React.JSX.Element {
  return (
    <div style={{ height }} role="img" aria-label="趋势折线图">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <RTooltip
            contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
