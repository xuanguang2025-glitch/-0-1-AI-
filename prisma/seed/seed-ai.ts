/**
 * Seed: AI capability configs (18) + prompt templates v1 (18).
 * Idempotent: capability upsert by unique `capability`; prompt upsert by (key, version).
 */
import { Prisma, type AiCapability } from '@prisma/client'
import { prisma } from '@/lib/db'
import { log } from './shared'

/** [capability, providerKey, model, temperature, maxTokens, isStreaming, outputSchema] */
type CapabilitySpec = [
  AiCapability, string, string, number, number, boolean, string | null,
]

const CAPABILITIES: CapabilitySpec[] = [
  ['WORD_EXPLAIN', 'mock', 'glm-4-flash', 0.5, 1024, false, 'WordExplain'],
  ['WRITING_REVIEW', 'mock', 'glm-4-plus', 0.3, 4096, false, 'WritingReview'],
  ['SPEAKING_SCORE', 'mock', 'glm-4-plus', 0.2, 2048, false, 'SpeakingScore'],
  ['PRONUNCIATION_ANALYZE', 'mock', 'glm-4-flash', 0.3, 1024, false, 'PronunciationAnalyze'],
  ['READING_EXPLAIN', 'mock', 'glm-4-plus', 0.5, 4096, false, 'ReadingExplain'],
  ['GRAMMAR_EXPLAIN', 'mock', 'glm-4-flash', 0.4, 1536, false, 'GrammarExplain'],
  ['PLAN_GENERATE', 'mock', 'glm-4-plus', 0.4, 4096, false, 'GeneratedPlan'],
  ['PLAN_ADJUST', 'mock', 'glm-4-plus', 0.3, 2048, false, 'GeneratedPlan'],
  ['DAILY_DIAGNOSIS', 'mock', 'glm-4-flash', 0.5, 1536, false, 'DailyDiagnosis'],
  ['TUTOR_CHAT', 'mock', 'glm-4-flash', 0.8, 2048, true, null],
  ['TRANSLATE', 'mock', 'glm-4-flash', 0.3, 1024, false, 'TranslateResult'],
  ['LISTENING_ANALYZE', 'mock', 'glm-4-plus', 0.4, 2048, false, 'ListeningAnalyze'],
  ['MISTAKE_CLASSIFY', 'mock', 'glm-4-flash', 0.2, 1024, false, 'MistakeClassify'],
  ['READING_QUIZ_GENERATE', 'mock', 'glm-4-plus', 0.6, 2048, false, 'ReadingQuiz'],
  ['WORD_SCENARIO', 'mock', 'glm-4-flash', 0.8, 1536, false, 'WordScenario'],
  ['RECOMMEND', 'mock', 'glm-4-flash', 0.4, 1024, false, 'RecommendResult'],
  ['EXAM_ESSAY_SCORE', 'mock', 'glm-4-plus', 0.2, 2048, false, 'EssayScore'],
  ['CET_ADVICE', 'mock', 'glm-4-plus', 0.5, 2048, false, 'CetAdvice'],
]

