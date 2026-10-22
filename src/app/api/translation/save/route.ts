/**
 * POST /api/translation/save — 一键收藏（T2，验收 3）。
 * 原句入 favorites（targetType='translation'）+ 抽取生词 upsert 进
 * user_vocabulary（inNotebook=true）。幂等。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { saveTranslation } from '@/services/translation.service'

import { translationSaveSchema, type TranslationSaveInput } from '@/features/translation/schemas'

export const POST = withAuth<unknown, TranslationSaveInput>(
  async (ctx) => {
    const data = await saveTranslation(ctx.auth!.userId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: translationSaveSchema, rateLimit: userRateLimitRule('translation:save', 120, 60_000) },
)
