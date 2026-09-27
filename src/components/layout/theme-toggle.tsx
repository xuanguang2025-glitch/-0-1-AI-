'use client'

/**
 * ThemeToggle：Light/Dark/System 三态循环切换（next-themes，SSR 不闪白）。
 */
import { Monitor, Moon, Sun } from 'lucide-react'

import { Tooltip } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'

const ORDER = ['light', 'dark', 'system'] as const
const LABEL: Record<(typeof ORDER)[number], string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme, ready } = useTheme()
  const current = ready ? (theme ?? 'system') : 'system'
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system'

  return (
    <Tooltip label={LABEL[current]}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`切换主题（当前：${LABEL[current]}）`}
        onClick={() => setTheme(next)}
      >
        {!ready || current === 'system' ? <Monitor /> : current === 'light' ? <Sun /> : <Moon />}
      </Button>
    </Tooltip>
  )
}
