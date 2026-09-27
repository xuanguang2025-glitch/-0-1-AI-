'use client'

/**
 * Avatar（图片 + 首字母 fallback）。
 */
import { useState } from 'react'

import { cn } from '@/lib/utils/cn'

export interface AvatarProps {
  src?: string | null
  alt?: string
  /** 首字母 fallback（src 缺失或加载失败时显示） */
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
}

export function Avatar({ src, alt = '', fallback = '?', size = 'md', className }: AvatarProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const showImg = src && !failed
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-secondary text-secondary-foreground',
        SIZE[size],
        className,
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{fallback.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}
