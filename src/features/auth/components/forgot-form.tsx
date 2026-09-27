'use client'

/**
 * ForgotForm：找回密码（Phase 1 dev 环境展示重置链接提示）。
 */
import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas'
import { ApiClientError, authApi } from '../api'

export function ForgotForm(): React.JSX.Element {
  const [values, setValues] = useState<ForgotPasswordInput>({ email: '' })
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [devHint, setDevHint] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setFormError(null)
    setDevHint(null)
    const parsed = forgotPasswordSchema.safeParse(values)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? '请输入邮箱')
      return
    }
    setLoading(true)
    try {
      const result = await authApi.forgotPassword(parsed.data)
      setSent(true)
      setDevHint(result.devHint)
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : '网络异常，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert variant="success" title="已提交">
          若该邮箱已注册，重置方式已生成。请留意邮箱（或按下方提示操作）。
        </Alert>
        {devHint ? (
          <Alert variant="warning" title="开发环境提示">
            Phase 1 不发真实邮件，重置链接如下：
            <code className="mt-1 block break-all rounded bg-surface-muted p-2 font-mono text-xs">{devHint}</code>
          </Alert>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">注册邮箱</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => {
            setValues({ email: e.target.value })
            setFieldError(null)
          }}
          aria-invalid={!!fieldError}
        />
        {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
      </div>

      {formError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '提交中…' : '发送重置方式'}
      </Button>
    </form>
  )
}
