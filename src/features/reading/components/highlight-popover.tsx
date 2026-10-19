'use client'

/**
 * HighlightPopover：划词释义浮层（T15 验收 2）。
 *
 * 词典直查结果（`ReadingWordResult`）的可视化：音标 / 词性 / 释义 / 例句。
 * 查不到时明确提示「词典未收录」并建议选中整个单词，**不阻塞阅读**。
 */
import { cn } from '@/lib/utils/cn'
import type { ReadingWordResult } from '../types'

export interface HighlightPopoverProps {
  result: ReadingWordResult | null
  loading?: boolean
  /** 关闭浮层 */
  onClose: () => void
  /** 收藏为生词 */
  onCollect?: (word: string) => void
  className?: string
}

export function HighlightPopover({
  result,
  loading = false,
  onClose,
  onCollect,
  className,
}: HighlightPopoverProps): React.JSX.Element | null {
  if (!loading && result === null) return null

  return (
    <div
      role="dialog"
      aria-label="划词释义"
      data-testid="highlight-popover"
      className={cn(
        'absolute right-0 top-0 z-20 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">查询中…</p>
          ) : result?.found ? (
            <>
              <p className="text-base font-semibold" data-testid="popover-word">
                {result.word}
              </p>
              {(result.phoneticUk ?? result.phoneticUs) ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {result.phoneticUk ? `英 ${result.phoneticUk}` : ''}
                  {result.phoneticUk && result.phoneticUs ? ' · ' : ''}
                  {result.phoneticUs ? `美 ${result.phoneticUs}` : ''}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-medium" data-testid="popover-not-found">
              词典未收录「{result?.word ?? ''}」
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭释义"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          data-testid="popover-close"
        >
          ×
        </button>
      </div>

      {!loading && result?.found ? (
        <>
          <ul className="mt-2 space-y-1">
            {result.definitions.slice(0, 4).map((d, i) => (
              <li key={`${d.pos}-${i}`} className="text-sm">
                {d.pos ? <span className="mr-1 text-muted-foreground">{d.pos}</span> : null}
                {d.zh}
              </li>
            ))}
          </ul>
          {result.examples.length > 0 ? (
            <div className="mt-2 border-t border-border pt-2">
              <p className="text-xs font-medium text-muted-foreground">例句</p>
              <ul className="mt-1 space-y-1">
                {result.examples.slice(0, 2).map((e, i) => (
                  <li key={i} className="text-xs leading-5">
                    <span className="text-foreground">{e.en}</span>
                    {e.zh ? <span className="ml-1 text-muted-foreground">{e.zh}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {onCollect ? (
            <button
              type="button"
              onClick={() => onCollect(result.word)}
              className="mt-2 text-xs text-primary underline-offset-4 hover:underline"
              data-testid="popover-collect"
            >
              收藏为生词
            </button>
          ) : null}
        </>
      ) : null}

      {!loading && result !== null && !result.found ? (
        <p className="mt-2 text-xs text-muted-foreground">提示：请选中**完整单词**再试；本功能走本地词典，不调用 AI。</p>
      ) : null}
    </div>
  )
}
