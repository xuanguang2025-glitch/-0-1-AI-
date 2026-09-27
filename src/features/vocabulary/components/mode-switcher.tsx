'use client'

/**
 * ModeSwitcher：词汇模块顶部分模式切换（今日学词 / 复习 / 词库 / 生词本）。
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils/cn'
import { ROUTES } from '@/lib/constants/routes'

const MODES = [
  { href: ROUTES.vocabulary.root, label: '今日学词' },
  { href: ROUTES.vocabulary.review, label: '复习' },
  { href: ROUTES.vocabulary.library, label: '词库' },
  { href: ROUTES.vocabulary.notebook, label: '生词本' },
] as const

export function ModeSwitcher(): React.JSX.Element {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {MODES.map((m) => {
        const active = pathname === m.href
        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              active ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </Link>
        )
      })}
    </nav>
  )
}
