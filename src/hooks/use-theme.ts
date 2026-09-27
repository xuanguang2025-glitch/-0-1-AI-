'use client'

/**
 * use-theme：next-themes 薄封装，收敛主题三态（light/dark/system）。
 */
import { useTheme as useNextTheme } from 'next-themes'

import { useMounted } from './use-mounted'

export type ThemePreference = 'light' | 'dark' | 'system'

export function useTheme(): {
  theme: ThemePreference
  resolvedTheme: 'light' | 'dark' | undefined
  setTheme: (t: ThemePreference) => void
  /** SSR 水合完成前 resolvedTheme 不可信 */
  ready: boolean
} {
  const { theme, resolvedTheme, setTheme } = useNextTheme()
  const ready = useMounted()
  return {
    theme: (theme as ThemePreference) ?? 'system',
    resolvedTheme: resolvedTheme as 'light' | 'dark' | undefined,
    setTheme: (t: ThemePreference) => setTheme(t),
    ready,
  }
}
