'use client'

/**
 * ScoreRadar：评分雷达（T17 验收 5）。
 *
 * 复用全站 `RadarChartLazy`；AI 维度分形状不固定（防御式解析后传入），
 * **scoreSource='rule' 时渲染 null**——规则引擎给不了维度分，硬造雷达是造假。
 */
import { RadarChartLazy } from '@/components/charts'
import { SkeletonCard } from '@/components/common/skeleton-kit'

export interface ScoreRadarProps {
  /** AI 维度分（键名即维度名）；null = 不可用 */
  scores: Record<string, unknown> | null
  loading?: boolean
  className?: string
}

/** 维度键 → 中文名（AI 返回什么键就映射什么，映射不到用原键） */
const DIM_NAMES: Record<string, string> = {
  grammar: '语法',
  vocabulary: '词汇',
  structure: '结构',
  coherence: '连贯',
  content: '内容',
  naturalness: '自然度',
  organisation: '组织',
  language: '语言',
  accuracy: '准确',
  total: '总分',
}

export function ScoreRadar({ scores, loading = false, className }: ScoreRadarProps): React.JSX.Element | null {
  if (loading) return <SkeletonCard className={className} />
  if (scores === null) return null

  const data = Object.entries(scores)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => ({ dimension: DIM_NAMES[k] ?? k, score: v as number }))
  if (data.length < 3) return null // 维度太少画不出雷达

  return (
    <div className={className} data-testid="score-radar">
      <RadarChartLazy data={data} />
    </div>
  )
}
