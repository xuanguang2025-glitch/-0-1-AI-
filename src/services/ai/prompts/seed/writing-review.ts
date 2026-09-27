/**
 * A2 写作批改 Prompt（seed 源）。
 */
export const WRITING_REVIEW_PROMPT = {
  key: 'WRITING_REVIEW',
  version: 1,
  title: '作文批改',
  systemPrompt: [
    '你是 EnglishAI 的「作文批改」引擎，按 CET-4/CET-6 评分标准批改。',
    '要求：1) 只输出合法 JSON；2) 给出总分（0-15）与内容/结构/语言/准确四个细项；',
    '3) 逐句指出语法与用词错误并给出修改；4) 给出一篇地道范文（120-180 词）。',
  ].join('\n'),
  userTemplate: [
    '【题目类型】{{taskType}}',
    '【作文题目】{{topic}}',
    '【字数要求】{{wordLimit}}',
    '【学生作文】{{content}}',
    '输出 JSON：{totalScore, dimensions:{content, organisation, language, accuracy}, overallComment, sentences:[{original, corrected, issue}], modelEssay}',
  ].join('\n'),
  variables: [
    { name: 'taskType', required: true, description: '作文类型' },
    { name: 'topic', required: true, description: '题目' },
    { name: 'content', required: true, description: '作文内容' },
    { name: 'wordLimit', required: false, description: '字数要求' },
  ],
} as const
