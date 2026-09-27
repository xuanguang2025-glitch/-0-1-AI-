/**
 * `npm run db:use-cloud` / `db:use-sqlite` —— 一键切换数据库 Tier（架构 §2.6）。
 * 只改 `.env.local` 的 DB_DRIVER / DB_TIER / DATABASE_URL，**业务代码零改动**。
 *
 * 用法：npx tsx scripts/use-driver.ts postgres|cloud|sqlite
 */
import fs from 'node:fs'
import path from 'path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_LOCAL = path.join(ROOT, '.env.local')
const ENV_EXAMPLE = path.join(ROOT, '.env.example')

type Target = 'postgres' | 'cloud' | 'sqlite'

const TIER_NAME: Record<Target, string> = {
  postgres: 'Tier A · 本机内嵌 PostgreSQL (embedded-postgres)',
  cloud: 'Tier C · 云 PostgreSQL (Neon / Supabase)',
  sqlite: 'Tier B · SQLite（逃生档，enum/Json 降级）',
}

const PRESET: Record<Target, { DB_DRIVER: string; DB_TIER: string; DATABASE_URL?: string }> = {
  postgres: {
    DB_DRIVER: 'postgres',
    DB_TIER: 'A',
    DATABASE_URL: 'postgresql://englishai:englishai@localhost:5433/englishai?schema=public',
  },
  cloud: { DB_DRIVER: 'postgres', DB_TIER: 'C' },
  sqlite: { DB_DRIVER: 'sqlite', DB_TIER: 'B', DATABASE_URL: 'file:./dev.db' },
}

function ensureEnvLocal(): string {
  if (fs.existsSync(ENV_LOCAL)) return fs.readFileSync(ENV_LOCAL, 'utf8')
  process.stdout.write(`[use-driver] .env.local 不存在，从 .env.example 复制\n`)
  const example = fs.existsSync(ENV_EXAMPLE) ? fs.readFileSync(ENV_EXAMPLE, 'utf8') : ''
  fs.writeFileSync(ENV_LOCAL, example, 'utf8')
  return example
}

function upsertKey(content: string, key: string, value: string): string {
  const line = `${key}="${value}"`
  const regex = new RegExp(`^\\s*#?\\s*${key}=.*$`, 'm')
  if (regex.test(content)) return content.replace(regex, line)
  return `${content.replace(/\s*$/, '')}\n${line}\n`
}

const target = (process.argv[2] ?? '') as Target
if (!(target in PRESET)) {
  process.stderr.write('[use-driver] 用法: npx tsx scripts/use-driver.ts postgres|cloud|sqlite\n')
  process.exit(1)
}

let content = ensureEnvLocal()
const preset = PRESET[target]
for (const [key, value] of Object.entries(preset)) {
  if (value != null) content = upsertKey(content, key, value)
}
fs.writeFileSync(ENV_LOCAL, content, 'utf8')

process.stdout.write(`[use-driver] switched to ${TIER_NAME[target]}\n`)
if (target === 'cloud') {
  const url = /^DATABASE_URL="?(.+?)"?$/m.exec(content)?.[1] ?? ''
  if (!url || url.includes('englishai:englishai@localhost')) {
    process.stdout.write(
      '[use-driver] ⚠️  当前 DATABASE_URL 仍是本地内嵌库。请编辑 .env.local 填入云库连接串：\n' +
        '            DATABASE_URL="postgresql://<user>:<pwd>@<host>/englishai?sslmode=require&pgbouncer=true"\n',
    )
  }
}
process.stdout.write('[use-driver] 下一步：\n')
process.stdout.write('  - cloud:  npm run db:deploy && npm run db:seed\n')
process.stdout.write('  - sqlite: npm run prisma:sqlite && npx prisma migrate dev --schema prisma/schema.sqlite.prisma --name init && npm run db:seed\n')
process.stdout.write('  - 回到默认: npm run db:start && npm run db:migrate && npm run db:seed\n')
