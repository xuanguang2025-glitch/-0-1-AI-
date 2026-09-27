/**
 * 认证 Zod schemas：前后端共用（route 校验 + 表单校验）。
 */
import { z } from 'zod'

/** 邮箱 */
export const emailSchema = z
  .string({ required_error: '请输入邮箱' })
  .min(1, '请输入邮箱')
  .email('邮箱格式不正确')
  .transform((v) => v.trim().toLowerCase())

/** 密码：≥8 位，含字母与数字 */
export const passwordSchema = z
  .string({ required_error: '请输入密码' })
  .min(8, '密码至少 8 位')
  .max(72, '密码最多 72 位')
  .regex(/[a-zA-Z]/, '密码需包含字母')
  .regex(/\d/, '密码需包含数字')

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: z.string().trim().min(1, '请输入昵称').max(30, '昵称最多 30 字'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10, '重置链接无效'),
  password: passwordSchema,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
