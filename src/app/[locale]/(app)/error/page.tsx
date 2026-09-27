'use client'

/**
 * /[locale]/(app)/error — 应用内错误说明页（T10）。
 * 说明常见错误来源与自助排查路径；运行时未捕获错误由 error.tsx 边界接管。
 */
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { ROUTES } from '@/lib/constants/routes'

export default function ErrorGuidePage(): React.JSX.Element {
  return (
    <AppShell>
      <PageContainer narrow>
        <h1 className="text-2xl font-bold">出错了？</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          这里汇总常见错误的排查方式。若页面出现红色错误提示，请先尝试刷新；问题持续时按下表处理。
        </p>

        <ul className="mt-6 space-y-4 text-sm">
          <li className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">网络 / 服务不可用</p>
            <p className="mt-1 text-muted-foreground">
              检查本地数据库是否已启动：<code className="rounded bg-muted px-1">npm run db:start</code>，然后刷新页面。
            </p>
          </li>
          <li className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">登录状态失效（401）</p>
            <p className="mt-1 text-muted-foreground">
              会话过期或被撤销，重新登录即可恢复。
            </p>
          </li>
          <li className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">AI 功能显示「已降级」</p>
            <p className="mt-1 text-muted-foreground">
              未配置 AI Key 时使用内置 Mock 提供方，核心链路不受影响；可在设置 → AI 中查看当前提供方。
            </p>
          </li>
        </ul>

        <div className="mt-8 flex gap-3">
          <Link
            href={ROUTES.dashboard}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            返回仪表盘
          </Link>
          <Link
            href={ROUTES.settings}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            前往设置
          </Link>
        </div>
      </PageContainer>
    </AppShell>
  )
}
