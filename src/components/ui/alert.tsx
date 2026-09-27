/**
 * Alert（提示条）。
 */
import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const alertVariants = cva('rounded-xl border p-4 text-sm [&>svg]:size-4 [&>svg]:shrink-0', {
  variants: {
    variant: {
      info: 'border-border bg-surface text-foreground',
      success: 'border-success/30 bg-success/10 text-success',
      warning: 'border-warning/30 bg-warning/10 text-warning',
      destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
    },
  },
  defaultVariants: { variant: 'info' },
})

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string
  icon?: React.ReactNode
}

export function Alert({ className, variant, title, icon, children, ...props }: AlertProps): React.JSX.Element {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <div className="flex items-start gap-2">
        {icon}
        <div>
          {title ? <div className="font-medium leading-none">{title}</div> : null}
          <div className={cn(title && 'mt-1', 'text-sm opacity-90')}>{children}</div>
        </div>
      </div>
    </div>
  )
}
