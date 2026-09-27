/**
 * SSE 工具（架构 §3.4）：ReadableStream → text/event-stream，事件帧格式：
 *   event: <name>\ndata: <json>\n\n
 */
export interface SseEvent {
  event: string
  data: unknown
}

/** 创建 SSE Response（Route Handler 返回值） */
export function sseResponse(source: AsyncIterable<SseEvent>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of source) {
          const frame = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
          controller.enqueue(encoder.encode(frame))
        }
      } catch {
        // 上游异常：以 error 事件优雅收尾
        controller.enqueue(encoder.encode(`event: error\ndata: {"code":"SYS_INTERNAL"}\n\n`))
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
    cancel() {
      // 客户端断开：迭代器的 finally 分支负责释放
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

/** 前端 SSE 消费：fetch + ReadableStream 解析（支持 POST + cookie 鉴权，不用 EventSource） */
export async function consumeSse(
  response: Response,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      let eventName = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data === '[DONE]') return
      if (data) {
        try {
          onEvent(eventName, JSON.parse(data))
        } catch {
          onEvent(eventName, data)
        }
      }
    }
  }
}
