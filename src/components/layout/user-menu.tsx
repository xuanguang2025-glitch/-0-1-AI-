'use client'

/**
 * UserMenu：右上角用户菜单（未登录 → 登录按钮；登录 → 头像下拉）。
 * 用户态 Phase 1 由 use-auth-store 客户端缓存（T06 接 /api/auth/me 实拉）。
 */
import { LogOut, Settings, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authApi, ApiClientError } from '@/features/auth/api'
import { ROUTES } from '@/lib/constants/routes'
import { useQueryClient } from '@tanstack/react-query'

interface SessionUser {
  id: string
  nickname: string
  email: string
  avatarUrl?: string | null
}

export function UserMenu({ user }: { user?: SessionUser | null }): React.JSX.Element {

  const router = useRouter()
  const queryClient = useQueryClient()

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout()
    } catch (e) {
      if (!(e instanceof ApiClientError)) throw e
      // 幂等：401/400 均视为已登出
    }
    queryClient.clear()
    router.push(ROUTES.home)
    router.refresh()
  }

  if (!user) {
    return (
      <Link href={ROUTES.login} className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted">
        登录
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar src={user.avatarUrl} fallback={user.nickname} alt={user.nickname} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="px-3 py-2">
          <div className="text-sm font-medium">{user.nickname}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(ROUTES.profile)}>
          <User className="mr-2 h-4 w-4" /> 个人中心
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(ROUTES.settings)}>
          <Settings className="mr-2 h-4 w-4" /> 设置
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void logout()}>
          <LogOut className="mr-2 h-4 w-4" /> 退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
