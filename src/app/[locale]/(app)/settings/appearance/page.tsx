'use client'

/**
 * /settings/appearance — 外观与语言：主题（浅色/深色/跟随系统）+ 界面语言（落库 userSettings）。
 */
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ApiClientError } from '@/features/auth/api'
import { userApi } from '@/features/user/api'
import type { SettingsUpdateInput } from '@/features/user/api'
import { useTheme } from '@/hooks/use-theme'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'

type Theme = NonNullable<SettingsUpdateInput['theme']>

const THEMES: Array<{ value: Theme; label: string; emoji: string }> = [
  { value: 'light', label: '浅色', emoji: '☀️' },
  { value: 'dark', label: '深色', emoji: '🌙' },
  { value: 'system', label: '跟随系统', emoji: '💻' },
]

export default function AppearanceSettingsPage(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [savedTheme, setSavedTheme] = useState<Theme | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    userApi
      .getSettings()
      .then((s) => {
        if (!cancelled && (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system')) {
          setSavedTheme(s.theme)
        }
      })
      .catch(() => {
        // 静默：本地主题仍然可用
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pick = async (t: Theme): Promise<void> => {
    setTheme(t)
    setSavedTheme(t)
    try {
      await userApi.updateSettings({ theme: t })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '保存失败（本地已生效）')
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">主题</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonList rows={1} /> : null}
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => void pick(t.value)}
                className={
                  'rounded-xl border p-4 text-center transition-colors ' +
                  (savedTheme === t.value || (savedTheme === null && theme === t.value)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40')
                }
              >
                <span className="block text-2xl" aria-hidden>
                  {t.emoji}
                </span>
                <span className="mt-1 block text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">界面语言 / Language</CardTitle>
        </CardHeader>
        <CardContent>
          <LocaleSwitcher />
          <p className="mt-2 text-xs text-muted-foreground">切换后立即生效，学习内容会尽量同步语言偏好</p>
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={() => window.location.reload()}>
        应用刷新
      </Button>
    </div>
  )
}
