/**
 * PUT /api/user/avatar — 更新头像 URL（上传接口产出的 /storage/** 引用）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import * as userService from '@/services/user.service'

const updateAvatarSchema = z.object({
  avatarUrl: z.string().min(1, '请提供头像地址').max(500),
})

export const PUT = withAuth(
  async (ctx) => ok(await userService.updateAvatar(ctx.auth!.userId, ctx.data.avatarUrl), { traceId: ctx.traceId }),
  { bodySchema: updateAvatarSchema },
)
