'use client'

/**
 * LazyBarChart/LazyLineChart 的 dynamic 包装（正式出口，供页面引用）。
 * 保证 recharts 不进首屏 bundle（架构 §7.3）。
 */
import dynamic from 'next/dynamic'

import { ChartSkeleton } from './lazy-chart'

export const LineChartLazy = dynamic(() => import('./lazy-line-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
})

export const BarChartLazy = dynamic(() => import('./lazy-bar-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
})

export const PieChartLazy = dynamic(() => import('./lazy-pie-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
})

export const RadarChartLazy = dynamic(() => import('./lazy-radar-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={280} />,
})
