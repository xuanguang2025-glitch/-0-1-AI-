'use client'

/**
 * use-ai-stream：AI 流式消费 hook（fetch + ReadableStream，POST + cookie 鉴权）。
 * 处理 delta / done / degraded / error 事件帧；abort 支持停止生成。
 */
import { useCallback, useRef, useState } from 'react'

import { consumeSse } from '@/lib/http/sse'

export interface AiStreamState {
  text: string
  streaming: boolean
  degraded: boolean
  degradedReason: string | null
  error: string | null
  meta: Record<string, unknown> | null
}

export function useAiStream(endpoint: string, body: unknown) {
  const [state, setState] = useState<AiStreamState>({
    text: '',
    streaming: false,
    degraded: false,
    degradedReason: null,
    error: null,
    meta: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (): Promise<void> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ text: '', streaming: true, degraded: false, degradedReason: null, error: null, meta: null })

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
        setState((s) => ({
          ...s,
          streaming: false,
          error: errBody?.error?.message ?? `请求失败（${response.status}）`,
        }))
        return
      }
      await consumeSse(response, (event, data) => {
        const d = data as Record<string, unknown>
        if (event === 'meta') {
          setState((s) => ({ ...s, meta: d }))
        } else if (event === 'delta') {
          setState((s) => ({ ...s, text: s.text + String(d.text ?? '') }))
        } else if (event === 'degraded') {
          setState((s) => ({
            ...s,
            degraded: true,
            degradedReason: String(d.reason ?? ''),
            text: s.text || String(d.fallback ?? 'AI 暂时不可用，请稍后再试。'),
          }))
        } else if (event === 'done') {
          setState((s) => ({ ...s, streaming: false }))
        } else if (event === 'error') {
          setState((s) => ({ ...s, streaming: false, error: '服务器内部错误' }))
        }
      })
      setState((s) => ({ ...s, streaming: false }))
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setState((s) => ({ ...s, streaming: false }))
        return
      }
      setState((s) => ({ ...s, streaming: false, error: e instanceof Error ? e.message : '网络错误' }))
    }
  }, [endpoint, body])

  const stop = useCallback((): void => {
    abortRef.current?.abort()
    setState((s) => ({ ...s, streaming: false }))
  }, [])

  return { ...state, start, stop }
}
