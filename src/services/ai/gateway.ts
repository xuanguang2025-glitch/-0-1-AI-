/**
 * AI Gateway（架构 §4.1-4.4）：所有 AI 能力的单一入口。
 * run          = 配置检查 → 配额 → 缓存 → Prompt 装配 → Provider → 结构守卫（修补重试 1 次）→ 计量 → 失败 failover → 降级
 * stream       = 流式分帧；降级以 {kind:'degraded'} 事件通知（deviation：比 doc 的纯 string 更显式）
 * streamStruct = 流文本 + 结束结构校验
 * status       = 能力可用性 + 配额余量
 */

import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger/logger'
import { getProvider } from './providers'
import { renderTemplate, resolvePrompt } from './prompt-registry'
import { getCapabilityConfig, type CapabilityConfigSnapshot } from './registry'
import { buildFallback } from './degrade'
import { checkUserQuota, hashRequest, writeCallLog } from './meter'
import { guardStruct, validateStruct, extractJson, StructInvalidError } from './struct-guard'
import type { AiCapabilityKey, AiCapabilityStatus, AiResult, AiRunContext, ChatMessage } from './types'

const log = createLogger('ai.gateway')

const globalForCache = globalThis as unknown as { __aiResultCache?: Map<string, { data: unknown; expiresAt: number }> }
const resultCache: Map<string, { data: unknown; expiresAt: number }> =
  globalForCache.__aiResultCache ?? new Map()
globalForCache.__aiResultCache = resultCache

const CACHE_TTL = 24 * 60 * 60_000

/** 装配 messages */
async function assemble(capability: AiCapabilityKey, input: unknown): Promise<{ messages: ChatMessage[]; promptId?: string; promptVersion?: number; source: string }> {
  const prompt = await resolvePrompt(capability)
  const userContent = renderTemplate(prompt.userTemplate, (input ?? {}) as Record<string, unknown>)
  let promptId: string | undefined
  try {
    const row = await prisma.aiPrompt.findFirst({
      where: { key: capability, version: prompt.version },
      select: { id: true },
    })
    promptId = row?.id
  } catch {
    /* promptId 仅冗余，查询失败不阻塞 */
  }
  return {
    messages: [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: userContent },
    ],
    promptId,
    promptVersion: prompt.version,
    source: prompt.source,
  }
}

async function callOnce(
  cfg: CapabilityConfigSnapshot,
  messages: ChatMessage[],
  ctx: AiRunContext,
  jsonMode: boolean,
): Promise<{ raw: string; usage: { inputTokens: number; outputTokens: number }; latencyMs: number }> {
  const provider = getProvider(cfg.providerKey)
  const started = Date.now()
  let raw = ''

  const iterable = provider.complete({
    messages,
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    stream: false, // 非流式结构化路径统一非流式（流式仅 TUTOR_CHAT 直通）
    jsonMode,
    timeoutMs: cfg.timeoutMs,
    firstTokenTimeoutMs: cfg.firstTokenTimeoutMs,
    signal: ctx.signal,
  })
  for await (const chunk of iterable) {
    raw += chunk.text
  }
  const usage = await iterable.usage()
  return { raw, usage, latencyMs: Date.now() - started }
}

/**
 * 非流式结构化运行（T>void 时由调用方传入 schema；schema=null 表示纯文本能力）。
 */
