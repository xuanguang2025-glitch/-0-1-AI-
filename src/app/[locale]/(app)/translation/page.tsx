'use client'

/**
 * /translation — 翻译训练页（T18）。
 *
 * 组成：TranslatorInput（≤500 字符 + 方向）→ ResultTabs（5 档，缺档显示
 * 「AI 暂不可用」不白屏）→ FavoriteButton（一键收藏 + 生词入本）+
 * WordExtract（词典直查生词）→ HistoryList（分页，保留最近 50 条）。
 */
import { useCallback, useState } from 'react'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ErrorState } from '@/components/common/error-state'
import { FavoriteButton } from '@/features/translation/components/favorite-button'
import { HistoryList } from '@/features/translation/components/history-list'
import { ResultTabs } from '@/features/translation/components/result-tabs'
import { TranslatorInput } from '@/features/translation/components/translator-input'
import { WordExtract } from '@/features/translation/components/word-extract'
import { useAddWord, useTranslate, useTranslationHistory, useTranslationSave, useWordExtract } from '@/features/translation/hooks'
import type { TranslationResult } from '@/features/translation/types'

export default function TranslationPage(): React.JSX.Element {
  const [text, setText] = useState('')
  const [direction, setDirection] = useState<'zh2en' | 'en2zh'>('zh2en')
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const { translate, loading, error } = useTranslate()
  const { save, saving, error: saveError } = useTranslationSave()
  const [addedCount, setAddedCount] = useState<number | null>(null)
  const [favorited, setFavorited] = useState(false)
  const { words, loading: extracting, extract, markAdded } = useWordExtract()
  const { add, saving: addingWord } = useAddWord()
  const history = useTranslationHistory(favoriteOnly)

  const onSubmit = useCallback(async () => {
    const r = await translate(text, direction)
    if (r !== null) {
      setResult(r)
      setFavorited(false)
      setAddedCount(null)
      extract(r.sourceText)
      history.reload()
    }
  }, [translate, text, direction, extract, history])

  const onFavorite = useCallback(async () => {
    if (result === null) return
    const r = await save(result.id)
    if (r !== null) {
      setFavorited(true)
      setAddedCount(r.addedWords.length)
      history.reload()
    }
  }, [save, result, history])

  const onAddWord = useCallback(
    async (vocabularyId: string) => {
      const ok = await add(vocabularyId)
      if (ok) markAdded(vocabularyId)
    },
    [add, markAdded],
  )

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="翻译训练" description="5 种风格译文 · 一键收藏 · 生词自动入本 · 历史保留 50 条" />

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-4">
              <TranslatorInput
                text={text}
                direction={direction}
                loading={loading}
                onTextChange={setText}
                onDirectionChange={setDirection}
                onSubmit={() => void onSubmit()}
              />
              {error !== null ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <ResultTabs result={result} loading={loading} />
              {result !== null && !result.degraded ? (
                <div className="mt-3">
                  <FavoriteButton
                    favorited={favorited}
                    saving={saving}
                    addedWordsCount={addedCount}
                    onClick={() => void onFavorite()}
                  />
                  {saveError !== null ? <p className="mt-1 text-xs text-destructive">{saveError}</p> : null}
                </div>
              ) : null}
            </section>

            <WordExtract words={words} loading={extracting} saving={addingWord} onAdd={(id) => void onAddWord(id)} />
          </div>

          <aside>
            <HistoryList
              data={history.data}
              loading={history.loading}
              favoriteOnly={favoriteOnly}
              onToggleFavoriteOnly={setFavoriteOnly}
              onPageChange={history.setPage}
            />
          </aside>
        </div>
      </PageContainer>
    </AppShell>
  )
}