const CAPABILITY_TITLES: Record<AiCapability, { title: string; desc: string; vars: string[] }> = {
  WORD_EXPLAIN: { title: '单词深度讲解', desc: '讲解单词释义、词根、搭配与例句', vars: ['word', 'cefr', 'scene'] },
  WRITING_REVIEW: { title: '作文批改', desc: '按四六级标准批改作文并给出分数与修改建议', vars: ['topic', 'type', 'content', 'wordLimit'] },
  SPEAKING_SCORE: { title: '口语评分', desc: '对口语回答进行流利度/准确度/内容三维评分', vars: ['question', 'answer', 'durationSec'] },
  PRONUNCIATION_ANALYZE: { title: '发音诊断', desc: '基于识别结果分析发音问题并给出跟读建议', vars: ['sentence', 'recognized', 'scores'] },
  READING_EXPLAIN: { title: '阅读精讲', desc: '讲解阅读长难句、段落结构与题目解析', vars: ['passage', 'question', 'userAnswer'] },
  GRAMMAR_EXPLAIN: { title: '语法讲解', desc: '讲解语法点定义、用法、易错点与例句', vars: ['topic', 'userLevel'] },
  PLAN_GENERATE: { title: '学习计划生成', desc: '根据目标水平与可学时长生成周学习计划', vars: ['targetExam', 'currentLevel', 'daysPerWeek', 'minutesPerDay'] },
  PLAN_ADJUST: { title: '学习计划调整', desc: '根据完成率与薄弱项动态调整后续计划', vars: ['planSummary', 'completionRate', 'weakPoints'] },
  DAILY_DIAGNOSIS: { title: '每日诊断', desc: '汇总当日学习数据并给出诊断与明日建议', vars: ['statsJson', 'streakDays'] },
  TUTOR_CHAT: { title: 'AI 学伴对话', desc: '双语陪练学伴，围绕学习话题进行对话辅导', vars: ['history', 'userMessage', 'userLevel'] },
  TRANSLATE: { title: '翻译练习批改', desc: '批改英译汉/汉译英翻译并给出地道表达', vars: ['sourceText', 'userText', 'direction'] },
  LISTENING_ANALYZE: { title: '听力分析', desc: '分析听力错题原因（辨音/语速/词汇/走神）', vars: ['transcript', 'wrongQuestions'] },
  MISTAKE_CLASSIFY: { title: '错题归类', desc: '将错题归因为知识点漏洞/审题/粗心等类别', vars: ['questionsJson'] },
  READING_QUIZ_GENERATE: { title: '阅读出题', desc: '根据文章自动生成阅读理解题（含答案解析）', vars: ['passage', 'count', 'difficulty'] },
  WORD_SCENARIO: { title: '单词情景造句', desc: '为单词生成情景记忆短故事与例句', vars: ['word', 'scene'] },
  RECOMMEND: { title: '个性化推荐', desc: '基于学习画像推荐今日学习内容', vars: ['profileJson'] },
  EXAM_ESSAY_SCORE: { title: '真题作文评分', desc: '按真题评分标准打分（档次分+细项分）', vars: ['prompt', 'essay'] },
  CET_ADVICE: { title: '备考建议', desc: '根据模考成绩生成个性化备考策略', vars: ['scoresJson', 'examDate'] },
}

/**
 * 各输出 Schema 的 JSON 结构示例（与 src/services/ai/schemas/ 的 Zod 定义一一对应）。
 * 有 outputSchema 的能力必须在 systemPrompt 中给出精确结构，否则模型只能猜字段名。
 */
const JSON_SHAPES: Record<string, string> = {
  WordExplain:
    '{"word":"<单词>","phoneticUk":"<英式音标或null>","phoneticUs":"<美式音标或null>","senses":[{"pos":"<词性>","zh":"<中文释义>","en":"<英文释义或null>"}],"rootAffix":"<词根词缀或null>","mnemonic":"<记忆法或null>","examples":[{"en":"<英文例句>","zh":"<中文翻译或null>"}],"collocations":["<搭配>"]}',
  WritingReport:
    '{"totalScore":<0-15>,"dimensions":{"content":<0-5>,"organisation":<0-4>,"language":<0-4>,"accuracy":<0-2>},"overallComment":"<总评>","sentences":[{"original":"<原句>","corrected":"<改后句或null>","issue":"<问题或null>"}],"modelEssay":"<范文或null>"}',
  DailyDiagnosis:
    '{"insights":[{"kind":"<progress|problem|suggestion>","text":"<诊断文本>"}],"tomorrowTip":"<明日建议>","cheer":"<鼓励语>"}',
  GeneratedPlan:
    '{"summary":"<计划总述>","weeks":[{"week":<周数>,"focus":"<本周重点>","tasks":[{"type":"<vocab|listening|reading|writing|grammar|speaking|translation>","title":"<任务名>","minutes":<1-240>,"detail":"<说明或null>"}]}],"tips":["<建议>"]}',
}

