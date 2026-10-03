/**
 * POST /api/ai/chat — AI 学伴对话（SSE 流式）。
 * 持久化：创建/复用 TUTOR 会话，用户与 AI 消息落 ai_messages。
 */
import { z } from 'zod'
import { sseResponse, type SseEvent } from '@/lib/http/sse'
import { aiService } from '@/services/ai/ai.service'
import { prisma } from '@/lib/db'
import { RULES, hitRateLimit } from '@/lib/auth/rate-limit'
import { createLogger } from '@/lib/logger/logger'
import type { AiRunContext } from '@/services/ai/types'

const log = createLogger('api.ai.chat')

/** AI 对话限流：单用户 20 req/min（QA P2 #16，AI 为高成本资源） */
const CHAT_RATE_LIMIT = { limit: RULES.ai.limit, windowMs: RULES.ai.windowMs }

export const chatSchema = z.object({
  message: z.string().trim().min(1, '请输入消息').max(2000, '消息最长 2000 字'),
  conversationId: z.string().min(1).nullish(),
})

export async function POST(request: Request): Promise<Response> {
  // 复用 withAuth 的认证与 envelope，但返回 SSE：手工组装（与 withApi 同源逻辑）
  const { verifyAccessToken } = await import('@/lib/auth/jwt')
  const { verifyCsrf } = await import('@/lib/auth/csrf')
  const { fail } = await import('@/lib/api/response')
  const { genTraceId } = await import('@/lib/api/response')

  if (!verifyCsrf(request)) return fail('PERM_FORBIDDEN', { traceId: genTraceId() })
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === 'access_token')?.[1]
  if (!token) return fail('AUTH_TOKEN_MISSING', { traceId: genTraceId() })

  let userId: string
  try {
    const payload = await verifyAccessToken(decodeURIComponent(token))
    userId = payload.sub
  } catch (e) {
    const err = e as { code?: string }
    const traceId = genTraceId()
    if (err.code === 'ERR_JWT_EXPIRED') return fail('AUTH_TOKEN_EXPIRED', { traceId })
    return fail('AUTH_TOKEN_INVALID', { traceId })
  }

  const traceId = request.headers.get('x-trace-id') ?? genTraceId()
  const body = (await request.json().catch(() => ({}))) as unknown

  // 手工校验（body schema 在 withApi 之外）
  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', {
      traceId,
      details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    })
  }
  const { message, conversationId } = parsed.data

  // ---- 限流（QA P2 #16）：本路由手工组装 SSE，未走 withApi，需显式限流 ----
  const rateKey = `ai:chat:${userId}`
  const rate = await hitRateLimit(rateKey, CHAT_RATE_LIMIT)
  if (!rate.allowed) {
    const { fail } = await import('@/lib/api/response')
    return fail('SYS_RATE_LIMIT', {
      traceId,
      message: `对话过于频繁，请 ${Math.ceil(rate.retryAfterMs / 1000)} 秒后继续`,
    })
  }

  const ctx: AiRunContext = { userId, traceId, locale: 'zh-CN' }

  // ---- 会话：复用或创建 ----
  let convId = conversationId ?? null
  if (convId) {
    const conv = await prisma.aiConversation.findFirst({
      where: { id: convId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!conv) convId = null
  }
  if (!convId) {
    const conv = await prisma.aiConversation.create({
      data: { userId, type: 'TUTOR', title: message.slice(0, 20) },
    })
    convId = conv.id
  }

  // 用户消息落库
  await prisma.aiMessage.create({ data: { conversationId: convId, role: 'USER', content: message } })
  const history = await prisma.aiMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { role: true, content: true },
  })
  const historyText = history
    .reverse()
    .map((m) => `${m.role === 'USER' ? '用户' : '助手'}: ${m.content}`)
    .join('\n')

  async function* events(): AsyncGenerator<SseEvent> {
    let full = ''
    try {
      yield { event: 'meta', data: { conversationId: convId } }
      for await (const frame of aiService.chat({ history: historyText, userMessage: message }, ctx)) {
        if (frame.kind === 'delta') {
          full += frame.text
          yield { event: 'delta', data: { text: frame.text } }
        } else if (frame.kind === 'degraded') {
          yield { event: 'degraded', data: { reason: frame.reason, fallback: 'AI 暂时不可用，请稍后再试。' } }
        } else {
          yield { event: 'done', data: { tokensUsed: frame.tokensUsed, latencyMs: frame.latencyMs } }
        }
      }
    } catch (e) {
      // QA P2 #16：SSE 已开始输出后无法再改 HTTP 状态码，
      // 异常必须包成 error 事件帧让前端能优雅收尾（否则表现为「静默截断」）。
      const messageText = e instanceof Error ? e.message : String(e)
      log.error({ traceId, userId, msg: 'sse stream aborted', err: messageText })
      yield {
        event: 'error',
        data: { code: 'SYS_INTERNAL', message: 'AI 回复中断，请重试', partial: full.length > 0, traceId },
      }
      return
    }
    // AI 消息落库（含 degraded 标记在 degraded 分支中由前端重发场景处理；此处尽力保存已有文本）
    if (full) {
      try {
        await prisma.aiMessage.create({
          data: { conversationId: convId!, role: 'ASSISTANT', content: full, model: 'tutor-chat' },
        })
        await prisma.aiConversation.update({
          where: { id: convId! },
          data: { lastMessageAt: new Date(), messageCount: { increment: 2 } },
        })
      } catch (e) {
        // 落库失败不应再打断已完成的流
        log.warn({ traceId, userId, msg: 'persist assistant message failed', err: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  return sseResponse(events())
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60
