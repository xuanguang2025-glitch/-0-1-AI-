# EnglishAI · 智能英语学习平台

> Your personal AI English coach.
> Next.js 15 (App Router) · TypeScript Strict · Prisma 6 · PostgreSQL 18 单体应用。
> 目标：面向大学生与 CET-4/6 备考者的完整学习闭环 —— 词汇 · 听力 · 口语 · 阅读 · 写作 · 语法 · 翻译 · AI 陪练 · 个性化学习计划 · 数据分析。

---

## ✨ 功能特性

| 模块 | 说明 | 状态 |
| --- | --- | --- |
| 🧠 词汇 + SRS | 间隔重复引擎（SM-2 变体），掌握度 0-100、六状态、1/3/7/14/30 天间隔，服务端结算 | ✅ |
| 📊 水平测试 | 30 题 Placement Test，规则评分 → CEFR（A1-C2）→ CET 分数估算 | ✅ |
| 🤖 AI Gateway | 18 项 AI 能力统一网关：DeepSeek / OpenAI 兼容 / Ollama / **Mock 零配置**，SSE 流式，结构化输出校验，逐能力降级 | ✅ |
| 🔐 认证授权 | JWT 双 Token 轮换 + 重放检测（整族撤销）、argon2id、RBAC、CSRF、限流、登录锁定 | ✅ |
| 🏠 Dashboard | 今日进度环 · 今日任务 · 能力雷达 · AI 建议 · 连续学习 Streak · 等级环 | ✅ |
| 📈 学习统计 | 预聚合 `daily_learning_stats`，30 天趋势 / 热力日历 / 分模块正确率 | ✅ |
| 🌗 体验 | Light / Dark / System 主题 · 中英双语 · PC Sidebar / 移动 BottomNav · 首屏 JS 102kB gzip | ✅ |
| 📚 词库 | 开源 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT）精简导入：CET-4 3000 词 + CET-6 2000 词 | ✅ |
| 🎧 听力 / 口语 / 阅读 / 写作 / 翻译 / 语法 / CET 专区 / 模拟考试 | Phase 2-4 交付 | 🚧 |

> 设计文档：[`docs/01-prd.md`](docs/01-prd.md)（产品需求与 77 页信息架构）· [`docs/02-architecture.md`](docs/02-architecture.md)（技术架构：52 表 / 140 API / 算法约定）

---

## 🚀 快速开始（Windows · 零系统安装）

本机**无 Docker、无系统 PostgreSQL** 也能跑：开发期数据库默认走 **Tier A：npm 内嵌 PostgreSQL 18.4**
（`embedded-postgres`），`provider` 始终为 `postgresql`，与生产 schema 100% 一致。

```bash
# 0) 确认 Node 版本（团队基线 22 LTS，见 .nvmrc）
node -v            # 期望 v22.x（>=20.11 <25 均可）

# 1) 安装依赖（npmmirror，无 node-gyp 编译）
npm install --no-audit --no-fund

# 2) 启动内嵌 PostgreSQL（首次约 16~25s：initdb + start + create db）
npm run db:start          # 前台独占一个终端；Ctrl+C 优雅停止
#   另开一个终端继续：

# 3) 迁移 + 灌数据
npm run db:migrate
npm run db:seed

# 4) 起开发服务器
npm run dev               # http://localhost:3000
```

