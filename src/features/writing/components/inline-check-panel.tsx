'use client'

/**
 * InlineCheckPanel：规则检查面板（T17 验收 3）。
 *
 * 展示同步规则检查结果：总分 + 每类问题的扣分明细。
 * **零 AI 依赖**——数据来自保存时的 ruleCheck，编辑器侧边实时更新。
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { RULE_NAMES, type WritingRuleCheck } from '../types'

export interface InlineCheckPanelProps {
  check: WritingRuleCheck | null
  className?: string
}

export function InlineCheckPanel({ check, className }: InlineCheckPanelProps): React.JSX.Element {
  if (check === null) {
    return (
      <p className={cn('py-4 text-center text-xs text-muted-foreground', className)}>
        开始输入后显示规则检查结果
      </p>
    )
  }

  return (
    <div className={cn('space-y-2', className)} data-testid="inline-check-panel">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">规则检查</h3>
        <span
          className={cn('text-xl font-semibold tabular-nums', check.score >= 80 ? 'text-success' : check.score >= 60 ? 'text-warning' : 'text-destructive')}
          data-testid="rule-score"
        >
          {check.score}
        </span>
        <Badge variant={check.passed ? 'success' : 'secondary'}>{check.passed ? '通过' : '待改进'}</Badge>
      </div>

      {check.issues.length === 0 ? (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success" data-testid="rule-clean">
          未发现规则问题，继续保持
        </p>
      ) : (
        <ul className="space-y-1.5">
          {check.issues.map((issue) => (
            <li key={issue.rule} className="rounded-lg border border-border bg-surface p-2" data-testid={`rule-issue-${issue.rule}`}>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
                  {RULE_NAMES[issue.rule] ?? issue.rule}
                </span>
                <span className="text-muted-foreground">-{issue.deduction} 分</span>
              </div>
              <p className="mt-1 text-xs leading-5">{issue.message}</p>
              {issue.excerpt ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={issue.excerpt}>
                  {issue.excerpt}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        规则检查为本地确定性算法（词典/句长/连接词/分段/被动语态），不调用 AI。
      </p>
    </div>
  )
}
