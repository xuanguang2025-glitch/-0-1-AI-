'use client'

/**
 * AiDegradedBanner：AI 降级提示条（degraded=true 时展示，架构 §7.4）。
 */
import { Alert } from '@/components/ui/alert'
import { CloudOff } from 'lucide-react'

const REASON_TEXT: Record<string, string> = {
  AI_CAPABILITY_DISABLED: '该功能已下线',
  AI_QUOTA_EXCEEDED: '今日 AI 次数已用完，明天再来吧',
  AI_TIMEOUT: 'AI 响应超时',
  AI_UNAVAILABLE: 'AI 服务暂时不可用',
}

export function AiDegradedBanner({
  reason,
  className,
}: {
  /** AiResult.degradedReason */
  reason?: string | null
  className?: string
}): React.JSX.Element | null {
  if (!reason) return null
  const text = REASON_TEXT[reason] ?? 'AI 暂时不可用，以下为兜底内容'
  return (
    <Alert
      variant="warning"
      title="降级模式"
      icon={<CloudOff className="mt-0.5" />}
      className={className}
    >
      {text}。内容由本地兜底生成，恢复后自动优化。
    </Alert>
  )
}
