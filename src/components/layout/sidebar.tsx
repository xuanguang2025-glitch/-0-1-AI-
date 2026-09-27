'use client'

/**
 * Sidebar（桌面 ≥1024）：logo + 分组导航 + 折叠按钮。
 */
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'

import { SidebarNav } from './sidebar-nav'
import { Button } from '@/components/ui/button'
import { useSidebarStore } from '@/stores/sidebar.store'
import { cn } from '@/lib/utils/cn'
import { SIDEBAR_GROUPS } from '@/lib/constants/routes'

export function Sidebar(): React.JSX.Element {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)

  const groupCount = collapsed ? 0 : SIDEBAR_GROUPS.length

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            E
          </span>
          {!collapsed ? <span className="truncate font-semibold">EnglishAI</span> : null}
        </Link>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="主导航">
        <SidebarNav groups={groupCount} />
      </nav>

      {/* 折叠按钮 */}
      <div className="border-t border-border p-2">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleCollapsed}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed ? <span className="text-xs">收起侧栏</span> : null}
        </Button>
      </div>
    </aside>
  )
}
