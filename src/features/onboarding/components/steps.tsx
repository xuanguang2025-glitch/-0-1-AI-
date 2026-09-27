'use client'

/**
 * Onboarding 步骤组件（选项卡单选/多选，统一 OptionGrid 内核）。
 * 拆分文件按文档命名，此处导出 8 个步骤组件 + Summary。
 */
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { onboardingStepsSchema, type OnboardingDraft } from '../schemas'
import { cn } from '@/lib/utils/cn'

// ---------- 内核 ----------

interface Option<T extends string | number> {
  value: T
  label: string
  hint?: string
}

function OptionGrid<T extends string | number>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: ReadonlyArray<Option<T>>
  value: T | T[] | null
  onChange: (v: T) => void
  multi?: boolean
}): React.JSX.Element {
  const selected = (v: T): boolean => (multi ? Array.isArray(value) && value.includes(v) : value === v)
  return (
    <div className={cn('grid gap-3', multi ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={selected(o.value)}
          className={cn(
            'rounded-xl border p-4 text-left transition-all',
            selected(o.value)
              ? 'border-primary bg-primary/10 ring-1 ring-primary'
              : 'border-border bg-surface hover:border-primary/40',
          )}
        >
          <div className="text-sm font-medium">{o.label}</div>
          {o.hint ? <div className="mt-1 text-xs text-muted-foreground">{o.hint}</div> : null}
        </button>
      ))}
    </div>
  )
}

// ---------- Step 1: goal ----------

const GOALS = [
  { value: 'exam', label: '备考过级', hint: 'CET-4/6、考研等' },
  { value: 'abroad', label: '出国留学', hint: '雅思、托福' },
  { value: 'work', label: '职场需要', hint: '邮件、会议、商务' },
  { value: 'daily', label: '日常提升', hint: '看剧、阅读无障碍' },
  { value: 'interest', label: '纯粹兴趣', hint: '喜欢英语本身' },
] as const

export function StepGoal({ draft, update }: { draft: OnboardingDraft; update: (k: 'goal', v: OnboardingDraft['goal']) => void }): React.JSX.Element {
  return <OptionGrid options={GOALS} value={draft.goal} onChange={(v) => update('goal', v)} />
}

// ---------- Step 2: level ----------

const LEVELS = [
  { value: 'beginner', label: '零基础', hint: '认识少量单词' },
  { value: 'elementary', label: '初级', hint: '约初中水平' },
  { value: 'intermediate', label: '中级', hint: '约高中-四级之间' },
  { value: 'upper', label: '中高级', hint: '已过四级' },
  { value: 'advanced', label: '高级', hint: '已过六级' },
] as const

export function StepLevel({ draft, update }: { draft: OnboardingDraft; update: (k: 'level', v: OnboardingDraft['level']) => void }): React.JSX.Element {
  return <OptionGrid options={LEVELS} value={draft.level} onChange={(v) => update('level', v)} />
}

// ---------- Step 3: dailyTime ----------

const TIMES = [
  { value: 15, label: '15 分钟', hint: '碎片时间' },
  { value: 30, label: '30 分钟', hint: '适度坚持' },
  { value: 60, label: '1 小时', hint: '认真备考' },
  { value: 90, label: '90 分钟+', hint: '冲刺模式' },
] as const

export function StepTime({ draft, update }: { draft: OnboardingDraft; update: (k: 'dailyTime', v: OnboardingDraft['dailyTime']) => void }): React.JSX.Element {
  return <OptionGrid options={TIMES} value={draft.dailyTime} onChange={(v) => update('dailyTime', v)} />
}

// ---------- Step 4: weeklyDays ----------

export function StepDays({ draft, update }: { draft: OnboardingDraft; update: (k: 'weeklyDays', v: OnboardingDraft['weeklyDays']) => void }): React.JSX.Element {
  const options = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    value: d,
    label: `${d} 天/周`,
    hint: d >= 6 ? '高强度' : d >= 4 ? '推荐' : d <= 2 ? '轻度' : undefined,
  }))
  return <OptionGrid options={options} value={draft.weeklyDays} onChange={(v) => update('weeklyDays', v)} />
}

// ---------- Step 5: targetExam ----------

const EXAMS = [
  { value: 'CET4' as const, label: 'CET-4 四级' },
  { value: 'CET6' as const, label: 'CET-6 六级' },
  { value: 'KAOYAN' as const, label: '考研英语' },
  { value: 'IELTS' as const, label: '雅思 IELTS' },
  { value: 'TOEFL' as const, label: '托福 TOEFL' },
] as const

