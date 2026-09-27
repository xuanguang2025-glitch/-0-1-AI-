/**
 * Footer：站点页脚。
 */
const LINKS: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: '学习',
    items: [
      { label: '词汇', href: '/vocabulary' },
      { label: '听力', href: '/listening' },
      { label: '阅读', href: '/reading' },
      { label: '写作', href: '/writing' },
    ],
  },
  {
    title: '备考',
    items: [
      { label: '水平测试', href: '/placement' },
      { label: '真题模考', href: '/exam' },
      { label: 'AI 学伴', href: '/tutor' },
    ],
  },
  {
    title: '关于',
    items: [
      { label: '登录', href: '/login' },
      { label: '注册', href: '/register' },
      { label: '开发预览', href: '/dev/ui-kit' },
    ],
  },
]

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-border py-12" role="contentinfo">
      <div className="container-content grid gap-8 sm:grid-cols-3">
        {LINKS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="mt-3 space-y-2">
              {group.items.map((item) => (
                <li key={item.href + item.label}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-content mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} EnglishAI · 智能英语学习平台</span>
        <span>Phase 1 · MVP</span>
      </div>
    </footer>
  )
}
