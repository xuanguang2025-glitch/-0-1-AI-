/**
 * Seed · 听力 Phase 2（60 篇 · 架构 §5.2 难度阶梯 + §5.1 音频资产）。
 *
 * 与 Phase 1 `seedContent.seedListening()` 的关系：
 *   - 本 seed **覆盖** lm-1..lm-20 的内容（Phase 2 取代 Phase 1 的 20 篇），
 *     最终 `listening_materials` 共 60 行（lm-1..lm-60）；
 *   - 因此会顺带清理这些材料下**不属于 Phase 2** 的历史题目（`lq-*`），避免旧题泄漏到 L3。
 *
 * 幂等：material 以固定 id upsert，question 以 `lq2-{materialId}-{n}` upsert，
 *       audio asset 以 `@@unique([materialId, rate])` upsert → 可重复执行。
 *
 * 内容单一数据源：`./data/listening-p2.ts`（与 `scripts/gen-listening-audio.ts` 共用），
 * 杜绝「字幕 / 音频」两条链路漂移。
 */
import fs from 'node:fs'
import path from 'node:path'

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

import { RATES, rateTag, slugify } from '../../scripts/gen-listening-audio'
import { countWords, estimateTimeline, wpmForIntensity, type TimelineLine } from '@/services/listening/ladder'
import { LISTENING_P2, type FocusPointKind, type ListeningMaterialData } from './data/listening-p2'
import { log, warn } from './shared'

/** 生词/考点类型 → Prisma FocusPointType 枚举 */
const FOCUS_TYPE: Record<FocusPointKind, 'NEW_WORD' | 'KEY_WORD' | 'PHRASE' | 'GRAMMAR'> = {
  new: 'NEW_WORD',
  key: 'KEY_WORD',
  phrase: 'PHRASE',
  grammar: 'GRAMMAR',
}

/** 音频输出目录（与 scripts/gen-listening-audio.ts 一致） */
const AUDIO_DIR = path.resolve(process.cwd(), 'public', 'audio', 'listening')

/** 考点定位：优先整短语命中字幕行，退化到短语首词；都找不到回退 0 */
function locateStartSec(phrase: string, timeline: TimelineLine[]): number {
  const lower = phrase.toLowerCase()
  const direct = timeline.find((l) => l.en.toLowerCase().includes(lower))
  if (direct) return direct.startSec
  const head = lower.split(/\s+/)[0] ?? ''
  if (head.length >= 3) {
    const hit = timeline.find((l) => l.en.toLowerCase().includes(head))
    if (hit) return hit.startSec
  }
  return 0
}

/**
 * 读取已生成音频文件的时长（秒）。
 * 优先用 edge-tts 留下的 `.vtt` 末条 cue（最准）；无 vtt 时按 `材料时长 / 倍速` 估算。
 * 精确时长由 `npm run audio:gen` 落库时覆写。
 */
function durationForFile(fileAbs: string, materialSec: number, rate: number): number {
  const vtt = fileAbs.replace(/\.mp3$/, '.vtt')
  if (fs.existsSync(vtt)) {
    const text = fs.readFileSync(vtt, 'utf8')
    const times = [...text.matchAll(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/g)]
    const last = times[times.length - 1]
    if (last) {
      const sec = Number(last[5]) * 3600 + Number(last[6]) * 60 + Number(last[7]) + Number(last[8]) / 1000
      if (sec > 0) return Math.round(sec)
    }
  }
  return Math.max(1, Math.round(materialSec / Math.max(rate, 0.1)))
}

