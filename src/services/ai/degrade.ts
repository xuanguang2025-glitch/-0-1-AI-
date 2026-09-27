/**
 * 降级兜底（架构 §4.4 降级矩阵）：AI 失败/超时/结构非法时按能力返回本地兜底内容。
 * degraded=true 语义：data 为兜底内容，前端展示 AiDegradedBanner。
 */
import { getSeedPrompt } from './prompts/seed'
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
      return {
        totalScore: 0,
        dimensions: { content: 0, organisation: 0, language: 0, accuracy: 0 },
        overallComment: 'AI 批改暂时不可用，已保存你的作文。稍后可在记录页重新提交批改。',
        sentences: [],
        modelEssay: null,
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
