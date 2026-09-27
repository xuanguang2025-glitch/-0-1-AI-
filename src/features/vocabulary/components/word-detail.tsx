'use client'

/**
 * WordDetailDialog：单词详情弹窗（完整释义 / 例句 / 派生词 / 学习状态 / 收藏）。
 */
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/separator'
import { vocabularyApi } from '../api'
import { firstDefinition, stageBadgeVariant, stageLabel } from './word-card'
import type { WordDetail } from '../types'

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

export function WordDetailDialog({
  vocabularyId,
  open,
  onOpenChange,
}: {
  vocabularyId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [detail, setDetail] = useState<WordDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [inNotebook, setInNotebook] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!open || !vocabularyId) return
    let cancelled = false
    setLoading(true)
    setDetail(null)
    vocabularyApi
      .wordDetail(vocabularyId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setInNotebook(d.state?.inNotebook ?? false)
      })
      .catch(() => {
        // 详情拉取失败静默（弹窗内展示空态）
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, vocabularyId])

  const toggleNotebook = async (): Promise<void> => {
    if (!detail?.state || toggling) return
    setToggling(true)
    try {
      const res = await vocabularyApi.toggleNotebook(detail.state.id)
      setInNotebook(res.inNotebook)
    } catch {
      // 静默失败
    } finally {
      setToggling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto">
        {loading || !detail ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-xl">
                {detail.word.word}
                {detail.word.phoneticUs ? <span className="text-sm font-normal text-muted-foreground">/{detail.word.phoneticUs}/</span> : null}
                {detail.word.cefrLevel ? <Badge variant="outline">{detail.word.cefrLevel}</Badge> : null}
              </DialogTitle>
            </DialogHeader>

            {detail.state ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={stageBadgeVariant(detail.state.masteryStage)}>{stageLabel(detail.state.masteryStage)}</Badge>
                <span className="text-muted-foreground">掌握度 {detail.state.masteryScore}</span>
                <span className="text-muted-foreground">
                  复习 {detail.state.reviewCount} 次 · 对 {detail.state.correctCount} / 错 {detail.state.wrongCount}
                </span>
                <Button
                  size="sm"
                  variant={inNotebook ? 'secondary' : 'outline'}
                  onClick={() => void toggleNotebook()}
                  disabled={toggling}
                >
                  {inNotebook ? '★ 已在生词本' : '☆ 加入生词本'}
                </Button>
              </div>
            ) : null}

            <div className="space-y-4 text-sm">
              <div>
                <h4 className="mb-1 font-medium">释义</h4>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {asStringArraySafe(detail.word.definitions).map((def, i) => (
                    <li key={i}>{def}</li>
                  ))}
                </ul>
              </div>

              {(detail.word.examples?.length ?? 0) > 0 ? (
                <div>
                  <h4 className="mb-1 font-medium">例句</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    {detail.word.examples?.map((ex, i) => (
                      <li key={i}>
                        <p>{ex.en}</p>
                        {ex.zh ? <p className="text-xs">{ex.zh}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {asStringArray(detail.word.synonyms).length > 0 ? (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">近义词：</span>
                  {asStringArray(detail.word.synonyms).join('、')}
                </p>
              ) : null}

              {detail.word.mnemonic ? (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">记忆法：</span>
                  {detail.word.mnemonic}
                </p>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** definitions JSON → 展示字符串列表 */
function asStringArraySafe(defs: unknown): string[] {
  if (!Array.isArray(defs)) return []
  return defs.map((d, i) => {
    if (typeof d === 'string') return d
    const obj = d as { pos?: string; zh?: string; en?: string }
    return `${obj.pos ? `${obj.pos} ` : ''}${obj.zh ?? obj.en ?? `释义 ${i + 1}`}`
  })
}

export { firstDefinition }
