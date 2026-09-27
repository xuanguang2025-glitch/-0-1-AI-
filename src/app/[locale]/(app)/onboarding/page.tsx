'use client'

/**
 * Onboarding 8 步主页面：单屏单步 + localStorage 暂存防丢 + 跳过/完成。
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { Stepper } from '@/features/onboarding/components/stepper'
import { StepGoal, StepLevel, StepTime, StepDays, StepExam, StepDate, StepWeakest, StepStyle, Summary } from '@/features/onboarding/components/steps'
import { useOnboardingDraft, clearLocalDraft } from '@/features/onboarding/hooks'
import { onboardingApi } from '@/features/onboarding/api'
import { onboardingStepsSchema, type OnboardingDraft } from '@/features/onboarding/schemas'
import { ApiClientError } from '@/features/auth/api'
import { ROUTES } from '@/lib/constants/routes'

const STEP_KEYS = [
  'goal', 'level', 'dailyTime', 'weeklyDays', 'targetExam', 'targetDate', 'weakest', 'style',
] as const
type StepKey = (typeof STEP_KEYS)[number]

const STEP_META: Record<StepKey, { title: string; hint: string }> = {
  goal: { title: '你为什么学英语？', hint: '我们会据此调整内容侧重' },
  level: { title: '你觉得自己现在的水平？', hint: '之后还有 5 分钟 AI 测试帮你精准定位' },
  dailyTime: { title: '每天能学多久？', hint: '任务量会按此生成，宁可少而持续' },
  weeklyDays: { title: '每周能坚持几天？', hint: '节奏感比强度更重要' },
  targetExam: { title: '有目标考试吗？', hint: '可跳过' },
  targetDate: { title: '考试日期？', hint: '用于倒计时与冲刺排期，可跳过' },
  weakest: { title: '哪些方面最想提升？', hint: '优先安排练习' },
  style: { title: '喜欢哪种记忆方式？', hint: '影响单词呈现形式' },
}

export default function OnboardingPage(): React.JSX.Element {
  const t = useTranslations('common')
  const router = useRouter()
  const { draft, update, reset } = useOnboardingDraft()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const stepKey: StepKey = STEP_KEYS[step] ?? 'goal'
  const isSummary = step === STEP_KEYS.length

  const stepValid = (key: StepKey, d: OnboardingDraft): boolean => {
    const check = onboardingStepsSchema.pick({ [key]: true } as never).safeParse({ [key]: d[key] })
    return check.success
  }

  const goNext = (): void => {
    if (!isSummary && !stepValid(stepKey, draft)) {
      setError('这一步还没有完成或选择无效')
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, STEP_KEYS.length))
  }

  const goBack = (): void => {
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }

  const finish = async (skipped: boolean): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const parsed = onboardingStepsSchema.parse(draft)
      await onboardingApi.submit(parsed, skipped)
      clearLocalDraft()
      reset()
      // Phase 1：跳 Dashboard（T07 后携带 planId 跳报告/计划）
      router.push(ROUTES.dashboard)
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : t('errorTitle'))
    } finally {
      setLoading(false)
    }
  }

  const renderStep = (): React.JSX.Element | null => {
    switch (stepKey) {
      case 'goal': return <StepGoal draft={draft} update={update} />
      case 'level': return <StepLevel draft={draft} update={update} />
      case 'dailyTime': return <StepTime draft={draft} update={update} />
      case 'weeklyDays': return <StepDays draft={draft} update={update} />
      case 'targetExam': return <StepExam draft={draft} update={update} />
      case 'targetDate': return <StepDate draft={draft} update={update} />
      case 'weakest': return <StepWeakest draft={draft} update={update} />
      case 'style': return <StepStyle draft={draft} update={update} />
    }
  }

  return (
    <AppShell>
      <PageContainer narrow>
        <Stepper total={STEP_KEYS.length + 1} current={step} onJump={setStep} />

        <div className="mt-8">
          {!isSummary ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight">{STEP_META[stepKey]?.title}</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">{STEP_META[stepKey]?.hint}</p>
              {renderStep()}
            </>
          ) : (
            <Summary draft={draft} />
          )}
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4" title={error} />
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={goBack} disabled={step === 0 || loading}>
            {t('cancel') === '取消' ? '上一步' : 'Back'}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void finish(true)} disabled={loading}>
              跳过
            </Button>
            {isSummary ? (
              <Button onClick={() => void finish(false)} disabled={loading}>
                {loading ? '生成中…' : '完成，生成我的计划'}
              </Button>
            ) : (
              <Button onClick={goNext}>下一步</Button>
            )}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}
