'use client'

/**
 * WordExtract：生词抽取面板（T18 验收 3，词典直查 0 AI）。
 * 「加入生词本」→ inNotebook=true，本地即时更新。
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { ExtractedWord } from '../types'

export interface WordExtractProps {
  words: ExtractedWord[]
  loading?: boolean
  saving?: boolean
  onAdd: (vocabularyId: string) => void
  className?: string
}

export function WordExtract({ words, loading = false, saving = false, onAdd, className }: WordExtractProps): React.JSX.Element | null {
  if (loading) {
    return (
      <p className={cn('py-3 text-center text-xs text-muted-foreground', className)} data-testid="word-extract-loading">
        抽取生词中…
      </p>
    )
  }
  if (words.length === 0) return null

  return (
    <div className={cn('space-y-1.5', className)} data-testid="word-extract">
      <h3 className="text-sm font-semibold">抽取生词（词典直查）</h3>
      <ul className="space-y-1.5">
        {words.map((w) => (
          <li key={w.vocabularyId} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2" data-testid={`extract-word-${w.lemma}`}>
            <span className="text-sm font-medium">{w.word}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{w.meanings.join('；')}</span>
            {w.inNotebook ? (
              <Badge variant="secondary">已在生词本</Badge>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onAdd(w.vocabularyId)} data-testid={`extract-add-${w.lemma}`}>
                加入生词本
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
