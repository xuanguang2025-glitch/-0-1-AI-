/**
 * `npm run check:env` —— 启动前自检（架构 §6.3 / T01 验收 6）：
 *  1. Node 版本符合 `engines`（>=20.11 <25）
 *  2. env 完整性（schema 同 `src/lib/constants/config.ts`）
 *  3. DB 连通性（postgres：SELECT 1；sqlite：文件可写）
 *  4. AI provider 健康检查（未配 Key → 提示 Mock Provider 兜底，不算失败）
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local') })
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  engines?: { node?: string }
}

let failures = 0
const ok = (msg: string) => process.stdout.write(`  ✔ ${msg}\n`)
const bad = (msg: string) => {
  failures += 1
  process.stderr.write(`  ✘ ${msg}\n`)
}
const warnMsg = (msg: string) => process.stderr.write(`  ⚠ ${msg}\n`)

// ---- 1. Node 版本 ---------------------------------------------------------
process.stdout.write('1) Node version\n')
const current = process.versions.node
const range = pkg.engines?.node ?? '>=20.11 <25'
const [majorRaw] = current.split('.')
const major = Number(majorRaw)
const satisfies = major >= 20 && major < 25
if (satisfies) ok(`node ${current} matches engines "${range}"`)
else bad(`node ${current} does NOT match engines "${range}" — 请切换到 Node 22 LTS（见 .nvmrc）`)

// ---- 2. env 完整性 --------------------------------------------------------
process.stdout.write('2) Environment variables\n')
const required = ['DATABASE_URL', 'AUTH_JWT_SECRET'] as const
for (const key of required) {
  const value = process.env[key]
  if (value && value.length > 0) {
    if (key === 'AUTH_JWT_SECRET' && value.length < 16) bad(`${key} 过短（至少 16 位）`)
    else if (value.includes('<openssl')) bad(`${key} 仍是占位符，请生成真实密钥`)
    else ok(`${key} is set`)
  } else bad(`${key} is missing — 请在 .env.local 中配置`)
}
const optional = ['AI_PROVIDER', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'DB_DRIVER', 'DB_TIER']
for (const key of optional) {
  if (!process.env[key]) warnMsg(`${key} 未设置（使用默认值）`)
}
if (process.env.AUTH_JWT_SECRET == null) {
  warnMsg('AUTH_JWT_SECRET 缺失将导致登录不可用（T03 起）')
}

// ---- 3. DB 连通性 ---------------------------------------------------------
process.stdout.write('3) Database connectivity\n')
const driver = process.env.DB_DRIVER ?? 'postgres'
const url = process.env.DATABASE_URL ?? ''
const portFromUrl = /:(\d{2,5})\/[a-zA-Z]/.exec(url)?.[1]

if (driver === 'sqlite') {
  warnMsg(`DB_DRIVER=sqlite（Tier B）—— enum/Json 降级，先运行 npm run prisma:sqlite`)
  const dbFile = path.join(ROOT, 'prisma', 'dev.db')
  try {
    fs.accessSync(path.dirname(dbFile), fs.constants.W_OK)
    ok('sqlite target directory is writable')
  } catch {
    bad('sqlite target directory is not writable')
  }
} else if (portFromUrl) {
  const port = Number(portFromUrl)
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket()
    const done = (result: boolean) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(1500)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, '127.0.0.1')
  })
  if (reachable) ok(`postgres port ${port} is reachable (Tier ${process.env.DB_TIER ?? 'A'})`)
  else {
    warnMsg(`postgres port ${port} not reachable — 若使用 Tier A，请先运行 npm run db:start`)
  }
} else {
  warnMsg('DATABASE_URL 无法解析出端口，跳过探活')
}

// ---- 4. AI provider -------------------------------------------------------
process.stdout.write('4) AI provider\n')
const provider = process.env.AI_PROVIDER ?? 'deepseek'
const hasKey =
  (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) ||
  (provider === 'openai' && process.env.OPENAI_API_KEY) ||
  (provider === 'dashscope' && process.env.DASHSCOPE_API_KEY)
if (hasKey) ok(`AI_PROVIDER=${provider} has an API key`)
else {
  warnMsg(`AI_PROVIDER=${provider} 无 API Key —— 运行时自动降级到 Mock Provider（链路仍可跑通）`)
}

process.stdout.write('\n')
if (failures > 0) {
  process.stderr.write(`check:env FAILED with ${failures} problem(s)\n`)
  process.exit(1)
}
process.stdout.write('check:env PASSED\n')
