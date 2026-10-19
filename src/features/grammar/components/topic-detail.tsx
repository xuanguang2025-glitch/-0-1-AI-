'use client'

/**
 * TopicDetail：知识点讲解区（T16）。
 *
 * 展示 `GrammarTopic.content`（[{title, content}]）+ 描述 + 各知识点的
 * 「AI 讲解」入口（AI 不可用时 ExplainPanel 给静态兜底）。
 */
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { DIFFICULTY_NAMES, type GrammarContentPoint, type GrammarTopicDetail } from '../types'

export interface TopicDetailProps {
  topic: GrammarTopicDetail
  onExplain?: (pointTitle: string) => void
  explainingPoint?: string | null
  className?: string
}

export function TopicDetail({ topic, onExplain, explainingPoint = null, className }: TopicDetailProps): React.JSX.Element {
  const points: GrammarContentPoint[] = topic.content

  return (
    <div className={cn('space-y-3', className)} data-testid="topic-detail">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{topic.name}</h2>
        <Badge variant="outline">{DIFFICULTY_NAMES[topic.difficulty] ?? topic.difficulty}</Badge>
        <Badge variant="secondary">{topic.questionCount} 题</Badge>
      </div>

      {topic.description ? (
        <p className="text-sm leading-6 text-muted-foreground">{topic.description}</p>
      ) : null}

      {points.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
          该知识点暂无讲解内容
        </p>
      ) : (
        <ul className="space-y-2">
          {points.map((p, i) => (
            <li key={`${p.title}-${i}`} className="rounded-xl border border-border bg-surface p-3" data-testid={`topic-point-${i}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{p.title || `要点 ${i + 1}`}</h3>
                {onExplain ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onExplain(p.title)}
                    disabled={explainingPoint === p.title}
                    data-testid={`topic-explain-${i}`}
                    title="AI 讲解该要点"
                  >
                    <Sparkles className="h-4 w-4" />
                    {explainingPoint === p.title ? '讲解中…' : '讲解'}
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{p.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
