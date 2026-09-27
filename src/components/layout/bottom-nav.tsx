'use client'

/**
 * BottomNav：移动端底部导航（<md 显示，PRD §5.2）。
 */
import {
  Book, ClipboardList, Home, MessageCircle, User, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils/cn'
import { BOTTOM_NAV_ITEMS } from '@/lib/constants/routes'
import type { NavIcon } from '@/lib/constants/ui'
import { UI } from '@/lib/constants/ui'

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  book: Book,
  message: MessageCircle,
  clipboard: ClipboardList,
  user: User,
  headphones: Home,
  mic: Home,
  bookOpen: Home,
  penLine: Home,
  spellCheck: Home,
  languages: Home,
  target: Home,
  trophy: Home,
  chart: Home,
  settings: Home,
}

const LABELS: Record<string, string> = {
  'nav.dashboard': '仪表盘',
  'nav.vocabulary': '词汇',
  'nav.tutor': '学伴',
  'nav.exam': '模考',
  'nav.profile': '我的',
}

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ height: UI.bottomNavHeight }}
      aria-label="底部导航"
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon] ?? Home
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" />
            {LABELS[item.labelKey] ?? item.labelKey}
          </Link>
        )
      })}
    </nav>
  )
}
