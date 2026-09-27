/**
 * next-intl 路由配置（架构 §7.6）。
 */
import { defineRouting } from 'next-intl/routing'

export const locales = ['zh-CN', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh-CN'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // 默认语言无前缀，/en/ 前缀给英文
})

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
