/**
 * POST /api/speaking/session/:id/messages — 发送一条消息（S3，**SSE 流式回复**）。
 *
 * 流程：鉴权 → 落用户消息（含 wasTextInput 文本降级标记，验收 5）→
 * TUTOR_CHAT 流式（persona/setting 拼入 history 前缀）→ SSE 逐帧转发 →
 * 聚合完成后 AI 回复整条落库。
 *
 * 帧协议（与 gateway.stream 帧对齐）：
 *   `data:{"kind":"delta","text":"..."}` / `data:{"kind":"done","replyId","messageCount"}`
 *   / `data:{"kind":"degraded","reason"}`
 *
 * ⚠️ 不走 withAuth（envelope 与 SSE 帧协议不兼容），鉴权内联实现——
 * 与 handler.ts 相同的 cookie + JWT 校验。
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { AppError } from '@/lib/api/errors'
import { verifyCsrf } from '@/lib/auth/csrf'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { hitRateLimit } from '@/lib/auth/rate-limit'
import { parseWith, readJson } from '@/lib/api/zod'
import { createLogger } from '@/lib/logger/logger'
import { gateway } from '@/services/ai/gateway'
import { getSessionContext, listMessages, saveUserMessage, saveAiMessage } from '@/services/speaking.service'
import { genTraceId } from '@/lib/api/response'

const log = createLogger('api.speaking.messages')

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  wasTextInput: z.boolean().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  sttConfidence: z.number().min(0).max(1).optional(),
  sttProvider: z.enum(['web_speech', 'cloud_asr', 'manual']).optional(),
})

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (header === null) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return undefined
}

/** 鉴权 + CSRF（与 withApi 同语义） */
async function authenticate(request: Request): Promise<{ userId: string }> {
  verifyCsrf(request)
  const token = readCookie(request, 'access_token')
  if (token === undefined) throw new AppError('UNAUTHORIZED', '未登录')
  const payload = await verifyAccessToken(token)
  return { userId: payload.sub }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: sessionId } = await ctx.params
  try {
    const { userId } = await authenticate(request)
    await hitRateLimit(`speaking:message:${userId}`, { limit: 120, windowMs: 60_000 })
    const parsed = parseWith(bodySchema, await readJson(request))

    // 会话归属 + persona/setting 上下文
    const { session, role, scene } = await getSessionContext(userId, sessionId)
    // 落用户消息（文本降级标记，验收 5）
    const userMessage = await saveUserMessage(sessionId, parsed)
    // 最近对话轮次（含本条），persona/setting 作为前缀拼入——T19 关键：Prompt 片段必须生效
    const history = await prismaHistory(sessionId)

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown): void => {
          controller.enqueue(encoder.encode(`data:${JSON.stringify(obj)}\n\n`))
        }
        let full = ''
        let tokensUsed = 0
        let latencyMs = 0
        let degraded = false
        let reason = ''
        try {
          const ctxBase = { userId, traceId: `speaking-msg-${userMessage.id}`, locale: 'zh-CN' as const }
          const personaPrefix = [
            `【角色扮演】${role?.name ?? session.roleKey}：${role?.persona ?? ''}`,
            `【场景】${scene?.name ?? session.sceneKey}：${scene?.setting ?? ''}`,
            '【要求】用英语与用户对话，句子简短自然，并适当追问。',
          ].join('\n')
          for await (const frame of gateway.stream("TUTOR_CHAT", { userMessage: parsed.text, history: `${personaPrefix}\n【对话历史】${history}` }, ctxBase)) {
            if (frame.kind === 'delta') {
              full += frame.text
              send(frame)
            } else if (frame.kind === 'done') {
              tokensUsed = frame.tokensUsed
              latencyMs = frame.latencyMs
            } else {
              degraded = true
              reason = frame.reason
            }
          }
          // Mock/失败：给固定引导语（对话链路不中断，验收 4）
          const replyText = full.trim().length > 0 ? full : '(The AI tutor is offline. Try again in a moment — keep practicing!)'
          const aiMessage = await saveAiMessage(sessionId, replyText, {
            tokensUsed,
            latencyMs,
            model: degraded ? 'degraded' : 'mock',
          })
          send({ kind: 'done', replyId: aiMessage.id, messageCount: aiMessage.id, text: replyText, degraded, reason })
        } catch (error) {
          log.warn({ msg: 'speaking message stream failed', sessionId, error: String(error) })
          send({ kind: 'degraded', reason: String(error) })
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : error.code.startsWith('VALIDATION') || error.code === 'NOT_FOUND' ? (error.code === 'NOT_FOUND' ? 404 : 400) : 500
      return NextResponse.json({ success: false, data: null, error: { code: error.code, message: error.message } }, { status })
    }
    log.error({ msg: 'speaking messages route error', sessionId, error: String(error) })
    return NextResponse.json({ success: false, data: null, error: { code: 'SYS_INTERNAL', message: '服务异常' } }, { status: 500 })
  }
}

/** 最近 12 条对话（persona 前缀外的真实轮次） */
async function prismaHistory(sessionId: string): Promise<string> {
  const { prisma } = await import('@/lib/db')
  const rows = await prisma.speakingMessage.findMany({
    where: { sessionId },
    select: { speaker: true, textContent: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })
  return rows
    .reverse()
    .map((r) => `${String(r.speaker) === 'USER' ? 'User' : 'Tutor'}: ${r.textContent ?? ''}`)
    .join('\n')
}

/** GET：消息列表（对话页刷新用，走标准 envelope —— 与 POST 的 SSE 帧协议互不影响） */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: sessionId } = await ctx.params
  try {
    const { userId } = await authenticate(request)
    const data = await listMessages(userId, sessionId)
    return Response.json({ success: true, data, error: null, traceId: genTraceId() })
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({ success: false, data: null, error: { code: error.code, message: error.message } }, { status: error.code === 'UNAUTHORIZED' ? 401 : 404 })
    }
    return Response.json({ success: false, data: null, error: { code: 'SYS_INTERNAL', message: '服务异常' } }, { status: 500 })
  }
}
