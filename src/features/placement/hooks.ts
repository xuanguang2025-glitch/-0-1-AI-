'use client'

/**
 * use-placement-test：测试流程状态机（intro → answering → submitting → done）。
 * 单题作答即 POST /answer（断线可恢复）；全答完才可交卷。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { placementApi, type PlacementQuestion } from './api'

export type PlacementPhase = 'intro' | 'loading' | 'answering' | 'submitting' | 'done'

export function usePlacementTest(onDone: (testId: string) => void) {
  const [phase, setPhase] = useState<PlacementPhase>('intro')
  const [testId, setTestId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<PlacementQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const startedAtRef = useRef<number>(Date.now())

  const start = useCallback(async (): Promise<void> => {
    setPhase('loading')
    setError(null)
    try {
      const { testId: id } = await placementApi.start()
      const qs = await placementApi.questions(id)
      setTestId(id)
      setQuestions(qs)
      setPhase('answering')
      startedAtRef.current = Date.now()
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始测试失败')
      setPhase('intro')
    }
  }, [])

  /** 选择答案：本地记录 + 异步上报（失败不阻塞，交卷时服务端有则算） */
  const pick = useCallback(
    (questionId: string, option: string): void => {
      setAnswers((prev) => (prev[questionId] === option ? prev : { ...prev, [questionId]: option }))
      const responseMs = Date.now() - startedAtRef.current
      startedAtRef.current = Date.now()
      if (testId) {
        void placementApi
          .answer(testId, { questionId, userAnswer: option, responseMs })
          .catch(() => undefined)
      }
      // 自动前进
      setCurrent(() => {
        const idx = questions.findIndex((q) => q.id === questionId)
        return Math.min(questions.length - 1, Math.max(idx, 0) + 1)
      })
    },
    [testId, questions],
  )

  const jumpTo = useCallback((index: number): void => {
    setCurrent(Math.max(0, Math.min(index, questions.length - 1)))
  }, [questions.length])

  const answeredCount = Object.keys(answers).length
  const allAnswered = questions.length > 0 && answeredCount >= questions.length

  const submit = useCallback(async (): Promise<void> => {
    if (!testId) return
    setPhase('submitting')
    setError(null)
    try {
      const result = await placementApi.submit(testId)
      setPhase('done')
      onDone(result.testId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
      setPhase('answering')
    }
  }, [testId, onDone])

  // 未完成测试恢复（刷新页面后 intro 顶部提示，Phase 1 简化：重新 start 即恢复同一 testId）
  useEffect(() => {
    return () => {
      /* 卸载时不做中止（answer 为幂等 upsert） */
    }
  }, [])

  return {
    phase, testId, questions, answers, current, error,
    answeredCount, allAnswered,
    start, pick, jumpTo, submit,
  }
}
