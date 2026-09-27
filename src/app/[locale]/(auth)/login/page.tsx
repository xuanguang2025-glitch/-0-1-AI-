import type { Metadata } from 'next'
import Link from 'next/link'

import { LoginForm } from '@/features/auth/components/login-form'

export const metadata: Metadata = { title: '登录' }

export default function LoginPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-2xl font-bold">欢迎回来</h1>
      <p className="mt-1 text-sm text-muted-foreground">登录继续你的学习计划</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        还没有账号？{' '}
        <Link href={ROUTES.register} className="text-primary hover:underline">
          免费注册
        </Link>
        {' · '}
        <Link href={ROUTES.forgotPassword} className="text-primary hover:underline">
          忘记密码
        </Link>
      </p>
    </div>
  )
}
