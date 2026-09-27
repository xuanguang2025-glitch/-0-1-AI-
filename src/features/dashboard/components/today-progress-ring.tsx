'use client'

/**
 * TodayProgressRing：今日进度环（学习分钟 / 目标 + 任务完成数）。
 */
import { ProgressRing } from '@/components/charts/progress-ring'
import type { DashboardData } from '../api'

export function TodayProgressRing({ data }: { data: DashboardData }): React.JSX.Element {
  const pct =
    data.today.minutesGoal > 0
      ? Math.min(100, Math.round((data.today.minutesDone / data.today.minutesGoal) * 100))
      : 0
  return (
    <div className="flex items-center gap-5">
      <ProgressRing value={pct} size={110} strokeWidth={10} label={`${data.today.minutesDone}/${data.today.minutesGoal}min`} />
      <div className="space-y-1 text-sm">
        <p className="font-medium">
          今日学习 <span className="text-primary">{data.today.minutesDone}</span> / {data.today.minutesGoal} 分钟
        </p>
        <p className="text-muted-foreground">
          任务完成 {data.today.tasksCompleted} / {data.today.tasksTotal}
        </p>
        <p className="text-muted-foreground">
          等级 Lv.{data.user.level} · 距下一级 {data.user.xpToNext} XP
        </p>
      </div>
    </div>
  )
}
