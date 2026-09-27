/**
 * PageContainer：内容区统一宽度/内边距。
 */
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'
import { UI } from '@/lib/constants/ui'

export function PageContainer({
  children,
  className,
  narrow,
}: {
  children: ReactNode
  className?: string
  narrow?: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn('mx-auto w-full px-4 py-6 lg:px-8', className)}
      style={{ maxWidth: narrow ? 720 : UI.contentMaxWidth }}
    >
      {children}
    </div>
  )
}
