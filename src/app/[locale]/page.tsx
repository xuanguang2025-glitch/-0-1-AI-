/**
 * Landing 首页（[locale] 段）：静态优先，TTI ≤ 3s。
 * Hero / Features / CTA / Footer 拆分于 features/landing/components。
 */
import { Hero } from '@/features/landing/components/hero'
import { Features } from '@/features/landing/components/features'
import { Cta } from '@/features/landing/components/cta'
import { Footer } from '@/features/landing/components/footer'

export default function LandingPage(): React.JSX.Element {
  return (
    <main className="min-h-dvh bg-background">
      <Hero />
      <Features />
      <Cta />
      <Footer />
    </main>
  )
}
