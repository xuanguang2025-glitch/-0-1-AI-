'use client'

/**
 * /grammar — 语法主题列表（G1，T16 验收 1）。
 *
 * 左侧主题树（14 类，parent/children），右侧选中主题的详情面板
 * （知识点 / 例句 / 错误示例对照 / 掌握度）+ 「开始练习」入口。
 * 三态齐备（Skeleton / Empty / Error+Retry）。
 */
import { useCallback, useState } from 'react'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { ExampleCard } from '@/features/grammar/components/example-card'
import { ErrorExample } from '@/features/grammar/components/error-example'
import { MasteryBadge } from '@/features/grammar/components/mastery-badge'
import { TopicDetail } from '@/features/grammar/components/topic-detail'
import { TopicTree } from '@/features/grammar/components/topic-tree'
import { useGrammarExplain, useGrammarTopic, useGrammarTopics } from '@/features/grammar/hooks'
import { ExplainPanel } from '@/features/grammar/components/explain-panel'
import {
  DIFFICULTY_NAMES,
  type GrammarErrorExample,
  type GrammarExample,
  type GrammarExplainResult,
  type GrammarTopicNode,
} from '@/features/grammar/types'
import { ROUTES } from '@/lib/constants/routes'

export default function GrammarListPage(): React.JSX.Element {
  const { data, loading, error, reload } = useGrammarTopics()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [explainResult, setExplainResult] = useState<GrammarExplainResult | null>(null)
  const [explainingPoint, setExplainingPoint] = useState<string | null>(null)
  const { explain, loading: explaining } = useGrammarExplain(activeId)

  /** 展平查找（树 → 平铺 map） */
  const flatten = useCallback((nodes: GrammarTopicNode[], out: GrammarTopicNode[] = []): GrammarTopicNode[] => {
    for (const n of nodes) {
      out.push(n)
      flatten(n.children, out)
    }
    return out
  }, [])

  const all = data ? flatten(data.topics) : []
  const active = all.find((t) => t.id === activeId) ?? all[0] ?? null

  const onExplain = useCallback(
    async (pointTitle: string) => {
      if (!active) return
      setExplainingPoint(pointTitle)
      const r = await explain(pointTitle)
      setExplainingPoint(null)
      if (r) setExplainResult(r)
    },
    [active, explain],
  )

  // ---- 三态 ----
  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-20" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_1fr]">
            <SkeletonCard className="h-96" />
            <SkeletonCard className="h-96" />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="语法知识点加载失败" message={error} onRetry={reload} />
        </PageContainer>
      </AppShell>
    )
  }

  if (!data || all.length === 0) {
    return (
      <AppShell>
        <PageContainer>
          <EmptyState
            emoji="📐"
            title="暂无语法知识点"
            description="内容尚未导入，请先执行 npm run db:seed。"
            action={<Badge variant="outline">共 0 类</Badge>}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="语法学习"
          description="14 类语法体系 · 例句对照 · 错例分析 · 练习巩固掌握度"
          actions={<Badge variant="secondary">共 {data.total} 类</Badge>}
        />

        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          {/* 左：主题树 */}
          <Card className="p-2">
            <h2 className="px-2 py-1 text-xs font-medium text-muted-foreground">知识点目录</h2>
            <TopicTree
              topics={data.topics}
              activeId={active?.id ?? null}
              onSelect={(t) => {
                setActiveId(t.id)
                setExplainResult(null)
              }}
            />
          </Card>

          {/* 右：详情 */}
          <div className="space-y-4">
            {active ? (
              <>
                <Card className="p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{active.name}</h2>
                    <Badge variant="outline">{DIFFICULTY_NAMES[active.difficulty] ?? active.difficulty}</Badge>
                    <Badge variant="secondary">{active.questionCount} 题</Badge>
                    <span className="ml-auto">
                      <MasteryBadge mastery={active.mastery} mastered={active.mastered} />
                    </span>
                  </div>

                  <TopicDetailLazy
                    topicId={active.id}
                    onExplain={(p) => void onExplain(p)}
                    explainingPoint={explainingPoint}
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`${ROUTES.grammar}/${active.id}`}
                      className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      data-testid="goto-detail"
                    >
                      查看详解
                    </Link>
                    <Link
                      href={`${ROUTES.grammar}/${active.id}/exercise`}
                      className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
                      data-testid="goto-exercise"
                    >
                      开始练习（{active.questionCount} 题）
                    </Link>
                  </div>
                </Card>

                {/* 验收 3：AI 讲解 Mock 时静态兜底，区块不消失 */}
                <ExplainPanel result={explainResult} loading={explaining} />
              </>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}

/** 详情按需加载（切主题时才请求），避免首屏拉全量 */
function TopicDetailLazy({
  topicId,
  onExplain,
  explainingPoint,
}: {
  topicId: string
  onExplain: (pointTitle: string) => void
  explainingPoint: string | null
}): React.JSX.Element {
  const { data, loading, error, reload } = useGrammarTopic(topicId)
  if (loading) return <SkeletonCard className="h-40" />
  if (error || !data) {
    return <ErrorState title="知识点加载失败" message={error ?? '未知错误'} onRetry={reload} />
  }
  return (
    <>
      <TopicDetail topic={data} onExplain={onExplain} explainingPoint={explainingPoint} />
      {data.examples.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">例句</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.examples.map((e: GrammarExample, i: number) => (
              <ExampleCard key={i} example={e} index={i} />
            ))}
          </div>
        </section>
      ) : null}
      {data.errorExamples.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">易错对照</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.errorExamples.map((e: GrammarErrorExample, i: number) => (
              <ErrorExample key={i} example={e} index={i} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
