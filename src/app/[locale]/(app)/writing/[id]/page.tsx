'use client'

/**
 * /writing/[id] — 作文编辑页（T17 验收 3/6/7）。
 *
 * 流程：创建后进入 → 边写边出规则提示（同步）+ 自动保存（防抖 2.5s）
 *       → 「请求 AI 批改」→ 跳转报告页。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { AutosaveIndicator } from '@/features/writing/components/autosave-indicator'
import { InlineCheckPanel } from '@/features/writing/components/inline-check-panel'
import { WordCounter } from '@/features/writing/components/word-counter'
import { WritingEditor } from '@/features/writing/components/writing-editor'
import { useWritingAnalyze, useWritingAutosave, useWritingDetail } from '@/features/writing/hooks'
import { ROUTES } from '@/lib/constants/routes'

export default function WritingEditorPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const submissionId = params.id
  const router = useRouter()

  const { data, loading, error, reload } = useWritingDetail(submissionId)
  const { schedule, flush, saving, savedAt, saveError, ruleCheck: savedRuleCheck } = useWritingAutosave(submissionId)
  const { analyze, loading: analyzing, error: analyzeError } = useWritingAnalyze()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const initializedRef = useRef(false)

  // 详情到位后初始化本地状态（只一次；之后是用户输入）
  useEffect(() => {
    if (!data || initializedRef.current) return
    initializedRef.current = true
    setTitle(data.title ?? '')
    setContent(data.content.trim().length > 0 ? data.content : '')
  }, [data])

  // 规则面板数据源：**最新一次保存**的检查结果优先（QA 第八轮 P2——
  // 详情只加载一次，若不回填，面板永远显示创建时快照，「边写边出提示」断链）
  const ruleCheck = savedRuleCheck ?? data?.ruleCheck ?? null
  const required = useMemo(() => data?.requiredWords ?? { min: 0, max: 0 }, [data])

  /** 字数：与服务端同口径（去标点只留含字母词） */
  const wordCount = useMemo(
    () => content.split(/\s+/).map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '')).filter((w) => /[A-Za-z]/.test(w)).length,
    [content],
  )

  const onContentChange = useCallback(
    (v: string) => {
      setContent(v)
      schedule({ content: v })
    },
    [schedule],
  )

  const onTitleChange = useCallback(
    (v: string) => {
      setTitle(v)
      schedule({ title: v })
    },
    [schedule],
  )

  const onAnalyze = useCallback(async () => {
    // 先把防抖中的最新内容立即落库，再请求批改（否则批改的是旧稿）
    await flush()
    const r = await analyze(submissionId)
    if (r) router.push(`${ROUTES.writing}/${submissionId}/report`)
  }, [flush, analyze, submissionId, router])

  // ---- 三态 ----
  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-20" />
          <SkeletonCard className="mt-4 h-96" />
        </PageContainer>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="作文加载失败" message={error ?? '该作文可能已删除。'} onRetry={reload} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={data.taskTitle}
          description={`${data.status === 'DRAFT' ? '草稿' : data.status} · 第 ${data.revision} 轮批改`}
          actions={
            <>
              <AutosaveIndicator saving={saving} savedAt={savedAt} error={saveError} />
              <Button
                type="button"
                onClick={() => void onAnalyze()}
                disabled={analyzing || wordCount < 10}
                title={wordCount < 10 ? '至少写 10 个词再请求批改' : undefined}
                data-testid="request-analyze"
              >
                {analyzing ? '批改中…' : '请求 AI 批改'}
              </Button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-3">
            <WritingEditor
              content={content}
              title={title}
              prompt={data.prompt}
              onContentChange={onContentChange}
              onTitleChange={onTitleChange}
            />
            <WordCounter wordCount={wordCount} required={required} />
            {analyzeError !== null ? <p className="text-xs text-destructive">{analyzeError}</p> : null}
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <InlineCheckPanel check={ruleCheck} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">使用说明</p>
              <p>· 规则检查随输入实时更新（本地算法，不调用 AI）</p>
              <p>· 每次输入 2.5 秒后自动保存，刷新不丢稿</p>
              <p>· 「请求 AI 批改」后可在报告页看到评分与修改建议</p>
              <p className="mt-2">
                <Badge variant="outline">共 {data.revision} 轮批改</Badge>
              </p>
            </div>
          </aside>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href={ROUTES.writing} className="text-primary underline-offset-4 hover:underline">
            ← 返回写作任务
          </Link>
        </p>
      </PageContainer>
    </AppShell>
  )
}
