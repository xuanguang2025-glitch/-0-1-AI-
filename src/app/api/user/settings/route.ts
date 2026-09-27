/**
 * GET /api/user/settings — 获取偏好设置。
 * PATCH /api/user/settings — 部分更新（主题/语言/时区/每日目标/通知）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import * as userService from '@/services/user.service'

const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  locale: z.enum(['zh-CN', 'en']).optional(),
  timezone: z.string().max(64).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(480).optional(),
  notificationPrefs: z.record(z.boolean()).optional(),
})

export const GET = withAuth(
  async (ctx) => ok(await userService.getSettings(ctx.auth!.userId), { traceId: ctx.traceId }),
)

export const PATCH = withAuth(
  async (ctx) => ok(await userService.updateSettings(ctx.auth!.userId, ctx.data), { traceId: ctx.traceId }),
  { bodySchema: updateSettingsSchema },
)
