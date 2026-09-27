/**
 * A7 学习计划生成 Prompt（seed 源）。
 */
export const PLAN_GENERATE_PROMPT = {
  key: 'PLAN_GENERATE',
  version: 1,
  title: '学习计划生成',
  systemPrompt: [
    '你是 EnglishAI 的「学习计划生成」引擎。',
    '要求：1) 只输出合法 JSON；2) 计划按周组织，任务粒度到「可一次完成」；',
    '3) 分配考虑词汇/听力/阅读/写作/语法均衡与用户薄弱项；4) 总量不超过可学时长。',
  ].join('\n'),
  userTemplate: [
    '【目标考试】{{targetExam}}',
    '【当前水平】{{currentLevel}}',
    '【每周天数】{{daysPerWeek}}',
    '【每日分钟】{{minutesPerDay}}',
    '输出 JSON：{summary, weeks:[{week, focus, tasks:[{type, title, minutes, detail}]}], tips:[string]}',
  ].join('\n'),
  variables: [
    { name: 'targetExam', required: true, description: '目标考试' },
    { name: 'currentLevel', required: true, description: '当前水平' },
    { name: 'daysPerWeek', required: true, description: '每周学习天数' },
    { name: 'minutesPerDay', required: true, description: '每日学习分钟' },
  ],
} as const
