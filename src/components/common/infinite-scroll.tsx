'use client'

/**
 * InfiniteScroll：滚动到底自动加载（IntersectionObserver，根元素默认视口）。
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

import { Spinner } from '@/components/ui/spinner'

export function InfiniteScroll({
  loadMore,
  hasMore,
  loading,
  children,
}: {
  loadMore: () => void
  hasMore: boolean
  loading: boolean
  children: ReactNode
}): React.JSX.Element {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadRef = useRef(loadMore)
  loadRef.current = loadMore

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]
      if (entry?.isIntersecting && hasMore && !loading) loadRef.current()
    },
    [hasMore, loading],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(onIntersect, { rootMargin: '240px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onIntersect])

  return (
    <div>
      {children}
      <div ref={sentinelRef} className="flex justify-center py-4" aria-hidden>
        {loading ? <Spinner /> : null}
      </div>
    </div>
  )
}
