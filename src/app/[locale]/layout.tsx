import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'

import { locales, type Locale } from '@/lib/i18n/routing'

/**
 * [locale] 段布局：校验 locale 参数并注入对应 messages（覆盖 root 的默认 zh-CN）。
 */
export function generateStaticParams(): Array<{ locale: Locale }> {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  if (!hasLocale(locales, locale)) notFound()

  const messages = (await import(`../../../messages/${locale}.json`)).default

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
