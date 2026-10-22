/**
 * 降级兜底（架构 §4.4 降级矩阵）：AI 失败/超时/结构非法时按能力返回本地兜底内容。
 * degraded=true 语义：data 为兜底内容，前端展示 AiDegradedBanner。
 */
import { getSeedPrompt } from './prompts/seed'
import { computeRuleStats } from '@/services/speaking/rule-score'
import { runRuleCheck } from '@/services/writing/rule-engine'
import type { AiCapabilityKey } from './types'

/** 通用兜底对象：按能力键给最小可用结构 */
export function buildFallback(capability: AiCapabilityKey, input: unknown): unknown {
  const inp = (input ?? {}) as Record<string, unknown>

  switch (capability) {
    case 'WORD_EXPLAIN':
      return {
        word: String(inp.word ?? ''),
        phoneticUk: null,
        phoneticUs: null,
        senses: [{ pos: 'n.', zh: '（离线释义暂不可用）', en: null }],
        rootAffix: null,
        mnemonic: '离线模式：请稍后重试获取 AI 讲解。',
        examples: [],
        collocations: null,
      }
    case 'WRITING_REVIEW':
      // §4.2：兜底必须**真实计算**——corrections 由写作规则引擎产出（非空）
      {
        const essayText = typeof inp.content === 'string' ? inp.content : typeof inp.essayText === 'string' ? inp.essayText : ''
        const check = runRuleCheck(essayText, {})
        return {
          totalScore: 0,
          dimensions: { content: 0, organisation: 0, language: 0, accuracy: 0 },
          overallComment: 'AI 批改暂时不可用，已保存你的作文。以下为本地规则检查结果，稍后可重新提交批改。',
          sentences: check.issues.map((i) => ({
            original: i.excerpt ?? i.message,
            corrected: null,
            issue: `${i.message}（-${i.deduction} 分）`,
          })),
          modelEssay: null,
        }
      }
    case 'DAILY_DIAGNOSIS':
      return {
        insights: [{ kind: 'offline', text: 'AI 诊断暂时不可用。坚持完成今日任务就是最好的进步！' }],
        tomorrowTip: '明天继续来，保持学习节奏。',
        cheer: '加油！💪',
      }
    case 'PLAN_GENERATE':
    case 'PLAN_ADJUST':
      return {
        summary: '（离线兜底计划）按默认节奏执行：每日 30 分钟，词汇+听力+阅读均衡分配。',
        weeks: [
          {
            week: 1,
            focus: '恢复节奏',
            tasks: [
              { type: 'vocab', title: '背 20 个新词', minutes: 10, detail: null },
              { type: 'listening', title: '精听 1 篇短对话', minutes: 10, detail: null },
              { type: 'reading', title: '精读 1 篇短文', minutes: 10, detail: null },
            ],
          },
        ],
        tips: ['离线兜底计划：AI 计划恢复后将自动优化。'],
      }
    case 'RECOMMEND':
      return []
    case 'CET_ADVICE':
      return {
        summary: 'AI 备考建议暂时不可用。通用建议：近 3 周错题集中复习 + 每日 1 篇听力精听。',
        focusAreas: [],
      }
    case 'TUTOR_CHAT':
      return '（离线兜底）我暂时无法连接 AI 服务，稍后再聊。你可以先完成今天的背单词任务哦！'
    // ---- Phase 2 补齐（§4.2：8 → 13 项）----
    case 'SPEAKING_SCORE':
      // 兜底必须真实计算：ruleStats 由 S6 规则评分产出（ruleStats.wpm > 0）
      return {
        total: 0,
        grammar: null,
        vocabulary: null,
        fluency: null,
        naturalness: null,
        summary: 'AI 评分暂不可用，已切换为口语统计分析',
        ruleStats: computeRuleStats(
          typeof inp.transcript === 'string' ? inp.transcript : '',
          typeof inp.durationSec === 'number' ? inp.durationSec : 60,
        ),
      }
    case 'LISTENING_ANALYZE':
      return {
        suggestions: ['先用「精听」模式逐句听写，定位连读与弱读问题'],
        weakSpots: Array.isArray(inp.unknownWords)
          ? (inp.unknownWords as unknown[]).slice(0, 10).map((w) => ({ word: String(w), type: 'unknown' }))
          : [],
        nextMaterials: [],
      }
    case 'READING_EXPLAIN':
      // 隐藏 AI 区块（架构 §4.7：原文+词典+预置题仍完整展示，AI 块消失）
      return null
    case 'READING_QUIZ_GENERATE':
      // 回落 seed 预置题（阅读详情页已内置，AI 出题失败不影响答题）
      return {
        questions: Array.isArray(inp.fallbackQuestions) ? inp.fallbackQuestions : [],
        source: 'preset',
      }
    case 'MISTAKE_CLASSIFY':
      // §4.1：显示正确答案 + 知识点，错因分类「未分类」（AI 分类不可用时不阻塞）
      return {
        category: '未分类',
        confidence: 0,
        suggestion: 'AI 错因分类暂不可用，请结合正确答案与解析自行归纳。',
      }
    case 'TRANSLATE':
      // 文本能力（schema=null）→ 返回离线文案；translation.service 将字符串映射为 literal 档
      return '（离线兜底）AI 翻译暂不可用，请稍后重试。'
    case 'GRAMMAR_EXPLAIN':
      return {
        answer: typeof inp.answer === 'string' ? inp.answer : '',
        explanation: typeof inp.staticExplanation === 'string' ? inp.staticExplanation : '该知识点暂无 AI 讲解，可结合例句与练习巩固。',
        examples: Array.isArray(inp.examples) ? inp.examples : [],
        miniExercise: null,
        source: 'static',
      }
    default:
      return null
  }
}

/** 降级原因 → 用户可读文案（AiDegradedBanner 用） */
export function degradedReasonText(reason: string): string {
  if (reason.includes('timeout') || reason.includes('aborted')) return 'AI 响应超时'
  if (reason.includes('Struct') || reason.includes('JSON')) return 'AI 输出异常'
  if (reason.includes('HTTP')) return 'AI 服务不可用'
  return 'AI 暂不可用'
}

export { getSeedPrompt }
