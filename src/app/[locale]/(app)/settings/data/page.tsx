/**
 * /settings/data — 数据管理（Phase 1 静态页：导出/清除说明）。
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DataSettingsPage(): React.JSX.Element {
  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">导出数据</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>学习记录、词汇掌握与统计数据支持导出为 JSON/CSV。</p>
          <p className="mt-1 text-xs">导出功能将在 T10 联调阶段开放。</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">清除与注销</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>清除学习数据不影响账号；注销账号将在 7 天后彻底删除全部数据。</p>
          <p className="mt-1 text-xs">如需立即处理，请联系支持渠道。</p>
        </CardContent>
      </Card>
    </div>
  )
}
