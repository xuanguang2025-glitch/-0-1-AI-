'use client'

/**
 * RecommendedForYou：为你推荐（基于待复习/已学数据的轻量推荐位）。
 */
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'
import type { DashboardData } from '../api'

interface RecItem {
  title: string
  desc: string
  href: string
  cta: string
}

/** 规则推荐：优先待复习 → 新词学习 → 水平测试 */
function pickRecs(vocabulary: DashboardData['vocabulary'], hasAbility: boolean): RecItem[] {
  const recs: RecItem[] = []
  if (vocabulary.dueReview > 0) {
    recs.push({
      title: `${vocabulary.dueReview} 个单词待复习`,
      desc: '按 SRS 记忆曲线安排的今日复习',
      href: ROUTES.vocabulary.review,
      cta: '去复习',
    })
  }
  recs.push({
    title: '学习新单词',
    desc: `已学 ${vocabulary.learnedTotal} · 已掌握 ${vocabulary.masteredTotal}`,
    href: ROUTES.vocabulary.learn,
    cta: '去学习',
  })
  if (!hasAbility) {
    recs.push({
      title: '水平测试',
      desc: '约 15 分钟，测出 CEFR 等级与六维画像',
      href: ROUTES.placement,
      cta: '开始测试',
    })
  }
  return recs.slice(0, 3)
}

export function RecommendedForYou({ data }: { data: DashboardData }): React.JSX.Element {
  const recs = pickRecs(data.vocabulary, data.ability !== null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">为你推荐</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {recs.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
          >
            <p className="text-sm font-medium group-hover:text-primary">{r.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            <span className="mt-3 inline-block text-xs font-medium text-primary">{r.cta} →</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
