'use client'

/**
 * use-hotkey：全局快捷键（如 Ctrl+K 打开搜索、Esc 关闭弹层）。
 */
import { useEffect, useRef } from 'react'

export interface HotkeyOptions {
  /** 是否忽略输入框内按键 */
  ignoreInputs?: boolean
  enabled?: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/**
 * @param combo 组合键，如 'mod+k'、'esc'、'shift+?'；mod = Meta(mac)/Ctrl(win)
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, options: HotkeyOptions = {}): void {
  const { ignoreInputs = true, enabled = true } = options
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const comboKeyParts = combo.toLowerCase().split('+')
  const comboKey = comboKeyParts[comboKeyParts.length - 1] ?? ''

  useEffect(() => {
    if (!enabled) return
    const parts = comboKeyParts
    const needMod = parts.includes('mod')
    const needShift = parts.includes('shift')
    const needAlt = parts.includes('alt')

    const onKey = (e: KeyboardEvent) => {
      if (ignoreInputs && isTypingTarget(e.target)) return
      const modOk = needMod ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey
      const shiftOk = needShift ? e.shiftKey : true
      const altOk = needAlt ? e.altKey : true
      const eKey = e.key.toLowerCase() === 'esc' ? 'esc' : e.key.toLowerCase()
      if (modOk && shiftOk && altOk && eKey === comboKey) {
        handlerRef.current(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [comboKeyParts, comboKey, ignoreInputs, enabled])
}
