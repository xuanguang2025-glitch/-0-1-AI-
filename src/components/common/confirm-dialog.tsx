'use client'

/**
 * ConfirmDialog：全局确认弹窗（由 ui.store.confirmDialog() 驱动）。
 */
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useUiStore } from '@/stores/ui.store'

export function ConfirmDialog(): React.JSX.Element {
  const confirm = useUiStore((s) => s.confirm)
  const resolveConfirm = useUiStore((s) => s.resolveConfirm)

  return (
    <Dialog open={confirm.open} onOpenChange={(open) => !open && resolveConfirm(false)} title={confirm.title || undefined}>
      <div className="mt-2 flex items-start gap-3">
        {confirm.destructive ? (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{confirm.description}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => resolveConfirm(false)}>
          {confirm.cancelText}
        </Button>
        <Button variant={confirm.destructive ? 'destructive' : 'default'} onClick={() => resolveConfirm(true)}>
          {confirm.confirmText}
        </Button>
      </div>
    </Dialog>
  )
}
