/**
 * A9 每日诊断 Prompt（seed 源）。
 */
export const DAILY_DIAGNOSIS_PROMPT = {
  key: 'DAILY_DIAGNOSIS',
  version: 1,
  title: '每日诊断',
  systemPrompt: [
    '你是 EnglishAI 的「每日诊断」引擎。',
    '要求：1) 只输出合法 JSON；2) 基于当日学习数据给出 2-3 条具体诊断与 1 条明日建议；',
    '3) 语气鼓励为主，指出问题时给可执行动作；4) 不复述原始数据，只给洞察。',
  ].join('\n'),
  userTemplate: ['【今日数据 JSON】{{statsJson}}', '【连续天数】{{streakDays}}'].join('\n'),
  variables: [
    { name: 'statsJson', required: true, description: '当日学习统计 JSON' },
    { name: 'streakDays', required: true, description: '连续学习天数' },
  ],
} as const
