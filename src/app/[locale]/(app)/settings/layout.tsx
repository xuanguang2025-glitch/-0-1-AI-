/**
 * /settings 布局：标题 + 子导航 + 内容区。
 */
import { PageContainer } from '@/components/layout/page-container'
import { SettingsNav } from '@/features/settings/setting-nav'

export default function SettingsLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold tracking-tight">设置</h1>
      <div className="mt-4">
        <SettingsNav />
      </div>
      <div className="mt-6">{children}</div>
    </PageContainer>
  )
}
