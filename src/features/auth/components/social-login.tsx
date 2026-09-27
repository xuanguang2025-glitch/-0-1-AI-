'use client'

/**
 * SocialLogin：第三方登录占位（Phase 1 FEATURE_SOCIAL_LOGIN=false 时隐藏）。
 */
import { appConfig } from '@/lib/constants/config'

export function SocialLogin(): React.JSX.Element | null {
  if (!appConfig.features.socialLogin) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        或使用第三方登录
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm opacity-60"
          title="即将上线"
        >
          微信登录
        </button>
        <button
          type="button"
          disabled
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm opacity-60"
          title="即将上线"
        >
          QQ 登录
        </button>
      </div>
    </div>
  )
}
