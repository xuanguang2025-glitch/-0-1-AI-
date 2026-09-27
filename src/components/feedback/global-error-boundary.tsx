'use client'

/**
 * GlobalErrorBoundary：根级兜底错误边界（比 app/error.tsx 更内层，可捕获组件树任意错误）。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class GlobalErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {

    console.error('[GlobalErrorBoundary]', error.message, info.componentStack)
  }

  private readonly reload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-6">
          <ErrorState
            title="页面出错了"
            message="发生了意外错误，刷新页面通常可以解决。"
            action={
              <Button onClick={this.reload}>刷新页面</Button>
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}
