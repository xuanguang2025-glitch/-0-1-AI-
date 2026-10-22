'use client'

/**
 * WritingEditor：作文编辑器（T17 验收 3/6）。
 *
 * 受控组件：内容/标题由页面持有；输入回调直通页面的防抖自动保存。
 * 字数实时显示由 WordCounter 负责，这里只管输入本身。
 */
import { cn } from '@/lib/utils/cn'

export interface WritingEditorProps {
  content: string
  title: string
  prompt: string
  disabled?: boolean
  onContentChange: (content: string) => void
  onTitleChange: (title: string) => void
  className?: string
}

export function WritingEditor({
  content,
  title,
  prompt,
  disabled = false,
  onContentChange,
  onTitleChange,
  className,
}: WritingEditorProps): React.JSX.Element {
  return (
    <div className={cn('space-y-3', className)} data-testid="writing-editor">
      <div>
        <label htmlFor="writing-title" className="mb-1 block text-xs font-medium text-muted-foreground">
          标题（可选）
        </label>
        <input
          id="writing-title"
          type="text"
          value={title}
          disabled={disabled}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="给你的作文起个标题"
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          data-testid="writing-title"
        />
      </div>

      <div className="rounded-lg bg-surface-muted px-3 py-2 text-xs leading-6 text-muted-foreground" data-testid="writing-prompt">
        <span className="font-medium text-foreground">题目要求：</span>
        {prompt}
      </div>

      <div>
        <label htmlFor="writing-content" className="mb-1 block text-xs font-medium text-muted-foreground">
          正文（英文）
        </label>
        <textarea
          id="writing-content"
          value={content}
          disabled={disabled}
          onChange={(e) => onContentChange(e.target.value)}
          rows={16}
          placeholder="开始写作。规则检查会随输入实时更新，无需手动保存。"
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-6"
          data-testid="writing-content"
        />
      </div>
    </div>
  )
}
