'use client'

/**
 * GreetingBar：问候条（昵称 + 状态 + 快捷入口）。
 */
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import type { DashboardData } from '../api'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export function GreetingBar({ data }: { data: DashboardData }): React.JSX.Element {
  const nickname = data.user.nickname || '同学'
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}，{nickname}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.streak.todayDone ? '今天的学习已完成，太棒了！' : '先从今日任务开始吧 💪'}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={ROUTES.vocabulary.review}>
          <Button size="sm" variant="outline">
            去复习{data.vocabulary.dueReview > 0 ? `（${data.vocabulary.dueReview}）` : ''}
          </Button>
        </Link>
        <Link href={ROUTES.vocabulary.root}>
          <Button size="sm">学新词</Button>
        </Link>
      </div>
    </div>
  )
}
