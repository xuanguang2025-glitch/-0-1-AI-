'use client'

/**
 * /writing — 写作任务列表（W1/W2，T17）。
 *
 * 上半：任务卡片（题目要求 + 字数要求 + 我的提交数）；
 * 下半：我的作文记录（规则分 / AI 分 / scoreSource 徽章）。
 */
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { useCreateWriting, useWritingSubmissions, useWritingTasks } from '@/features/writing/hooks'
import { DIFFICULTY_NAMES, type WritingTaskListItem } from '@/features/writing/types'
import { ROUTES } from '@/lib/constants/routes'

function NewDraftCard({ onCreate, creating, error }: { onCreate: (taskId: string) => void; creating: boolean; error: string | null }): React.JSX.Element {
  const { data, loading, error: tasksError, reload } = useWritingTasks()
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <section data-testid="writing-tasks">
      <h2 className="mb-3 text-lg font-semibold">写作任务</h2>
      {tasksError ? <ErrorState title="任务加载失败" message={tasksError} onRetry={reload} /> : null}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} className="h-44" />
          ))}
        </div>
      ) : (data?.tasks.length ?? 0) === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
          暂无写作任务，请先执行 seed。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.tasks ?? []).map((t: WritingTaskListItem) => {
            const active = selected === t.id
            return (
              <Card key={t.id} className={active ? 'border-primary p-4' : 'p-4'} data-testid={`writing-task-${t.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug">{t.title}</h3>
                  <Badge variant="outline">{DIFFICULTY_NAMES[t.difficulty] ?? t.difficulty}</Badge>
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-muted-foreground">{t.prompt}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{t.taskType}</span>
                  {t.wordMin !== null ? <span>· ≥ {t.wordMin} 词</span> : null}
                  {t.wordMax !== null ? <span>· ≤ {t.wordMax} 词</span> : null}
                  {t.mySubmissionCount > 0 ? <span>· 已写 {t.mySubmissionCount} 篇</span> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={creating}
                  onClick={() => {
                    setSelected(t.id)
                    onCreate(t.id)
                  }}
                  data-testid={`writing-start-${t.id}`}
                >
                  {creating && active ? '创建中…' : '开始写作'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}
      {error !== null ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  )
}

export default function WritingListPage(): React.JSX.Element {
  const router = useRouter()
  const { create, submitting, error } = useCreateWriting()
  const submissions = useWritingSubmissions()

  /** 新建即进入编辑器：先建一篇占位稿拿 id（服务端拒绝空内容，故用真实占位句，
      用户在编辑页覆盖它，autosave 会立即以新内容落库） */
  const onStart = useCallback(
    (taskId: string) => {
      void (async () => {
        const r = await create({ taskId, content: 'Draft started. Replace this with your essay.' })
        if (r) router.push(`${ROUTES.writing}/${r.id}`)
      })()
    },
    [create, router],
  )

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="写作训练" description="规则检查实时提示 · AI 批改双轨评分 · 自动保存" />

        <NewDraftCard onCreate={(id) => onStart(id)} creating={submitting} error={error} />

        <section className="mt-8" data-testid="writing-submissions">
          <h2 className="mb-3 text-lg font-semibold">我的作文</h2>
          {submissions.loading ? (
            <SkeletonCard className="h-32" />
          ) : submissions.error ? (
            <ErrorState title="记录加载失败" message={submissions.error} onRetry={submissions.reload} />
          ) : (submissions.data?.submissions.length ?? 0) === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
              还没有作文记录，从上面选一个任务开始吧。
            </p>
          ) : (
            <ul className="space-y-2">
              {(submissions.data?.submissions ?? []).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`${ROUTES.writing}/${s.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
                    data-testid={`writing-record-${s.id}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title ?? s.taskTitle}</span>
                    <Badge variant={s.scoreSource === 'ai' ? 'success' : 'warning'}>
                      {s.scoreSource === 'ai' ? 'AI 评分' : '规则评分'}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">
                      {s.scoreSource === 'ai' ? (s.aiTotalScore ?? s.ruleCheckScore ?? '-') : (s.ruleCheckScore ?? '-')}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.wordCount} 词</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>
    </AppShell>
  )
}
