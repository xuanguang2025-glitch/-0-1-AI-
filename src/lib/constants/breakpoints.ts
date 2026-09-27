/**
 * 断点常量：与 tailwind.config（sm 640 / md 768 / lg 1024 / xl 1280）对齐。
 */

export const BREAKPOINTS = {
  sm: 640,
  /** ≤768 显示 BottomNav（PRD §5.2） */
  md: 768,
  /** ≥1024 显示 Sidebar */
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type BreakpointKey = keyof typeof BREAKPOINTS

/** 判断是否移动端布局（与 Tailwind md 断点一致） */
export function isMobileViewport(width: number): boolean {
  return width < BREAKPOINTS.md
}
