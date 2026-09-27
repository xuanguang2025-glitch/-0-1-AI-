'use client'

/**
 * PasswordStrength：密码强度条（弱/中/强，纯前端即时反馈）。
 */
import { useMemo } from 'react'

import { cn } from '@/lib/utils/cn'

export type Strength = 'weak' | 'medium' | 'strong'

export function scorePassword(plain: string): Strength {
  if (plain.length < 8) return 'weak'
  let score = 0
  if (/[a-z]/.test(plain)) score += 1
  if (/[A-Z]/.test(plain)) score += 1
  if (/\d/.test(plain)) score += 1
  if (/[^a-zA-Z0-9]/.test(plain)) score += 1
  if (plain.length >= 12) score += 1
  if (score <= 2) return 'weak'
  if (score <= 3) return 'medium'
  return 'strong'
}

const LABEL: Record<Strength, string> = { weak: '弱', medium: '中', strong: '强' }
const COLOR: Record<Strength, string> = {
  weak: 'bg-destructive',
  medium: 'bg-warning',
  strong: 'bg-success',
}

export function PasswordStrength({ password, className }: { password: string; className?: string }): React.JSX.Element | null {
  const strength = useMemo(() => scorePassword(password), [password])
  if (!password) return null
  const level = strength === 'weak' ? 1 : strength === 'medium' ? 2 : 3

  return (
    <div className={cn('space-y-1.5', className)} aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= level ? COLOR[strength] : 'bg-surface-muted')}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">密码强度：{LABEL[strength]}</span>
    </div>
  )
}
