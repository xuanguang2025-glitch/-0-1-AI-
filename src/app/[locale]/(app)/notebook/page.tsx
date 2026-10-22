'use client'

/**
 * /notebook — 错题本（错题本闭环，team-lead 增补项）。
 *
 * 数据来源：阅读（source=reading）/ 语法（grammar）/ 听力（listening）等业务
 * 在判分时自动写入 `wrong_questions`；本页负责**读取与复习闭环**。
 * 筛选：来源 chips（带未掌握计数）/ 掌握状态（待复习 / 已掌握 / 全部）。
 */
import { useCallback, useState } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { WrongQuestionList } from '@/features/notebook/components/wrong-question-list'
import { useWrongQuestions, useWrongQuestionReview } from '@/features/notebook/hooks'
import { SOURCE_NAMES, type WrongQuestionItem } from '@/features/notebook/types'

type MasteredFilter = 'all' | 'pending' | 'mastered'

export default function NotebookPage(): React.JSX.Element {
  const [source, setSource] = useState<string | undefined>(undefined)
  const [masteredFilter, setMasteredFilter] = useState<MasteredFilter>('pending')
  const [page, setPage] = useState(1)

  const mastered = masteredFilter === 'all' ? undefined : masteredFilter === 'mastered'
  const { data, loading, error, reload } = useWrongQuestions({ source, mastered, page })
  const { review, busyId, error: reviewError } = useWrongQuestionReview(reload)

  const onMaster = useCallback((item: WrongQuestionItem) => void review(item, 'master'), [review])
  const onReopen = useCallback((item: WrongQuestionItem) => void review(item, 'reopen'), [review])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize ?? 20)))

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="错题本"
          description="阅读 / 语法 / 听力做错的题自动收录 · 掌握后可重新打开"
        />

        {/* 掌握状态筛选 */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="掌握状态筛选">
          {(
            [
              { key: 'pending', label: '待复习' },
              { key: 'mastered', label: '已掌握' },
              { key: 'all', label: '全部' },
            ] as const
          ).map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={masteredFilter === f.key ? 'default' : 'outline'}
              onClick={() => {
                setMasteredFilter(f.key)
                setPage(1)
              }}
              data-testid={`filter-${f.key}`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* 来源筛选 chips（未掌握计数） */}
        {data !== null && data.sourceCounts.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="来源筛选" data-testid="source-filter">
            <Button
              type="button"
              size="sm"
              variant={source === undefined ? 'default' : 'outline'}
              onClick={() => {
                setSource(undefined)
                setPage(1)
              }}
              data-testid="source-all"
            >
              全部来源
            </Button>
            {data.sourceCounts.map((s) => (
              <Button
                key={s.source}
                type="button"
                size="sm"
                variant={source === s.source ? 'default' : 'outline'}
                onClick={() => {
                  setSource(s.source)
                  setPage(1)
                }}
                data-testid={`source-${s.source}`}
              >
                {SOURCE_NAMES[s.source] ?? s.source} {s.count}
              </Button>
            ))}
          </div>
        ) : null}

        {reviewError !== null ? <p className="mt-3 text-xs text-destructive">{reviewError}</p> : null}

        <div className="mt-4">
          {error !== null ? (
            <ErrorState title="错题本加载失败" message={error} onRetry={reload} />
          ) : (
            <WrongQuestionList
              items={data?.items ?? []}
              loading={loading}
              busyId={busyId}
              onMaster={onMaster}
              onReopen={onReopen}
            />
          )}
        </div>

        {total > (data?.pageSize ?? 20) ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="wrong-prev">
              上一页
            </Button>
            <span className="text-xs text-muted-foreground">
              第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} data-testid="wrong-next">
              下一页
            </Button>
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  )
}
