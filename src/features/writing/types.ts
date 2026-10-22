/**
 * 写作模块前端 DTO（T17）。
 *
 * 与 `src/services/writing.service.ts` 对应，显式重复声明以避免把 Prisma 运行时
 * 拖进浏览器 bundle（与 reading/grammar 同套路）。
 */

export interface WritingRequiredWords {
  min: number
  max: number
}

/** 规则引擎问题（与 rule-engine 的 RuleIssue 对应） */
export interface WritingRuleIssue {
  rule: 'spelling' | 'sentenceLength' | 'connectors' | 'paragraphs' | 'passiveVoice'
  message: string
  deduction: number
  excerpt?: string
}

export interface WritingTaskListItem {
  id: string
  title: string
  taskType: string
  difficulty: string
  examType: string | null
  prompt: string
  wordMin: number | null
  wordMax: number | null
  tags: string[]
  mySubmissionCount: number
}

export interface WritingTaskListResult {
  tasks: WritingTaskListItem[]
  total: number
}

export interface WritingSubmissionListItem {
  id: string
  taskId: string
  taskTitle: string
  title: string | null
  wordCount: number
  status: string
  ruleCheckScore: number | null
  scoreSource: string
  aiTotalScore: number | null
  updatedAt: string
}

export interface WritingSubmissionListResult {
  submissions: WritingSubmissionListItem[]
  total: number
  page: number
  pageSize: number
}

export interface WritingRuleStats {
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  longSentences: number
  passiveCount: number
  connectorCount: number
  spellingErrors: string[]
}

export interface WritingRuleCheck {
  score: number
  issues: WritingRuleIssue[]
  stats: WritingRuleStats
  passed: boolean
}

export interface WritingSubmissionDetail {
  id: string
  taskId: string
  taskTitle: string
  prompt: string
  title: string | null
  content: string
  wordCount: number
  paragraphCount: number
  requiredWords: WritingRequiredWords
  wordCountOk: boolean
  ruleCheck: WritingRuleCheck | null
  ruleCheckScore: number | null
  aiScores: Record<string, unknown> | null
  aiTotalScore: number | null
  aiCorrections: Array<{ original: string; issue: string; fixed: string; reason: string }> | null
  aiRewrites: Record<string, string> | null
  aiSummary: string | null
  scoreSource: string
  aiDegraded: boolean
  revision: number
  status: string
  submittedAt: string | null
  scoredAt: string | null
}

export interface WritingCreateResult {
  id: string
  wordCount: number
  paragraphCount: number
  ruleCheck: WritingRuleCheck
  ruleCheckScore: number
  requiredWords: WritingRequiredWords
  wordCountOk: boolean
}

export interface WritingAnalyzeResult {
  id: string
  scoreSource: 'rule' | 'ai'
  aiDegraded: boolean
  ruleCheckScore: number
  aiTotalScore: number | null
  revision: number
  aiSummary: string | null
}

export interface WritingReport {
  submissionId: string
  taskId: string
  taskTitle: string
  prompt: string
  title: string | null
  wordCount: number
  paragraphCount: number
  requiredWords: WritingRequiredWords
  wordCountOk: boolean
  scoreSource: 'rule' | 'ai'
  aiDegraded: boolean
  ruleScore: number
  ruleIssues: WritingRuleIssue[]
  aiTotalScore: number | null
  aiScores: Record<string, unknown> | null
  aiSummary: string | null
  corrections: Array<{ original: string; issue: string; fixed: string; reason: string }> | null
  rewrites: Record<string, string> | null
  revision: number
}

/** 难度中文名 */
export const DIFFICULTY_NAMES: Record<string, string> = {
  EASY: '入门',
  MEDIUM: '标准',
  HARD: '挑战',
}

/** 规则中文名 */
export const RULE_NAMES: Record<string, string> = {
  spelling: '拼写',
  sentenceLength: '句长',
  connectors: '连接词',
  paragraphs: '分段',
  passiveVoice: '被动语态',
}
