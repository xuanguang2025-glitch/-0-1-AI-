'use client'

/**
 * ContinueLearning：继续学习卡（上次词书 + 快捷入口）。
 */
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'

export function ContinueLearning({
  lastBookSlug,
  lastBookName,
}: {
  lastBookSlug: string | null
  lastBookName: string | null
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">继续学习</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        {lastBookName ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{lastBookName}</p>
              <p className="text-xs text-muted-foreground">从上次进度继续</p>
            </div>
            <Link href={`${ROUTES.vocabulary.root}?book=${encodeURIComponent(lastBookSlug ?? '')}`}>
              <Button size="sm">继续</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">选择一本词书开始学习吧</p>
            <Link href={ROUTES.vocabulary.library}>
              <Button size="sm">选词书</Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
