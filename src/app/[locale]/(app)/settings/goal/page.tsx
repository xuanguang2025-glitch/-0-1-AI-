'use client'

/**
 * /settings/goal — 学习目标：每日学习时长 + 目标考试 CRUD。
 */
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ApiClientError } from '@/features/auth/api'
import { userApi, type GoalCreateInput } from '@/features/user/api'
import type { LearningGoalDto } from '@/types/dto/user.dto'

const GOAL_LABEL: Record<string, string> = {
  CET4: '四级',
  CET6: '六级',
  KAOYAN: '考研',
  IELTS: '雅思',
  TOEFL: '托福',
  DAILY: '日常提升',
  BUSINESS: '商务英语',
  INTEREST: '兴趣学习',
  ABROAD: '出国留学',
}

export default function GoalSettingsPage(): React.JSX.Element {
  const [goals, setGoals] = useState<LearningGoalDto[]>([])
  const [minutes, setMinutes] = useState('30')
  const [type, setType] = useState<GoalCreateInput['type']>('CET4')
  const [targetDate, setTargetDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([userApi.listGoals(), userApi.getProfile()])
      .then(([g, p]) => {
        if (cancelled) return
        setGoals(g.goals)
        setMinutes(String(p.dailyGoalMinutes ?? 30))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiClientError ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const saveMinutes = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await userApi.updateSettings({ dailyGoalMinutes: Math.max(5, Math.min(480, Number(minutes) || 30)) })
      setMessage('每日目标已更新')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const createGoal = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const goal = await userApi.createGoal({
        type,
        targetDate: targetDate || null,
      })
      setGoals((prev) => [...prev, goal])
      setTargetDate('')
      setMessage('目标已创建')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const close = async (goal: LearningGoalDto, status: 'ACHIEVED' | 'ABANDONED'): Promise<void> => {
    try {
      await userApi.closeGoal(goal.id, status)
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status } : g)))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '操作失败')
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">每日学习目标</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="minutes">每日目标（分钟，5-480）</Label>
              <Input id="minutes" type="number" min={5} max={480} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
            <Button onClick={() => void saveMinutes()} disabled={saving}>
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">目标考试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-type">目标类型</Label>
              <select
                id="goal-type"
                value={type}
                onChange={(e) => setType(e.target.value as GoalCreateInput['type'])}
                className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              >
                {Object.entries(GOAL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">目标日期（选填）</Label>
              <Input id="goal-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <Button onClick={() => void createGoal()} disabled={saving}>
              添加目标
            </Button>
          </div>

          {loading ? <SkeletonList rows={2} /> : null}

          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                <span className="font-medium">{GOAL_LABEL[g.type] ?? g.type}</span>
                {g.targetDate ? <span className="text-muted-foreground">目标 {g.targetDate}</span> : null}
                <Badge variant={g.status === 'ACTIVE' ? 'default' : g.status === 'ACHIEVED' ? 'success' : 'secondary'}>
                  {g.status === 'ACTIVE' ? '进行中' : g.status === 'ACHIEVED' ? '已达成' : '已放弃'}
                </Badge>
                <span className="flex-1" />
                {g.status === 'ACTIVE' ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => void close(g, 'ACHIEVED')}>
                      达成
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void close(g, 'ABANDONED')}>
                      放弃
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
