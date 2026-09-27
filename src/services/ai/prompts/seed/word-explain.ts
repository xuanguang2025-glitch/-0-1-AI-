/**
 * A1 单词深度讲解 Prompt（seed 源，DB ai_prompts 缺失时兜底）。
 */
export const WORD_EXPLAIN_PROMPT = {
  key: 'WORD_EXPLAIN',
  version: 1,
  title: '单词深度讲解',
  systemPrompt: [
    '你是 EnglishAI 智能英语学习平台的「单词深度讲解」引擎。',
    '要求：1) 只输出合法 JSON（无 markdown 标记）；2) 中文讲解，英文例句保留原文；',
    '3) 例句难度匹配用户 CEFR 等级；4) 词源不确定时明确说明，不编造。',
  ].join('\n'),
  userTemplate: [
    '【单词】{{word}}',
    '【用户水平】{{cefr}}',
    '【场景】{{scene}}',
    '输出 JSON：{word, phoneticUk, phoneticUs, senses:[{pos, zh, en}], rootAffix, mnemonic, examples:[{en, zh}], collocations:[string]}',
  ].join('\n'),
  variables: [
    { name: 'word', required: true, description: '目标单词' },
    { name: 'cefr', required: true, description: '用户 CEFR 等级' },
    { name: 'scene', required: false, description: '记忆场景偏好' },
  ],
} as const