> `npm run db:start` **可重复执行**：第二次检测到 `PG_VERSION` 与 pid 均存在时直接提示已在运行并 `exit 0`。
> 管理员账号由 seed 生成：`admin@englishai.dev`（初始密码见 `prisma/seed/seed-admin.ts`，首次登录后请修改）。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run db:status` | 是否已初始化 / 是否在跑 / PG 版本 / 端口 / 数据目录大小 |
| `npm run db:stop` | 读 `.data/pg.pid` 优雅停止内嵌 PG |
| `npm run db:reset` | 重置数据库（`migrate reset --force`）并重新 seed |
| `npm run db:studio` | Prisma Studio（可视化 52 张表） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint（Next 规则） |
| `npm run check:env` | 校验 env 完整性 + Node 版本 + DB 连通性 |
| `npm run db:fetch:vocab` | 下载 ECDICT 全量词库到 `.data/ecdict/ecdict.csv` |
| `npm run db:build:vocab` | 流式解析词库 → 生成 `prisma/data/cet4-words.csv` / `cet6-words.csv` |

---

## 🤖 AI Provider 配置（默认 Mock，零 Key 可跑）

不配置任何 Key 时，全部 18 项 AI 能力自动走 **Mock Provider**（返回结构合法的演示数据，
UI 明确标注「Mock AI」），整条学习闭环照常可跑。接真实模型只改 `.env`，**零代码改动**：

```ini
# DeepSeek（国内直连，OpenAI 兼容协议）
AI_PROVIDER=deepseek
AI_API_KEY=sk-xxxxxxxx
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat

# OpenAI 兼容的其他服务（智谱 / 通义 / Moonshot 等，改 BASE_URL 与 MODEL 即可）
# AI_PROVIDER=openai

# 本地 Ollama（零成本离线）
# AI_PROVIDER=ollama
# AI_BASE_URL=http://localhost:11434/v1
# AI_API_KEY=ollama
# AI_MODEL=qwen2.5-coder:7b

# 回到 Mock
# AI_PROVIDER=mock
```

> 🔒 API Key 只存在于服务端 `.env`（已 gitignore），绝不进前端、绝不进仓库。

---

## 🗄️ 数据库三档（Tier A / C / B）

| 档位 | 方案 | 一键切换 | 说明 |
| --- | --- | --- | --- |
| **Tier A** ★默认 | npm 内嵌 PostgreSQL 18.4 | — | 零系统安装，`provider = postgresql` |
| **Tier C** | 云 PG（Neon / Supabase） | `npm run db:use-cloud` | 填 `DATABASE_URL`（`sslmode=require&pgbouncer=true`） |
| **Tier B** | SQLite（最后手段） | `npm run db:use-sqlite` | enum/Json 降级（见架构 §2.6.3） |

切换只改 `.env.local`，**业务代码零改动**。

---

## 📚 词库

Phase 1 采用开源 [ECDICT](https://github.com/skywind3000/ECDICT) 精简子集：

```bash
npm run db:fetch:vocab   # 下载 62.9MB ecdict.csv → .data/ecdict/ecdict.csv（已 gitignore）
npm run db:build:vocab   # 流式解析，按 tag 筛选 → prisma/data/cet4-words.csv(3000) + cet6-words.csv(2000)
npm run db:seed          # 批量 upsert 入库（按 lemma 唯一键，幂等）
```

若下载失败，seed 会自动使用内置的 **200 词 fallback 词表**（`prisma/data/fallback-words.csv`），
并打印警告提示补齐。**商用授权待确认前仅限本地/自评用途**。

---

## 🪟 Windows 专项

### 慢网安装

`.npmrc` 已固化 npmmirror 与 Prisma / Playwright 镜像。若仍慢：

```bash
npm install --no-audit --no-fund
# 依赖树冲突时退一寸：
npm install --legacy-peer-deps
```

### Prisma engine 下载

`registry=https://registry.npmmirror.com` 下 `@prisma/engines`（`libquery-engine-windows.dll.node`、
`schema-engine-windows.exe`）可正常分发。若失败，确认 `.npmrc` 中 `prisma_engines_mirror`，
或在 shell 中导出同名大写环境变量 `PRISMA_ENGINES_MIRROR`。

### 零系统安装起 PG（Tier A）

- 数据目录：`.data/pg`（已 gitignore，**禁止提交**）；pid：`.data/pg.pid`
- 端口：**5433**；认证：`scram-sha-256`；`initdb` 参数：`--encoding=UTF8 --locale=C`
- 连接串：`postgresql://englishai:englishai@localhost:5433/englishai?schema=public`
- **已知坑**：
  1. `initialise()` 非幂等 —— 目录非空会报 `exists but is not empty`；守护脚本以 `PG_VERSION` 判断是否已初始化。
  2. `createDatabase()` 非幂等 —— 已存在会抛错；守护脚本已 try/catch。
