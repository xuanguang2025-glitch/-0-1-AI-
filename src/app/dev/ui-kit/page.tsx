'use client'

/**
 * /dev/ui-kit — 状态组件预览页（临时开发页，验收标准 #4）。
 * 预览：EmptyState / ErrorState / SkeletonKit / ChipFilter / Toast / Dialog / Switch / Charts。
 */
import { useState } from 'react'

import { ChipFilter } from '@/components/common/chip-filter'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard, SkeletonDetail, SkeletonList, SkeletonStats } from '@/components/common/skeleton-kit'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Progress } from '@/components/ui/separator'
import { ProgressRing } from '@/components/charts/progress-ring'
import { LineChartLazy, RadarChartLazy } from '@/components/charts'
import { useUiStore } from '@/stores/ui.store'

type Difficulty = 'ALL' | 'EASY' | 'MEDIUM' | 'HARD'

export default function UiKitPage(): React.JSX.Element {
  const toast = useUiStore((s) => s.toast)
  const confirmDialog = useUiStore((s) => s.confirmDialog)
  const [difficulty, setDifficulty] = useState<Difficulty>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(true)

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">UI Kit · 状态组件预览</h1>
        <p className="mt-1 text-sm text-muted-foreground">临时开发页 —— 覆盖全部状态组件 variant</p>
      </header>

      {/* Empty / Error */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">EmptyState</h2>
          <EmptyState
            emoji="🎉"
            title="今日学习任务已完成！"
            description="复习队列已清空，明天再来。"
            action={<Button size="sm">去做练习</Button>}
          />
        </div>
        <div className="rounded-2xl border border-border p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">ErrorState</h2>
          <ErrorState title="加载失败" message="网络连接中断" onRetry={() => toast({ title: '重试中…', variant: 'info' })} />
        </div>
      </section>

      {/* Skeletons */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">SkeletonKit</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonStats cards={2} />
          <SkeletonList rows={2} />
          <SkeletonCard />
          <SkeletonDetail />
        </div>
      </section>

      {/* Chips / Switch / Progress / Badge / Alert */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">交互控件</h2>
        <ChipFilter
          options={[
            { value: 'ALL', label: '全部' },
            { value: 'EASY', label: '简单' },
            { value: 'MEDIUM', label: '中等' },
            { value: 'HARD', label: '困难' },
          ]}
          value={difficulty}
          onChange={setDifficulty}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} aria-label="演示开关" />
          <Progress value={66} tone="success" className="w-48" />
          <ProgressRing value={72} size={72} />
          <Badge variant="success">已掌握</Badge>
          <Badge variant="warning">复习中</Badge>
          <Badge variant="secondary">n. 名词</Badge>
        </div>
        <Alert variant="warning" title="AI 降级模式">
          AI 服务暂时不可用，当前展示离线兜底内容。
        </Alert>
      </section>

      {/* Toast / Dialog / Confirm */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Toast / Dialog / Confirm</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast({ title: '已保存', variant: 'success' })}>
            Success Toast
          </Button>
          <Button variant="outline" onClick={() => toast({ title: '注意', description: '还有 3 个新词待复习', variant: 'warning' })}>
            Warning Toast
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Dialog
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const ok = await confirmDialog({
                title: '重置学习进度',
                description: '此操作将清空你的学习记录，不可恢复。',
                destructive: true,
                confirmText: '确认重置',
              })
              toast({ title: ok ? '已重置' : '已取消', variant: ok ? 'success' : 'info' })
            }}
          >
            ConfirmDialog（命令式）
          </Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="示例弹窗" description="Esc 或点击遮罩关闭">
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              关闭
            </Button>
          </div>
        </Dialog>
      </section>

      {/* Charts（dynamic ssr:false） */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Charts（ssr:false 懒加载）</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <LineChartLazy
            data={[
              { label: '周一', value: 20 },
              { label: '周二', value: 45 },
              { label: '周三', value: 32 },
              { label: '周四', value: 60 },
              { label: '周五', value: 50 },
              { label: '周六', value: 75 },
              { label: '周日', value: 68 },
            ]}
          />
          <RadarChartLazy
            data={[
              { dimension: '词汇', score: 72 },
              { dimension: '听力', score: 55 },
              { dimension: '口语', score: 40 },
              { dimension: '阅读', score: 66 },
              { dimension: '写作', score: 48 },
              { dimension: '语法', score: 60 },
            ]}
          />
        </div>
      </section>
    </div>
  )
}
