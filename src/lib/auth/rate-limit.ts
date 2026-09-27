/**
 * 限流（架构 §1.4.6）：内存 Token Bucket（单实例够用）。
 * 预留 RateLimiter 接口，多实例时替换 RedisRateLimiter 实现。
 */

export interface RateLimitRule {
  /** 窗口内允许的最大请求数 */
  limit: number
  /** 窗口长度（毫秒） */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** 剩余额度 */
  remaining: number
  /** 被拒时多久后可重试（毫秒） */
  retryAfterMs: number
}

/** 抽象接口：预留 Redis 实现 */
export interface RateLimiter {
  hit(key: string, rule: RateLimitRule): Promise<RateLimitResult>
}

interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

/** 内存实现：固定窗口计数 */
export class MemoryRateLimiter implements RateLimiter {
  async hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || now - bucket.windowStart >= rule.windowMs) {
      buckets.set(key, { count: 1, windowStart: now })
      return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 }
    }
    if (bucket.count >= rule.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: rule.windowMs - (now - bucket.windowStart) }
    }
    bucket.count += 1
    return { allowed: true, remaining: rule.limit - bucket.count, retryAfterMs: 0 }
  }
}

/** 单例（进程内共享） */
export const rateLimiter: RateLimiter = new MemoryRateLimiter()

/** 预置规则（架构 §1.4.6） */
export const RULES = {
  /** 全局 API：IP + path，300 req/60s */
  global: { limit: 300, windowMs: 60_000 },
  /** 登录/注册/找回：IP + email，10 req/10min（锁定另由 login-guard 处理） */
  auth: { limit: 10, windowMs: 10 * 60_000 },
  /** 考试自动保存：1 次/5s */
  examSave: { limit: 1, windowMs: 5_000 },
} as const

/** 便捷命中：返回 null 表示放行，返回 retryAfterMs 表示被拒 */
export async function hitRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  return rateLimiter.hit(key, rule)
}

/** 取客户端 IP（Next Request） */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
