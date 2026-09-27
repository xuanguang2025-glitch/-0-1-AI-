'use client'

/**
 * TopNav：顶栏（移动端汉堡菜单 + 主题/语言/用户菜单）。
 */
import { Menu } from 'lucide-react'

import { LocaleSwitcher } from './locale-switcher'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui.store'
import { UI } from '@/lib/constants/ui'

export function TopNav({ onMenuClick }: { onMenuClick?: () => void }): React.JSX.Element {
  const confirmOpen = useUiStore((s) => s.confirm.open)

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6"
      style={{ height: UI.topNavHeight }}
      role="banner"
    >
      <div className="flex items-center gap-2">
        {/* 移动端菜单按钮（lg 以下显示） */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="打开菜单"
          disabled={confirmOpen}
        >
          <Menu />
        </Button>
        <span className="text-sm font-medium text-muted-foreground lg:hidden">EnglishAI</span>
      </div>

      <div className="flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
