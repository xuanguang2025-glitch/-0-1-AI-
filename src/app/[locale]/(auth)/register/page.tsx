import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from '@/features/auth/components/register-form'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = { title: '注册' }

export default function RegisterPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-2xl font-bold">创建账号</h1>
      <p className="mt-1 text-sm text-muted-foreground">30 秒注册，立即开始 5 分钟水平测试</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        已有账号？{' '}
        <Link href={ROUTES.login} className="text-primary hover:underline">
          直接登录
        </Link>
      </p>
    </div>
  )
}