async function runImpl<T>(
  capability: AiCapabilityKey,
  input: unknown,
  ctx: AiRunContext,
  schemaName: string | null,
): Promise<AiResult<T>> {
  const started = Date.now()
  const cfg = await getCapabilityConfig(capability)
  const rHash = await hashRequest([capability, input])

  // ---- 能力开关 ----
  if (!cfg.enabled) {
    return {
      data: buildFallback(capability, input) as T,
      degraded: true,
      degradedReason: 'AI_CAPABILITY_DISABLED',
      tokensUsed: 0,
      latencyMs: Date.now() - started,
      cacheHit: false,
    }
  }

  // ---- 配额 ----
  const quota = await checkUserQuota(ctx.userId, capability, cfg.dailyQuotaUser)
  if (!quota.allowed) {
    await writeCallLog({
      userId: ctx.userId, capability, status: 'RATE_LIMITED', errorCode: 'AI_QUOTA_EXCEEDED',
      requestHash: rHash, traceId: ctx.traceId, provider: cfg.providerKey, model: cfg.model,
    })
    return {
      data: buildFallback(capability, input) as T,
      degraded: true,
      degradedReason: 'AI_QUOTA_EXCEEDED',
      tokensUsed: 0,
      latencyMs: Date.now() - started,
      cacheHit: false,
    }
  }

  // ---- 结果缓存（非流式 + 开启缓存）----
  if (cfg.cacheEnabled) {
    const hit = resultCache.get(`${capability}:${rHash}`)
    if (hit && hit.expiresAt > Date.now()) {
      return {
        data: hit.data as T,
        degraded: false,
        tokensUsed: 0,
        latencyMs: Date.now() - started,
        cacheHit: true,
      }
    }
  }

  const { messages, promptId, promptVersion } = await assemble(capability, input)
  const schemaNameResolved = schemaName
  const needsStruct = schemaNameResolved !== null

  // ---- 主调用 + 修补重试 1 次 ----
  let attemptError: string | null = null
  for (let attempt = 0; attempt <= Math.max(1, cfg.maxRetries); attempt += 1) {
    try {
      const { raw, usage, latencyMs } = await callOnce(cfg, messages, ctx, needsStruct)
      const costCents = getProvider(cfg.providerKey).estimateCost(usage, cfg.model)

      if (!needsStruct) {
        // 纯文本
        await writeCallLog({
          userId: ctx.userId, capability, status: 'SUCCESS', inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens, costCents, latencyMs, requestHash: rHash, traceId: ctx.traceId,
          provider: cfg.providerKey, model: cfg.model, promptId, promptVersion, promptKey: capability,
        })
        const result: AiResult<T> = {
          data: raw as unknown as T, degraded: false, provider: cfg.providerKey, model: cfg.model,
          promptVersion, tokensUsed: usage.inputTokens + usage.outputTokens, latencyMs, cacheHit: false,
        }
        if (cfg.cacheEnabled) resultCache.set(`${capability}:${rHash}`, { data: result.data, expiresAt: Date.now() + CACHE_TTL })
        return result
      }

      // 结构化
      const parsed = extractJson(raw)
      // validateStruct 需要具体 schema；此处经 outputSchema 注册表解析
      const { getOutputSchema } = await import('./schemas')
      const schema = getOutputSchema(schemaNameResolved)
      const data = schema ? validateStruct(schema, parsed) : parsed
      if (data === null) throw new StructInvalidError('AI 输出不符合 Schema')

      await writeCallLog({
        userId: ctx.userId, capability, status: 'SUCCESS', inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens, costCents, latencyMs, requestHash: rHash, traceId: ctx.traceId,
        provider: cfg.providerKey, model: cfg.model, promptId, promptVersion, promptKey: capability,
      })
      if (cfg.cacheEnabled) resultCache.set(`${capability}:${rHash}`, { data, expiresAt: Date.now() + CACHE_TTL })
      return {
        data: data as T, degraded: false, provider: cfg.providerKey, model: cfg.model,
        promptVersion, tokensUsed: usage.inputTokens + usage.outputTokens, latencyMs, cacheHit: false,
      }
    } catch (e) {
      attemptError = e instanceof Error ? e.message : String(e)
      log.warn({ msg: `attempt ${attempt} failed: ${attemptError}`, traceId: ctx.traceId, capability })
    }
  }

  // ---- 主 provider 失败 → failover provider ----
  const { failoverProviderKey } = await import('./providers')
  const failoverKey = failoverProviderKey()
  if (cfg.fallbackEnabled && failoverKey !== cfg.providerKey) {
    try {
      const failCfg: CapabilityConfigSnapshot = { ...cfg, providerKey: failoverKey, model: '' }
      const { raw, usage, latencyMs } = await callOnce(failCfg, messages, ctx, needsStruct)
      const { getOutputSchema } = await import('./schemas')
      const schema = getOutputSchema(schemaNameResolved)
      const data = needsStruct ? (schema ? validateStruct(schema, extractJson(raw)) : extractJson(raw)) : raw
      if (data === null || data === undefined) throw new StructInvalidError('failover 输出不符合 Schema')
      await writeCallLog({
        userId: ctx.userId, capability, status: 'DEGRADED', degraded: true,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, latencyMs,
        requestHash: rHash, traceId: ctx.traceId, provider: failoverKey, model: cfg.model, promptKey: capability,
        errorMessage: `failover after: ${attemptError}`,
      })
      return {
        data: data as T, degraded: true, degradedReason: `failover:${failoverKey}`,
        provider: failoverKey, model: cfg.model, promptVersion,
        tokensUsed: usage.inputTokens + usage.outputTokens, latencyMs, cacheHit: false,
      }
    } catch (e) {
      log.warn({ msg: `failover failed: ${e instanceof Error ? e.message : String(e)}`, traceId: ctx.traceId })
    }
  }

  // ---- 全部失败 → 降级兜底 ----
  if (!cfg.fallbackEnabled) {
    await writeCallLog({
      userId: ctx.userId, capability, status: 'ERROR', errorCode: 'AI_UNAVAILABLE', errorMessage: attemptError ?? undefined,
      requestHash: rHash, traceId: ctx.traceId, provider: cfg.providerKey, model: cfg.model, promptKey: capability,
    })
    throw new Error(`AI_UNAVAILABLE: ${attemptError}`)
  }

  await writeCallLog({
    userId: ctx.userId, capability, status: 'DEGRADED', degraded: true, errorMessage: attemptError ?? undefined,
    requestHash: rHash, traceId: ctx.traceId, provider: cfg.providerKey, model: cfg.model, promptKey: capability,
  })
  return {
    data: buildFallback(capability, input) as T,
    degraded: true,
    degradedReason: attemptError ?? 'unknown',
    provider: cfg.providerKey,
    model: cfg.model,
    promptVersion,
    tokensUsed: 0,
    latencyMs: Date.now() - started,
    cacheHit: false,
  }
}

