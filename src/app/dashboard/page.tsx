/**
 * /dashboard — 登录后首页占位（T07 完成真实 Dashboard）。
 * 验收：≥1024 显示 Sidebar + TopNav；≤768 显示 BottomNav。
 */
import { PageHeader } from '@/components/layout/page-header'
import { AppShell } from '@/components/layout/app-shell'
import { StatCard } from '@/components/common/stat-card'
import { SkeletonList } from '@/components/common/skeleton-kit'

export const metadata = {
  title: '仪表盘',
}

export default function DashboardPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="px-4 py-6 lg:px-8">
        <PageHeader title="仪表盘" description="今天也要坚持学习哦 💪" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="连续天数" value={0} hint="今天学完任务 +1" />
          <StatCard label="今日待学" value={0} hint="选择词库后开始" />
          <StatCard label="掌握词汇" value={0} />
          <StatCard label="累计 XP" value={0} />
        </div>
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">今日任务</h2>
          <SkeletonList rows={3} />
          <p className="mt-3 text-xs text-muted-foreground">占位内容 —— 真实 Dashboard 在 T07 交付</p>
        </section>
      </div>
    </AppShell>
  )
}