function buildSystemPrompt(cap: AiCapability): string {
  const meta = CAPABILITY_TITLES[cap]
  const outputSchema = CAPABILITIES.find(([c]) => c === cap)?.[6] ?? null
  const lines = [
    `你是 EnglishAI 智能英语学习平台的「${meta.title}」引擎。${meta.desc}。`,
    '要求：',
    '1. 输出必须是合法 JSON，不要输出任何 JSON 以外的内容（不要 markdown 代码块标记）。',
    '2. 全程使用简体中文进行讲解，英语例句保留原文。',
    '3. 讲解要贴近中国学习者的认知习惯，例句难度与用户 CEFR 等级匹配。',
    '4. 对不确定的内容保持克制，不要编造词源或统计数据。',
  ]
  const shape = outputSchema ? JSON_SHAPES[outputSchema] : undefined
  if (shape) {
    lines.push('输出 JSON 必须严格符合如下结构（字段名不可更改，缺可选字段用 null；禁止输出 JSON 以外的任何内容）：')
    lines.push(shape)
  }
  return lines.join('\n')
}

function buildUserTemplate(cap: AiCapability): string {
  const meta = CAPABILITY_TITLES[cap]
  return `【任务】${meta.desc}\n` + meta.vars.map((v) => `【${v}】{{${v}}}`).join('\n') + '\n【输出】请按 outputSchema 定义的 JSON 结构返回。'
}

function buildVariables(cap: AiCapability): Array<{ name: string; required: boolean; description: string }> {
  return CAPABILITY_TITLES[cap].vars.map((v) => ({
    name: v,
    required: true,
    description: `模板变量 ${v}`,
  }))
}

async function seedCapabilities(): Promise<number> {
  let count = 0
  for (const [capability, providerKey, model, temperature, maxTokens, isStreaming, outputSchema] of CAPABILITIES) {
    const existing = await prisma.aiCapabilityConfig.findUnique({ where: { capability } })
    const data = {
      providerKey,
      model,
      enabled: true,
      fallbackEnabled: true,
      temperature,
      maxTokens,
      timeoutMs: 30000,
      firstTokenTimeoutMs: isStreaming ? 3000 : 30000,
      maxRetries: 1,
      dailyQuotaUser: capability === 'TUTOR_CHAT' ? 200 : 100,
      dailyQuotaGlobal: null,
      isStreaming,
      cacheEnabled: !isStreaming,
      updatedBy: 'seed',
    }
    if (existing) {
      await prisma.aiCapabilityConfig.update({ where: { capability }, data })
    } else {
      await prisma.aiCapabilityConfig.create({ data: { capability, ...data } })
    }
    count += 1
  }
  log(`ai_capability_config: ${count} rows`)
  return count
}

async function seedPrompts(): Promise<number> {
  let count = 0
  for (const [capability] of CAPABILITIES) {
    const key = capability as string
    const data = {
      title: CAPABILITY_TITLES[capability].title,
      systemPrompt: buildSystemPrompt(capability),
      userTemplate: buildUserTemplate(capability),
      variables: buildVariables(capability) as Prisma.InputJsonValue,
      modelOverrides: Prisma.JsonNull,
      status: 'ACTIVE' as const,
      trafficRatio: 100,
      outputSchema: CAPABILITIES.find(([c]) => c === capability)?.[6] ?? null,
      createdBy: 'seed',
      publishedAt: new Date(),
    }
    await prisma.aiPrompt.upsert({
      where: { key_version: { key, version: 1 } },
      update: data,
      create: { key, version: 1, ...data },
    })
    count += 1
  }
  log(`ai_prompts: ${count} rows (v1, ACTIVE)`)
  return count
}

export async function seedAi(): Promise<void> {
  await seedCapabilities()
  await seedPrompts()
}

if (process.argv[1] && process.argv[1].includes('seed-ai')) {
  seedAi()
    .catch((e) => {
      process.stderr.write(`[seed-warn] ${e instanceof Error ? e.message : String(e)}\n`)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
