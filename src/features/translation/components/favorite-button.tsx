'use client'

/**
 * FavoriteButton：一键收藏（T18 验收 3）。
 * 收藏成功后展示「生词已入本 N 个」反馈。
 */
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export interface FavoriteButtonProps {
  favorited?: boolean
  saving?: boolean
  disabled?: boolean
  /** 收藏时入生词本的词数（成功反馈用） */
  addedWordsCount?: number | null
  onClick: () => void
  className?: string
}

export function FavoriteButton({
  favorited = false,
  saving = false,
  disabled = false,
  addedWordsCount = null,
  onClick,
  className,
}: FavoriteButtonProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        type="button"
        variant={favorited ? 'secondary' : 'outline'}
        onClick={onClick}
        disabled={saving || disabled || favorited}
        data-testid="favorite-button"
      >
        {favorited ? '已收藏' : saving ? '收藏中…' : '收藏本句 + 生词入本'}
      </Button>
      {addedWordsCount !== null && addedWordsCount > 0 ? (
        <span className="text-xs text-success" data-testid="favorite-feedback">
          已加入生词本 {addedWordsCount} 个
        </span>
      ) : null}
    </div>
  )
}
