'use client'

/**
 * AbilityBlock：六维能力雷达区块（复用 charts/AbilityRadar，数据缺失时占位引导）。
 */
import { AbilityRadar } from '@/components/charts/ability-radar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

export function AbilityBlock({ ability }: { ability: Record<string, number> | null }): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">能力画像</CardTitle>
        {!ability ? (
          <Link href={ROUTES.placement} className="text-xs font-medium text-primary hover:underline">
            去测一测
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {ability ? (
          <AbilityRadar abilityVector={ability} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            完成水平测试后，这里会展示你的六维能力画像
          </p>
        )}
      </CardContent>
    </Card>
  )
}
