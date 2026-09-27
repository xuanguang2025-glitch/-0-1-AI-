/**
 * UI 常量：布局尺寸、动效、层次。
 */

export const UI = {
  /** 侧边栏宽度（px） */
  sidebarWidth: 240,
  sidebarWidthCollapsed: 64,
  /** 顶栏高度（px） */
  topNavHeight: 56,
  /** 底部导航高度（px） */
  bottomNavHeight: 60,
  /** 内容最大宽度（px） */
  contentMaxWidth: 1200,
  /** 通用过渡（ms） */
  transitionMs: 200,
  /** Toast 默认停留（ms） */
  toastDuration: 4000,
} as const

/** 图标名 → lucide 组件映射在 sidebar-nav 内完成 */
export type NavIcon =
  | 'home'
  | 'book'
  | 'message'
  | 'clipboard'
  | 'user'
  | 'headphones'
  | 'mic'
  | 'bookOpen'
  | 'penLine'
  | 'spellCheck'
  | 'languages'
  | 'target'
  | 'trophy'
  | 'chart'
  | 'settings'
