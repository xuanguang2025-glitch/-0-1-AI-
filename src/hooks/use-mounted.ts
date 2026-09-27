'use client'

/**
 * use-mounted：SSR 水合后为 true（避免 hydration mismatch 的浏览器专属渲染）。
 */
import { useEffect, useState } from 'react'

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
