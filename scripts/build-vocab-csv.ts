/**
 * `npm run db:build:vocab` —— 流式解析 ECDICT（66MB / 77 万行），
 * 按 `tag`（cet4/cet6）筛选并按 `frq`/`bnc` 词频分级，输出：
 *   prisma/data/cet4-words.csv（3000 词）
 *   prisma/data/cet6-words.csv（2000 词）
 *
 * 设计约束：
 *  - **流式解析**（readline 逐行），不整文件载入内存；
 *  - 词数不足（ECDICT 标注的 cet4/cet6 少于目标数）时按 `frq`→`bnc`→字母序
 *    从高频词池回退补齐（架构 §11.1-Q1 / team-lead 指令）；
 *  - 字段映射严格对齐 §2.5 `Vocabulary` 模型：
 *      translation「词性. 释义」→ definitions JSON；exchange p:/i:/3:/d:/r:/t:/s: → 词形变化。
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, '.data', 'ecdict', 'ecdict.csv')
const OUT_DIR = path.join(ROOT, 'prisma', 'data')
const CET4_TARGET = 3000
const CET6_TARGET = 2000

const ECDICT_HEADER = [
  'word', 'phonetic', 'definition', 'translation', 'pos', 'collins',
  'oxford', 'tag', 'bnc', 'frq', 'exchange', 'detail', 'audio',
] as const

interface DictRow {
  word: string
  phonetic: string
  translation: string
  definition: string
  pos: string
  exchange: string
  tags: string[]
  frq: number
  bnc: number
}

interface VocabRow {
  word: string
  lemma: string
  phoneticUs: string
  phoneticUk: string
  pos: string[]
  definitions: Array<{ pos: string; zh: string; en: string }>
  exchange: Record<string, string>
  tags: string[]
  frequencyRank: number | null
  cefrLevel: string
  difficulty: string
  source: string
}

// ---------------------------------------------------------------- CSV helpers

/** 引号感知的单行 CSV 切分（ECDICT 每条记录独占一行，换行以字面 `\n` 表示）。 */
function parseCsvLine(line: string): string[] {
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

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// ------------------------------------------------------------- field mappers

const POS_PREFIX_RE = /^([a-z]{1,5}\.)\s*(.*)$/

/** translation「n. 释义\nv. 释义」→ [{pos, zh}] */
function splitTranslation(raw: string): Array<{ pos: string; zh: string }> {
  return raw
    .split('\\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = POS_PREFIX_RE.exec(part)
      if (match) return { pos: match[1] ?? '', zh: match[2] ?? '' }
      return { pos: '', zh: part }
    })
}

/** 英文 definition 对齐到 definitions[].en */
function splitDefinition(raw: string): string[] {
  return raw
    .split('\\n')
    .map((part) => part.trim())
    .filter(Boolean)
}

/** pos 列「n:50/v:30」→ ['n.','v.'] */
function parsePosColumn(raw: string): string[] {
  return raw
    .split('/')
    .map((part) => part.split(':')[0]?.trim() ?? '')
    .filter(Boolean)
    .map((code) => `${code}.`)
}

const EXCHANGE_KEYS: Record<string, string> = {
  p: 'past',
  d: 'pastParticiple',
  i: 'presentParticiple',
  3: 'thirdPerson',
  r: 'comparative',
  t: 'superlative',
  s: 'plural',
  0: 'lemmaOf',
  1: 'lemma',
}

/** exchange「p:went/d:gone/i:going」→ {past, pastParticiple, presentParticiple} */
function parseExchange(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of raw.split('/')) {
    const idx = part.indexOf(':')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    const mapped = EXCHANGE_KEYS[key]
    if (mapped && value) out[mapped] = value
  }
  return out
}

