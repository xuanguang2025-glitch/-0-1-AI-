/**
 * scripts/gen-listening-audio.ts — 听力音频资产生成（架构 §5.1 方案 A：Edge TTS）。
 *
 * 目的：解决 Phase 1 的音频死链（`/audio/listening/{slug}.mp3` 指向不存在的文件）。
 *
 * 每篇材料生成 **3 档语速**：0.75 / 1.0 / 1.25（对应 edge-tts 的 -25% / +0% / +25%）。
 * 输出：`public/audio/listening/{slug}_{075|100|125}.mp3`。
 *
 * 时长来源：**不使用 TTS 输出做字幕时间轴**（§5.1 局限③），
 * 但 `durationSec` 用 edge-tts 生成的 `.vtt` 最后一条 cue 的结束时间求得（比按字节估算准）；
 * 无 vtt 时回退按 24kHz/48kbps MP3 的字节数估算。
 *
 * 幂等：已存在且大小 > 0 的文件跳过（可重复执行、支持 `--only` 增量）。
 * 可选落库：`ListeningAudioAsset` + 回填 `ListeningMaterial.audioUrls`（需 DB；DB 不可用时**明确报错并退出码 2**，不静默降级）。
 *
 * 用法：
 *   npm run audio:gen                 # 全部 60 篇 × 3 档
 *   npm run audio:gen -- --only=cet4  # 只生成 category=cet4
 *   npm run audio:gen -- --only=intensity:3
 *   npm run audio:gen -- --limit=5    # 只处理前 5 篇（调试）
 *   npm run audio:gen -- --no-db      # 只写文件、不落库
 *
 * 环境变量：EDGE_TTS_CMD（默认 edge-tts）、EDGE_TTS_VOICE（默认 en-US-AriaNeural）
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { LISTENING_P2, type ListeningMaterialData } from '../prisma/seed/data/listening-p2'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public', 'audio', 'listening')

export const RATES = [0.75, 1.0, 1.25] as const
export type Rate = (typeof RATES)[number]

const EDGE_TTS_CMD = process.env.EDGE_TTS_CMD ?? 'edge-tts'
const VOICE = process.env.EDGE_TTS_VOICE ?? 'en-US-AriaNeural'

export interface GeneratedAsset {
  slug: string
  rate: Rate
  /** 绝对路径 */
  fileAbs: string
  /** 可访问 URL（/audio/...） */
  url: string
  durationSec: number
  skipped: boolean
}

// ---------------------------------------------------------------------------
// 纯函数（可单测）
// ---------------------------------------------------------------------------

/** slug：与 Phase 1 seed 同一口径 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 语速档 → 文件名后缀（0.75→075 / 1.0→100 / 1.25→125） */
export function rateTag(rate: Rate): string {
  return rate.toFixed(2).replace('.', '')
}

