import { z } from 'zod'

/**
 * 环境变量解析与运行时配置（架构 §10.5）。
 *
 * 规则：
 * - 所有 env 必须在 `.env.example` 有占位行；
 * - 读取统一走本模块，禁止散落 `process.env.X`（scripts/check-env.ts 复用本 schema）；
 * - 缺失关键变量在启动即报错（由 `parseEnv()` 抛错），非关键变量给安全默认值。
 */

/** 关键变量校验（缺一即 fail-fast）；供 `scripts/check-env.ts` 复用。 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
  AUTH_JWT_SECRET: z.string().min(16, 'AUTH_JWT_SECRET 至少 16 位').optional(),
})

export type EnvSchema = z.infer<typeof envSchema>

/**
 * 解析并校验关键 env；失败时抛出带字段详情的错误。
 * @param raw 默认取 `process.env`，便于单测注入。
 */
export function parseEnv(raw: NodeJS.ProcessEnv = process.env): EnvSchema {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`环境变量校验失败，请检查 .env.local：\n${detail}`)
  }
  return result.data
}

const asBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null || value === '') return fallback
  return value === 'true' || value === '1'
}

const asInt = (value: string | undefined, fallback: number): number => {
  if (value == null || value === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const nodeEnv = process.env.NODE_ENV ?? 'development'

/**
 * 全站运行时配置（结构化只读）。
 * 注意：`server` 段包含密钥，禁止被客户端组件导入。
 */
export const appConfig = {
  app: {
    name: 'EnglishAI',
    origin: process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000',
    env: nodeEnv,
    isDev: nodeEnv === 'development',
    isProd: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  },
  db: {
    /** postgres | sqlite —— 由 scripts/use-driver.ts 切换（架构 §2.6） */
    driver: (process.env.DB_DRIVER ?? 'postgres') as 'postgres' | 'sqlite',
    /** A | C | B —— 仅用于状态展示，业务代码不分支（架构 §2.6.1） */
    tier: (process.env.DB_TIER ?? 'A') as 'A' | 'C' | 'B',
    url: process.env.DATABASE_URL ?? '',
    sqliteUrl: process.env.DATABASE_URL_SQLITE ?? 'file:./dev.db',
    pgPort: asInt(process.env.PG_PORT, 5433),
    pgDataDir: process.env.PG_DATA_DIR ?? '.data/pg',
  },
  auth: {
    jwtSecret: process.env.AUTH_JWT_SECRET ?? '',
    jwtIssuer: process.env.AUTH_JWT_ISSUER ?? 'englishai',
    accessTtlSeconds: asInt(process.env.AUTH_ACCESS_TTL_SECONDS, 900),
    refreshTtlDays: asInt(process.env.AUTH_REFRESH_TTL_DAYS, 30),
    hasher: (process.env.AUTH_HASHER ?? 'argon2') as 'argon2' | 'bcryptjs',
    argon2: {
      memoryKb: asInt(process.env.ARGON2_MEMORY_KB, 19456),
      iterations: asInt(process.env.ARGON2_ITERATIONS, 2),
      parallelism: asInt(process.env.ARGON2_PARALLELISM, 1),
    },
    bcryptCost: asInt(process.env.BCRYPT_COST, 10),
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'deepseek',
    failoverProvider: process.env.AI_FAILOVER_PROVIDER ?? 'mock',
    fallbackEnabled: asBool(process.env.AI_FALLBACK_ENABLED, true),
    defaultTimeoutMs: asInt(process.env.AI_DEFAULT_TIMEOUT_MS, 30000),
    defaultFirstTokenTimeoutMs: asInt(process.env.AI_DEFAULT_FIRST_TOKEN_TIMEOUT_MS, 3000),
    globalConcurrency: asInt(process.env.AI_GLOBAL_CONCURRENCY, 8),
    userDailyQuota: asInt(process.env.AI_USER_DAILY_QUOTA, 100),
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b-instruct',
    },
  },
  upload: {
    dir: process.env.UPLOAD_DIR ?? './storage',
    maxMb: asInt(process.env.UPLOAD_MAX_MB, 20),
    allowedImageTypes: (process.env.ALLOWED_IMAGE_TYPES ?? 'image/jpeg,image/png,image/webp').split(
      ',',
    ),
    allowedAudioTypes: (
      process.env.ALLOWED_AUDIO_TYPES ?? 'audio/mpeg,audio/wav,audio/mp4'
    ).split(','),
  },
  features: {
    offlineCache: asBool(process.env.FEATURE_OFFLINE_CACHE, false),
    push: asBool(process.env.FEATURE_PUSH, false),
    socialLogin: asBool(process.env.FEATURE_SOCIAL_LOGIN, false),
  },
} as const

export type AppConfig = typeof appConfig
