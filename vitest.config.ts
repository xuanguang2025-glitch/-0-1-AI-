import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest 配置：单测纯函数层（SRS / gamification / placement 评分映射 / CEFR / 时区 / 限流 / AI mock）。
 * alias '@' 与 tsconfig 一致。
 *
 * ⚠️ coverage 必须挂在 `test.coverage` 下（Vitest 3 已把 coverage 从顶层迁进 test），
 *    放在 defineConfig 顶层会被**静默忽略**——thresholds 不生效（覆盖率门禁假绿），
 *    include 也不生效（会统计全仓库）。参见 CI 步骤 "Unit tests (coverage gate)"。
 *
 * 门禁口径（T10 验收 3）：核心算法面 lines/functions/statements ≥ 80%、branches ≥ 70%。
 * 只纳入「无 IO 的确定性算法/纯函数」文件——这类文件才适合用覆盖率门禁；
 * 触碰 DB 的 service 层由 E2E 覆盖，不在本门禁范围内（否则门禁会被 mock 数量绑架）。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/tests/e2e/**', 'node_modules/**'],
    reporters: 'default',
    setupFiles: ['src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      // 核心算法面：SRS 引擎 / 等级与 XP 曲线 / Placement 评分映射 / 时区日期 / 限流。
      // 说明 1：streak.ts 是 barrel（纯 re-export level.ts），无独立逻辑，故不纳入统计。
      // 说明 2：placement 只纳入 scoring.ts（纯评分映射），不含 placement.service.ts
      //         —— 后者是 DB 编排，需真实 DB 才能覆盖，由 E2E 负责，不该拖低算法门禁。
      include: [
        'src/services/vocabulary/srs/srs.constants.ts',
        'src/services/vocabulary/srs/srs.formula.ts',
        'src/services/vocabulary/srs/srs.engine.ts',
        'src/services/gamification/level.ts',
        'src/services/placement/scoring.ts',
        'src/lib/utils/date.ts',
        'src/lib/auth/rate-limit.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
})
