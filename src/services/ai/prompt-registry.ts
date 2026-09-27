/**
 * Prompt 注册表：DB ai_prompts（ACTIVE 最高版本）→ seed 兜底。
 * Handlebars 风格 {{var}} 渲染（纯字符串替换，零依赖）。
 */
import { prisma } from '@/lib/db'
import { getSeedPrompt } from './prompts/seed'

export interface ResolvedPrompt {
  key: string
  version: number
  systemPrompt: string
  userTemplate: string
  source: 'db' | 'seed'
}

/** 取 ACTIVE prompt：先 DB，缺失/未发布时回退 seed 文件 */
export async function resolvePrompt(key: string): Promise<ResolvedPrompt> {
  const row = await prisma.aiPrompt.findFirst({
    where: { key, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { key: true, version: true, systemPrompt: true, userTemplate: true },
  })
  if (row) {
    return { key: row.key, version: row.version, systemPrompt: row.systemPrompt, userTemplate: row.userTemplate, source: 'db' }
  }
  const seed = getSeedPrompt(key)
  if (seed) {
    return { key: seed.key, version: seed.version, systemPrompt: seed.systemPrompt, userTemplate: seed.userTemplate, source: 'seed' }
  }
  // 最后兜底：通用模板（保证链路可用）
  return {
    key,
    version: 0,
    systemPrompt: '你是 EnglishAI 智能英语学习平台的助手。用简体中文回答，英文例句保留原文。',
    userTemplate: '【用户输入】{{input}}',
    source: 'seed',
  }
}

/** {{var}} 模板渲染：未提供变量替换为 '(未提供)' */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = vars[name]
    if (value === undefined || value === null) return '(未提供)'
    return typeof value === 'string' ? value : JSON.stringify(value)
  })
}
