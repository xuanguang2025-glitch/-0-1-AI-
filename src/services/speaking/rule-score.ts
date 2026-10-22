/**
 * 口语规则评分引擎（S6，架构 §6.4 —— Phase 2 Mock 阶段的核心兜底）。
 *
 * **设计原则**：
 *   1. **纯函数 + 确定性**：不触 DB/AI/网络，同样输入永远得到同样分数——
 *      单测用 3 组固定输入断言具体 score 数值（验收 2）。
 *   2. **真实计算，非空壳**（架构「降级兜底必须真实计算」原则）：S6 端点
 *      （POST /api/speaking/rule-score，无需 AI）与 `degrade.ts` 的
 *      `SPEAKING_SCORE` 兜底共用本实现，保证 Mock 阶段口语报告有真实数字。
 *   3. **文本级 4 维**（语法/词汇/流利度/自然度的可计算代理指标）：
 *      wpm（语速）/ fillerCount（填充词）/ avgSentenceLen（平均句长）/
 *      coverage（目标句覆盖度）。**不含发音维度**（Web Speech API 无音素数据，
 *      架构师裁决宁缺毋假，UI 不展示该维度）。
 *
 * 权重（设计 §6.4 固定值）：语速 0.3 / 句长 0.25 / 填充词 0.15 / 覆盖度 0.3。
 */

/** 语速最优区间 100-150 wpm 得分最高（设计 §6.4） */
export const WPM_OPTIMAL_MIN = 100
export const WPM_OPTIMAL_MAX = 150
/** 平均句长最优区间 8-18 词 */
export const SENTENCE_LEN_MIN = 8
export const SENTENCE_LEN_MAX = 18
/** 每个填充词扣 12 分 */
export const FILLER_PENALTY = 12

/** 常见口语填充词（小写整词匹配） */
export const FILLERS: readonly string[] = ['um', 'uh', 'er', 'like', 'you know', 'i mean', 'basically']

export interface RuleScoreInput {
  transcript: string
  durationSec: number
  /** 停顿次数（Phase 2 记录但暂不参与加权，接口预留） */
  pauseCount?: number
  /** 场景目标句/关键表达（覆盖度分母） */
  targetWords?: string[]
}

export interface RuleScoreOutput {
  wpm: number
  fillerCount: number
  avgSentenceLen: number
  /** 0-1，目标句覆盖比例；未提供目标句时按设计取 0.6 */
  coverage: number
  /** 0-100 */
  score: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 数出填充词出现次数（整词、大小写不敏感；多词填充词按短语匹配） */
export function countFillers(transcript: string): number {
  const lower = transcript.toLowerCase()
  return FILLERS.reduce((n, f) => n + (lower.match(new RegExp(`\\b${f}\\b`, 'g'))?.length ?? 0), 0)
}

/** 主入口（算法与设计 §6.4 伪代码逐行对应） */
export function ruleScore(i: RuleScoreInput): RuleScoreOutput {
  const words = i.transcript.trim().split(/\s+/).filter(Boolean)
  // 语速：防除零——durationSec < 6s 时按 0.1 分钟（6s）下限处理
  const minutes = Math.max(i.durationSec / 60, 0.1)
  const wpm = Math.round(words.length / minutes)

  const fillerCount = countFillers(i.transcript)

  const sentences = i.transcript.split(/[.!?]+/).filter((s) => s.trim())
  const avgSentenceLen = Math.round(words.length / Math.max(sentences.length, 1))

  // 目标句覆盖度：说出场景关键表达的比例；未提供目标句按设计取 0.6（中性值）
  const coverage =
    i.targetWords !== undefined && i.targetWords.length > 0
      ? i.targetWords.filter((t) => i.transcript.toLowerCase().includes(t.toLowerCase())).length / i.targetWords.length
      : 0.6

  // 语速：100-150 wpm 满分；偏离按每 wpm 扣 1.2
  const wpmScore = wpm >= WPM_OPTIMAL_MIN && wpm <= WPM_OPTIMAL_MAX ? 100 : Math.max(0, 100 - Math.abs(wpm - 125) * 1.2)
  // 句长：8-18 满分；偏离按每词扣 6
  const lenScore = avgSentenceLen >= SENTENCE_LEN_MIN && avgSentenceLen <= SENTENCE_LEN_MAX ? 100 : Math.max(0, 100 - Math.abs(avgSentenceLen - 13) * 6)
  // 填充词：每个扣 12
  const fillerScore = Math.max(0, 100 - fillerCount * FILLER_PENALTY)

  const score = Math.round(wpmScore * 0.3 + lenScore * 0.25 + fillerScore * 0.15 + coverage * 100 * 0.3)
  return { wpm, fillerCount, avgSentenceLen, coverage: Number(coverage.toFixed(2)), score: clamp(score, 0, 100) }
}

/** SPEAKING_SCORE 降级兜底用的便捷包装（degrade.ts 调用） */
export function computeRuleStats(transcript: string, durationSec: number, targetWords?: string[]): RuleScoreOutput {
  return ruleScore({
    transcript,
    durationSec: durationSec > 0 ? durationSec : 60, // 防除零：无时长按 1 分钟计，wpm 仍有意义
    targetWords,
  })
}
