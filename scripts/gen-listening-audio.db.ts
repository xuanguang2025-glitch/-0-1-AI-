/**
 * scripts/gen-listening-audio.db.ts — 音频资产落库（被 gen-listening-audio.ts 延迟调用）。
 *
 * 拆成独立模块的原因：让音频**文件生成**（无需 DB）与 **DB 落库**（需 PG）解耦，
 * 从而在 PG 不可用时仍能先产出音频文件（也不让 `@/lib/db` 在纯文件模式下被加载）。
 *
 * 幂等：`ListeningAudioAsset` 以 `@@unique([materialId, rate])` 为键 upsert；
 * 同时回填 `ListeningMaterial.audioUrls = [{rate,url}...]`。
 */
import fs from 'node:fs'

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

import type { GeneratedAsset } from './gen-listening-audio'
import type { ListeningMaterialData } from '../prisma/seed/data/listening-p2'

export interface SyncSummary {
  materials: number
  assets: number
}

const VOICE = process.env.EDGE_TTS_VOICE ?? 'en-US-AriaNeural'

export async function syncAssetsToDb(
  materials: ListeningMaterialData[],
  results: GeneratedAsset[],
): Promise<SyncSummary> {
  const idBySlug = new Map(materials.map((m) => [slugOf(m.title), m.id]))
  const grouped = new Map<string, GeneratedAsset[]>()
  for (const r of results) {
    const arr = grouped.get(r.slug) ?? []
    arr.push(r)
    grouped.set(r.slug, arr)
  }

  let materialCount = 0
  let assetCount = 0

  for (const [slug, assets] of grouped) {
    const materialId = idBySlug.get(slug)
    if (!materialId) continue

    const material = await prisma.listeningMaterial.findUnique({ where: { id: materialId }, select: { id: true } })
    if (!material) continue // 未 seed 的材料跳过（不静默创建）

    const audioUrls: Array<{ rate: number; url: string }> = []
    for (const a of assets) {
      const fileSize = fs.existsSync(a.fileAbs) ? fs.statSync(a.fileAbs).size : null
      const durationSec = a.durationSec > 0 ? a.durationSec : 1
      await prisma.listeningAudioAsset.upsert({
        where: { materialId_rate: { materialId, rate: a.rate } },
        update: { url: a.url, durationSec, fileSize: fileSize ?? undefined, isTts: true, voiceName: VOICE },
        create: {
          materialId,
          rate: a.rate,
          url: a.url,
          durationSec,
          fileSize: fileSize ?? undefined,
          isTts: true,
          voiceName: VOICE,
        },
      })
      audioUrls.push({ rate: a.rate, url: a.url })
      assetCount += 1
    }

    audioUrls.sort((x, y) => x.rate - y.rate)
    await prisma.listeningMaterial.update({
      where: { id: materialId },
      data: { audioUrls: audioUrls as unknown as Prisma.InputJsonValue },
    })
    materialCount += 1
  }

  return { materials: materialCount, assets: assetCount }
}

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