/** 语速档 → edge-tts --rate 参数（1.0 → +0%） */
export function rateFlag(rate: Rate): string {
  const pct = Math.round((rate - 1) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

export function audioFileName(slug: string, rate: Rate): string {
  return `${slug}_${rateTag(rate)}.mp3`
}

/** 组装朗读稿：字幕逐句拼接（句间加空格，保证自然停顿） */
export function materialText(m: ListeningMaterialData): string {
  return m.lines.map((l) => l.en.trim()).join(' ')
}

/** 从 edge-tts 的 .vtt 求结束时间（秒）；解析失败返回 null */
export function durationFromVtt(vtt: string): number | null {
  const re = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g
  let last: number | null = null
  let match: RegExpExecArray | null
  while ((match = re.exec(vtt)) !== null) {
    last = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000
  }
  return last
}

/** 回退：按 24kHz/48kbps 单声道 MP3 的字节数估算时长 */
export function durationFromBytes(byteLength: number): number {
  return Math.max(1, Math.round((byteLength * 8) / 48_000))
}

// ---------------------------------------------------------------------------
// CLI 解析
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2)
const optOnly = argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const optLimit = Number(argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0')
const noDb = argv.includes('--no-db')

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------
function synth(slug: string, rate: Rate, text: string): GeneratedAsset {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const fileAbs = path.join(OUT_DIR, audioFileName(slug, rate))
  const url = `/audio/listening/${audioFileName(slug, rate)}`

  if (fs.existsSync(fileAbs) && fs.statSync(fileAbs).size > 0) {
    return { slug, rate, fileAbs, url, durationSec: 0, skipped: true }
  }

  const vttPath = path.join(OUT_DIR, `${slug}_${rateTag(rate)}.vtt`)
  execFileSync(
    EDGE_TTS_CMD,
    ['--voice', VOICE, `--rate=${rateFlag(rate)}`, '--text', text, '--write-media', fileAbs, '--write-subtitles', vttPath],
    { stdio: 'pipe' },
  )

  let durationSec = 0
  if (fs.existsSync(vttPath)) {
    durationSec = durationFromVtt(fs.readFileSync(vttPath, 'utf8')) ?? 0
    fs.rmSync(vttPath, { force: true })
  }
  if (durationSec <= 0) durationSec = durationFromBytes(fs.statSync(fileAbs).size)

  return { slug, rate, fileAbs, url, durationSec: Math.round(durationSec), skipped: false }
}

/** 过滤：--only=category | intensity:N | --limit=N */
function selectAll(): ListeningMaterialData[] {
  let list = LISTENING_P2
  if (optOnly?.startsWith('intensity:')) {
    const level = Number(optOnly.split(':')[1])
    list = list.filter((m) => m.intensityLevel === level)
  } else if (optOnly) {
    list = list.filter((m) => m.category === optOnly || m.tags.includes(optOnly))
  }
  if (optLimit > 0) list = list.slice(0, optLimit)
  return list
}

async function main(): Promise<void> {
  const materials = selectAll()
  const log = (msg: string): void => {
    process.stdout.write(`[audio] ${msg}\n`)
  }

  if (materials.length === 0) {
    process.stderr.write('[audio] no materials matched filter — nothing to do\n')
    process.exit(1)
  }

  try {
    execFileSync(EDGE_TTS_CMD, ['--version'], { stdio: 'pipe' })
  } catch {
    process.stderr.write(
      `[audio] Edge TTS 不可用（找不到 "${EDGE_TTS_CMD}"）。\n` +
        `        路径①：pip install edge-tts；路径②：EDGE_TTS_CMD 指向自定义命令。\n`,
    )
    process.exit(3)
  }

  log(`${materials.length} materials × ${RATES.length} rates = ${materials.length * RATES.length} files → ${path.relative(ROOT, OUT_DIR)}`)

  const results: GeneratedAsset[] = []
  let failures = 0
  for (const [idx, mat] of materials.entries()) {
    const slug = slugify(mat.title)
    const text = materialText(mat)
    for (const rate of RATES) {
      try {
        results.push(synth(slug, rate, text))
      } catch (e) {
        failures += 1
        process.stderr.write(`[audio] FAIL ${slug} @${rate}: ${e instanceof Error ? e.message : String(e)}\n`)
      }
    }
    log(`(${idx + 1}/${materials.length}) ${mat.title} ✓`)
  }

  const generated = results.filter((r) => !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length
  log(`files done: generated=${generated} skipped(existing)=${skipped} failures=${failures}`)

  if (noDb) {
    log('--no-db set → skip DB sync')
  } else {
    try {
      const { syncAssetsToDb } = await import('./gen-listening-audio.db')
      const summary = await syncAssetsToDb(materials, results)
      log(`DB synced: materials=${summary.materials} assets=${summary.assets}`)
    } catch (e) {
      process.stderr.write(
        `[audio] DB sync failed (${e instanceof Error ? e.message : String(e)}).\n` +
          `        音频文件已生成；请先启动 PG（npm run db:start）后重跑以落库。\n`,
      )
      process.exit(2)
    }
  }

  if (failures > 0) process.exit(1)
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (invokedDirectly) {
  void main()
}
