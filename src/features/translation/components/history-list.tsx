'use client'

/**
 * HistoryList：翻译历史（T18 验收 4，分页 + 只看收藏）。
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { TranslationHistoryResult } from '../types'

export interface HistoryListProps {
  data: TranslationHistoryResult | null
  loading?: boolean
  favoriteOnly: boolean
  onToggleFavoriteOnly: (v: boolean) => void
  onPageChange: (page: number) => void
  className?: string
}

export function HistoryList({
  data,
  loading = false,
  favoriteOnly,
  onToggleFavoriteOnly,
  onPageChange,
  className,
}: HistoryListProps): React.JSX.Element {
  return (
    <section className={cn('space-y-2', className)} data-testid="history-list">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">翻译历史</h2>
        <Badge variant="outline">保留最近 50 条</Badge>
        <Button
          type="button"
          size="sm"
          variant={favoriteOnly ? 'default' : 'ghost'}
          className="ml-auto"
          onClick={() => onToggleFavoriteOnly(!favoriteOnly)}
          data-testid="history-fav-only"
        >
          只看收藏
        </Button>
      </div>

      {loading ? (
        <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-muted-foreground">加载中…</p>
      ) : (data?.records.length ?? 0) === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-muted-foreground" data-testid="history-empty">
          {favoriteOnly ? '还没有收藏的翻译。' : '还没有翻译记录。'}
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {(data?.records ?? []).map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-2.5" data-testid={`history-item-${r.id}`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{r.direction === 'zh2en' ? '中→英' : '英→中'}</span>
                  {r.isFavorite ? <Badge variant="secondary">已收藏</Badge> : null}
                  <span className="ml-auto">{new Date(r.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm">{r.sourceText}</p>
                {r.preview !== null ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.preview}</p> : null}
              </li>
            ))}
          </ul>

          {(data?.total ?? 0) > 20 ? (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button type="button" size="sm" variant="outline" disabled={(data?.page ?? 1) <= 1} onClick={() => onPageChange((data?.page ?? 1) - 1)} data-testid="history-prev">
                上一页
              </Button>
              <span className="text-xs text-muted-foreground">
                第 {data?.page ?? 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)))} 页
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={(data?.page ?? 1) >= Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20))}
                onClick={() => onPageChange((data?.page ?? 1) + 1)}
                data-testid="history-next"
              >
                下一页
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
