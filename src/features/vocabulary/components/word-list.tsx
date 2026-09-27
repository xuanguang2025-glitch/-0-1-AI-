'use client'

/**
 * WordList：单词列表（含搜索空态），点击回调交给页面处理。
 */
import { WordCard } from './word-card'
import type { WordSummary } from '../types'

export function WordList({
  words,
  onWordClick,
  emptyText = '暂无单词',
}: {
  words: WordSummary[]
  onWordClick?: (word: WordSummary) => void
  emptyText?: string
}): React.JSX.Element {
  if (words.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <div className="space-y-2">
      {words.map((w) => (
        <WordCard key={w.id} word={w} onClick={onWordClick ? () => onWordClick(w) : undefined} />
      ))}
    </div>
  )
}
