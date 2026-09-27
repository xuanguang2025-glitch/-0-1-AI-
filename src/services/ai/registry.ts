/**
 * 能力配置注册表：ai_capability_config 读取（进程缓存 60s），后台改配置立即级联生效（≤60s）。
 */
import { prisma } from '@/lib/db'
import { defaultProviderKey } from './providers'

export interface CapabilityConfigSnapshot {
  capability: string
  providerKey: string
  model: string
  enabled: boolean
  fallbackEnabled: boolean
  temperature: number
  maxTokens: number
  timeoutMs: number
  firstTokenTimeoutMs: number
  maxRetries: number
  dailyQuotaUser: number | null
  dailyQuotaGlobal: number | null
  isStreaming: boolean
  cacheEnabled: boolean
}

const globalForRegistry = globalThis as unknown as {
  __aiConfigCache?: { data: Map<string, CapabilityConfigSnapshot>; expiresAt: number }
}

const CACHE_TTL = 60_000

async function loadAll(): Promise<Map<string, CapabilityConfigSnapshot>> {
  const now = Date.now()
  const cache = globalForRegistry.__aiConfigCache
  if (cache && cache.expiresAt > now) return cache.data

  const rows = await prisma.aiCapabilityConfig.findMany()
  const map = new Map<string, CapabilityConfigSnapshot>()
  for (const r of rows) {
    map.set(r.capability, {
      capability: r.capability,
      providerKey: r.providerKey,
      model: r.model,
      enabled: r.enabled,
      fallbackEnabled: r.fallbackEnabled,
      temperature: r.temperature,
      maxTokens: r.maxTokens,
      timeoutMs: r.timeoutMs,
      firstTokenTimeoutMs: r.firstTokenTimeoutMs,
      maxRetries: r.maxRetries,
      dailyQuotaUser: r.dailyQuotaUser,
      dailyQuotaGlobal: r.dailyQuotaGlobal,
      isStreaming: r.isStreaming,
      cacheEnabled: r.cacheEnabled,
    })
  }
  globalForRegistry.__aiConfigCache = { data: map, expiresAt: now + CACHE_TTL }
  return map
}

/** 取能力配置；DB 无记录时按 env 默认值合成（provider 默认 → mock 兜底链） */
export async function getCapabilityConfig(capability: string): Promise<CapabilityConfigSnapshot> {
  const map = await loadAll()
  return (
    map.get(capability) ?? {
      capability,
      providerKey: defaultProviderKey(),
      model: '',
      enabled: true,
      fallbackEnabled: true,
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
      firstTokenTimeoutMs: 3000,
      maxRetries: 1,
      dailyQuotaUser: 100,
      dailyQuotaGlobal: null,
      isStreaming: false,
      cacheEnabled: true,
    }
  )
}

/** 主动失效缓存（后台改配置后调用） */
export function invalidateConfigCache(): void {
  globalForRegistry.__aiConfigCache = undefined
}
