import Link from 'next/link'

import { ROUTES } from '@/lib/constants/routes'

/**
 * Hero：首屏主视觉（纯 CSS，无图片/无 JS 依赖 → TTI 快）。
 */
export function Hero(): React.JSX.Element {
  return (
    <section className="container-content flex flex-col items-center py-20 text-center lg:py-28">
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
        AI 驱动 · CET-4/6 · 雅思托福
      </span>
      <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
        让 AI 陪你把英语
        <span className="text-primary">学到能用</span>
      </h1>
      <p className="mt-5 max-w-xl text-base text-muted-foreground">
        词汇 SRS 科学记忆 · 听说读写全维度练习 · AI 学伴 24 小时陪练 ·
        真题模考与个性化备考规划，一站式完成。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ROUTES.register}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          免费开始学习
        </Link>
        <Link
          href={ROUTES.login}
          className="rounded-xl border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          我已有账号
        </Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">注册即测 · 5 分钟定位你的真实水平</p>
    </section>
  )
}
