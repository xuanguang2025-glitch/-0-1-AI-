'use client'

/**
 * LazyHeatmap：学习热力日历（GitHub 风格，纯 DOM，无需 recharts，但同样 ssr:false）。
 */
import dynamic from 'next/dynamic'

export interface HeatmapDay {
  date: string // YYYY-MM-DD
  /** 学习分钟数 0-N；0 表示无学习 */
  minutes: number
}

/** 纯 DOM 实现（比 recharts 轻），直接默认导出 */
export default function LazyHeatmapImpl({
  days,
  weeks = 20,
}: {
  days: HeatmapDay[]
  weeks?: number
}): React.JSX.Element {
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const level = (m: number): number => (m === 0 ? 0 : Math.min(4, Math.ceil((m / max) * 4)))
  const tone = ['bg-surface-muted', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary']

  // 截取最近 n 周
  const trimmed = days.slice(-weeks * 7)

  return (
    <div className="overflow-x-auto" role="img" aria-label="学习热力图">
      <div className="flex gap-1" style={{ width: 'max-content' }}>
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, dow) => {
              const day = trimmed[w * 7 + dow]
              if (!day) return <span key={dow} className="h-3.5 w-3.5" />
              return (
                <span
                  key={dow}
                  className={`h-3.5 w-3.5 rounded-sm ${tone[level(day.minutes)]}`}
                  title={`${day.date}：${day.minutes} 分钟`}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 导出经 dynamic 包装的组件（ssr:false） */
const LazyHeatmap = dynamic(() => Promise.resolve({ default: LazyHeatmapImpl }), { ssr: false })
export { LazyHeatmap }
