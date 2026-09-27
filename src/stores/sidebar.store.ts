'use client'

/**
 * sidebar.store：桌面折叠状态 + 移动抽屉开关（zustand + localStorage 持久化）。
 */
import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  setMobileOpen: (open: boolean) => void
}

const STORAGE_KEY = 'englishai.sidebar.collapsed'

const readInitial = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: false, // SSR 首帧展开，客户端水合后读 localStorage
  mobileOpen: false,
  toggleCollapsed: () => {
    const next = !get().collapsed
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* localStorage 不可用时静默 */
    }
    set({ collapsed: next })
  },
  setMobileOpen: (open) => set({ mobileOpen: open }),
}))

/** 客户端水合后同步持久化状态（在 app-shell 中调用一次） */
export function hydrateSidebar(): void {
  if (readInitial()) useSidebarStore.setState({ collapsed: true })
}
