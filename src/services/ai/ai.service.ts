/**
 * AiService（架构 §4.1）：18 个能力的显式语义封装（A1-A18）。
 * 业务层只调这些方法，不直接触碰 gateway。
 */
import { gateway } from './gateway'
import type { AiResult, AiRunContext, AiCapabilityKey } from './types'

/** 输入类型（宽松 Record，service 内做最小化白名单透传） */
type Loose = Record<string, unknown>

async function runStruct<T>(capability: AiCapabilityKey, input: Loose, ctx: AiRunContext, schema: string | null): Promise<AiResult<T>> {
  return gateway.run<T>(capability, input, ctx, schema)
}

export const aiService = {
  /** A1 单词深度解释 */
  explainWord: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('WORD_EXPLAIN', i, ctx, 'WordExplain'),

  /** A2 写作批改 */
  analyzeWriting: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('WRITING_REVIEW', i, ctx, 'WritingReport'),

  /** A3 口语评分 */
  analyzeSpeaking: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('SPEAKING_SCORE', i, ctx, null),

  /** A4 发音分析 */
  analyzePronunciation: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('PRONUNCIATION_ANALYZE', i, ctx, null),

  /** A5 阅读讲解 */
  explainReading: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('READING_EXPLAIN', i, ctx, null),

  /** A6 语法讲解 */
  explainGrammar: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('GRAMMAR_EXPLAIN', i, ctx, null),

  /** A7 学习计划生成 */
  generateStudyPlan: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('PLAN_GENERATE', i, ctx, 'GeneratedPlan'),

  /** A8 计划调整 */
  adjustStudyPlan: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('PLAN_ADJUST', i, ctx, 'GeneratedPlan'),

  /** A9 每日诊断 */
  diagnoseDaily: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('DAILY_DIAGNOSIS', i, ctx, 'DailyDiagnosis'),

  /** A10 学伴对话（流式，经 gateway.stream 分帧） */
  chat: (i: Loose, ctx: AiRunContext): AsyncGenerator<{ kind: 'delta'; text: string } | { kind: 'done'; tokensUsed: number; latencyMs: number } | { kind: 'degraded'; reason: string }> =>
    gateway.stream('TUTOR_CHAT', i, ctx),

  /** A11 翻译批改 */
  translate: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('TRANSLATE', i, ctx, null),

  /** A12 听力分析 */
  analyzeListening: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('LISTENING_ANALYZE', i, ctx, null),

  /** A13 错题归类 */
  classifyMistake: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('MISTAKE_CLASSIFY', i, ctx, null),

  /** A14 阅读出题 */
  generateReadingQuiz: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('READING_QUIZ_GENERATE', i, ctx, null),

  /** A15 单词情景造句 */
  wordScenario: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('WORD_SCENARIO', i, ctx, null),

  /** A16 个性化推荐 */
  recommend: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('RECOMMEND', i, ctx, null),

  /** A17 真题作文评分 */
  gradeExamEssay: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('EXAM_ESSAY_SCORE', i, ctx, null),

  /** A18 备考建议 */
  cetAdvice: (i: Loose, ctx: AiRunContext): Promise<AiResult<unknown>> => runStruct('CET_ADVICE', i, ctx, null),

  /** 能力状态透传 */
  status: (capability: AiCapabilityKey, userId?: string): ReturnType<typeof gateway.status> => gateway.status(capability, userId),
}
