/**
 * 口语模块前端 DTO（T19）。
 */
export interface SpeakingCatalogItem {
  roleKey: string
  name: string
  description: string | null
  difficulty: string
}

export interface SpeakingCatalog {
  roles: SpeakingCatalogItem[]
  scenes: Array<{ sceneKey: string; name: string; description: string | null; difficulty: string; targetWords: string[] }>
}

export interface SpeakingSessionCreated {
  id: string
  roleKey: string
  sceneKey: string
  roleName: string
  sceneName: string
  greeting: string
}

export interface SpeakingMessageItem {
  id: string
  speaker: string
  textContent: string | null
  createdAt: string
}

export interface RuleStats {
  wpm: number
  fillerCount: number
  avgSentenceLen: number
  coverage: number
  score: number
}

export interface SpeakingSessionReport {
  id: string
  roleKey: string
  roleName: string
  sceneKey: string
  sceneName: string
  status: string
  durationSec: number
  messageCount: number
  scoreSource: string
  /** **无"发音"维度**（Phase 2 无音素数据，宁缺毋假） */
  scores: { grammar: number; vocabulary: number; fluency: number; naturalness: number; total: number } | null
  ruleStats: RuleStats | null
  aiSummary: string | null
  aiCorrections: Array<{ sentence: string; correct: string; moreNatural: string | null }> | null
  wasTextInput: boolean
  messages: SpeakingMessageItem[]
}

export interface SpeakingSessionListItem {
  id: string
  roleKey: string
  sceneKey: string
  status: string
  durationSec: number
  messageCount: number
  scoreSource: string
  ruleScore: number | null
  startedAt: string
}

export interface SpeakingSessionListResult {
  sessions: SpeakingSessionListItem[]
  total: number
  page: number
  pageSize: number
}

export const DIFFICULTY_NAMES: Record<string, string> = {
  EASY: '入门',
  MEDIUM: '标准',
  HARD: '挑战',
}
