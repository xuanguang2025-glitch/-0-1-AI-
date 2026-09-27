import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest 配置：单测纯函数层（SRS / gamification / placement 评分映射 / CEFR / AI mock）。
 * alias '@' 与 tsconfig 一致；coverage 阈值对齐 T10 验收（SRS/planner/level/streak/cefr ≥ 80%）。
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
  },
  coverage: {
    provider: 'v8',
    // T10 验收 3 的核心算法面：SRS 引擎 / 等级曲线 / streak / Placement 评分映射。
    // 注意：streak.ts 是 barrel（re-export level.ts），无独立语句，不纳入统计。
    include: [
      'src/services/vocabulary/srs/srs.constants.ts',
      'src/services/vocabulary/srs/srs.formula.ts',
      'src/services/vocabulary/srs/srs.engine.ts',
      'src/services/gamification/level.ts',
      'src/services/placement.service.ts',
    ],
    thresholds: {
      lines: 80,
      functions: 80,
      statements: 80,
      branches: 70,
    },
  },
})
