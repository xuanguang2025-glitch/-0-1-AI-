'use client'

/**
 * /vocabulary/notebook — 生词本：全部 / 待复习 / 已掌握 三个页签 + 收藏切换 + 掌握度概览。
 */
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ApiClientError } from '@/features/auth/api'
import { vocabularyApi } from '@/features/vocabulary/api'
import type { MasteryOverview, NotebookItem } from '@/features/vocabulary/types'
import { firstDefinition } from '@/features/vocabulary/components/word-card'
import { MasteryBar } from '@/features/vocabulary/components/mastery-bar'
import { NotebookTabs, type NotebookTab } from '@/features/vocabulary/components/notebook-tabs'
import { ModeSwitcher } from '@/features/vocabulary/components/mode-switcher'

export default function VocabularyNotebookPage(): React.JSX.Element {
  const [tab, setTab] = useState<NotebookTab>('all')
  const [items, setItems] = useState<NotebookItem[]>([])
  const [mastery, setMastery] = useState<MasteryOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [list, overview] = await Promise.all([vocabularyApi.notebook(), vocabularyApi.mastery()])
      setItems(list)
      setMastery(overview)
      setError(null)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (item: NotebookItem): Promise<void> => {
    try {
      await vocabularyApi.toggleNotebook(item.userVocabId)
      setItems((prev) => prev.filter((i) => i.userVocabId !== item.userVocabId))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '操作失败')
    }
  }

  const now = Date.now()
  const filtered = items.filter((i) => {
    if (tab === 'due') return i.nextReviewAt ? new Date(i.nextReviewAt).getTime() <= now : false
    if (tab === 'mastered') return i.stage === 'MASTERED'
    return true
  })

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="生词本" description="收藏的重点词 + 掌握度概览" />
        <ModeSwitcher />

        <div className="mt-6 space-y-5">
          <MasteryBar data={mastery} />

          <NotebookTabs value={tab} onChange={setTab} />

          {loading ? <SkeletonList rows={3} /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!loading && filtered.length === 0 ? (
            <EmptyState emoji="⭐" title="这里还没有单词" description="在学词或复习时点击收藏即可加入生词本" />
          ) : null}

          <div className="space-y-2">
            {filtered.map((i) => (
              <div key={i.userVocabId} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{i.vocabulary.word}</span>
                    {i.vocabulary.phoneticUk ? (
                      <span className="text-xs text-muted-foreground">/{i.vocabulary.phoneticUk}/</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{firstDefinition(i.vocabulary)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void remove(i)}>
                  取消收藏
                </Button>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}
