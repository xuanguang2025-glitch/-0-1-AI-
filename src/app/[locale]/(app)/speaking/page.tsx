'use client'

/**
 * /speaking — 口语目录页（S1：11 角色 × 9 场景）。
 * 选角色 + 场景 → 创建会话 → 进入对话页。三态齐备。
 */
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { RolePicker, ScenePicker } from '@/features/speaking/components/pickers'
import { speakingApi } from '@/features/speaking/api'
import type { SpeakingCatalog } from '@/features/speaking/types'
import { ROUTES } from '@/lib/constants/routes'
import { useEffect } from 'react'

export default function SpeakingPage(): React.JSX.Element {
  const router = useRouter()
  const [catalog, setCatalog] = useState<SpeakingCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleKey, setRoleKey] = useState<string | null>(null)
  const [sceneKey, setSceneKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setCatalog(await speakingApi.catalog())
    } catch {
      setError('口语目录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onStart = useCallback(async () => {
    if (roleKey === null || sceneKey === null) return
    setCreating(true)
    try {
      const session = await speakingApi.createSession({ roleKey, sceneKey })
      router.push(`${ROUTES.speaking}/partner/${session.id}`)
    } catch {
      setCreating(false)
    }
  }, [roleKey, sceneKey, router])

  const ready = useMemo(() => roleKey !== null && sceneKey !== null, [roleKey, sceneKey])

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="口语练习" description="11 个角色 × 9 个场景 · 文本/语音皆可 · 结束后获得规则评分报告" />

        {loading ? (
          <SkeletonCard className="h-64" />
        ) : error !== null ? (
          <ErrorState title="口语目录加载失败" message={error} onRetry={() => void load()} />
        ) : (
          <>
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">1. 选择对话角色</h2>
              <RolePicker items={catalog?.roles ?? []} selected={roleKey} onSelect={setRoleKey} testPrefix="role-picker" />
            </section>

            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">2. 选择练习场景</h2>
              <ScenePicker scenes={catalog?.scenes ?? []} selected={sceneKey} onSelect={setSceneKey} />
            </section>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => void onStart()} disabled={!ready || creating} data-testid="start-session">
                {creating ? '创建中…' : '开始对话'}
              </Button>
              {!ready ? <span className="text-xs text-muted-foreground">请先选择角色与场景</span> : null}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