- 失败排查：`npm run db:status`；端口占用 `netstat -ano | findstr :5433`；
  半成品目录可 `Remove-Item -Recurse -Force .data\pg` 后重启。
- 建议把项目目录加入 **Windows Defender 排除项**（显著加速 `npm i` / `initdb` / `postgres` 启停）。
- 本机若存在失效的系统代理（`HTTP_PROXY` 指向已关闭的动态端口），`curl` 等命令需加 `--noproxy "*"` 直连。

### 中文路径

项目路径含中文（如 `D:/徐浩然/...`），**已实测 Prisma 6 + PostgreSQL 18 正常工作**。若个别工具链异常，
可用目录联接：`mklink /J D:\work\englishai "D:\徐浩然\2026-09-26-21-59-15\englishai"`。

---

## 🧪 测试

```bash
npm run test        # Vitest 单测（SRS / CEFR 映射 / 认证等核心算法）
npx playwright test # E2E（Phase 1 收尾接入：注册→测评→看板→学词 8 条链路）
```

---

## 🗺️ 路线图

| Phase | 内容 | 状态 |
| --- | --- | --- |
| **Phase 1** | 基础设施 · 数据层 · 认证 · UI 框架 · AI Gateway · 测评 · Dashboard · 词汇 SRS · 统计 · 个人中心 | 🚧 收尾（T10 联调 + E2E） |
| Phase 2 | 听力 · 阅读 · 语法 · 写作批改 · 翻译 | ⏳ |
| Phase 3 | AI Tutor 对话 · 口语评分 · 发音训练 | ⏳ |
| Phase 4 | CET-4/6 专区 · 模拟考试引擎 · 错题本 | ⏳ |
| Phase 5 | 成就 · 排行榜 · 推荐引擎 · 每日挑战 | ⏳ |
| Phase 6 | 管理后台 · 安全加固 · 部署 | ⏳ |

---

## 🧱 技术栈版本（精确锁定，勿用 `^` / `latest`）

`next 15.5.26` · `react/react-dom 19.2.8` · `typescript 5.9.3` · `tailwindcss 3.4.19` ·
`zod 3.25.76` · `prisma 6.19.3` / `@prisma/client 6.19.3` · `@node-rs/argon2 2.2.1` ·
`embedded-postgres 18.4.0-beta.17` · `jose 5.10.0`。

> ⚠️ `prisma` 的 npm `latest` 指向 `8.0.0-rc.17`（预发布）。**严禁** `@latest` / `^` / `*`。
> `package.json` 已写死精确版本并在 `overrides` 中兜底。

---

## 📁 目录结构

```
prisma/       schema.prisma(52表) · migrations · seed/** · data/*.csv
scripts/      pg-daemon.mjs · pg-stop.mjs · pg-status.mjs · use-driver.ts
              fetch-ecdict.mjs · build-vocab-csv.ts · check-env.ts · gen-sqlite-schema.ts
src/app/      路由（[locale]/(auth)/(app)/api/**）
src/features/ 按功能域拆分的页面模块（auth/landing/onboarding/vocabulary/...）
src/services/ 领域服务（auth/vocabulary+srs/placement/analytics/ai+gateway/...）
src/lib/      api envelope · auth 基建 · cache · db · i18n · logger
src/components/ ui 原语 · layout · charts · common · feedback
docs/         01-prd.md · 02-architecture.md
```

---

## 📐 工程规范

- 提交信息遵循 Conventional Commits（`feat|fix|chore|docs|refactor|test|perf|ci`）。
- `package-lock.json` 必须提交；`.env*` 除 `.env.example` 全部 gitignore。
- 跨文件约定见 `docs/02-architecture.md` §10（别名 / 命名 / 类型 / env / 日志 / 错误处理）。

---

## 📄 License 与致谢

- 词库数据：[ECDICT](https://github.com/skywind3000/ECDICT)（MIT License）—— 感谢开源社区。
- 应用代码：© 2026 [xuanguang2025-glitch](https://github.com/xuanguang2025-glitch)，保留所有权利（正式开源协议待定）。
