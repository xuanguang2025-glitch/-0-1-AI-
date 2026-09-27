'use client'

/**
 * AiSuggestion：AI 每日建议卡片（独立降级 + 手动刷新）。
 */
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { AiDegradedBanner } from '@/components/feedback/ai-degraded-banner'
import { dashboardApi } from '../api'

export function AiSuggestion({
  initial,
  degraded,
}: {
  initial: string
  degraded: boolean
}): React.JSX.Element {
  const [text, setText] = useState(initial)
  const [isDegraded, setIsDegraded] = useState(degraded)
  const [loading, setLoading] = useState(false)

  const refresh = async (): Promise<void> => {
    if (loading) return
    setLoading(true)
    try {
      const r = await dashboardApi.refreshSuggestion()
      setText(r.text)
      setIsDegraded(r.degraded)
    } catch {
      // 静默：保留当前文案
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden>✨</span> AI 今日建议
        </h3>
        <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? '思考中…' : '换一条'}
        </Button>
      </div>
      {isDegraded ? <AiDegradedBanner reason="AI_UNAVAILABLE" className="mb-2" /> : null}
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  )
}
