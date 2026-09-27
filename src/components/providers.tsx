'use client'

/**
 * Providers：客户端 Provider 汇总（Theme + QueryClient + ErrorBoundary + Toast/Confirm）。
 * 架构 §7.2：root layout 内包裹全部 children。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState, type ReactNode } from 'react'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Toaster } from '@/components/ui/toast'
import { GlobalErrorBoundary } from '@/components/feedback/global-error-boundary'

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  // 每个 browser session 一个 QueryClient（SSR 安全）
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <GlobalErrorBoundary>
          {children}
          <ConfirmDialog />
          <Toaster />
        </GlobalErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
