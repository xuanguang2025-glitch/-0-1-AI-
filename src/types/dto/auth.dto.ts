/**
 * Auth DTO（架构 §3.1）：route ↔ service 之间的传输对象定义。
 */

export interface AuthUserDto {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  role: string
  status: string
  locale: string
  timezone: string
  emailVerified: boolean
  createdAt: string
}

export interface RegisterResultDto {
  user: AuthUserDto
  /** 新注册即建立会话（免二次登录） */
  accessToken?: string
  refreshToken?: string
}

export interface LoginResultDto {
  user: AuthUserDto
  accessToken: string
  refreshToken: string
}

export interface RefreshResultDto {
  user: AuthUserDto
  accessToken: string
  refreshToken: string
}

export interface ForgotPasswordResultDto {
  /** Phase 1 不发真实邮件：开发环境返回 devHint（生产恒为 null） */
  devHint: string | null
}

export interface ResetPasswordResultDto {
  revokedSessions: number
}
