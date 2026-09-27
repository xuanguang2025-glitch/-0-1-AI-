'use client'

/**
 * 图表统一 dynamic(ssr:false) 加载器（架构 §7.3：recharts 不进首屏 bundle）。
 * 所有 charts/* 组件均经此包装。
 */
import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/separator'

/** 图表容器骨架（加载占位） */
export function ChartSkeleton({ height = 240, className }: { height?: number; className?: string }): React.JSX.Element {
  return <Skeleton className={className} style={{ height }} />
}

/** 生成 dynamic 组件的便捷工厂 */
export function lazyChart<P>(loader: () => Promise<{ default: React.ComponentType<P> }>, height = 240) {
  return dynamic(loader, {
    ssr: false,
    loading: () => <ChartSkeleton height={height} />,
  })
}
