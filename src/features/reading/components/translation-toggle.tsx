'use client'

/**
 * TranslationToggle：段落译文显隐（T15）。
 *
 * 受控组件：`show` 由页面持有（可全局切换），点击单段译文也可单独展开/收起，
 * 便于「先自己读英文，再看译文」的精读习惯。
 */
import { useState } from 'react'

import { cn } from '@/lib/utils/cn'
import type { ReadingBlock } from '../types'

export interface TranslationToggleProps {
  blocks: ReadingBlock[]
  /** 全局显示译文 */
  show: boolean
  onToggleShow?: (show: boolean) => void
  className?: string
}

export function TranslationToggle({ blocks, show, onToggleShow, className }: TranslationToggleProps): React.JSX.Element {
  // 单独收起过的段落（优先级高于全局开关）
  const [hidden, setHidden] = useState<Set<number>>(new Set())

  const toggleOne = (index: number): void => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (blocks.length === 0) return <></>

  return (
    <div className={cn('space-y-2', className)}>
      {onToggleShow ? (
        <button
          type="button"
          onClick={() => onToggleShow(!show)}
          className="text-xs text-primary underline-offset-4 hover:underline"
          data-testid="translation-toggle"
        >
          {show ? '隐藏全部译文' : '显示全部译文'}
        </button>
      ) : null}

      <div className="space-y-2" data-testid="translation-list">
        {blocks.map((b) => {
          const visible = show && !hidden.has(b.index)
          if (!visible) {
            return (
              <button
                key={b.index}
                type="button"
                onClick={() => toggleOne(b.index)}
                className="block w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-surface-muted"
                data-testid={`translation-show-${b.index}`}
              >
                第 {b.index + 1} 段 · 点击显示译文
              </button>
            )
          }
          return (
            <div key={b.index} className="rounded-lg bg-surface-muted px-3 py-2" data-testid={`translation-${b.index}`}>
              <p className="text-xs leading-6 text-muted-foreground">{b.zh}</p>
              <button
                type="button"
                onClick={() => toggleOne(b.index)}
                className="mt-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                收起
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
