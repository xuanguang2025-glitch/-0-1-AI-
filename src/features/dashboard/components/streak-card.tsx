'use client'

/**
 * StreakCard：连胜卡片（当前天数 + 历史最长 + 今日是否点亮 + 可选热力图）。
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StreakCalendar } from '@/components/charts/streak-calendar'

export function StreakCard({
  days,
  longest,
  todayDone,
  recentStats,
}: {
  days: number
  longest: number
  todayDone: boolean
  /** 可选：按 date 升序的近期统计（有则渲染热力图） */
  recentStats?: Array<{ date: string; minutes: number }>
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">学习连胜</CardTitle>
        <span className="text-2xl" aria-hidden>
          🔥
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6">
          <div>
            <p className="text-3xl font-bold text-primary">{days}</p>
            <p className="text-xs text-muted-foreground">
              当前连胜{todayDone ? '（今天已点亮）' : '（今天还没学）'}
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold">{longest}</p>
            <p className="text-xs text-muted-foreground">历史最长</p>
          </div>
        </div>
        {recentStats && recentStats.length > 0 ? (
          <StreakCalendar days={recentStats.map((s) => ({ date: s.date, minutes: s.minutes }))} weeks={8} />
        ) : null}
      </CardContent>
    </Card>
  )
}
