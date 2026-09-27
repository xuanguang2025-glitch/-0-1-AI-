import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest 配置：单测纯函数层（services/gamification、placement 评分映射）。
 * alias '@' 与 tsconfig 一致；placement.service 依赖 prisma → mock 掉。
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
    reporters: 'default',
  },
})
