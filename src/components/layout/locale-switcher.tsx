'use client'

/**
 * LocaleSwitcher：中/英切换（next-intl；Phase 1 经 cookie + 刷新，[locale] 路由落地 T06）。
 */
import { Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

export function LocaleSwitcher(): React.JSX.Element {
  const locale = useLocale()
  const router = useRouter()

  const toggle = (): void => {
    const next = locale === 'zh-CN' ? 'en' : 'zh-CN'
    // 写 cookie（next-intl 默认读取 NEXT_LOCALE）后刷新生效
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="切换语言" className="gap-1.5">
      <Globe className="h-4 w-4" />
      <span className="hidden text-xs sm:inline">{locale === 'zh-CN' ? '中' : 'EN'}</span>
    </Button>
  )
}
