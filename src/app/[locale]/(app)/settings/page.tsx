'use client'

/**
 * /settings — 账号资料：昵称 / 简介 / 目标分数。
 */
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonList } from '@/components/common/skeleton-kit'
import { ApiClientError } from '@/features/auth/api'
import { userApi } from '@/features/user/api'
import type { UserProfileDto } from '@/types/dto/user.dto'

export default function AccountSettingsPage(): React.JSX.Element {
  const [profile, setProfile] = useState<UserProfileDto | null>(null)
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [targetScore, setTargetScore] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    userApi
      .getProfile()
      .then((p) => {
        if (cancelled) return
        setProfile(p)
        setNickname(p.nickname)
        setBio(p.bio ?? '')
        setTargetScore('')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiClientError ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await userApi.updateProfile({
        nickname: nickname.trim() || undefined,
        bio: bio.trim() || undefined,
        targetScore: targetScore ? Number(targetScore) : undefined,
      })
      setProfile(updated)
      setMessage('已保存')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">账号资料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <SkeletonList rows={3} /> : null}

        {!loading && profile ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="nickname">昵称</Label>
              <Input id="nickname" value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">个人简介</Label>
              <Input id="bio" value={bio} maxLength={200} placeholder="介绍一下自己（选填）" onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">目标分数（0-710，选填）</Label>
              <Input
                id="target"
                type="number"
                min={0}
                max={710}
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
              />
            </div>

            {message ? <p className="text-sm text-success">{message}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
