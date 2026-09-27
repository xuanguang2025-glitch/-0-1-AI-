'use client'

/**
 * MobileNavDrawer：移动端抽屉导航（复用 Sheet + SidebarNav）。
 */
import { Sheet } from '@/components/ui/sheet'
import { SidebarNav } from './sidebar-nav'

export function MobileNavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="left">
      <div className="mb-4 px-2 text-lg font-semibold">EnglishAI</div>
      <SidebarNav />
    </Sheet>
  )
}
