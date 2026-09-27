/**
 * 密码（架构 §1.4.8）：@node-rs/argon2（OWASP 参数 m=19456 t=2 p=1）。
 * 强度校验：≥8 位且同时含字母与数字（Zod 侧也有同规则，此处服务端兜底）。
 */
import { hash, verify } from '@node-rs/argon2'

import { AppError } from '@/lib/api/errors'
import { appConfig } from '@/lib/constants/config'

const argon2Options = {
  memoryCost: appConfig.auth.argon2.memoryKb,
  timeCost: appConfig.auth.argon2.iterations,
  parallelism: appConfig.auth.argon2.parallelism,
}

/** 哈希密码（argon2id） */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, argon2Options)
}

/** 校验密码；成功返回 true */
export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain, argon2Options)
  } catch {
    return false
  }
}

/** 密码强度：≥8 位 + 至少一个字母 + 至少一个数字 */
export function isStrongPassword(plain: string): boolean {
  return plain.length >= 8 && /[a-zA-Z]/.test(plain) && /\d/.test(plain)
}

/** 强度不足抛 AUTH_WEAK_PASSWORD */
export function assertStrongPassword(plain: string): void {
  if (!isStrongPassword(plain)) {
    throw new AppError('AUTH_WEAK_PASSWORD')
  }
}
