/**
 * Seed 步骤清单（orchestrator 与单测共用的**唯一事实来源**）。
 *
 * 为什么单独拆一个模块：QA 第五轮曾报「LISTENING_P2 导入量为 0」——当时
 * `seed-listening-p2.ts` 是未提交 WIP、`index.ts` 里既没 import 也没调用。
 * 把步骤清单抽出来后，`src/tests/seed-listening-p2.spec.ts` 可以直接断言
 * 「listening-p2 在清单里、顺序在 content 之后、且是函数」，接线回归有单测兜底，
 * 不再依赖「跑一次 seed 看日志」这种一次性证据。
 *
 * ⚠️ 新增 seed 必须同时登记到这里，否则不会被执行。
 */
import { seedAchievements } from './seed-achievements'
import { seedAdmin } from './seed-admin'
import { seedAi } from './seed-ai'
import { seedContent } from './seed-content'
import { seedListeningP2 } from './seed-listening-p2'
import { seedQuestions } from './seed-questions'
import { seedRoles } from './seed-roles'
import { seedVocabulary } from './seed-vocabulary'

export interface SeedStep {
  /** 步骤名（日志与断言用） */
  name: string
  run: () => Promise<unknown>
}

/**
 * 依赖顺序（不可随意调换）：
 *   roles → admin → vocabulary → content → **listening-p2** → questions → ai → achievements
 *
 * 说明：`listening-p2` 必须在 `content` 之后——它覆盖 Phase 1 的 lm-1..lm-20，
 * 并清理这些材料下不属于 Phase 2 的历史题目。
 */
export const SEED_STEPS: readonly SeedStep[] = [
  { name: 'roles', run: seedRoles },
  { name: 'admin', run: seedAdmin },
  { name: 'vocabulary', run: seedVocabulary },
  { name: 'content', run: seedContent },
  { name: 'listening-p2', run: seedListeningP2 },
  { name: 'questions', run: seedQuestions },
  { name: 'ai', run: seedAi },
  { name: 'achievements', run: seedAchievements },
]

/** 步骤名列表（断言用） */
export function seedStepNames(): string[] {
  return SEED_STEPS.map((s) => s.name)
}
