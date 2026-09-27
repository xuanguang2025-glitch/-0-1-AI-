'use client'

/**
 * SidebarNav：SIDEBAR_GROUPS 渲染（图标映射 lucide）。
 */
import {
  Book, BookOpen, ChartLine, ClipboardList, Headphones, Home, Languages,
  Mic, PenLine, Settings, SpellCheck, Target, Trophy, User, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils/cn'
import { SIDEBAR_GROUPS } from '@/lib/constants/routes'
import type { NavIcon } from '@/lib/constants/ui'

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  book: Book,
  message: Home, // T09 AI 学伴上线时替换为 MessageCircle
  clipboard: ClipboardList,
  user: User,
  headphones: Headphones,
  mic: Mic,
  bookOpen: BookOpen,
  penLine: PenLine,
  spellCheck: SpellCheck,
  languages: Languages,
  target: Target,
  trophy: Trophy,
  chart: ChartLine,
  settings: Settings,
}

export function SidebarNav({ groups }: { groups?: number }): React.JSX.Element {
  const pathname = usePathname()
  const list = typeof groups === 'number' ? SIDEBAR_GROUPS.slice(0, Math.max(0, groups)) : SIDEBAR_GROUPS

  return (
    <div className="space-y-4 px-2">
      {list.map((group) => (
        <div key={group.labelKey}>
          <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {group.labelKey === 'nav.group.learn' ? '学习' : group.labelKey === 'nav.group.exam' ? '备考' : '我的'}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Home
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground/80 hover:bg-surface-muted hover:text-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{labelOf(item.labelKey)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Phase 1 简化映射；T06 接入 next-intl 后替换为 t(labelKey) */
function labelOf(key: string): string {
  const MAP: Record<string, string> = {
    'nav.dashboard': '仪表盘',
    'nav.vocabulary': '词汇',
    'nav.listening': '听力',
    'nav.speaking': '口语',
    'nav.reading': '阅读',
    'nav.writing': '写作',
    'nav.grammar': '语法',
    'nav.translation': '翻译',
    'nav.exam': '模考',
    'nav.placement': '水平测试',
    'nav.profile': '个人中心',
    'nav.achievements': '成就',
    'nav.analytics': '学习分析',
    'nav.settings': '设置',
    'nav.tutor': 'AI 学伴',
  }
  return MAP[key] ?? key
}
