'use client'

/**
 * IntervalHint：复习提交后展示的间隔预测（1/3/7/14/30 天按 EF 缩放）。
 */
import type { ReviewResult } from '../types'

const LABELS = ['1天', '3天', '7天', '14天', '30天']

export function IntervalHint({ result }: { result: ReviewResult | null }): React.JSX.Element | null {
  if (!result) return null
  const preds = result.intervalPredictions
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
      <div className="mb-1 font-medium text-foreground">
        下次复习 {result.newIntervalDays} 天后 · {result.path === 'LAPSE' ? '再接再厉' : result.path === 'MASTERED' ? '已掌握 🎉' : '稳步推进'}
      </div>
      <div className="flex flex-wrap gap-3">
        {LABELS.map((label, i) => (
          <span key={label}>
            若{label.split('天')[0]}天档：约 <span className="font-medium text-foreground">{preds[i] ?? '—'}</span> 天
          </span>
        ))}
      </div>
    </div>
  )
}
