'use client'

/**
 * /vocabulary/library — 词书库：选择/切换词书（选择后写入本地偏好并跳今日学词）。
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ROUTES } from '@/lib/constants/routes'
import { ApiClientError } from '@/features/auth/api'
import { vocabularyApi } from '@/features/vocabulary/api'
import { useLocalDraft } from '@/hooks/use-local-draft'
import type { VocabularyBookDto } from '@/features/vocabulary/types'
import { ModeSwitcher } from '@/features/vocabulary/components/mode-switcher'

interface BookPref {
  slug: string
  name: string
}

export default function VocabularyLibraryPage(): React.JSX.Element {
  const router = useRouter()
  const [books, setBooks] = useState<VocabularyBookDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { draft, update } = useLocalDraft<BookPref>('englishai.book-pref', { slug: '', name: '' })

  useEffect(() => {
    let cancelled = false
    vocabularyApi
      .books()
      .then((list) => {
        if (!cancelled) setBooks(list)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiClientError ? e.message : '词书加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const choose = (b: VocabularyBookDto): void => {
    update({ slug: b.slug, name: b.name })
    router.push(`${ROUTES.vocabulary.root}?book=${encodeURIComponent(b.slug)}`)
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="词书库" description="选一本词书，学习计划会围绕它展开" />
        <ModeSwitcher />

        <div className="mt-6 space-y-3">
          {loading ? <SkeletonList rows={3} /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {books.map((b) => {
            const active = draft.slug === b.slug
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{b.name}</span>
                    {active ? <Badge>当前</Badge> : null}
                  </div>
                  {b.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">{b.wordCount} 词</p>
                </div>
                <Button size="sm" variant={active ? 'secondary' : 'outline'} onClick={() => choose(b)}>
                  {active ? '继续学习' : '选择'}
                </Button>
              </div>
            )
          })}
        </div>
      </PageContainer>
    </AppShell>
  )
}
