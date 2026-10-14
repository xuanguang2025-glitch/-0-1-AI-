'use client'

/**
 * /listening/report/[recordId] — 训练报告页（L5 + L6，T14）。
 *
 * 展示 L5 报告（正确率 / 逐题 / 听写四态 / 生词 / 规则统计），并可触发 L6 AI 分析；
 * AI 不可用时组件自带规则兜底并标注来源，绝不给用户一句「AI 不可用」就结束。
 */
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { TrainerReport } from '@/features/listening/components/trainer-report'
import { useListeningReport } from '@/features/listening/hooks'
import { ROUTES } from '@/lib/constants/routes'

export default function ListeningReportPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const recordId = params.id
  const { data, loading, error, reload } = useListeningReport(recordId)

  return (
    <AppShell>
      <PageContainer>
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard className="h-24" />
            <SkeletonCard className="h-48" />
          </div>
        ) : error ? (
          <ErrorState title="报告加载失败" message={error} onRetry={reload} />
        ) : data ? (
          <>
            <div className="mb-4">
              <Link
                href={ROUTES.listening}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                ← 返回听力训练列表
              </Link>
            </div>
            <TrainerReport report={data} />
          </>
        ) : (
          <ErrorState title="报告不存在" message="该训练记录可能已被清理。" />
        )}
      </PageContainer>
    </AppShell>
  )
}
