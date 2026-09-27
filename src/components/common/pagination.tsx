'use client'

/**
 * Pagination：服务端分页控件（配合 meta：page/totalPages/hasNext/hasPrev）。
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}): React.JSX.Element {
  if (totalPages <= 1) return <></>
  const pages = getWindow(page, totalPages)

  return (
    <nav className={cn('flex items-center justify-center gap-1', className)} aria-label="分页">
      <Button variant="outline" size="icon" disabled={!hasPrev(page)} onClick={() => onChange(page - 1)} aria-label="上一页">
        <ChevronLeft />
      </Button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}>
            {p}
          </Button>
        ),
      )}
      <Button variant="outline" size="icon" disabled={!hasNext(page, totalPages)} onClick={() => onChange(page + 1)} aria-label="下一页">
        <ChevronRight />
      </Button>
    </nav>
  )
}

const hasPrev = (page: number): boolean => page > 1
const hasNext = (page: number, total: number): boolean => page < total

/** 页码窗口：首尾保留，中间 ±1，间隔用 … */
function getWindow(page: number, total: number): Array<number | '…'> {
  const out: Array<number | '…'> = []
  const push = (n: number): void => {
    if (out[out.length - 2] === n - 2 && out[out.length - 1] === '…') out.pop()
    out.push(n)
  }
  if (total <= 7) {
    for (let i = 1; i <= total; i += 1) out.push(i)
    return out
  }
  out.push(1)
  if (page > 3) out.push('…')
  for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i += 1) push(i)
  if (page < total - 2) out.push('…')
  out.push(total)
  return out
}
