/**
 * /settings/privacy — 隐私说明（Phase 1 静态页）。
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PrivacySettingsPage(): React.JSX.Element {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">隐私</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>我们仅收集为提供学习服务所必需的数据：学习记录、错题、AI 调用日志与基础账号信息。</p>
        <ul className="list-inside list-disc space-y-1.5">
          <li>学习数据仅用于生成个性化计划与统计，不会用于广告。</li>
          <li>AI 调用内容经过脱敏处理，不携带邮箱等身份信息。</li>
          <li>你可以随时在「数据管理」中申请导出或删除数据。</li>
        </ul>
        <p className="text-xs">完整的隐私政策将在正式发布前提供。</p>
      </CardContent>
    </Card>
  )
}
