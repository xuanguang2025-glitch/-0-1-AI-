'use client'

/**
 * /reading — 阅读文章列表（R1，T15）。
 *
 * 三态齐备（Skeleton / Empty / Error+Retry）；筛选：分类 / 难度 / 标题搜索。
 * 列表项展示已读进度与 quiz 成绩，便于「断点续读」。
 */
import { useCallback, useState } from 'react'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ChipFilter, type ChipOption } from '@/components/common/chip-filter'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { useReadingList } from '@/features/reading/hooks'
import { DIFFICULTY_NAMES, type ReadingArticleListItem } from '@/features/reading/types'
import { ROUTES } from '@/lib/constants/routes'

type DifficultyFilter = '' | 'EASY' | 'MEDIUM' | 'HARD'

const DIFFICULTY_OPTIONS: ChipOption<DifficultyFilter>[] = [
  { value: '', label: '全部难度' },
  { value: 'EASY', label: '入门' },
  { value: 'MEDIUM', label: '标准' },
  { value: 'HARD', label: '挑战' },
]

function linkButtonClass(primary: boolean): string {
  return primary
    ? 'inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90'
    : 'inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium transition-colors hover:bg-surface-muted'
}

export default function ReadingListPage(): React.JSX.Element {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [keyword, setKeyword] = useState('')

  const { data, loading, error, reload } = useReadingList({
    difficulty: difficulty === '' ? undefined : difficulty,
    category: category === '' ? undefined : category,
    q: keyword === '' ? undefined : keyword,
  })

  const onSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setKeyword(q)
  }, [q])

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="阅读训练"
          description="分级文章 · 划词直查 · 长难句解析 · 阅读理解自动收录错题"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="难度筛选">
            <ChipFilter options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
          </div>

          <form onSubmit={onSearch} className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索文章标题"
              aria-label="搜索文章标题"
              className="h-9 w-48"
              data-testid="reading-search"
            />
            <Button type="submit" size="sm" variant="outline">
              搜索
            </Button>
          </form>
        </div>

        {/* 分类 chips（来自 facets，反映全量分布） */}
        {data && data.facets.categories.length > 0 ? (
          <div className="mt-3" role="group" aria-label="分类筛选">
            <ChipFilter
              options={[
                { value: '', label: '全部分类' },
                ...data.facets.categories.map((c) => ({ value: c.value, label: `${c.value} ${c.count}` })),
              ]}
              value={category}
              onChange={setCategory}
            />
          </div>
        ) : null}

        {/* 三态 */}
        {loading ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} className="h-40" />
            ))}
          </div>
        ) : error ? (
          <ErrorState className="mt-6" message={error} onRetry={reload} />
        ) : (data?.articles.length ?? 0) === 0 ? (
          <EmptyState
            className="mt-6"
            emoji="📖"
            title="暂无文章"
            description="换个筛选条件试试，或稍后再来。"
            action={<Button variant="outline" onClick={reload}>刷新</Button>}
          />
        ) : (
          <>
            <p className="mt-4 text-xs text-muted-foreground">共 {data?.total ?? 0} 篇</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="reading-list">
              {(data?.articles ?? []).map((a: ReadingArticleListItem) => (
                <Card key={a.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug">{a.title}</h3>
                    <Badge variant="outline">{DIFFICULTY_NAMES[a.difficulty] ?? a.difficulty}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.category} · {a.wordCount} 词 · 约 {a.readingMinutes} 分钟
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {a.quizDone ? <Badge variant="success"> quiz {a.quizAccuracy}%</Badge> : null}
                    {a.progress > 0 && a.progress < 100 ? <Badge variant="secondary">已读 {a.progress}%</Badge> : null}
                    {a.progress >= 100 ? <Badge variant="secondary">已读完</Badge> : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link href={`${ROUTES.reading}/${a.id}`} className={linkButtonClass(true)}>
                      {a.progress > 0 && a.progress < 100 ? '继续阅读' : '开始阅读'}
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
