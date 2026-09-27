/**
 * TagBadge：语义化标签徽章（词性/难度/来源等）。
 */
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

export type TagTone = 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'

const DIFFICULTY_TONE: Record<string, TagTone> = {
  EASY: 'success',
  MEDIUM: 'warning',
  HARD: 'destructive',
}

const POS_LABEL: Record<string, string> = {
  n: '名词',
  v: '动词',
  adj: '形容词',
  adv: '副词',
  prep: '介词',
  conj: '连词',
  pron: '代词',
  art: '冠词',
  num: '数词',
  int: '感叹词',
}

export function TagBadge({
  tag,
  tone,
  className,
  ...rest
}: Omit<BadgeProps, 'variant' | 'children'> & { tag: string; tone?: TagTone }): React.JSX.Element {
  const resolved = tone ?? DIFFICULTY_TONE[tag] ?? 'secondary'
  const label = POS_LABEL[tag] ?? tag.toLowerCase()
  return (
    <Badge variant={resolved === 'default' ? 'default' : resolved} className={cn('font-normal', className)} {...rest}>
      {label}
    </Badge>
  )
}
