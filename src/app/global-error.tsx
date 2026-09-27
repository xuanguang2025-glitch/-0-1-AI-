'use client'

/**
 * 全局错误边界（架构 §7.4 / §6.4）。
 * 仅当 root layout 本身抛出异常时兜底；必须自带 <html>/<body>。
 * 此处不依赖任何自定义 CSS 变量，使用内联样式保证极端情况下仍可渲染。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.JSX.Element {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0f1116',
          color: '#f3f4f6',
        }}
      >
        <div style={{ maxWidth: 480, padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#f87171', fontWeight: 600, margin: 0 }}>EnglishAI · 致命错误</p>
          <h1 style={{ fontSize: 24, margin: '12px 0 0' }}>应用启动失败</h1>
          <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 12 }}>
            请刷新页面重试；若问题持续，请联系管理员。
          </p>
          {error.digest ? (
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>
              traceId: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  )
}
