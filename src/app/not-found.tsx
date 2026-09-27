import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '页面不存在',
}

/**
 * 404 页面（架构 §7.4 Empty 状态）。
 */
export default function NotFound(): React.JSX.Element {
  return (
    <main className="container-content flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <div className="card-surface max-w-lg p-8">
        <p className="text-5xl font-bold text-brand-600">404</p>
        <h1 className="mt-3 text-2xl font-semibold">找不到这个页面</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          页面可能已被移动或删除，请检查地址是否正确。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          返回首页
        </Link>
      </div>
    </main>
  )
}