export function StepExam({ draft, update }: { draft: OnboardingDraft; update: (k: 'targetExam', v: OnboardingDraft['targetExam']) => void }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <OptionGrid options={EXAMS} value={draft.targetExam} onChange={(v) => update('targetExam', v)} />
      <button
        type="button"
        onClick={() => update('targetExam', null)}
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        没有特定目标考试，跳过
      </button>
    </div>
  )
}

// ---------- Step 6: targetDate ----------

export function StepDate({ draft, update }: { draft: OnboardingDraft; update: (k: 'targetDate', v: OnboardingDraft['targetDate']) => void }): React.JSX.Element {
  const [text, setText] = useState(draft.targetDate ?? '')
  const [error, setError] = useState<string | null>(null)

  const apply = (): void => {
    if (!text) {
      update('targetDate', null)
      setError(null)
      return
    }
    const parsed = onboardingStepsSchema.pick({ targetDate: true }).safeParse({ targetDate: text })
    if (parsed.success) {
      update('targetDate', text)
      setError(null)
    } else {
      setError('请输入有效日期，格式 YYYY-MM-DD')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">什么时候考试？（可跳过，用于倒计时与计划排期）</p>
      <div className="flex gap-2">
        <Input
          type="date"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          className="max-w-xs"
          aria-label="目标日期"
        />
        <Button variant="outline" onClick={apply}>
          确认
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

// ---------- Step 7: weakest（多选） ----------

const WEAK = [
  { value: 'vocabulary' as const, label: '词汇量' },
  { value: 'listening' as const, label: '听力' },
  { value: 'speaking' as const, label: '口语' },
  { value: 'reading' as const, label: '阅读' },
  { value: 'writing' as const, label: '写作' },
  { value: 'grammar' as const, label: '语法' },
] as const

export function StepWeakest({ draft, update }: { draft: OnboardingDraft; update: (k: 'weakest', v: OnboardingDraft['weakest']) => void }): React.JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">可多选，将优先安排练习</p>
      <OptionGrid multi options={WEAK} value={draft.weakest} onChange={(v) => {
        const next = draft.weakest.includes(v)
          ? draft.weakest.filter((w) => w !== v)
          : [...draft.weakest, v]
        update('weakest', next)
      }} />
    </div>
  )
}

// ---------- Step 8: style ----------

const STYLES = [
  { value: 'scenario', label: '情景记忆', hint: '短故事 + 场景例句' },
  { value: 'reading', label: '阅读记忆', hint: '文章精读中学词' },
  { value: 'video', label: '视频记忆', hint: '影视片段跟学' },
  { value: 'audio', label: '听力记忆', hint: '磨耳朵 + 精听' },
] as const

export function StepStyle({ draft, update }: { draft: OnboardingDraft; update: (k: 'style', v: OnboardingDraft['style']) => void }): React.JSX.Element {
  return <OptionGrid options={STYLES} value={draft.style} onChange={(v) => update('style', v)} />
}

// ---------- Summary ----------

const GOAL_LABEL: Record<string, string> = {
  exam: '备考过级', abroad: '出国留学', work: '职场需要', daily: '日常提升', interest: '纯粹兴趣',
}
const LEVEL_LABEL: Record<string, string> = {
  beginner: '零基础', elementary: '初级', intermediate: '中级', upper: '中高级', advanced: '高级',
}
const EXAM_LABEL: Record<string, string> = {
  CET4: 'CET-4', CET6: 'CET-6', KAOYAN: '考研', IELTS: '雅思', TOEFL: '托福',
}
const STYLE_LABEL: Record<string, string> = {
  scenario: '情景记忆', reading: '阅读记忆', video: '视频记忆', audio: '听力记忆',
}
const WEAK_LABEL: Record<string, string> = {
  vocabulary: '词汇', listening: '听力', speaking: '口语', reading: '阅读', writing: '写作', grammar: '语法',
}

export function Summary({ draft }: { draft: OnboardingDraft }): React.JSX.Element {
  const rows: Array<[string, string]> = [
    ['学习目标', GOAL_LABEL[draft.goal] ?? draft.goal],
    ['当前水平', LEVEL_LABEL[draft.level] ?? draft.level],
    ['每日时长', `${draft.dailyTime} 分钟`],
    ['每周频率', `${draft.weeklyDays} 天`],
    ['目标考试', draft.targetExam ? EXAM_LABEL[draft.targetExam] ?? draft.targetExam : '不限'],
    ['目标日期', draft.targetDate ?? '不限'],
    ['薄弱项', draft.weakest.length > 0 ? draft.weakest.map((w) => WEAK_LABEL[w] ?? w).join('、') : '无'],
    ['记忆偏好', STYLE_LABEL[draft.style] ?? draft.style],
  ]
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold">确认你的学习画像</h3>
      <dl className="mt-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
