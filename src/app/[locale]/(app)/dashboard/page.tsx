'use client'

/**
 * Dashboard 主页面：9 Block 布局（问候 / 连胜 / 等级 / 今日进度 / 今日任务 /
 * 能力画像 / AI 建议 / 继续学习 / 推荐）。AI 建议独立降级，不影响其余区块。
 */
import { useCallback, useEffect, useState } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonStats } from '@/components/common/skeleton-kit'
import {
  AbilityBlock,
  AiSuggestion,
  ContinueLearning,
  GreetingBar,
  LevelBlock,
  RecommendedForYou,
  StreakCard,
  TodayProgressRing,
  TodayTasks,
} from '@/features/dashboard'
import { dashboardApi, type DashboardData } from '@/features/dashboard/api'

export default function DashboardPage(): React.JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    dashboardApi
      .get()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 任务打卡成功 → 增量更新本地计数（避免整页刷新）
  const handleTaskCompleted = useCallback((taskId: string, xpEarned: number): void => {
    void taskId
    void xpEarned
    setData((prev) =>
      prev
        ? {
            ...prev,
            today: { ...prev.today, tasksCompleted: Math.min(prev.today.tasksTotal, prev.today.tasksCompleted + 1) },
          }
        : prev,
    )
  }, [])

  return (
    <AppShell>
      <PageContainer className="space-y-6 py-6">
        {error ? (
          <ErrorState title="加载失败" message={error} onRetry={() => window.location.reload()} />
        ) : null}

        {!data && !error ? <SkeletonStats cards={4} /> : null}

        {data ? (
          <div className="space-y-6">
            {/* 问候 + 快捷入口 */}
            <GreetingBar data={data} />

            {/* 第一排：今日进度环 + 连胜 + 等级 */}
            <div className="grid gap-4 md:grid-cols-3">
              <TodayProgressRing data={data} />
              <StreakCard days={data.streak.days} longest={data.streak.longest} todayDone={data.streak.todayDone} />
              <LevelBlock level={data.user.level} levelPct={data.user.levelPct} xpToNext={data.user.xpToNext} />
            </div>

            {/* AI 建议（独立降级 + 手动刷新） */}
            <AiSuggestion initial={data.aiSuggestion.text} degraded={data.aiSuggestion.degraded} />

            {/* 今日任务（打卡幂等 + XP） */}
            <section aria-label="今日任务">
              <TodayTasks tasks={data.tasks} onCompleted={handleTaskCompleted} />
            </section>

            {/* 能力画像 + 继续学习 */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <AbilityBlock ability={data.ability} />
              </div>
              <ContinueLearning
                lastBookSlug={data.continueLearning.lastBookSlug}
                lastBookName={data.continueLearning.lastBookName}
              />
            </div>

            {/* 推荐 */}
            <RecommendedForYou data={data} />
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  )
}
