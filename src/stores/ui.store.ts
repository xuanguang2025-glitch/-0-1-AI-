'use client'

/**
 * ui.store：全局 UI 状态（确认弹窗、Toasts、命令面板开关）。
 */
import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ConfirmState {
  open: boolean
  title: string
  description: string
  confirmText: string
  cancelText: string
  destructive: boolean
  resolve: ((ok: boolean) => void) | null
}

interface UiState {
  toasts: ToastItem[]
  commandOpen: boolean
  confirm: ConfirmState
  toast: (t: { title: string; description?: string; variant?: ToastVariant }) => void
  dismissToast: (id: string) => void
  setCommandOpen: (open: boolean) => void
  /** 命令式确认框：await confirmDialog({...}) → boolean */
  confirmDialog: (opts: Partial<Omit<ConfirmState, 'open' | 'resolve'>>) => Promise<boolean>
  resolveConfirm: (ok: boolean) => void
}

const DEFAULT_CONFIRM: ConfirmState = {
  open: false,
  title: '',
  description: '',
  confirmText: '确定',
  cancelText: '取消',
  destructive: false,
  resolve: null,
}

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  commandOpen: false,
  confirm: DEFAULT_CONFIRM,

  toast: ({ title, description, variant = 'info' }) => {
    const id = Math.random().toString(36).slice(2, 10)
    set((s) => ({ toasts: [...s.toasts, { id, title, description, variant }] }))
    setTimeout(() => get().dismissToast(id), 4000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  confirmDialog: (opts) =>
    new Promise<boolean>((resolve) => {
      set({
        confirm: {
          ...DEFAULT_CONFIRM,
          ...opts,
          open: true,
          resolve,
        },
      })
    }),
  resolveConfirm: (ok) => {
    const { confirm } = get()
    confirm.resolve?.(ok)
    set({ confirm: DEFAULT_CONFIRM })
  },
}))
