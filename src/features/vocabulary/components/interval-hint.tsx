'use client'

/**
 * IntervalHint：复习提交后展示的间隔预测（与 8 档长尾阶梯 ADVANCE_INTERVALS 同源，按 EF 缩放）。
 */
import { ADVANCE_INTERVALS } from '@/services/vocabulary/srs/srs.constants'
import type { ReviewResult } from '../types'

const LABELS = ADVANCE_INTERVALS.map((days) => `${days}天`)

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
