'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * 路由级错误边界（架构 §7.4 Error 状态）。
 * 捕获渲染期异常，提供重试与回首页入口。
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.JSX.Element {
  useEffect(() => {
    // 服务端已记录；此处仅在前端留痕（Phase 1 不接远台上报）
    console.error('[app/error]', error.message)
  }, [error])

  return (
    <main className="container-content flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <div className="card-surface max-w-lg p-8">
        <p className="text-sm font-medium text-destructive">出错了 · Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold">页面加载失败</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          请重试；若持续失败，可稍后再来或返回首页。
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">traceId: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            重试
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  )
}
