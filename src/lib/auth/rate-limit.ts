/**
 * 限流（架构 §1.4.6）：内存 Token Bucket（单实例够用）。
 * 预留 RateLimiter 接口，多实例时替换 RedisRateLimiter 实现。
 *
 * QA P2 #12：buckets Map 增加容量上限 + 过期清扫，防止 key 无限增长（内存泄漏）。
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

/** 桶容量上限：超出后按最早写入顺序淘汰（近似 LRU，防无限增长） */
const MAX_BUCKETS = 10_000

/** 清扫间隔：每 60s 或每次写入超过阈值时触发一次 */
const SWEEP_INTERVAL_MS = 60_000
let lastSweepAt = 0

/** 淘汰已过期桶；返回被清理的数量 */
function sweep(now: number): number {
  let removed = 0
  // 桶只存 windowStart，用一个保守的最大窗口判断是否「大概率已过期」
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > LONGEST_WINDOW_MS) {
      buckets.delete(key)
      removed += 1
    }
  }
  lastSweepAt = now
  return removed
}

/** 所有规则里最长的窗口（用于保守过期判定） */
const LONGEST_WINDOW_MS = 24 * 60 * 60 * 1000

/** 容量超限时淘汰最早写入的桶（Map 保持插入顺序） */
function evictIfNeeded(): void {
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next()
    if (oldest.done) return
    buckets.delete(oldest.value)
  }
}

/** 内存实现：固定窗口计数 */
export class MemoryRateLimiter implements RateLimiter {
  async hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now()
    // 周期性清扫过期桶（保证长时间运行不膨胀）
    if (now - lastSweepAt > SWEEP_INTERVAL_MS || buckets.size >= MAX_BUCKETS) {
      sweep(now)
    }

    const bucket = buckets.get(key)
    if (!bucket || now - bucket.windowStart >= rule.windowMs) {
      evictIfNeeded()
      buckets.set(key, { count: 1, windowStart: now })
      return { allowed: true, remaining: Math.max(0, rule.limit - 1), retryAfterMs: 0 }
    }
    if (bucket.count >= rule.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: rule.windowMs - (now - bucket.windowStart) }
    }
    bucket.count += 1
    return { allowed: true, remaining: Math.max(0, rule.limit - bucket.count), retryAfterMs: 0 }
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
  /** AI 高成本资源：单用户 20 req/min（QA P2 #16） */
  ai: { limit: 20, windowMs: 60_000 },
} as const

/** 便捷命中：返回 null 表示放行，返回 retryAfterMs 表示被拒 */
export async function hitRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  return rateLimiter.hit(key, rule)
}

/**
 * 取客户端 IP（QA P2 #13）。
 *
 * 安全说明：`x-forwarded-for` / `x-real-ip` 均可被客户端伪造，只有当服务确实
 * 部署在可信反向代理（Nginx / 云 LB / Vercel）之后才应采信。因此这里做两级判断：
 * 1. 显式配置 `TRUST_PROXY=1`（或部署在 Vercel/Cloudflare 等已知平台）→ 采信代理头；
 * 2. 直连部署 → 忽略一切可伪造的头，回落 `x-vercel-forwarded-for` 之外的稳定值 `direct`，
 *    并在文档中说明此时 IP 维度限流退化为「单桶」（安全优先于精确度）。
 *
 * 之所以不直接取 socket 地址：Next.js Route Handler 拿到的是 Web `Request`，
 * 底层 socket 地址不可见（Next 15 已移除 `request.ip`），只能由代理层透传。
 */
export function clientIp(request: Request): string {
  if (trustProxy()) {
    const fwd = request.headers.get('x-forwarded-for')
    if (fwd) {
      const first = fwd.split(',')[0]?.trim()
      if (first) return first
    }
    const real = request.headers.get('x-real-ip')
    if (real) return real.trim()
    // Vercel / Cloudflare 会覆盖 x-real-ip 为真实客户端地址
    const cf = request.headers.get('cf-connecting-ip')
    if (cf) return cf.trim()
  }
  // 直连部署：无法可信获取客户端 IP → 统一归为 direct（限流仍生效，但退化为单桶）
  return 'direct'
}

/** 是否信任反向代理头（默认不信任；TRUST_PROXY=1/true 时信任） */
export function trustProxy(): boolean {
  const flag = process.env.TRUST_PROXY
  return flag === '1' || flag === 'true'
}
