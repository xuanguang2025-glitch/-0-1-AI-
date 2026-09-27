'use client'

/**
 * RegisterForm：注册表单（强度条 + 字段级校验 + 错误码映射）。
 */
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { registerSchema, type RegisterInput } from '../schemas'
import { ApiClientError, authApi } from '../api'
import { PasswordStrength } from './password-strength'
import { SocialLogin } from './social-login'

const CODE_MESSAGE: Record<string, string> = {
  AUTH_EMAIL_TAKEN: '该邮箱已注册，可直接登录或找回密码',
  AUTH_WEAK_PASSWORD: '密码强度不足：至少 8 位，需包含字母和数字',
  SYS_RATE_LIMIT: '注册过于频繁，请稍后再试',
}

export function RegisterForm(): React.JSX.Element {
  const router = useRouter()
  const [values, setValues] = useState<RegisterInput>({ email: '', password: '', nickname: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof RegisterInput, v: string): void => {
    setValues((prev) => ({ ...prev, [k]: v }))
    setFieldErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setFormError(null)
    const parsed = registerSchema.safeParse(values)
    if (!parsed.success) {
      const errors: Partial<Record<keyof RegisterInput, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RegisterInput | undefined
        if (key && !errors[key]) errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await authApi.register(parsed.data) // 注册即建立会话（httpOnly Cookie）
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
        <Label htmlFor="reg-nickname">昵称</Label>
        <Input
          id="reg-nickname"
          autoComplete="nickname"
          placeholder="怎么称呼你？"
          value={values.nickname}
          onChange={(e) => set('nickname', e.target.value)}
          aria-invalid={!!fieldErrors.nickname}
        />
        {fieldErrors.nickname ? <p className="text-xs text-destructive">{fieldErrors.nickname}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-email">邮箱</Label>
        <Input
          id="reg-email"
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
        <Label htmlFor="reg-password">密码</Label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          placeholder="至少 8 位，包含字母和数字"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
      </div>

      <PasswordStrength password={values.password} />

      {formError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '注册中…' : '注册并开始'}
      </Button>

      <SocialLogin />
    </form>
  )
}
