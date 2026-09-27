import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'

import { Providers } from '@/components/providers'
import { defaultLocale, isLocale } from '@/lib/i18n/routing'

import './globals.css'
import '@/styles/tokens.css'
import '@/styles/themes.css'
import '@/styles/utilities.css'

export const metadata: Metadata = {
  title: {
    default: 'EnglishAI · 智能英语学习平台',
    template: '%s · EnglishAI',
  },
  description:
    'EnglishAI —— 以 AI 驱动的英语学习平台：词汇 SRS、听力、口语、阅读、写作、语法、翻译、CET 备考一站式。',
  applicationName: 'EnglishAI',
  keywords: ['英语学习', 'CET-4', 'CET-6', 'AI 学习', 'SRS 背单词'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1116' },
  ],
}

/**
 * 防主题闪白：SSR 阶段读 localStorage 决定 html class（next-themes class 策略的前置内联脚本）。
 */
const themeScript = `
try {
  var s = localStorage.getItem('theme');
  var t = s === 'light' || s === 'dark' ? s : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', t === 'dark');
} catch (e) {}
`

/**
 * Root layout —— 注入 html/body、主题防闪白脚本与全局 Providers。
 * locale 由 NEXT_LOCALE cookie 驱动（next-intl 默认 cookie 名），T06 落地 [locale] 路由段。
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): Promise<React.JSX.Element> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value ?? ''
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale
  const messages = (await import(`../../messages/${locale}.json`)).default

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
