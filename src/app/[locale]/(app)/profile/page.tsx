'use client'

/**
 * /profile — 个人中心：资料卡 + 学习统计 + 能力画像 + 快捷入口。
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { StatCard } from '@/components/common/stat-card'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { AbilityRadar } from '@/components/charts/ability-radar'
import { ROUTES } from '@/lib/constants/routes'
import { ApiClientError, authApi } from '@/features/auth/api'
import type { AuthUserDto } from '@/types/dto/auth.dto'
import { userApi } from '@/features/user/api'
import type { UserProfileDto, UserStatsDto } from '@/types/dto/user.dto'
import { analyticsApi, vocabularyApi } from '@/features/vocabulary/api'
import type { MasteryOverview } from '@/features/vocabulary/types'
import type { AnalyticsOverviewDto } from '@/features/vocabulary/api'

export default function ProfilePage(): React.JSX.Element {
  const [user, setUser] = useState<AuthUserDto | null>(null)
  const [profile, setProfile] = useState<UserProfileDto | null>(null)
  const [stats, setStats] = useState<UserStatsDto | null>(null)
  const [mastery, setMastery] = useState<MasteryOverview | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverviewDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      authApi.me(),
      userApi.getProfile(),
      vocabularyApi.mastery(),
      analyticsApi.overview(),
      userApi.getStats(),
    ])
      .then(([me, p, m, o, s]) => {
        if (cancelled) return
        setUser(me)
        setProfile(p)
        setMastery(m)
        setOverview(o)
        setStats(s)
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

  return (
    <AppShell>
      <PageContainer>
        {loading ? <SkeletonList rows={5} /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && user ? (
          <div className="space-y-6">
            {/* 资料卡 */}
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-6">
                <Avatar src={user.avatarUrl} alt={user.nickname} fallback={(user.nickname || 'U').slice(0, 1)} size="lg" className="h-16 w-16 text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight">{user.nickname}</h1>
                    {profile?.gradeBand ? <Badge variant="success">{profile.gradeBand}</Badge> : null}
                    <Badge variant="secondary">Lv.{stats?.level ?? 1}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
                  {profile?.bio ? <p className="mt-2 text-sm">{profile.bio}</p> : null}
                </div>
                <Link
                  href={ROUTES.settings}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  编辑资料与设置 →
                </Link>
              </CardContent>
            </Card>

            {/* 统计卡 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="累计 XP" value={overview?.total.xp ?? 0} />
              <StatCard label="连续学习" value={overview?.streak.days ?? 0} hint={`最长 ${overview?.streak.longest ?? 0} 天`} />
              <StatCard label="已学词汇" value={mastery?.total ?? 0} hint={`已掌握 ${mastery?.byStage.MASTERED ?? 0}`} />
              <StatCard label="累计学习（分钟）" value={overview?.total.minutes ?? 0} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* 能力画像 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">能力画像</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProfileAbility />
                </CardContent>
              </Card>

              {/* 快捷入口 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">我的学习</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { href: ROUTES.analytics, emoji: '📊', label: '学习统计' },
                    { href: ROUTES.vocabulary.notebook, emoji: '⭐', label: '生词本' },
                    { href: ROUTES.achievements, emoji: '🏆', label: '我的成就' },
                    { href: ROUTES.settings, emoji: '⚙️', label: '设置' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 rounded-xl border border-border p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span aria-hidden>{item.emoji}</span>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  )
}

/** 能力雷达（从 dashboard 聚合轻量取 abilityVector，失败静默降级） */
function ProfileAbility(): React.JSX.Element {
  const [ability, setAbility] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const dash = await fetch('/api/dashboard', { credentials: 'same-origin' })
        const body = (await dash.json()) as { data?: { ability?: Record<string, number> | null } } | null
        if (!cancelled && body?.data?.ability) setAbility(body.data.ability)
      } catch {
        // 静默降级
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return <AbilityRadar abilityVector={ability} />
}
