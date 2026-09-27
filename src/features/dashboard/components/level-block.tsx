'use client'

/**
 * LevelBlock：等级进度区块（ProgressRing + XP 进度文案）。
 */
import { ProgressRing } from '@/components/charts/progress-ring'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LevelBlock({
  level,
  levelPct,
  xpToNext,
}: {
  level: number
  levelPct: number
  xpToNext: number
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">我的等级</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <ProgressRing value={levelPct} size={88} label={`Lv.${level}`} />
        <div className="text-sm">
          <div className="font-medium">Lv.{level}</div>
          <p className="text-muted-foreground">
            {xpToNext > 0 ? `距下一级还需 ${xpToNext} XP` : '已满级，继续保持！'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
