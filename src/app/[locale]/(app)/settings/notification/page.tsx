'use client'

/**
 * /settings/notification — 通知偏好：落库 userSettings.notificationPrefs（布尔开关集）。
 */
import { useEffect, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ApiClientError } from '@/features/auth/api'
import { userApi } from '@/features/user/api'

const PREFS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'reviewRemind', label: '复习提醒', desc: '有单词到期时提醒（默认开）' },
  { key: 'streakRemind', label: '连胜提醒', desc: '当天还没学习时晚间提醒' },
  { key: 'weeklyReport', label: '每周报告', desc: '每周一推送上周学习总结' },
  { key: 'aiPush', label: 'AI 建议', desc: 'AI 生成的学习建议通知' },
  { key: 'marketing', label: '活动与更新', desc: '产品更新与活动信息' },
]

export default function NotificationSettingsPage(): React.JSX.Element {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    userApi
      .getSettings()
      .then((s) => {
        if (!cancelled) setPrefs(s.notificationPrefs as Record<string, boolean>)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiClientError ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async (key: string, value: boolean): Promise<void> => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSaving(true)
    setError(null)
    try {
      await userApi.updateSettings({ notificationPrefs: next })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">通知偏好</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <SkeletonList rows={3} /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {PREFS.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
            <Switch
              checked={prefs[p.key] ?? p.key === 'reviewRemind'}
              disabled={saving}
              onCheckedChange={(v) => void toggle(p.key, v)}
              aria-label={p.label}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
