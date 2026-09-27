/**
 * Spinner（加载圈）。
 */
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} aria-label="loading" />
}
