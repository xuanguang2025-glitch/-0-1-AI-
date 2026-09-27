import Link from 'next/link'

import { ROUTES } from '@/lib/constants/routes'

/**
 * CTA：行动召唤横幅。
 */
export function Cta(): React.JSX.Element {
  return (
    <section className="container-content py-16">
      <div className="rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground">
        <h2 className="text-3xl font-bold">现在开始，5 分钟摸清自己的英语底子</h2>
        <p className="mx-auto mt-3 max-w-md text-sm opacity-90">
          免费 AI 水平测试 → 个性化学习计划 → 每日 30 分钟，21 天养成习惯。
        </p>
        <Link
          href={ROUTES.placement}
          className="mt-8 inline-block rounded-xl bg-background px-8 py-3 text-sm font-medium text-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          免费测一测
        </Link>
      </div>
    </section>
  )
}
