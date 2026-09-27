/**
 * JWT（架构 §1.4.2 / §4）：jose@5 + HS256，Edge Runtime 兼容。
 * access 15min（Fast grant），refresh 30d（familyId 用于重放检测）。
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

import { appConfig } from '@/lib/constants/config'
import { AppError } from '@/lib/api/errors'

const encoder = new TextEncoder()
const secretKey = (): Uint8Array => {
  const secret = appConfig.auth.jwtSecret || 'englishai-dev-secret-change-in-production'
  return encoder.encode(secret)
}

export interface AccessTokenPayload extends JWTPayload {
  /** userId */
  sub: string
  /** 角色（冗余快路径） */
  role: string
  /** 关联 AuthSession.familyId */
  fid: string
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string
  /** familyId */
  fid: string
  /** 本 token 的唯一 id（= AuthSession.tokenHash 对应的随机串） */
  jti: string
}

const ISSUER = appConfig.auth.jwtIssuer

/** 签发 access token（默认 15min） */
export async function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${appConfig.auth.accessTtlSeconds}s`)
    .sign(secretKey())
}

/** 签发 refresh token（默认 30d） */
export async function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${appConfig.auth.refreshTtlDays}d`)
    .sign(secretKey())
}

/** 校验 access token；失效抛 AUTH_TOKEN_INVALID / AUTH_TOKEN_EXPIRED */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER })
    if (!payload.sub || typeof payload.role !== 'string' || typeof payload.fid !== 'string') {
      throw new AppError('AUTH_TOKEN_INVALID')
    }
    return payload as AccessTokenPayload
  } catch (e) {
    if (e instanceof AppError) throw e
    const code = (e as { code?: string }).code
    if (code === 'ERR_JWT_EXPIRED') throw new AppError('AUTH_TOKEN_EXPIRED')
    throw new AppError('AUTH_TOKEN_INVALID')
  }
}

/** 校验 refresh token；失效抛对应 AppError */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER })
    if (!payload.sub || typeof payload.fid !== 'string' || typeof payload.jti !== 'string') {
      throw new AppError('AUTH_TOKEN_INVALID')
    }
    return payload as RefreshTokenPayload
  } catch (e) {
    if (e instanceof AppError) throw e
    const code = (e as { code?: string }).code
    if (code === 'ERR_JWT_EXPIRED') throw new AppError('AUTH_TOKEN_EXPIRED')
    throw new AppError('AUTH_TOKEN_INVALID')
  }
}
