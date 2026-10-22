/**
 * 口语模块前端 API 客户端（T19，S1-S7；S3 走 SSE 帧解析）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type { SpeakingCatalog, SpeakingMessageItem, SpeakingSessionCreated, SpeakingSessionListResult, SpeakingSessionReport, RuleStats } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new ApiClientError('SYS_INTERNAL', '响应解析失败', response.status)
  if (body.success && body.data !== null) return body.data
  const err = body.error
  throw new ApiClientError(err?.code ?? 'SYS_INTERNAL', err?.message ?? '请求失败', response.status, err?.details)
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  const s = search.toString()
  return s === '' ? '' : `?${s}`
}

export const speakingApi = {
  /** S1 目录 */
  catalog: () => request<SpeakingCatalog>('/api/speaking/catalog'),

  /** S2 创建会话 */
  createSession: (body: { roleKey: string; sceneKey: string; mode?: string }) =>
    request<SpeakingSessionCreated>('/api/speaking/session', { method: 'POST', body: JSON.stringify(body) }),

  /**
   * S3 发消息（SSE）：onDelta 逐帧回调；resolve 于 done/degraded。
   */
  sendMessage: async (
    sessionId: string,
    body: { text: string; wasTextInput?: boolean; durationMs?: number; sttConfidence?: number; sttProvider?: 'web_speech' | 'cloud_asr' | 'manual' },
    onDelta?: (text: string) => void,
  ): Promise<{ text: string; degraded: boolean }> => {
    const response = await fetch(`/api/speaking/session/${sessionId}/messages`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok || response.body === null) {
      throw new ApiClientError('SYS_INTERNAL', `发送失败（${response.status}）`, response.status)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    let degraded = false
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const line = frame.trim()
        if (!line.startsWith('data:')) continue
        try {
          const payload = JSON.parse(line.slice(5)) as { kind: string; text?: string; reason?: string }
          if (payload.kind === 'delta' && typeof payload.text === 'string') {
            text += payload.text
            onDelta?.(payload.text)
          } else if (payload.kind === 'degraded') {
            degraded = true
          }
        } catch {
          // 忽略不完整帧
        }
      }
    }
    return { text, degraded }
  },

  /** GET 消息列表 */
  messages: (sessionId: string) => request<SpeakingMessageItem[]>(`/api/speaking/session/${sessionId}/messages`),

  /** S4 结束 */
  endSession: (sessionId: string, body: { durationSec?: number; pauseCount?: number } = {}) =>
    request<{ id: string; status: string; scoreSource: string; ruleStats: RuleStats }>(`/api/speaking/session/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** S5 报告 */
  report: (sessionId: string) => request<SpeakingSessionReport>(`/api/speaking/report/${sessionId}`),

  /** S6 纯规则评分（无 AI） */
  ruleScore: (body: { transcript: string; durationSec: number; targetWords?: string[] }) =>
    request<RuleStats & { source: string }>('/api/speaking/rule-score', { method: 'POST', body: JSON.stringify(body) }),

  /** S7 历史 */
  sessions: (params: { page?: number; sceneKey?: string } = {}) =>
    request<SpeakingSessionListResult>(`/api/speaking/sessions${qs(params)}`),
}
