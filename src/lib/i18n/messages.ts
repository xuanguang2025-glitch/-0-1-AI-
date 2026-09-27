/**
 * 静态 messages 映射（布局/页面共用；webpack 可静态解析，
 * 动态模板 import 在中文路径下不可靠）。
 */
import type { AbstractIntlMessages } from 'next-intl'

import type { Locale } from './routing'

import zhCN from '../../../messages/zh-CN.json'
import en from '../../../messages/en.json'

const MESSAGES: Record<Locale, AbstractIntlMessages> = {
  'zh-CN': zhCN as AbstractIntlMessages,
  en: en as AbstractIntlMessages,
}

/** 按 locale 取 messages（未知 locale 回退默认） */
export function getMessages(locale: Locale): AbstractIntlMessages {
  return MESSAGES[locale] ?? MESSAGES['zh-CN']
}
