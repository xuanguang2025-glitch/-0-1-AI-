import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 配置（T10）：
 * - webServer 复用项目 dev 脚本（自动检查内嵌 PG 状态后启动 Next dev）；
 *   若 CI/本机已手动起服务，设置 PW_SKIP_WEBSERVER=1 跳过。
 * - 8 条 E2E 面向真实服务端 + 真实内嵌 PostgreSQL（Mock AI Provider 兜底，无需外部 Key）。
 * - 失败自动截图/trace，reporter 用 list（Windows 终端友好）。
 */
const PORT = Number(process.env.PORT ?? 3000)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PW_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npx next dev -p 3000',
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
