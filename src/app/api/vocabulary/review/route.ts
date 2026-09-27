/**
 * POST /api/vocabulary/review — 复习提交（服务端 SRS 推进 + 幂等 + 乐观锁）。
 * Idempotency-Key 可放 body 或 header，两者都支持。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { submitReview, type ReviewInput } from '@/services/vocabulary.service'
import type { SelfRating } from '@/services/vocabulary/srs/srs.engine'
import { z } from 'zod'

const bodySchema = z.object({
  userVocabId: z.string().min(1),
  rating: z.number().int().min(0).max(5),
  responseMs: z.number().int().min(0).max(600_000).default(0),
  idempotencyKey: z.string().min(8).max(64).optional(),
})

export const POST = withAuth(
  async (ctx) => {
    const input: ReviewInput = {
      userVocabId: ctx.data.userVocabId,
      rating: ctx.data.rating as SelfRating,
      responseMs: ctx.data.responseMs ?? 0,
      // header 优先，兼容不传 body key 的客户端
      idempotencyKey: ctx.request.headers.get('idempotency-key') ?? ctx.data.idempotencyKey,
    }
    const result = await submitReview(ctx.auth!.userId, input)
    return ok(result, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: { key: 'vocab-review', limit: 120, windowMs: 60_000 } },
)
