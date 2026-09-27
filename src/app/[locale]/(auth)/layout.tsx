import Link from 'next/link'

import { ROUTES } from '@/lib/constants/routes'

/**
 * (auth) 组布局：居中卡片 + 品牌 Logo。
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">E</span>
        <span className="text-lg font-semibold">EnglishAI</span>
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">{children}</div>
    </main>
  )
}
