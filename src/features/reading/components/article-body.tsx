'use client'

/**
 * ArticleBody：文章正文（分段渲染 + 划词 + 段落高亮定位，T15 验收 2/4）。
 *
 * - 划词：`mouseup` 时读 `window.getSelection()`，非空且为单个英文词则弹出释义浮层
 *   （词典直查，不调 AI）；
 * - 段落高亮：`highlightBlock` ≥ 0 时滚动到该段并加高亮类（点击题目 location 跳转）；
 * - 断点续读：容器滚动回调由页面节流后上报，组件本身不直接请求。
 */
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils/cn'
import type { ReadingBlock } from '../types'

export interface ArticleBodyProps {
  blocks: ReadingBlock[]
  /** 高亮定位的段落下标（-1 = 无） */
  highlightBlock?: number
  /** 划词回调（选中文本） */
  onSelectWord?: (word: string, blockIndex: number) => void
  /** 滚动进度回调（0-100 + 当前段落下标），由页面节流上报 */
  onScrollProgress?: (progress: number, blockIndex: number) => void
  className?: string
}

/** 只接受「单个英文单词（含连字符/所有格）」的划选，避免整句划词触发查词 */
function normalizeSelection(raw: string): string {
  const t = raw.trim()
  if (t.length === 0 || t.length > 40) return ''
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(t)) return ''
  return t
}

export function ArticleBody({
  blocks,
  highlightBlock = -1,
  onSelectWord,
  onScrollProgress,
  className,
}: ArticleBodyProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const blockRefs = useRef<Array<HTMLParagraphElement | null>>([])

  // 段落高亮定位：滚动进视口 + 短暂高亮
  useEffect(() => {
    if (highlightBlock < 0) return
    const el = blockRefs.current[highlightBlock]
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightBlock])

  // 滚动进度（被动监听，页面侧防抖）
  useEffect(() => {
    const el = containerRef.current
    if (!el || !onScrollProgress) return undefined
    const onScroll = (): void => {
      const max = el.scrollHeight - el.clientHeight
      const ratio = max <= 0 ? 100 : (el.scrollTop / max) * 100
      // 当前视口顶部所在的段落
      const top = el.getBoundingClientRect().top
      let idx = 0
      for (let i = 0; i < blockRefs.current.length; i += 1) {
        const b = blockRefs.current[i]
        if (b && b.getBoundingClientRect().top - top <= el.clientHeight * 0.35) idx = i
      }
      onScrollProgress(Math.round(Math.max(0, Math.min(100, ratio))), idx)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [onScrollProgress])

  const handleMouseUp = (blockIndex: number): void => {
    if (!onSelectWord) return
    const sel = window.getSelection()
    const word = normalizeSelection(sel?.toString() ?? '')
    if (word.length > 0) onSelectWord(word, blockIndex)
  }

  if (blocks.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>正文加载中或暂不可用</p>
  }

  return (
    <div
      ref={containerRef}
      className={cn('max-h-[70vh] space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-4', className)}
      data-testid="article-body"
    >
      {blocks.map((b) => {
        const active = b.index === highlightBlock
        return (
          <p
            key={b.index}
            ref={(el) => {
              blockRefs.current[b.index] = el
            }}
            onMouseUp={() => handleMouseUp(b.index)}
            data-testid={`article-block-${b.index}`}
            data-highlight={active ? 'true' : undefined}
            className={cn(
              'text-[15px] leading-7 transition-colors',
              active && 'rounded-lg bg-primary/10 px-2 py-1',
            )}
          >
            {b.en}
          </p>
        )
      })}
    </div>
  )
}
