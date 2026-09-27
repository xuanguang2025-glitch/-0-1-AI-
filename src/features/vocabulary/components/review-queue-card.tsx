'use client'

/**
 * ReviewQueueCard：复习队列概览（到期数 + 进入复习入口）。
 */
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'

import type { ReviewQueue } from '../types'

export function ReviewQueueCard({ queue }: { queue: ReviewQueue | null }): React.JSX.Element {
  const due = queue?.dueCount ?? 0
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">复习队列</CardTitle>
        {due > 0 ? <span className="text-2xl font-bold text-warning">{due}</span> : null}
      </CardHeader>
      <CardContent>
        {due > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">有 {due} 个单词到了最佳复习时间，现在复习记忆保持率最高。</p>
            <Link
              href={ROUTES.vocabulary.review}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              开始复习
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">暂无到期单词，安排得很棒！学点新词吧。</p>
        )}
      </CardContent>
    </Card>
  )
}
