/**
 * Features：六大功能卡片（纯静态）。
 */
const FEATURES = [
  { emoji: '📚', title: 'SRS 科学背单词', desc: '间隔重复 + 掌握度双引擎，1/3/7/14/30 天科学复习节奏，遗忘曲线看得见。' },
  { emoji: '🎧', title: '听力精听', desc: '逐句精听、变速播放、真题语料，错因智能归类。' },
  { emoji: '🎤', title: '口语跟练', desc: 'AI 评分流利度、准确度、内容三维反馈，开口就能练。' },
  { emoji: '✍️', title: '作文智能批改', desc: '按四六级评分标准逐句纠错，给出档次分与地道范文。' },
  { emoji: '🤖', title: 'AI 学伴', desc: '24 小时双语陪练，启发式引导不直接给答案。' },
  { emoji: '📊', title: '模考与备考规划', desc: '真题模考自动评分，六维能力画像，个性化冲刺计划。' },
] as const

export function Features(): React.JSX.Element {
  return (
    <section className="container-content py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight">一个平台，覆盖英语学习全链路</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-md">
            <div className="text-3xl" aria-hidden>
              {f.emoji}
            </div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
