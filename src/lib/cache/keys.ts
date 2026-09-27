/**
 * 缓存 key 统一构造（架构 §1.4.7）：避免散落字符串拼接。
 */

export const CACHE_TTL = {
  /** 词库列表 / 语法分类 / 场景角色 */
  reference: 300_000,
  /** Analytics 报表 */
  analytics: 60_000,
  /** AI 结构化结果 */
  aiResult: 24 * 60 * 60_000,
  /** 排行榜 */
  leaderboard: 300_000,
} as const

export const cacheKeys = {
  vocabBooks: (): string => 'vocab:books',
  vocabBook: (slug: string): string => `vocab:book:${slug}`,
  grammarCategories: (): string => 'grammar:categories',
  speakingScenes: (): string => 'speaking:scenes',
  dashboard: (userId: string): string => `dashboard:${userId}`,
  analytics: (userId: string, range: string): string => `analytics:${userId}:${range}`,
  leaderboard: (type: string): string => `leaderboard:${type}`,
  aiResult: (capability: string, inputHash: string): string => `ai:${capability}:${inputHash}`,
} as const
