/**
 * 翻译模块前端 DTO（T18）。
 */
export type TranslateStyle = 'literal' | 'natural' | 'formal' | 'academic' | 'spoken'

export interface TranslationStyles {
  literal: string | null
  natural: string | null
  formal: string | null
  academic: string | null
  spoken: string | null
}

export interface TranslationResult {
  id: string
  direction: 'zh2en' | 'en2zh'
  sourceText: string
  styles: TranslationStyles
  notes: string | null
  /** true = AI 完全不可用 */
  degraded: boolean
  /** 哪些档可用 */
  availableStyles: TranslateStyle[]
}

export interface TranslationRecordItem {
  id: string
  direction: string
  sourceText: string
  preview: string | null
  isFavorite: boolean
  createdAt: string
}

export interface TranslationHistoryResult {
  records: TranslationRecordItem[]
  total: number
  page: number
  pageSize: number
}

export interface ExtractedWord {
  word: string
  lemma: string
  meanings: string[]
  inNotebook: boolean
  vocabularyId: string
}

/** 档位中文名 */
export const STYLE_NAMES: Record<TranslateStyle, string> = {
  literal: '直译',
  natural: '地道',
  formal: '正式',
  academic: '学术',
  spoken: '口语',
}

/** 档位展示顺序 */
export const STYLE_ORDER: TranslateStyle[] = ['literal', 'natural', 'formal', 'academic', 'spoken']

/** 输入上限（与后端 MAX_SOURCE_LEN 对应） */
export const MAX_SOURCE_LEN = 500
