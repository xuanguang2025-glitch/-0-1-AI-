'use client'

/**
 * /grammar/[id]/exercise — 语法练习页（G3 取题 + G4 提交，T16 验收 2/4/5）。
 *
 * 流程：取题（**不含答案**）→ 作答 → 服务端判分 → 报告视图
 * （逐题解析 + 掌握度变化 + 错题本新增数）。
 */
import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { ExerciseRunner } from '@/features/grammar/components/exercise-runner'
import { MasteryBadge } from '@/features/grammar/components/mastery-badge'
import { useGrammarExercises, useGrammarTopic, useSubmitGrammar } from '@/features/grammar/hooks'
import type { GrammarSubmitResult } from '@/features/grammar/types'
import { ROUTES } from '@/lib/constants/routes'

const QUESTION_COUNT = 5

export default function GrammarExercisePage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const topicId = params.id

  const topic = useGrammarTopic(topicId)
  const exercises = useGrammarExercises(topicId, QUESTION_COUNT)
  const { submit, submitting, error: submitError } = useSubmitGrammar(topicId)
  const [result, setResult] = useState<GrammarSubmitResult | null>(null)
  const startedAtRef = useState(() => Date.now())[0]

  const onSubmit = useCallback(
    async (answers: Array<{ questionId: string; userAnswer: string }>) => {
      const r = await submit(answers, Math.max(1, Math.round((Date.now() - startedAtRef) / 1000)))
      if (r) {
        setResult(r)
        // 掌握度已变 → 刷新主题详情，让徽章同步（验收 4）
        topic.reload()
      }
    },
    [submit, startedAtRef, topic],
  )

  // ---- 三态 ----
  if (exercises.loading || topic.loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-20" />
          <SkeletonCard className="mt-4 h-64" />
        </PageContainer>
      </AppShell>
    )
  }

  if (exercises.error || !exercises.data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState
            title="题目加载失败"
            message={exercises.error ?? '该知识点可能已下架。'}
            onRetry={exercises.reload}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const topicName = topic.data?.name ?? exercises.data.topicName

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={`练习 · ${topicName}`}
          description="判分在服务端完成；错题自动进入错题本，掌握度按累计正确率更新"
          actions={
            <>
              <MasteryBadge mastery={topic.data?.mastery ?? null} mastered={topic.data?.mastered ?? false} />
              <Link
                href={`${ROUTES.grammar}/${topicId}`}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
              >
                返回知识点
              </Link>
            </>
          }
        />

        {submitError ? <p className="mb-3 text-xs text-destructive">{submitError}</p> : null}

        {result ? (
          <div className="space-y-4" data-testid="exercise-result">
            {/* 概览 */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <div>
                <p className="text-xs text-muted-foreground">本次正确率</p>
                <p className="text-2xl font-semibold tabular-nums" data-testid="exercise-accuracy">
                  {result.accuracy}%
                </p>
              </div>
              <Badge variant={result.accuracy >= 85 ? 'success' : result.accuracy >= 60 ? 'warning' : 'destructive'}>
                {result.accuracy >= 85 ? '优秀' : result.accuracy >= 60 ? '良好' : '待加强'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                答对 {result.correctCount} / {result.total}
              </span>
              <span className="text-xs text-muted-foreground" data-testid="exercise-wrong-count">
                错题本 +{result.wrongCount}
              </span>
              {/* 验收 4：掌握度徽章随练习结果变化 */}
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">掌握度</span>
                <MasteryBadge mastery={result.mastery} mastered={result.mastered} />
                <span className="text-[10px] text-muted-foreground">累计 {result.attemptCount} 题</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setResult(null)
                  exercises.reload()
                }}
                data-testid="exercise-retry"
              >
                再练一轮
              </Button>
            </div>

            {/* 逐题解析 */}
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold">逐题解析</h3>
              <ul className="space-y-2">
                {result.answers.map((a, i) => (
                  <li key={a.questionId} className="rounded-lg bg-surface-muted p-3" data-testid={`exercise-answer-${i}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={a.isCorrect ? 'text-success' : 'text-destructive'}>{a.isCorrect ? '✓' : '✗'}</span>
                      <span className="text-muted-foreground">你的答案：</span>
                      <span className="font-medium">{a.userAnswer || '（空）'}</span>
                      {!a.isCorrect ? (
                        <>
                          <span className="text-muted-foreground">正确答案：</span>
                          <span className="font-medium text-success">{a.correctAnswer}</span>
                        </>
                      ) : null}
                    </div>
                    {a.explanation ? (
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">{a.explanation}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <ExerciseRunner
            questions={exercises.data.questions}
            submitting={submitting}
            onSubmit={(a) => void onSubmit(a)}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
