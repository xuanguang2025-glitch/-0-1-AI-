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
 * ⚠️ edge-tts 版本要求（2026-10-14 实测）：**必须 ≥ 7.3.1**。
 *   7.2.8 及更早版本的 DRM token（Sec-MS-GEC）派生已被微软拒绝，
 *   表现为 `aiohttp ... WSServerHandshakeError: 403, message='Invalid response status'`
 *   （连 `--text "probe"` 都复现；`--list-voices` 的 HTTPS 却正常，故易误判为网络问题）。
 *   升级方式：`pip install --upgrade edge-tts`，或用 `EDGE_TTS_CMD` 指向新版：
 *     EDGE_TTS_CMD=/path/to/edgeenv/Scripts/edge-tts.exe npm run audio:gen
 *
 * 用法：
 *   npm run audio:gen                 # 全部 60 篇 × 3 档
 *   npm run audio:gen -- --force      # 忽略幂等 skip，全部重生
 *   npm run audio:gen -- --only=cet4  # 只生成 category=cet4
 *   npm run audio:gen -- --only=intensity:3
 *   npm run audio:gen -- --limit=5    # 只处理前 5 篇（调试）
 *   npm run audio:gen -- --no-db      # 只写文件、不落库
 *
 * **截断自愈**：幂等 skip 原本只查 `size > 0`，会永久放过「有字节但内容不完整」的文件。
 * 现按「实际时长 / 词数估算时长 < TRUNCATION_RATIO(0.45)」判定截断并自动重生，
 * 生成后还会复核一次；阈值标定见 `looksTruncated` 注释（179 正常样本 ratio∈[0.579,1.460]，
 * 唯一截断样本 0.245）。
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

/** 词数统计（朗读稿口径） */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * 按「词数 / (wpm × rate)」估算的**合理时长**（秒）。
 * 用于截断检测的下限，不是精确值——edge-tts 实际语速与设计 wpm 有偏差。
 */
export function estimateSpeechSec(words: number, intensityLevel: number, rate: Rate): number {
  const wpm = intensityLevel === 1 ? 100 : intensityLevel === 2 ? 130 : intensityLevel === 3 ? 150 : 160
  return Math.max(2, (words / (wpm * rate)) * 60)
}

/**
 * 截断判定阈值：实际时长 / 估算时长 低于该值即判「非空但截断」。
 *
 * 标定依据（2026-10-14，对全部 180 个已生成文件实测）：
 *   - 179 个正常文件 ratio ∈ [0.579, 1.460]，p05 = 0.625，中位数 0.914；
 *   - 唯一的截断文件（lm-36 @1.25，只含 5 句中的第 1 句）ratio = 0.245。
 * 取 0.45：低于最低正常值 0.579 留足裕量，又能稳定抓住 0.245 这类截断。
 * 可用 TRUNCATION_RATIO 环境变量覆盖（调试用）。
 */
export const TRUNCATION_RATIO = Number(process.env.TRUNCATION_RATIO ?? '0.45')

/**
 * 判断已存在文件是否「非空但截断」。
 *
 * 为什么需要：幂等 skip 只看 `size > 0`，放过了「有字节但内容不完整」的文件
 * （QA 第六轮实测 lm-36 @1.25 仅 4.08s/170 帧，而同篇 075=28.61s、100=21.48s）。
 * 不检测的话，这种文件会永远留在仓库里、并把 4s 写进库内 durationSec。
 */
export function looksTruncated(
  actualSec: number,
  words: number,
  intensityLevel: number,
  rate: Rate,
): boolean {
  if (words <= 0) return false // 无词数信息时不做判断（避免误杀）
  const est = estimateSpeechSec(words, intensityLevel, rate)
  return actualSec / est < TRUNCATION_RATIO
}

// ---------------------------------------------------------------------------
// CLI 解析
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2)
const optOnly = argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const optLimit = Number(argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0')
const noDb = argv.includes('--no-db')
/** --force：忽略幂等 skip，全部重生（截断文件修复用） */
const optForce = argv.includes('--force')

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------
function synth(
  slug: string,
  rate: Rate,
  text: string,
  opts: { words: number; intensityLevel: number; force: boolean },
): GeneratedAsset {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const fileAbs = path.join(OUT_DIR, audioFileName(slug, rate))
  const url = `/audio/listening/${audioFileName(slug, rate)}`

  if (fs.existsSync(fileAbs) && fs.statSync(fileAbs).size > 0) {
    const actualSec = durationFromBytes(fs.statSync(fileAbs).size)
    // 已存在：跳过合成，但**仍给出时长**（按字节估算）——否则落库会把这些
    // 资产的 durationSec 覆写成 1 秒（syncAssetsToDb 的兜底值），毁掉真实时长。
    //
    // 截断检测：`--force` 或「非空但时长明显偏短」时不跳过，删掉重生。
    // （幂等 skip 原本只查 size>0，会永久放过截断文件。）
    if (!opts.force && !looksTruncated(actualSec, opts.words, opts.intensityLevel, rate)) {
      return { slug, rate, fileAbs, url, durationSec: actualSec, skipped: true }
    }
    const reason = opts.force ? '--force' : `truncated(${actualSec}s < ${TRUNCATION_RATIO}×est)`
    process.stderr.write(`[audio] regenerating ${audioFileName(slug, rate)}: ${reason}\n`)
    fs.rmSync(fileAbs, { force: true })
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
    // vtt 是**中间产物**，删不掉不该让整个资产落库失败（沙箱的 safe-delete
    // 护栏曾一次性拦截 23 个删除，导致这些 mp3 生成了却没登记资产）。
    try {
      fs.rmSync(vttPath, { force: true })
    } catch {
      process.stderr.write(`[audio] warn: cannot remove ${vttPath} (left as-is)\n`)
    }
  }
  if (durationSec <= 0) durationSec = durationFromBytes(fs.statSync(fileAbs).size)

  // 生成后复核：仍然明显偏短 → 视为失败（不进 results，不落库）
  if (looksTruncated(durationSec, opts.words, opts.intensityLevel, rate)) {
    throw new Error(
      `generated audio looks truncated: ${durationSec}s < ${TRUNCATION_RATIO}×estimate ` +
        `(words=${opts.words}, intensity=${opts.intensityLevel}, rate=${rate})`,
    )
  }

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
  let regenerated = 0
  for (const [idx, mat] of materials.entries()) {
    const slug = slugify(mat.title)
    const text = materialText(mat)
    const words = countWords(text)
    for (const rate of RATES) {
      try {
        const before = fs.existsSync(path.join(OUT_DIR, audioFileName(slug, rate)))
        const asset = synth(slug, rate, text, { words, intensityLevel: mat.intensityLevel, force: optForce })
        // before && !skipped → 触发了重生（--force 或截断检测）
        if (before && !asset.skipped) regenerated += 1
        results.push(asset)
      } catch (e) {
        failures += 1
        process.stderr.write(`[audio] FAIL ${slug} @${rate}: ${e instanceof Error ? e.message : String(e)}\n`)
      }
    }
    log(`(${idx + 1}/${materials.length}) ${mat.title} ✓`)
  }

  const generated = results.filter((r) => !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length
  log(`files done: generated=${generated} skipped(existing)=${skipped} regenerated=${regenerated} failures=${failures}`)

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
