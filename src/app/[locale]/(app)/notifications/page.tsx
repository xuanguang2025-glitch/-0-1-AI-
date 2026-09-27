'use client'

/**
 * /notifications — 通知中心（Phase 1 占位：空态 + 规则说明；数据结构待 Notification 表落地）。
 */
import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/common/empty-state'

export default function NotificationsPage(): React.JSX.Element {
  return (
    <AppShell>
      <PageContainer narrow>
        <PageHeader title="通知中心" description="复习提醒、周报与系统消息" />
        <div className="mt-6">
          <EmptyState
            emoji="🔔"
            title="暂无通知"
            description="开启复习提醒后，到期单词与连胜提醒会出现在这里"
          />
        </div>
      </PageContainer>
    </AppShell>
  )
}
