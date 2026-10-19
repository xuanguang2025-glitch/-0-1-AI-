'use client'

/**
 * /grammar/[id] — 语法主题详情页（G2，T16）。
 *
 * 知识点 / 例句 / 易错对照 + AI 讲解（Mock 时静态兜底，source='static'）
 * + 掌握度徽章（随练习结果变化，验收 4）。
 */
import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { ExampleCard } from '@/features/grammar/components/example-card'
import { ErrorExample } from '@/features/grammar/components/error-example'
import { ExplainPanel } from '@/features/grammar/components/explain-panel'
import { MasteryBadge } from '@/features/grammar/components/mastery-badge'
import { TopicDetail } from '@/features/grammar/components/topic-detail'
import { useGrammarExplain, useGrammarTopic } from '@/features/grammar/hooks'
import { DIFFICULTY_NAMES, type GrammarExplainResult } from '@/features/grammar/types'
import { ROUTES } from '@/lib/constants/routes'

export default function GrammarTopicPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const topicId = params.id

  const { data, loading, error, reload } = useGrammarTopic(topicId)
  const { explain, loading: explaining } = useGrammarExplain(topicId)
  const [explainResult, setExplainResult] = useState<GrammarExplainResult | null>(null)
  const [explainingPoint, setExplainingPoint] = useState<string | null>(null)

  const onExplain = useCallback(
    async (pointTitle: string) => {
      setExplainingPoint(pointTitle)
      const r = await explain(pointTitle)
      setExplainingPoint(null)
      if (r) setExplainResult(r)
    },
    [explain],
  )

  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-24" />
          <SkeletonCard className="mt-4 h-64" />
        </PageContainer>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="知识点加载失败" message={error ?? '该知识点可能已下架。'} onRetry={reload} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={data.name}
          description={`${DIFFICULTY_NAMES[data.difficulty] ?? data.difficulty} · ${data.questionCount} 题 · 已练习 ${data.attemptCount} 次`}
          actions={
            <>
              <MasteryBadge mastery={data.mastery} mastered={data.mastered} />
              <Link
                href={`${ROUTES.grammar}/${data.id}/exercise`}
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                data-testid="goto-exercise"
              >
                开始练习
              </Link>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-4">
              <TopicDetail topic={data} onExplain={(p) => void onExplain(p)} explainingPoint={explainingPoint} />
            </section>

            {/* 验收 3：Mock 时静态兜底，区块完整 */}
            <ExplainPanel result={explainResult} loading={explaining} />

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">易错对照</h2>
              {data.errorExamples.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">暂无易错对照</p>
              ) : (
                <div className="space-y-2">
                  {data.errorExamples.map((e, i) => (
                    <ErrorExample key={i} example={e} index={i} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-3">
            <h2 className="text-sm font-semibold">例句</h2>
            {data.examples.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">暂无例句</p>
            ) : (
              <div className="space-y-2">
                {data.examples.map((e, i) => (
                  <ExampleCard key={i} example={e} index={i} />
                ))}
              </div>
            )}
          </aside>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href={ROUTES.grammar} className="text-primary underline-offset-4 hover:underline">
            ← 返回语法目录
          </Link>
        </p>
      </PageContainer>
    </AppShell>
  )
}
