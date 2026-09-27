'use client'

/**
 * use-debounce：值防抖与函数防抖。
 */
import { useEffect, useRef, useState } from 'react'

/** 值防抖：delay 内的连续变更只在停止后生效 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** 函数防抖：返回稳定引用（内部持 ref） */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs = 300): (...args: A) => void {
  const fnRef = useRef(fn)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  fnRef.current = fn

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (...args: A) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fnRef.current(...args), delayMs)
  }
}
