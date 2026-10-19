'use client'

/**
 * TopicTree：语法主题树（T16 验收 1）。
 *
 * `grammar_topics` 以 parent/children 组装；种子数据 parentId 均为 null，
 * 因此渲染为 14 个根节点的平铺列表（带序号），有子节点时自动缩进展开。
 */
import { cn } from '@/lib/utils/cn'
import { MasteryBadge } from './mastery-badge'
import { DIFFICULTY_NAMES, type GrammarTopicNode } from '../types'

export interface TopicTreeProps {
  topics: GrammarTopicNode[]
  activeId?: string | null
  onSelect?: (topic: GrammarTopicNode) => void
  className?: string
}

function Node({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: GrammarTopicNode
  depth: number
  activeId?: string | null
  onSelect?: (topic: GrammarTopicNode) => void
}): React.JSX.Element {
  const active = node.id === activeId
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        aria-current={active ? 'true' : undefined}
        data-testid={`topic-node-${node.slug}`}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
          active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-surface-muted',
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {DIFFICULTY_NAMES[node.difficulty] ?? node.difficulty}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{node.questionCount} 题</span>
        <MasteryBadge mastery={node.mastery} mastered={node.mastered} compact />
      </button>
      {node.children.length > 0 ? (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function TopicTree({ topics, activeId = null, onSelect, className }: TopicTreeProps): React.JSX.Element {
  if (topics.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>暂无语法知识点</p>
  }

  return (
    <ul className={cn('space-y-0.5', className)} data-testid="topic-tree">
      {topics.map((t) => (
        <Node key={t.id} node={t} depth={0} activeId={activeId} onSelect={onSelect} />
      ))}
    </ul>
  )
}
