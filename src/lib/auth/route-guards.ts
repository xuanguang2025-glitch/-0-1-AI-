/**
 * 路由级限流规则便捷构造（架构 §1.4.6）。
 */
import type { ApiOptions } from '@/lib/api/handler'

/** 登录/注册/找回密码：IP 维度 10 req / 10min（锁定由 login-guard 处理） */
export function authRateLimitRule(scope: 'login' | 'register' | 'forgot'): NonNullable<ApiOptions<unknown, unknown>['rateLimit']> {
  return { key: `auth:${scope}`, limit: 10, windowMs: 10 * 60_000 }
}

/** 考试自动保存：1 次/5s（userId 维度，handler 内拼 key） */
export function examSaveRateRule(userId: string): { key: string; limit: number; windowMs: number } {
  return { key: `exam:save:${userId}`, limit: 1, windowMs: 5_000 }
}
