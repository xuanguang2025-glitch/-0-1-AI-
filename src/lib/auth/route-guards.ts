/**
 * 路由级限流规则便捷构造（架构 §1.4.6）。
 *
 * QA P2 #13/#16：直连部署无法可信获取客户端 IP（见 rate-limit.clientIp），
 * 因此认证类接口在 IP 桶之外追加「身份桶」（email / userId），
 * AI 类接口在 IP 桶之外追加「用户桶」——防止直连部署下单桶挤兑。
 */
import type { ApiOptions } from '@/lib/api/handler'
import { RULES } from './rate-limit'

type RateLimitOption = NonNullable<ApiOptions<unknown, unknown>['rateLimit']>

/** 邮箱归一化（限流 key 用，避免大小写/空格绕过） */
function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const email = value.trim().toLowerCase()
  return email.length > 0 ? email : undefined
}

/** 登录/注册/找回密码：IP 桶 10 req/10min + 邮箱桶 10 req/10min（锁定由 login-guard 处理） */
export function authRateLimitRule(scope: 'login' | 'register' | 'forgot', withEmailBucket = true): RateLimitOption {
  return {
    key: `auth:${scope}`,
    limit: RULES.auth.limit,
    windowMs: RULES.auth.windowMs,
    ...(withEmailBucket ? { identity: (data: unknown) => normalizeEmail((data as { email?: unknown })?.email) } : {}),
  }
}

/** AI 高成本资源：单用户 20 req/min（QA P2 #16，IP 不可信时防滥用） */
export function aiRateLimitRule(capability: string): RateLimitOption {
  return {
    key: `ai:${capability}`,
    limit: RULES.ai.limit,
    windowMs: RULES.ai.windowMs,
  }
}

/** 已登录用户的 userId 维度限流（IP 桶退化时的兜底） */
export function userRateLimitRule(scope: string, limit: number, windowMs: number): RateLimitOption {
  return { key: scope, limit, windowMs }
}

/** 考试自动保存：1 次/5s（userId 维度，handler 内拼 key） */
export function examSaveRateRule(userId: string): { key: string; limit: number; windowMs: number } {
  return { key: `exam:save:${userId}`, limit: 1, windowMs: 5_000 }
}
