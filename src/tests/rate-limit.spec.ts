/**
 * rate-limit.spec.ts — 限流器行为（QA P2 #12 桶淘汰 / #13 IP 信任边界）。
 */
import { afterEach, describe, expect, it } from 'vitest'

import { MemoryRateLimiter, RULES, clientIp, trustProxy } from '@/lib/auth/rate-limit'

const req = (headers: Record<string, string>): Request =>
  new Request('http://localhost:3000/api/x', { headers })

afterEach(() => {
  delete process.env.TRUST_PROXY
})

describe('MemoryRateLimiter（固定窗口 + 容量淘汰）', () => {
  it('窗口内放行到上限后拒绝，并给出 retryAfterMs', async () => {
    const rl = new MemoryRateLimiter()
    const rule = { limit: 3, windowMs: 60_000 }
    expect((await rl.hit('k', rule)).allowed).toBe(true)
    expect((await rl.hit('k', rule)).allowed).toBe(true)
    expect((await rl.hit('k', rule)).allowed).toBe(true)
    const denied = await rl.hit('k', rule)
    expect(denied.allowed).toBe(false)
    expect(denied.remaining).toBe(0)
    expect(denied.retryAfterMs).toBeGreaterThan(0)
  })

  it('不同 key 互不影响（多用户不挤兑）', async () => {
    const rl = new MemoryRateLimiter()
    const rule = { limit: 1, windowMs: 60_000 }
    expect((await rl.hit('a', rule)).allowed).toBe(true)
    expect((await rl.hit('b', rule)).allowed).toBe(true)
    expect((await rl.hit('a', rule)).allowed).toBe(false)
  })

  it('窗口过期后重置', async () => {
    const rl = new MemoryRateLimiter()
    expect((await rl.hit('c', { limit: 1, windowMs: 1 })).allowed).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    expect((await rl.hit('c', { limit: 1, windowMs: 1 })).allowed).toBe(true)
  })

  it('容量上限内大量 key 不会抛错（清扫 + LRU 淘汰生效）', async () => {
    const rl = new MemoryRateLimiter()
    const rule = { limit: 5, windowMs: 60_000 }
    for (let i = 0; i < 12_000; i += 1) {
      const r = await rl.hit(`key-${i}`, rule)
      expect(r.allowed).toBe(true)
    }
    // 早期 key 已被淘汰，重新命中视为新窗口
    expect((await rl.hit('key-0', rule)).allowed).toBe(true)
  })

  it('remaining 不会为负', async () => {
    const rl = new MemoryRateLimiter()
    const rule = { limit: 2, windowMs: 60_000 }
    await rl.hit('d', rule)
    const second = await rl.hit('d', rule)
    expect(second.remaining).toBe(0)
  })
})

describe('RULES（架构 §1.4.6 预置规则）', () => {
  it('全局 / 认证 / 考试 / AI 规则齐备', () => {
    expect(RULES.global).toEqual({ limit: 300, windowMs: 60_000 })
    expect(RULES.auth).toEqual({ limit: 10, windowMs: 600_000 })
    expect(RULES.examSave).toEqual({ limit: 1, windowMs: 5_000 })
    expect(RULES.ai).toEqual({ limit: 20, windowMs: 60_000 })
  })
})

describe('clientIp（QA P2 #13：默认不信任可伪造的代理头）', () => {
  it('默认（直连部署）忽略 x-forwarded-for，回落 direct', () => {
    expect(trustProxy()).toBe(false)
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe('direct')
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('direct')
    expect(clientIp(req({}))).toBe('direct')
  })

  it('TRUST_PROXY=1 时采信代理头（部署在 Nginx/LB 之后）', () => {
    process.env.TRUST_PROXY = '1'
    expect(trustProxy()).toBe(true)
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8')
  })

  it('TRUST_PROXY=true（字符串）同样生效', () => {
    process.env.TRUST_PROXY = 'true'
    expect(trustProxy()).toBe(true)
  })

  it('TRUST_PROXY=0/其他值视为不信任', () => {
    process.env.TRUST_PROXY = '0'
    expect(trustProxy()).toBe(false)
  })
})
