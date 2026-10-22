'use client'

/**
 * /exam/practice/[attemptId] — 专项卷作答页（验收 2：答题 → 自动保存 → 交卷幂等）。
 * URL 以 attemptId 为准（attempt 与 paper 1:1 携带 title）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import {
  AnswerSheet,
  ExamAutosaveIndicator,
  ExamHeader,
  SubmitDialog,
} from '@/features/exam/components/exam-parts'
import { examApi } from '@/features/exam/api'
import type { ExamStartResult } from '@/features/exam/types'
import { ROUTES } from '@/lib/constants/routes'

export default function ExamPracticePage(): React.JSX.Element {
  const params = useParams<{ attemptId: string }>()
  const attemptId = params.attemptId
  const router = useRouter()

  const [data, setData] = useState<ExamStartResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** 本地作答状态：questionId → 选中的选项字母 */
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const pendingRef = useRef<{ examQuestionId: string; userAnswer: string } | null>(null)
  const inflightRef = useRef(false)
  const startedAtRef = useRef(Date.now())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    // attemptId 作 URL 主键；start 接口按 paperId 建新 attempt——这里通过
    // attemptId 无法直接反查 paper，因此 practice 页从 sessionStorage 取 start 结果
    const cached = sessionStorage.getItem(`exam-attempt-${attemptId}`)
    if (cached !== null) {
      try {
        setData(JSON.parse(cached) as ExamStartResult)
      } catch {
        setError('作答状态丢失，请重新开始')
      }
    } else {
      setError('作答状态丢失，请从试卷列表重新开始')
    }
    setLoading(false)
  }, [attemptId])

  const questions = useMemo(() => data?.questions ?? [], [data])
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])

  /** 自动保存（防抖 3s + 串行化，与写作同构） */
  const flush = useCallback(async (): Promise<void> => {
    if (inflightRef.current) return
    const payload = pendingRef.current
    if (payload === null || data === null) return
    pendingRef.current = null
    inflightRef.current = true
    setSaving(true)
    try {
      await examApi.saveAnswer(data.paperId, attemptId, payload)
      setSaved(true)
    } catch {
      setSaved(false)
    } finally {
      inflightRef.current = false
      setSaving(false)
      if (pendingRef.current !== null) void flush()
    }
  }, [data, attemptId])

  const schedule = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPick = useCallback(
    (examQuestionId: string, userAnswer: string) => {
      setAnswers((prev) => ({ ...prev, [examQuestionId]: userAnswer }))
      pendingRef.current = { examQuestionId, userAnswer }
      setSaved(false)
      if (schedule.current !== null) clearTimeout(schedule.current)
      schedule.current = setTimeout(() => void flush(), 3000) // 验收 2：自动保存 ≤3s 防抖
    },
    [flush],
  )

  const onSubmit = useCallback(async () => {
    if (data === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const answersPayload = questions.map((q) => ({ examQuestionId: q.id, userAnswer: answers[q.id] ?? '' }))
      await examApi.submit(data.paperId, attemptId, {
        answers: answersPayload,
        timeUsedSec: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      })
      sessionStorage.removeItem(`exam-attempt-${attemptId}`)
      router.push(`${ROUTES.exam}/report/${attemptId}`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '交卷失败')
      setSubmitting(false)
    }
  }, [data, questions, answers, attemptId, router])

  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-24" />
        </PageContainer>
      </AppShell>
    )
  }

  if (error !== null || data === null) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="作答状态丢失" message={error ?? '未知错误'} />
        </PageContainer>
      </AppShell>
    )
  }

  const scrollToQuestion = (index: number): void => {
    document.getElementById(`question-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="专项练习"
          actions={
            <>
              <ExamAutosaveIndicator saving={saving} saved={saved} />
              <Button type="button" onClick={() => setDialogOpen(true)} data-testid="open-submit-dialog">
                交卷
              </Button>
            </>
          }
        />

        <ExamHeader title={data.title} durationMin={data.durationMin} questionCount={questions.length} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            {questions.map((q, i) => (
              <fieldset key={q.id} id={`question-${i + 1}`} className="rounded-xl border border-border bg-surface p-4 scroll-mt-20">
                <legend className="px-1 text-sm font-medium">
                  <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                  {q.stem}
                </legend>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {(q.options ?? []).map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi)
                    return (
                      <label
                        key={letter}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={letter}
                          checked={answers[q.id] === letter}
                          onChange={() => onPick(q.id, letter)}
                          className="accent-[hsl(var(--primary))]"
                          data-testid={`exam-q${i + 1}-${letter}`}
                        />
                        <span className="font-medium text-muted-foreground">{letter}.</span>
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <AnswerSheet total={questions.length} answered={answeredCount} onJump={scrollToQuestion} />
            <Button type="button" className="w-full" onClick={() => setDialogOpen(true)} data-testid="open-submit-dialog-2">
              交卷并查看报告
            </Button>
          </aside>
        </div>

        <SubmitDialog
          open={dialogOpen}
          answered={answeredCount}
          total={questions.length}
          submitting={submitting}
          onConfirm={() => void onSubmit()}
          onCancel={() => setDialogOpen(false)}
        />
        {submitError !== null ? <p className="mt-3 text-xs text-destructive">{submitError}</p> : null}
      </PageContainer>
    </AppShell>
  )
}
