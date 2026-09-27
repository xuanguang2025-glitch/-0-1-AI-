'use client'

/**
 * /settings/ai — AI 偏好（Phase 1 占位：能力开关与语气风格说明，能力配置由服务端统一管理）。
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const AI_FEATURES: Array<{ emoji: string; label: string; desc: string }> = [
  { emoji: '💡', label: '单词讲解', desc: 'AI 生成词根词缀、联想记忆与例句' },
  { emoji: '🩺', label: '每日诊断', desc: '根据当天学习数据生成建议' },
  { emoji: '📝', label: '作文批改', desc: '按四六级/雅思评分维度给反馈' },
  { emoji: '💬', label: 'AI 学伴', desc: '对话式口语与语法答疑' },
  { emoji: '📅', label: '计划生成', desc: '按目标与空闲时间生成 4 周计划' },
]

export default function AiSettingsPage(): React.JSX.Element {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">AI 能力</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          以下 AI 能力默认开启，由服务端统一调控配额与质量；个性化开关将在后续版本提供。
        </p>
        <ul className="space-y-3">
          {AI_FEATURES.map((f) => (
            <li key={f.label} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <span className="text-xl" aria-hidden>
                {f.emoji}
              </span>
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
