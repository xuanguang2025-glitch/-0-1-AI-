'use client'

/**
 * /reading/[id] — 文章阅读页（T15 验收 1/2/4/5）。
 *
 * 组成：ArticleBody（正文+划词+段落高亮）+ HighlightPopover（词典释义浮层）
 *       + KeyWordRail（重点词）+ TranslationToggle（译文显隐）
 *       + SentenceAnalysis（长难句）+ ExplainPanel（AI 讲解，降级时隐藏）
 *       + QuizArea / QuizResult（阅读理解，判分在服务端）
 *
 * 断点续读：进入页面时按 `lastBlockIndex` 滚动到上次位置；滚动进度防抖 2s 上报。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { ArticleBody } from '@/features/reading/components/article-body'
import { ExplainPanel } from '@/features/reading/components/explain-panel'
import { HighlightPopover } from '@/features/reading/components/highlight-popover'
import { KeyWordRail } from '@/features/reading/components/key-word-rail'
import { QuizArea } from '@/features/reading/components/quiz-area'
import { QuizResult } from '@/features/reading/components/quiz-result'
import { SentenceAnalysis } from '@/features/reading/components/sentence-analysis'
import { TranslationToggle } from '@/features/reading/components/translation-toggle'
import {
  useArticleDetail,
  useExplain,
  useSaveReadingProgress,
  useSubmitQuiz,
  useWordLookup,
} from '@/features/reading/hooks'
import { DIFFICULTY_NAMES, type ReadingExplainResult, type ReadingQuizResult } from '@/features/reading/types'
import { ROUTES } from '@/lib/constants/routes'

export default function ReadingArticlePage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const articleId = params.id

  const { data, loading, error, reload } = useArticleDetail(articleId)
  const { submit, submitting, error: submitError } = useSubmitQuiz(articleId)
  const { explain, loading: explaining } = useExplain(articleId)
  const { save } = useSaveReadingProgress(articleId)
  const word = useWordLookup()

  const [highlightBlock, setHighlightBlock] = useState(-1)
  const [quizResult, setQuizResult] = useState<ReadingQuizResult | null>(null)
  const [explainResult, setExplainResult] = useState<ReadingExplainResult | null>(null)
  const [explainingSentence, setExplainingSentence] = useState<string | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [collected, setCollected] = useState<string[]>([])
  const startedAtRef = useRef<number>(Date.now())
  const scrolledRef = useRef(false)

  // 断点续读：详情到位后滚动到上次读到的段落（只做一次）
  useEffect(() => {
    if (!data || scrolledRef.current) return
    scrolledRef.current = true
    if (data.lastBlockIndex > 0) setHighlightBlock(data.lastBlockIndex)
  }, [data])

  const onScrollProgress = useCallback(
    (progress: number, blockIndex: number) => {
      const readSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      save(progress, blockIndex, readSeconds)
    },
    [save],
  )

  const onLocate = useCallback((blockIndex: number) => {
    setHighlightBlock(blockIndex)
    // 再点一次同一段也能重新触发高亮
    if (highlightBlock === blockIndex) {
      setHighlightBlock(-1)
      requestAnimationFrame(() => setHighlightBlock(blockIndex))
    }
  }, [highlightBlock])

  const onSelectWord = useCallback(
    (w: string) => {
      word.lookup(w)
    },
    [word],
  )

  const onSubmitQuiz = useCallback(
    async (answers: Array<{ questionId: string; userAnswer: string }>) => {
      const r = await submit(answers, Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)))
      if (r) setQuizResult(r)
    },
    [submit],
  )

  const onExplain = useCallback(
    async (sentence: string, blockIndex?: number) => {
      setExplainingSentence(sentence)
      const r = await explain(sentence, blockIndex)
      setExplainingSentence(null)
      if (r) setExplainResult(r)
    },
    [explain],
  )

  const onCollect = useCallback((w: string) => {
    setCollected((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]))
  }, [])

  const blocks = useMemo(() => data?.contentBlocks ?? [], [data])

  // ---- 三态 ----
  if (loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-24" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
            <SkeletonCard className="h-96" />
            <SkeletonCard className="h-96" />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState title="文章加载失败" message={error ?? '该文章可能已下架。'} onRetry={reload} />
        </PageContainer>
      </AppShell>
    )
  }

  const hasQuiz = data.questions.length > 0

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={data.title}
          description={`${data.category} · ${DIFFICULTY_NAMES[data.difficulty] ?? data.difficulty} · ${data.wordCount} 词 · 约 ${data.readingMinutes} 分钟`}
          actions={
            <Link
              href={ROUTES.reading}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              返回列表
            </Link>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          {/* 左：正文 + 译文 + 长难句 + AI 讲解 */}
          <div className="space-y-4">
            <div className="relative">
              <ArticleBody
                blocks={blocks}
                highlightBlock={highlightBlock}
                onSelectWord={onSelectWord}
                onScrollProgress={onScrollProgress}
              />
              <HighlightPopover
                result={word.result}
                loading={word.loading}
                onClose={word.clear}
                onCollect={onCollect}
              />
            </div>

            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">译文</h2>
                <Badge variant="outline">共 {blocks.length} 段</Badge>
              </div>
              <TranslationToggle blocks={blocks} show={showTranslation} onToggleShow={setShowTranslation} />
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">长难句</h2>
              <SentenceAnalysis
                sentences={data.sentences}
                onExplain={(s) => {
                  const idx = blocks.findIndex((b) => b.en.includes(s))
                  void onExplain(s, idx >= 0 ? idx : undefined)
                }}
                explainingSentence={explainingSentence}
              />
            </section>

            {/* 验收 5：degraded → 整个区块隐藏，其余内容完整 */}
            <ExplainPanel result={explainResult} loading={explaining} />
          </div>

          {/* 右：重点词 + 收藏 + 进度 */}
          <aside className="space-y-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">重点词</h2>
                <Badge variant="outline">{data.progress}%</Badge>
              </div>
              <KeyWordRail
                words={data.keyWords}
                onLookup={onSelectWord}
                onCollect={onCollect}
                collected={collected}
              />
            </div>

            {data.highlights.length > 0 ? (
              <div className="rounded-xl border border-border bg-surface p-3">
                <h2 className="mb-2 text-sm font-semibold">我的生词（{data.highlights.length}）</h2>
                <div className="flex flex-wrap gap-1.5">
                  {data.highlights.map((h) => (
                    <span key={`${h.word}-${h.blockIndex}`} className="rounded-md bg-secondary px-2 py-1 text-xs">
                      {h.word}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              划词即可查义（本地词典，不调用 AI）；阅读进度会自动保存，下次从此处继续。
            </p>
          </aside>
        </div>

        {/* 阅读理解 */}
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">阅读理解</h2>
          {submitError ? <p className="mb-2 text-xs text-destructive">{submitError}</p> : null}
          {quizResult ? (
            <QuizResult result={quizResult} onLocate={onLocate} onRetry={() => setQuizResult(null)} />
          ) : hasQuiz ? (
            <QuizArea questions={data.questions} submitting={submitting} onSubmit={(a) => void onSubmitQuiz(a)} />
          ) : (
            <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
              本篇暂无阅读理解题
            </p>
          )}
          {data.quizResult && !quizResult ? (
            <p className="mt-2 text-xs text-muted-foreground">
              上次成绩：{data.quizResult.correctCount} / {data.quizResult.total}（{data.quizResult.score} 分）
            </p>
          ) : null}
        </section>
      </PageContainer>
    </AppShell>
  )
}
