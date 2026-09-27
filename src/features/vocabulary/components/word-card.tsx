'use client'

/**
 * WordCard：单词摘要卡（音标 / 词性 / 首要释义 / 掌握度徽标）。
 * 学习、复习、生词本、搜索列表共用。
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

import type { NotebookItem, ReviewQueueItem, WordSummary } from '../types'

export interface WordCardProps {
  word: WordSummary
  /** 可选学习状态（复习/生词本场景） */
  masteryScore?: number
  stage?: string
  /** 点击卡片（打开详情/翻面） */
  onClick?: () => void
  /** 右侧操作区（收藏按钮等） */
  action?: React.ReactNode
  className?: string
}

const STAGE_LABEL: Record<string, string> = {
  NEW: '新词',
  LEARNING: '学习中',
  FAMILIAR: '熟悉',
  MASTERED: '已掌握',
}

export function stageLabel(stage: string | undefined): string {
  if (!stage) return '未学'
  return STAGE_LABEL[stage] ?? stage
}

export function stageBadgeVariant(stage: string | undefined): 'default' | 'secondary' | 'success' | 'warning' {
  switch (stage) {
    case 'MASTERED': return 'success'
    case 'FAMILIAR': return 'default'
    case 'LEARNING': return 'warning'
    default: return 'secondary'
  }
}

export function firstDefinition(word: Pick<WordSummary, 'definitions'>): string {
  const d = word.definitions?.[0]
  if (!d) return '（暂无释义）'
  return `${d.pos ? `${d.pos} ` : ''}${d.zh ?? d.en ?? ''}`
}

export function WordCard({ word, masteryScore, stage, onClick, action, className }: WordCardProps): React.JSX.Element {
  const interactive = onClick != null
  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors',
        interactive && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{word.word}</span>
          {word.phoneticUs ? <span className="text-sm text-muted-foreground">/{word.phoneticUs}/</span> : null}
          {stage != null ? (
            <Badge variant={stageBadgeVariant(stage)}>{stageLabel(stage)}</Badge>
          ) : null}
          {masteryScore != null ? (
            <span className="text-xs text-muted-foreground">掌握度 {masteryScore}</span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{firstDefinition(word)}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** 复习队列项 → WordCard 所需摘要 */
export function queueItemToSummary(item: ReviewQueueItem): WordSummary {
  return item.vocabulary
}

/** 生词本项 → WordCard 所需摘要 */
export function notebookItemToSummary(item: NotebookItem): WordSummary {
  return {
    id: item.vocabulary.id,
    word: item.vocabulary.word,
    phoneticUk: item.vocabulary.phoneticUk,
    phoneticUs: null,
    pos: null,
    definitions: item.vocabulary.definitions,
    difficulty: 'MEDIUM',
  }
}
