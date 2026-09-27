'use client'

// 与 services/placement.service 的 PLACEMENT_QUESTION_COUNT 保持一致（纯常量内联，避免服务端模块进 client bundle）
const QUESTION_COUNT = 30

/**
 * Placement 测试页：intro → 答题（答题卡 + 计时 + 自动前进）→ 交卷 → 跳报告。
 */
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { AnswerSheet, QuestionArea, SubmitBar, TestIntro, Timer, useElapsedSeconds } from '@/features/placement/components/test-runner'
import { usePlacementTest } from '@/features/placement/hooks'

export default function PlacementPage(): React.JSX.Element {
  const router = useRouter()
  const {
    phase, questions, answers, current, error,
    answeredCount, allAnswered,
    start, pick, jumpTo, submit,
  } = usePlacementTest((testId) => {
    router.push(`/placement/report/${testId}`)
  })
  const elapsed = useElapsedSeconds(phase === 'answering')

  return (
    <AppShell>
      <PageContainer>
        {phase === 'intro' || phase === 'loading' ? (
          <TestIntro
            questionCount={QUESTION_COUNT}
            onStart={() => void start()}
            loading={phase === 'loading'}
            error={error}
          />
        ) : null}

        {phase === 'answering' || phase === 'submitting' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">水平测试</h1>
              <Timer seconds={elapsed} />
            </div>
            <QuestionArea
              question={questions[current] ?? null}
              index={current}
              total={questions.length}
              selected={questions[current] ? answers[questions[current]!.id] : undefined}
              onSelect={pick}
            />
            <AnswerSheet total={questions.length} answered={answers} current={current} onJump={jumpTo} />
            <SubmitBar
              answeredCount={answeredCount}
              total={questions.length}
              allAnswered={allAnswered}
              submitting={phase === 'submitting'}
              onSubmit={() => void submit()}
            />
          </div>
        ) : null}

        {phase === 'done' ? (
          <p className="py-20 text-center text-muted-foreground">评分完成，正在跳转报告…</p>
        ) : null}
      </PageContainer>
    </AppShell>
  )
}
