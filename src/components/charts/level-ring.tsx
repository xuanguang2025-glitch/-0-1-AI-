'use client'

/**
 * LevelRing：等级环（XP 进度 → 下一级百分比）。
 */
import { ProgressRing } from './progress-ring'

export function LevelRing({
  level,
  xp,
  xpForNextLevel,
}: {
  level: number
  xp: number
  xpForNextLevel: number
}): React.JSX.Element {
  const pct = xpForNextLevel > 0 ? Math.min(100, (xp / xpForNextLevel) * 100) : 100
  return (
    <div className="flex items-center gap-4">
      <ProgressRing value={pct} size={88} label={`Lv.${level}`} />
      <div className="text-sm">
        <div className="font-medium">经验值 {xp}</div>
        <div className="text-muted-foreground">距下一级还需 {Math.max(0, xpForNextLevel - xp)} XP</div>
      </div>
    </div>
  )
}
