'use client'

/**
 * /settings/security — 账号安全：改密引导（走忘记密码流程）+ 登录态说明。
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/lib/constants/routes'
import { authApi } from '@/features/auth/api'
import type { AuthUserDto } from '@/types/dto/auth.dto'

export default function SecuritySettingsPage(): React.JSX.Element {
  const [user, setUser] = useState<AuthUserDto | null>(null)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">登录信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {user ? (
            <>
              <p>
                邮箱：<strong>{user.email}</strong>{' '}
                <Badge variant={user.emailVerified ? 'success' : 'warning'}>
                  {user.emailVerified ? '已验证' : '未验证'}
                </Badge>
              </p>
              <p className="text-muted-foreground">注册时间：{new Date(user.createdAt).toLocaleDateString('zh-CN')}</p>
            </>
          ) : (
            <p className="text-muted-foreground">加载中…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">修改密码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            为保障安全，修改密码通过邮箱验证码完成：点击下方按钮，输入注册邮箱获取重置链接。
          </p>
          <Link href={ROUTES.forgotPassword}>
            <Button variant="outline">发送密码重置邮件</Button>
          </Link>
          <p className="text-xs text-muted-foreground">重置成功后，所有已登录设备将被强制下线。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">会话管理</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>当前使用 httpOnly Cookie + 双 Token 会话（Access 15 分钟自动续期）。</p>
          <p className="mt-1">会话列表与远程下线将在后续版本提供。</p>
        </CardContent>
      </Card>
    </div>
  )
}
