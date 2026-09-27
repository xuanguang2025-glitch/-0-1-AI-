/**
 * next-intl 服务端请求配置（[locale] 段 layout 调用）。
 */
import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'

import { defaultLocale, isLocale, type Locale } from './routing'

// 静态导入（webpack 可静态解析；动态模板在 monorepo 中文路径下不可靠）
import zhCN from '../../../messages/zh-CN.json'
import en from '../../../messages/en.json'

const MESSAGES: Record<Locale, AbstractIntlMessages> = {
  'zh-CN': zhCN as AbstractIntlMessages,
  en: en as AbstractIntlMessages,
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = requested && isLocale(requested) ? requested : defaultLocale

  return {
    locale,
    messages: MESSAGES[locale],
  }
})
