'use client'

/**
 * LoginForm：登录表单（字段级校验 + 服务端错误码→中文提示）。
 */
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { loginSchema, type LoginInput } from '../schemas'
import { ApiClientError, authApi } from '../api'
import { SocialLogin } from './social-login'

/** 服务端错误码 → 表单提示 */
const CODE_MESSAGE: Record<string, string> = {
  AUTH_BAD_CREDENTIALS: '邮箱或密码错误',
  AUTH_ACCOUNT_LOCKED: '失败次数过多，账号已临时锁定，请 15 分钟后再试',
  AUTH_ACCOUNT_DISABLED: '账号已被禁用，请联系管理员',
  SYS_RATE_LIMIT: '操作过于频繁，请稍后再试',
}

export function LoginForm(): React.JSX.Element {
  const router = useRouter()
  const [values, setValues] = useState<LoginInput>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginInput, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof LoginInput, v: string): void => {
    setValues((prev) => ({ ...prev, [k]: v }))
    setFieldErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setFormError(null)

    // 字段级校验
    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
      const errors: Partial<Record<keyof LoginInput, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LoginInput | undefined
        if (key && !errors[key]) errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await authApi.login(parsed.data)
      // 登录成功 → 跳 onboarding（服务端已完成 onboarding 则由 onboarding 页自检后跳 dashboard）
      router.push('/onboarding')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(CODE_MESSAGE[err.code] ?? err.message)
      } else {
        setFormError('网络异常，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login-email">邮箱</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">密码</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="你的密码"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
      </div>

      {formError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '登录中…' : '登录'}
      </Button>

      <SocialLogin />
    </form>
  )
}
