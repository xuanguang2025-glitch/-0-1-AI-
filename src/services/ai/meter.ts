/**
 * 计量与配额（架构 §1.4.6 AI 行 + AiCallLog 表）：
 * - 用户日配额 / 全局日配额检查（ai_capability_config 覆盖）
 * - 每次调用落 ai_call_logs（tokens/latency/status/degraded/cacheHit）
 */
import { prisma } from '@/lib/db'

/** 今日 0 点（UTC） */
function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export interface QuotaCheck {
  allowed: boolean
  quotaLeft: number
  reason?: string
}

/** 用户级日配额检查（TUTOR_CHAT 等高频能力；null = 不限） */
export async function checkUserQuota(userId: string, capability: string, dailyQuotaUser: number | null): Promise<QuotaCheck> {
  if (dailyQuotaUser === null) return { allowed: true, quotaLeft: Number.POSITIVE_INFINITY }
  const used = await prisma.aiCallLog.count({
    where: { userId, capability: capability as never, createdAt: { gte: startOfUtcDay() } },
  })
  const left = Math.max(0, dailyQuotaUser - used)
  return { allowed: left > 0, quotaLeft: left, reason: left > 0 ? undefined : 'AI_QUOTA_EXCEEDED' }
}

export interface CallLogInput {
  userId?: string
  capability: string
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'DEGRADED' | 'RATE_LIMITED' | 'CONTENT_BLOCKED'
  errorCode?: string
  errorMessage?: string
  inputTokens?: number
  outputTokens?: number
  costCents?: number
  latencyMs?: number
  firstTokenMs?: number
  cacheHit?: boolean
  degraded?: boolean
  requestHash?: string
  traceId?: string
  ip?: string
  provider?: string
  model?: string
  promptId?: string
  promptKey?: string
  promptVersion?: number
  configId?: string
}

/** 写调用日志（尽力而为，失败仅控制台告警，不影响主流程） */
export async function writeCallLog(input: CallLogInput): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        userId: input.userId,
        capability: input.capability as never,
        status: input.status,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage?.slice(0, 500),
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        costCents: input.costCents ?? 0,
        latencyMs: input.latencyMs ?? 0,
        firstTokenMs: input.firstTokenMs,
        cacheHit: input.cacheHit ?? false,
        degraded: input.degraded ?? false,
        requestHash: input.requestHash,
        traceId: input.traceId,
        ip: input.ip,
        provider: input.provider,
        model: input.model,
        promptId: input.promptId,
        promptKey: input.promptKey,
        promptVersion: input.promptVersion,
        configId: input.configId,
      },
    })
  } catch (e) {
    console.error('[ai.meter] writeCallLog failed', e instanceof Error ? e.message : e)
  }
}

/** requestHash：input 的 sha256 前 32 位 */
export async function hashRequest(input: unknown): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(JSON.stringify(input ?? null)).digest('hex').slice(0, 32)
}