const CLEAN_WORD_RE = /^[a-zA-Z][a-zA-Z'-]*[a-zA-Z]$/

function toNumber(value: string | undefined): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

// ------------------------------------------------------------------- pipeline

async function main(): Promise<void> {
  if (!fs.existsSync(SOURCE)) {
    process.stderr.write(
      `[build-vocab] source not found: ${path.relative(ROOT, SOURCE)}\n` +
        '[build-vocab] run `npm run db:fetch:vocab` first (or rely on seed fallback).\n',
    )
    process.exit(1)
  }

  const startedAt = Date.now()
  const cet4Tagged: DictRow[] = []
  const cet6Tagged: DictRow[] = []
  const freqPool: Array<{ word: string; frq: number; bnc: number }> = []
  const seenLemmas = new Set<string>()
  let totalLines = 0

  const stream = fs.createReadStream(SOURCE, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  for await (const rawLine of rl) {
    const line = rawLine.replace(/\r$/, '')
    if (totalLines === 0) {
      totalLines += 1
      continue // header（含 BOM）
    }
    totalLines += 1
    if (!line || line.length < 8) continue

    const fields = parseCsvLine(line)
    const row: Record<string, string> = {}
    ECDICT_HEADER.forEach((key, index) => {
      row[key] = fields[index] ?? ''
    })

    const word = (row.word ?? '').trim()
    const lemma = word.toLowerCase()
    if (!word || !CLEAN_WORD_RE.test(word)) continue
    if (seenLemmas.has(lemma)) continue
    seenLemmas.add(lemma)

    const frq = toNumber(row.frq)
    const bnc = toNumber(row.bnc)
    const tags = (row.tag ?? '')
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    const dictRow: DictRow = {
      word,
      phonetic: row.phonetic ?? '',
      translation: row.translation ?? '',
      definition: row.definition ?? '',
      pos: row.pos ?? '',
      exchange: row.exchange ?? '',
      tags,
      frq,
      bnc,
    }

    if (tags.includes('cet4')) cet4Tagged.push(dictRow)
    if (tags.includes('cet6')) cet6Tagged.push(dictRow)
    freqPool.push({ word, frq, bnc })
  }
  rl.close()

  // ---- 排序：frq 升序（0 = 无词频 → Infinity），再 bnc，再字母序 ----
  const byFrequency = (a: { frq: number; bnc: number; word: string }, b: { frq: number; bnc: number; word: string }) => {
    const fa = a.frq > 0 ? a.frq : Number.POSITIVE_INFINITY
    const fb = b.frq > 0 ? b.frq : Number.POSITIVE_INFINITY
    if (fa !== fb) return fa - fb
    const ba = a.bnc > 0 ? a.bnc : Number.POSITIVE_INFINITY
    const bb = b.bnc > 0 ? b.bnc : Number.POSITIVE_INFINITY
    if (ba !== bb) return ba - bb
    return a.word.localeCompare(b.word)
  }

  cet4Tagged.sort(byFrequency)
  cet6Tagged.sort(byFrequency)
  freqPool.sort(byFrequency)

  const used = new Set<string>()
  const pickCet4 = cet4Tagged.slice(0, CET4_TARGET)
  for (const row of pickCet4) used.add(row.word.toLowerCase())

  // CET-6 先取「仅 cet6」的新词，保证 5000 词互不重复
  const pickCet6: DictRow[] = []
  for (const row of cet6Tagged) {
    if (pickCet6.length >= CET6_TARGET) break
    if (used.has(row.word.toLowerCase())) continue
    pickCet6.push(row)
    used.add(row.word.toLowerCase())
  }

  // ---- 词频回退补齐 ----
  let freqFilled = 0
  const fillFromFreqPool = (target: number, bucket: DictRow[]): void => {
    for (const candidate of freqPool) {
      if (bucket.length >= target) return
      const lemma = candidate.word.toLowerCase()
      if (used.has(lemma)) continue
      used.add(lemma)
      bucket.push({
        word: candidate.word,
        phonetic: '',
        translation: '',
        definition: '',
        pos: '',
        exchange: '',
        tags: [],
        frq: candidate.frq,
        bnc: candidate.bnc,
      })
      freqFilled += 1
    }
  }
  if (pickCet4.length < CET4_TARGET) fillFromFreqPool(CET4_TARGET, pickCet4)
  if (pickCet6.length < CET6_TARGET) fillFromFreqPool(CET6_TARGET, pickCet6)

  // ---- 输出 CSV ----
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const HEADER =
    'word,lemma,phoneticUs,phoneticUk,pos,definitions,exchange,tags,frequencyRank,cefrLevel,difficulty,source'

  const toVocabRow = (row: DictRow, level: 'cet4' | 'cet6'): VocabRow => {
    const zh = splitTranslation(row.translation)
    const en = splitDefinition(row.definition)
    const definitions = zh.map((item, index) => ({
      pos: item.pos,
      zh: item.zh,
      en: en[index] ?? '',
    }))
    if (definitions.length === 0 && en.length > 0) {
      definitions.push({ pos: '', zh: '', en: en[0] ?? '' })
    }
    const posList = parsePosColumn(row.pos)
    if (posList.length === 0) {
      for (const item of definitions) {
        if (item.pos && !posList.includes(item.pos)) posList.push(item.pos)
      }
    }
    const frequencyRank = row.frq > 0 ? row.frq : row.bnc > 0 ? row.bnc : null
    const tagList = [...row.tags.filter((t) => t === 'cet4' || t === 'cet6'), level]
    return {
      word: row.word,
      lemma: row.word.toLowerCase(),
      phoneticUs: row.phonetic,
      phoneticUk: '',
      pos: [...new Set(posList)],
      definitions,
      exchange: parseExchange(row.exchange),
      tags: [...new Set(tagList)],
      frequencyRank,
      cefrLevel: level === 'cet4' ? 'B1' : 'B2',
      difficulty: level === 'cet4' ? 'MEDIUM' : 'HARD',
      source: row.tags.includes(level) ? 'ecdict' : 'ecdict-freq',
    }
  }

  const writeCsv = (file: string, rows: VocabRow[]): void => {
    const out = fs.createWriteStream(file, { encoding: 'utf8' })
    out.write(`${HEADER}\n`)
    for (const row of rows) {
      const line = [
        csvEscape(row.word),
        csvEscape(row.lemma),
        csvEscape(row.phoneticUs),
        csvEscape(row.phoneticUk),
        csvEscape(JSON.stringify(row.pos)),
        csvEscape(JSON.stringify(row.definitions)),
        csvEscape(JSON.stringify(row.exchange)),
        csvEscape(JSON.stringify(row.tags)),
        row.frequencyRank == null ? '' : String(row.frequencyRank),
        row.cefrLevel,
        row.difficulty,
        row.source,
      ].join(',')
      out.write(`${line}\n`)
    }
    out.end()
  }

  writeCsv(path.join(OUT_DIR, 'cet4-words.csv'), pickCet4.map((r) => toVocabRow(r, 'cet4')))
  writeCsv(path.join(OUT_DIR, 'cet6-words.csv'), pickCet6.map((r) => toVocabRow(r, 'cet6')))

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  process.stdout.write(
    `[build-vocab] parsed ${totalLines - 1} lines in ${seconds}s\n` +
      `[build-vocab] cet4 tagged=${cet4Tagged.length} → picked ${pickCet4.length} (freq-filled ${Math.min(freqFilled, pickCet4.length - cet4Tagged.length >= 0 ? pickCet4.length - cet4Tagged.length : 0)})\n` +
      `[build-vocab] cet6 tagged=${cet6Tagged.length} → picked ${pickCet6.length}\n` +
      `[build-vocab] wrote ${path.relative(ROOT, path.join(OUT_DIR, 'cet4-words.csv'))} / cet6-words.csv\n`,
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`[build-vocab] fatal: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
