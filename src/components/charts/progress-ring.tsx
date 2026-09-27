'use client'

/**
 * ProgressRing：SVG 圆环进度（纯 SVG，无需 recharts；轻量可进首屏）。
 */
import { cn } from '@/lib/utils/cn'

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  label,
  className,
}: {
  /** 0-100 */
  value: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} role="img" aria-label={`进度 ${clamped}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--surface-muted))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-center text-sm font-semibold tabular-nums">{label ?? `${Math.round(clamped)}%`}</span>
    </div>
  )
}
