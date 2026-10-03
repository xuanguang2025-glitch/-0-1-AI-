/**
 * Placement 评分纯函数（架构 §5.5 / PRD Q9）——**无 IO、无 DB 依赖**，可独立单测。
 *
 * 从 `placement.service.ts` 抽离的原因：覆盖率门禁只对「确定性纯算法」设阈值。
 * 原文件把纯评分与 DB 编排（startTest/submitTest/getReport）混在一起，
 * 后者需要真实 DB 才能覆盖，会把纯算法文件的覆盖率稀释到门禁线以下
 * （实测 32%），导致门禁要么失效要么被迫调到无意义的下限。
 *
 * 本文件的所有导出在 `placement.service.ts` 里有同名 re-export，
 * 既有 import 路径与调用方无需改动。
 */

/** 维度标识（与 prisma Question.tags 里的维度名一致） */
export type Dimension = 'vocabulary' | 'grammar' | 'reading' | 'listening'

/** 全部维度（抽题遍历顺序） */
export const DIMENSIONS: readonly Dimension[] = ['vocabulary', 'grammar', 'reading', 'listening']

/** Placement 固定题量（PRD Q9：Phase 1 固定 30 题非自适应） */
export const PLACEMENT_QUESTION_COUNT = 30

/** 四维得分（0-100） */
export interface PlacementScores {
  vocabulary: number
  grammar: number
  reading: number
  listening: number
  overall: number
}

/** 单题作答记录（落 placement_tests.answers 槽位） */
export interface PlacementAnswer {
  questionId: string
  userAnswer: string
  isCorrect: boolean
  dimension: string
  responseMs: number
}

/**
 * 维度权重（PRD Q9 / §十一）：词汇 30% / 语法 30% / 阅读 25% / 听力 15%。
 * 评分与抽题配比共用同一份权重常量，保证「怎么算分」与「出几道题」口径一致。
 */
export const DIMENSION_WEIGHTS: Readonly<Record<Dimension, number>> = {
  vocabulary: 0.3,
  grammar: 0.3,
  reading: 0.25,
  listening: 0.15,
}

/** 维度得分：正确率 0-100；维度 0 题时给 40（保守中位） */
export function dimensionScore(correct: number, total: number): number {
  if (total <= 0) return 40
  return Math.round((correct / total) * 100)
}

/** 总分 = 四维加权（词汇 30% / 语法 30% / 阅读 25% / 听力 15%，PRD Q9） */
export function overallScore(scores: Omit<PlacementScores, 'overall'>): number {
  return Math.round(
    scores.vocabulary * DIMENSION_WEIGHTS.vocabulary +
      scores.grammar * DIMENSION_WEIGHTS.grammar +
      scores.reading * DIMENSION_WEIGHTS.reading +
      scores.listening * DIMENSION_WEIGHTS.listening,
  )
}

/** CEFR 档位（与 prisma CEFRLevel 枚举一致） */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** 分数 → CEFR（架构 §5.5 mapCefr：88/78/65/50/33 五段 + C2 顶档） */
export function scoreToCefr(overall: number): CefrLevel {
  if (overall >= 88) return 'C2'
  if (overall >= 78) return 'C1'
  if (overall >= 65) return 'B2'
  if (overall >= 50) return 'B1'
  if (overall >= 33) return 'A2'
  return 'A1'
}

/** 文档别名（§5.5 mapCefr） */
export const mapCefr = scoreToCefr

/** CET 基准分（§5.5 CET_BASE，710 分制） */
export const CET_BASE: Readonly<Record<CefrLevel, number>> = {
  A1: 220,
  A2: 330,
  B1: 420,
  B2: 520,
  C1: 600,
  C2: 660,
}

/** 各档位在 0-100 综合分区间内的中心点（§5.5 BAND_CENTER，用于档内线性微调） */
export const BAND_CENTER: Readonly<Record<CefrLevel, number>> = {
  A1: 20,
  A2: 42,
  B1: 58,
  B2: 72,
  C1: 84,
  C2: 94,
}

/** CET 估算上下限（§5.5 clamp 区间） */
export const CET_MIN = 220
export const CET_MAX = 700

/** 数值夹取 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 单科 CET 估算（§5.5 estimateCet）：
 * base = CET_BASE[level]；adjust = round(0.5 × (overall − BAND_CENTER[level]))；
 * CET-6 同水平略低（×0.92）；结果 clamp 到 [220, 700]。
 */
export function estimateCetFor(overall: number, level: CefrLevel, exam: 'CET4' | 'CET6'): number {
  const base = CET_BASE[level]
  const adjust = Math.round(0.5 * (overall - BAND_CENTER[level]))
  const raw = exam === 'CET4' ? base + adjust : (base + adjust) * 0.92
  return clamp(Math.round(raw), CET_MIN, CET_MAX)
}

/** CET-4 / CET-6 双科估算（落库到 placement_tests.cetEstimate） */
export function estimateCet(overall: number, level: CefrLevel): { cet4: number; cet6: number } {
  return {
    cet4: estimateCetFor(overall, level, 'CET4'),
    cet6: estimateCetFor(overall, level, 'CET6'),
  }
}

/**
 * 按维度权重把总题量分配到四个维度（最大余额法，整数且总和守恒）。
 * PRD Q9 固定 30 题 → 词汇 9 / 语法 9 / 阅读 8 / 听力 4。
 */
export function allocateQuestionCounts(total: number): Record<Dimension, number> {
  const exact = DIMENSIONS.map((d) => ({ dim: d, value: total * DIMENSION_WEIGHTS[d] }))
  const counts = Object.fromEntries(DIMENSIONS.map((d) => [d, 0])) as Record<Dimension, number>
  let assigned = 0
  for (const item of exact) {
    const floor = Math.floor(item.value)
    counts[item.dim] = floor
    assigned += floor
  }
  // 余数按小数部分从大到小补齐（保证总和 === total）
  const remainders = exact
    .map((item) => ({ dim: item.dim, frac: item.value - Math.floor(item.value) }))
    .sort((a, b) => b.frac - a.frac)
  for (let i = 0; assigned < total && i < remainders.length; i += 1) {
    const target = remainders[i]!
    counts[target.dim] += 1
    assigned += 1
  }
  return counts
}
