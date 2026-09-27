import type { Metadata } from 'next'
import Link from 'next/link'

import { ForgotForm } from '@/features/auth/components/forgot-form'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = { title: '找回密码' }

export default function ForgotPasswordPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-2xl font-bold">找回密码</h1>
      <p className="mt-1 text-sm text-muted-foreground">输入注册邮箱，我们会生成重置方式</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        想起来了？{' '}
        <Link href={ROUTES.login} className="text-primary hover:underline">
          返回登录
        </Link>
      </p>
    </div>
  )
}
