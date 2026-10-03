/**
 * GET    /api/ai/conversations/[id] — 会话详情（含校验归属，越权一律 404）。
 * DELETE /api/ai/conversations/[id] — 软删除会话。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { errNotFound } from '@/lib/api/errors'
import { prisma } from '@/lib/db'

async function loadOwned(id: string, userId: string) {
  const conv = await prisma.aiConversation.findFirst({
    where: { id, userId, deletedAt: null },
  })
  if (!conv) throw errNotFound('会话不存在')
  return conv
}

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const conv = await loadOwned(ctx.params.id, ctx.auth!.userId)
    return ok(conv, { traceId: ctx.traceId })
  },
)

export const DELETE = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const conv = await loadOwned(ctx.params.id, ctx.auth!.userId)
    await prisma.aiConversation.update({ where: { id: conv.id }, data: { deletedAt: new Date() } })
    return ok(null, { traceId: ctx.traceId })
  },
)
