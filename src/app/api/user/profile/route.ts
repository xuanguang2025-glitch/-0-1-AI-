/**
 * GET /api/user/profile — 获取个人资料。
 * PATCH /api/user/profile — 更新个人资料（白名单字段）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import * as userService from '@/services/user.service'

const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(30).optional(),
  bio: z.string().trim().max(200).optional(),
  realName: z.string().trim().max(30).optional(),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).optional(),
  targetScore: z.number().int().min(0).max(710).optional(),
})

export const GET = withAuth(
  async (ctx) => ok(await userService.getProfile(ctx.auth!.userId), { traceId: ctx.traceId }),
)

export const PATCH = withAuth(
  async (ctx) => ok(await userService.updateProfile(ctx.auth!.userId, ctx.data), { traceId: ctx.traceId }),
  { bodySchema: updateProfileSchema },
)