export const gateway = {
  /** 非流式：schemaName 为 AiPrompt.outputSchema 名；纯文本能力传 null */
  run<T>(capability: AiCapabilityKey, input: unknown, ctx: AiRunContext, schemaName: string | null = null): Promise<AiResult<T>> {
    return runImpl<T>(capability, input, ctx, schemaName)
  },

  /**
   * 流式（TUTOR_CHAT 等文本直通）：逐帧 yield；失败以 degraded 事件收尾。
   */
  async *stream(capability: AiCapabilityKey, input: unknown, ctx: AiRunContext): AsyncGenerator<
    { kind: 'delta'; text: string } | { kind: 'done'; tokensUsed: number; latencyMs: number } | { kind: 'degraded'; reason: string }
  > {
    const started = Date.now()
    const cfg = await getCapabilityConfig(capability)
    if (!cfg.enabled) {
      yield { kind: 'degraded', reason: 'AI_CAPABILITY_DISABLED' }
      return
    }
    const { messages, promptId, promptVersion } = await assemble(capability, input)
    const provider = getProvider(cfg.providerKey)
    try {
      const iterable = provider.complete({
        messages,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        stream: true,
        timeoutMs: cfg.timeoutMs,
        firstTokenTimeoutMs: cfg.firstTokenTimeoutMs,
        signal: ctx.signal,
      })
      for await (const chunk of iterable) {
        if (chunk.text) yield { kind: 'delta', text: chunk.text }
      }
      const usage = await iterable.usage()
      const latencyMs = Date.now() - started
      await writeCallLog({
        userId: ctx.userId, capability, status: 'SUCCESS', inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens, latencyMs, traceId: ctx.traceId,
        provider: cfg.providerKey, model: cfg.model, promptId, promptVersion, promptKey: capability,
      })
      yield { kind: 'done', tokensUsed: usage.inputTokens + usage.outputTokens, latencyMs }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      await writeCallLog({
        userId: ctx.userId, capability, status: 'DEGRADED', degraded: true, errorMessage: reason,
        traceId: ctx.traceId, provider: cfg.providerKey, model: cfg.model, promptKey: capability, promptVersion,
      })
      yield { kind: 'degraded', reason }
    }
  },

  /** 流式 + 结束结构校验（预留；Phase 1 结构化能力走非流式 run） */
  async *streamStruct<T>(capability: AiCapabilityKey, input: unknown, ctx: AiRunContext): AsyncGenerator<
    { kind: 'delta'; text: string } | { kind: 'struct'; data: T } | { kind: 'degraded'; fallback: T }
  > {
    const result = await runImpl<T>(capability, input, ctx, null)
    if (result.degraded) {
      yield { kind: 'degraded', fallback: result.data }
      return
    }
    yield { kind: 'delta', text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data) }
    yield { kind: 'struct', data: result.data }
  },

  /** 能力状态（前端决定是否展示入口） */
  async status(capability: AiCapabilityKey, userId?: string): Promise<AiCapabilityStatus> {
    const cfg = await getCapabilityConfig(capability)
    const provider = getProvider(cfg.providerKey)
    const healthy = await provider.healthCheck()
    const quota = userId
      ? await checkUserQuota(userId, capability, cfg.dailyQuotaUser)
      : { allowed: true, quotaLeft: Number.POSITIVE_INFINITY }
    return {
      enabled: cfg.enabled,
      healthy: healthy && cfg.enabled,
      quotaLeft: quota.quotaLeft,
    }
  },

  /** guardStruct 导出复用（service 层测试） */
  guardStruct,
}
