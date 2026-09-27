'use client'

/**
 * TodayTasks：今日任务列表（打卡完成，幂等 + XP 反馈）。
 */
import { useState } from 'react'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/empty-state'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { cn } from '@/lib/utils/cn'
import { ROUTES } from '@/lib/constants/routes'
import { dashboardApi, type DashboardTask } from '../api'

const TYPE_ICON: Record<string, string> = {
  VOCAB: '📖',
  REVIEW: '🔁',
  LISTENING: '🎧',
  READING: '📰',
  GRAMMAR: '✏️',
  CHALLENGE: '🏁',
  EXAM: '📝',
}

export function TodayTasks({
  tasks,
  onCompleted,
}: {
  tasks: DashboardTask[]
  onCompleted?: (taskId: string, xpEarned: number) => void
}): React.JSX.Element {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<Set<string>>(
    new Set(tasks.filter((t) => t.status === 'COMPLETED').map((t) => t.id)),
  )

  const complete = async (task: DashboardTask): Promise<void> => {
    if (doneIds.has(task.id) || busyId) return
    setBusyId(task.id)
    try {
      const { xpEarned } = await dashboardApi.completeTask(task.id)
      setDoneIds((prev) => new Set(prev).add(task.id))
      onCompleted?.(task.id, xpEarned)
    } catch {
      // 静默：下次点击重试
    } finally {
      setBusyId(null)
    }
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        emoji="🎯"
        title="今日任务已就绪"
        description="完成 Onboarding 或学习后这里会出现个性化任务"
        action={
          <Link href={ROUTES.onboarding}>
            <Button size="sm">去设置学习计划</Button>
          </Link>
        }
      />
    )
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const done = doneIds.has(t.id) || t.status === 'COMPLETED'
        const pct = t.targetValue > 0 ? Math.min(100, Math.round((t.completedValue / t.targetValue) * 100)) : 0
        return (
          <li
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-border p-3 transition-colors',
              done && 'border-success/40 bg-success/5',
            )}
          >
            <span className="text-xl" aria-hidden>
              {TYPE_ICON[t.taskType] ?? '📌'}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>{t.title}</p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-primary')}
                  style={{ width: `${Math.max(pct, done ? 100 : 0)}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.max(t.completedValue, done ? t.targetValue : 0)}/{t.targetValue} {t.unit}
            </span>
            <Button
              size="sm"
              variant={done ? 'ghost' : 'outline'}
              disabled={done || busyId === t.id}
              onClick={() => void complete(t)}
            >
              {done ? '已完成' : busyId === t.id ? '提交中…' : '打卡'}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

/** 任务骨架屏（水合前占位） */
export function TodayTasksSkeleton(): React.JSX.Element {
  return <SkeletonList rows={3} />
}
