'use client'

/**
 * SettingsNav：设置子导航（pathname 高亮）。
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils/cn'
import { ROUTES } from '@/lib/constants/routes'

const ITEMS: Array<{ href: string; label: string; emoji: string }> = [
  { href: ROUTES.settings, label: '账号资料', emoji: '👤' },
  { href: `${ROUTES.settings}/goal`, label: '学习目标', emoji: '🎯' },
  { href: `${ROUTES.settings}/appearance`, label: '外观与语言', emoji: '🎨' },
  { href: `${ROUTES.settings}/notification`, label: '通知偏好', emoji: '🔔' },
  { href: `${ROUTES.settings}/ai`, label: 'AI 偏好', emoji: '✨' },
  { href: `${ROUTES.settings}/security`, label: '账号安全', emoji: '🔒' },
  { href: `${ROUTES.settings}/privacy`, label: '隐私', emoji: '🛡️' },
  { href: `${ROUTES.settings}/data`, label: '数据管理', emoji: '🗂️' },
]

export function SettingsNav(): React.JSX.Element {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" aria-label="设置导航">
      {ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="mr-1" aria-hidden>
              {item.emoji}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
