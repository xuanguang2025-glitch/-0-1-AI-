import { PrismaClient } from '@prisma/client'

/**
 * PrismaClient 单例（架构 §6.4 / T02）。
 *
 * - dev 下挂 `globalThis` 防止 HMR 多实例耗尽连接池；
 * - seed / 脚本（tsx 运行）同样复用本模块，因此**不**引入 `server-only`
 *   （该包在非 RSC 运行时会抛错）；
 * - `DB_DRIVER=sqlite` 逃生档下行为不变，仅连接目标不同（见 §2.6.3）。
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  __prismaConnectPromise?: Promise<unknown>
}

function createClient(): PrismaClient {
  const isDev = process.env.NODE_ENV !== 'production'
  return new PrismaClient({
    log: isDev ? ['warn', 'error'] : ['error'],
    errorFormat: 'minimal',
  })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * 探活查询（health check 用）。
 * @returns 数据库版本字符串，失败抛出原始错误。
 */
export async function pingDatabase(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version() AS version`
  return rows[0]?.version ?? 'unknown'
}

/** 优雅断开（脚本退出前调用；Next 进程内无需调用）。 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}

export default prisma
