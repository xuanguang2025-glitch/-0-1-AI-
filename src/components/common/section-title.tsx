/**
 * SectionTitle：区块标题（左标题右操作）。
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export function SectionTitle({
  title,
  action,
  actionHref,
  className,
}: {
  title: string
  action?: ReactNode
  actionHref?: string
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('mb-4 flex items-center justify-between', className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {actionHref ? (
        <Link href={actionHref} className="text-sm text-primary hover:underline">
          {typeof action === 'string' ? action : '查看全部'}
        </Link>
      ) : (
        action
      )}
    </div>
  )
}
