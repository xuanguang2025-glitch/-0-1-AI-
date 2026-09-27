'use client'

/**
 * RetryBoundary：段级错误边界（错误态 + 重试按钮；架构 §7.4）。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ErrorState } from '@/components/common/error-state'

interface Props {
  children: ReactNode
  /** 自定义错误展示 */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class RetryBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {

    console.error('[RetryBoundary]', error.message, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset)
      return <ErrorState title="加载失败" message={error.message} onRetry={this.reset} />
    }
    return this.props.children
  }
}
