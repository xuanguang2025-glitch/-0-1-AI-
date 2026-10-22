'use client'

/**
 * WrongQuestionList：错题列表（错题本闭环）。
 *
 * 展示：来源徽章 / 题干 / 我的答案 vs 正确答案 / 解析（AI 优先）/ 出错次数。
 * 操作：「标记已掌握」⇄「重新打开」（本地即时更新 + 服务端持久化）。
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { AI_CATEGORY_NAMES, SOURCE_NAMES, type WrongQuestionItem } from '../types'

export interface WrongQuestionListProps {
  items: WrongQuestionItem[]
  loading?: boolean
  /** 处理中（按钮禁用）的题目 id */
  busyId?: string | null
  onMaster: (item: WrongQuestionItem) => void
  onReopen: (item: WrongQuestionItem) => void
  className?: string
}

export function WrongQuestionList({
  items,
  loading = false,
  busyId = null,
  onMaster,
  onReopen,
  className,
}: WrongQuestionListProps): React.JSX.Element {
  if (loading) {
    return (
      <p className={cn('rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground', className)}>
        加载中…
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <p className={cn('rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground', className)} data-testid="wrong-empty">
        没有符合条件的错题。做错阅读 / 语法 / 听力题目后会自动出现在这里。
      </p>
    )
  }

  return (
    <ul className={cn('space-y-2', className)} data-testid="wrong-question-list">
      {items.map((item) => {
        const mastered = item.masteredAt !== null
        const busy = busyId === item.id
        return (
          <li
            key={item.id}
            className={cn('rounded-xl border bg-surface p-3', mastered ? 'border-success/40' : 'border-border')}
            data-testid={`wrong-item-${item.id}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{SOURCE_NAMES[item.source] ?? item.source}</Badge>
              {item.aiCategory !== null ? (
                <Badge variant="secondary">错因：{AI_CATEGORY_NAMES[item.aiCategory] ?? item.aiCategory}</Badge>
              ) : null}
              {item.errorCount > 1 ? <Badge variant="destructive">错 {item.errorCount} 次</Badge> : null}
              {mastered ? (
                <Badge variant="success" data-testid={`wrong-mastered-${item.id}`}>
                  已掌握
                </Badge>
              ) : (
                <Badge variant="warning" data-testid={`wrong-pending-${item.id}`}>
                  待复习
                </Badge>
              )}
              <span className="ml-auto text-muted-foreground">
                最近写错 {new Date(item.lastWrongAt).toLocaleDateString('zh-CN')}
              </span>
            </div>

            <p className="mt-1.5 text-sm leading-6">{item.stem}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">你的答案：</span>
              <span className={cn('font-medium', mastered ? '' : 'text-destructive')}>{item.userAnswer || '（空）'}</span>
              {item.correctAnswer !== null ? (
                <>
                  <span className="text-muted-foreground">正确答案：</span>
                  <span className="font-medium text-success">{item.correctAnswer}</span>
                </>
              ) : null}
            </div>

            {(item.explanation ?? item.aiExplanation) !== null ? (
              <p className="mt-1 rounded bg-surface-muted px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                {item.aiExplanation ?? item.explanation}
              </p>
            ) : null}

            <div className="mt-2">
              {mastered ? (
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onReopen(item)} data-testid={`wrong-reopen-${item.id}`}>
                  重新打开
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onMaster(item)} data-testid={`wrong-master-${item.id}`}>
                  {busy ? '处理中…' : '标记已掌握'}
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