/** 组装材料写库字段（create / update 共用，保证幂等覆盖） */
function materialFields(m: ListeningMaterialData, slug: string, wpm: number) {
  const timeline = estimateTimeline(m.lines, wpm)
  const durationSec = Math.max(1, Math.round(timeline[timeline.length - 1]?.endSec ?? 0))
  const audioUrls = RATES.map((rate) => ({ rate, url: `/audio/listening/${slug}_${rateTag(rate)}.mp3` }))
  // audioUrl 为 Phase 1 遗留的**非空**字段：默认指向 1.0 档
  const defaultUrl = audioUrls.find((a) => a.rate === 1.0)?.url ?? audioUrls[0]?.url ?? ''

  return {
    title: m.title,
    description: `${m.category} 主题听力材料（强度档 ${m.intensityLevel}），含时间轴字幕、生词考点与 6 种训练模式。`,
    category: m.category,
    difficulty: m.difficulty,
    cefrLevel: m.cefr,
    audioUrl: defaultUrl,
    audioUrls: audioUrls as unknown as Prisma.InputJsonValue,
    intensityLevel: m.intensityLevel,
    focusPoints: m.focusPoints.map((fp) => ({
      word: fp.word,
      meaning: fp.meaning,
      type: FOCUS_TYPE[fp.type],
      startSec: locateStartSec(fp.word, timeline),
    })) as unknown as Prisma.InputJsonValue,
    durationSec,
    transcript: timeline as unknown as Prisma.InputJsonValue,
    wordCount: countWords(m.lines),
    tags: m.tags as unknown as Prisma.InputJsonValue,
    status: 'PUBLISHED' as const,
    publishedAt: new Date(),
    createdBy: 'seed-p2',
  }
}

/**
 * 播种 Phase 2 听力 60 篇（含题目与音频资产登记）。
 * @returns 播种的材料数
 */
export async function seedListeningP2(): Promise<number> {
  let count = 0
  let assetCount = 0

  for (const m of LISTENING_P2) {
    const slug = slugify(m.title)
    const wpm = wpmForIntensity(m.intensityLevel)
    const fields = materialFields(m, slug, wpm)

    await prisma.listeningMaterial.upsert({
      where: { id: m.id },
      update: fields,
      create: { id: m.id, ...fields },
    })

    // ---- 题目：Phase 2 的 7 模式题目（choice / cloze / keyword / extensive）----
    const questionIds: string[] = []
    for (const [i, q] of m.questions.entries()) {
      const id = `lq2-${m.id}-${i + 1}`
      questionIds.push(id)
      await prisma.listeningQuestion.upsert({
        where: { id },
        update: {
          type: q.type,
          stem: q.stem,
          options: (q.options ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          answer: q.answer,
          answerAliases: (q.answerAliases ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          explanation: q.explanation ?? null,
          difficulty: m.difficulty,
          // mode 大写存 knowledgePoints[0] → L3 按模式筛题
          knowledgePoints: [q.mode.toUpperCase(), m.category, `intensity:${m.intensityLevel}`] as unknown as Prisma.InputJsonValue,
          sortOrder: i,
        },
        create: {
          id,
          materialId: m.id,
          type: q.type,
          stem: q.stem,
          options: (q.options ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          answer: q.answer,
          answerAliases: (q.answerAliases ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          explanation: q.explanation ?? null,
          difficulty: m.difficulty,
          knowledgePoints: [q.mode.toUpperCase(), m.category, `intensity:${m.intensityLevel}`] as unknown as Prisma.InputJsonValue,
          sortOrder: i,
        },
      })
    }

    // ---- 清理 Phase 1 遗留题目（lq-*，非本次生成的 id）----
    const stale = await prisma.listeningQuestion.deleteMany({
      where: { materialId: m.id, id: { notIn: questionIds } },
    })
    if (stale.count > 0) {
      warn(`listening-p2: removed ${stale.count} legacy question(s) under ${m.id}`)
    }

    // ---- 音频资产：只为**真实存在**的 mp3 登记（不再造假死链）----
    for (const rate of RATES) {
      const fileName = `${slug}_${rateTag(rate)}.mp3`
      const fileAbs = path.join(AUDIO_DIR, fileName)
      if (!fs.existsSync(fileAbs)) continue
      const durationSec = durationForFile(fileAbs, fields.durationSec, rate)
      await prisma.listeningAudioAsset.upsert({
        where: { materialId_rate: { materialId: m.id, rate } },
        update: {
          url: `/audio/listening/${fileName}`,
          durationSec,
          fileSize: fs.statSync(fileAbs).size,
          isTts: true,
          voiceName: process.env.EDGE_TTS_VOICE ?? 'en-US-AriaNeural',
        },
        create: {
          materialId: m.id,
          rate,
          url: `/audio/listening/${fileName}`,
          durationSec,
          fileSize: fs.statSync(fileAbs).size,
          isTts: true,
          voiceName: process.env.EDGE_TTS_VOICE ?? 'en-US-AriaNeural',
        },
      })
      assetCount += 1
    }

    count += 1
  }

  log(`listening-p2: ${count} materials (+${assetCount} audio assets)`)
  return count
}
