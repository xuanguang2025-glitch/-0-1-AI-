/**
 * Seed 共享工具：env 加载 / CSV 解析 / 批处理 / 日志。
 * ⚠️ seed 在 tsx（非 Next 运行时）中执行，因此这里手动加载 .env。
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// ---- env：先 .env.local（本地真实值）再 .env（不覆盖已有） --------------------
loadEnv({ path: path.join(ROOT, '.env.local') })
loadEnv({ path: path.join(ROOT, '.env') })

/** Tier A 默认连接串（无任何 .env 时保证 seed 可跑）。 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://englishai:englishai@localhost:5433/englishai?schema=public'
  process.stdout.write('[seed] DATABASE_URL 未设置 → 使用 Tier A 默认值\n')
}

/** 引号感知 CSV 行解析（与 build-vocab-csv.ts 一致）。 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? ''
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1] ?? ''
        if (next === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/** 读取整份 CSV → 对象数组（首行为表头）。 */
export function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) return []
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const lines = content.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0] ?? '').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line)
    const row: Record<string, string> = {}
    header.forEach((key, index) => {
      row[key] = fields[index] ?? ''
    })
    return row
  })
}

export const DATA_DIR = path.join(ROOT, 'prisma', 'data')

/** 「n. 释义\nv. 释义」→ [{pos, zh}] */
export function splitTranslation(raw: string): Array<{ pos: string; zh: string }> {
  return raw
    .split('\\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^([a-z]{1,5}\.)\s*(.*)$/.exec(part)
      if (match) return { pos: match[1] ?? '', zh: match[2] ?? '' }
      return { pos: '', zh: part }
    })
}

/** 数组分批（写入批次上限，避免单条 SQL 过大）。 */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export const log = (msg: string): void => {
  process.stdout.write(`[seed] ${msg}\n`)
}
export const warn = (msg: string): void => {
  process.stderr.write(`[seed-warn] ${msg}\n`)
}
