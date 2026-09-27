/**
 * 词汇模块共享类型（与 service 返回结构对齐）。
 */

export interface WordSummary {
  id: string
  word: string
  phoneticUk: string | null
  phoneticUs: string | null
  pos: string[] | null
  definitions: Array<{ pos?: string; zh?: string; en?: string }>
  examples?: Array<{ en?: string; zh?: string }> | null
  difficulty: string
  cefrLevel?: string | null
  derivatives?: unknown
}

export interface ReviewQueueItem {
  userVocabId: string
  masteryScore: number
  stage: string
  intervalDays: number
  vocabulary: WordSummary
}

export interface TodayWords {
  book: { slug: string; name: string }
  words: WordSummary[]
}

export interface ReviewQueue {
  dueCount: number
  items: ReviewQueueItem[]
}

export interface ReviewResult {
  newMastery: number
  newStage: string
  newIntervalDays: number
  nextReviewAt: string
  path: string
  intervalPredictions: number[]
  duplicate: boolean
}

export interface VocabularyBookDto {
  id: string
  slug: string
  name: string
  description: string | null
  wordCount: number
}

export interface NotebookItem {
  userVocabId: string
  masteryScore: number
  stage: string
  nextReviewAt: string | null
  vocabulary: { id: string; word: string; phoneticUk: string | null; definitions: Array<{ pos?: string; zh?: string; en?: string }> }
}

export interface MasteryOverview {
  total: number
  byStage: Record<string, number>
}

export interface RecordItem {
  id: string
  word: string
  rating: number
  isCorrect: boolean
  prevStage: string
  newStage: string
  newIntervalDays: number
  occurredAt: string
}

export interface WordState {
  id: string
  masteryScore: number
  masteryStage: string
  intervalDays: number
  nextReviewAt: string | null
  lastReviewedAt: string | null
  reviewCount: number
  correctCount: number
  wrongCount: number
  inNotebook: boolean
  learnedAt: string | null
}

export interface WordDetail {
  word: WordSummary & {
    synonyms?: unknown
    antonyms?: unknown
    collocations?: unknown
    mnemonic?: string | null
    rootAffix?: string | null
    frequencyRank?: number | null
  }
  state: WordState | null
}
