'use client'

/**
 * AppShell：全局响应式布局骨架。
 * ≥1024：Sidebar + TopNav；≤768：TopNav + BottomNav；中间：TopNav。
 */
import type { ReactNode } from 'react'

import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'
import { BottomNav } from './bottom-nav'
import { MobileNavDrawer } from './mobile-nav-drawer'
import { useSidebarStore } from '@/stores/sidebar.store'
import { hydrateSidebar } from '@/stores/sidebar.store'
import { useMounted } from '@/hooks/use-mounted'
import { cn } from '@/lib/utils/cn'
import { UI } from '@/lib/constants/ui'

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const mobileOpen = useSidebarStore((s) => s.mobileOpen)
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)
  const mounted = useMounted()

  if (typeof window !== 'undefined' && !hydrated) hydrateOnce()

  return (
    <div className="min-h-dvh bg-background">
      {/* 桌面侧边栏（lg+） */}
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar />
      </div>

      {/* 主列 */}
      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-200',
          mounted && collapsed ? 'lg:pl-[64px]' : 'lg:pl-[240px]',
        )}
        style={{ ['--shell-sidebar' as string]: `${UI.sidebarWidth}px` }}
      >
        <TopNav onMenuClick={() => setMobileOpen(true)} />
        <main className="container-content flex-1 pb-24 lg:pb-10">{children}</main>
        {/* 移动端底部导航（<md） */}
        <BottomNav />
      </div>

      {/* 移动端抽屉 */}
      <MobileNavDrawer open={mounted && mobileOpen} onOpenChange={setMobileOpen} />
    </div>
  )
}

let hydrated = false
function hydrateOnce(): void {
  if (hydrated) return
  hydrated = true
  hydrateSidebar()
}
