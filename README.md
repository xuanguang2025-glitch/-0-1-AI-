# EnglishAI · 智能英语学习平台

> Next.js 15 (App Router) + Prisma 6 + PostgreSQL 18 单体应用。
> Phase 1 目标：跑通「注册 → 测评 → 看板 → 学单词」完整学习闭环。

---

## 1. 快速开始（Windows · 零系统安装）

本机**无 Docker、无系统 PostgreSQL**，开发期数据库默认走 **Tier A：npm 内嵌 PostgreSQL 18.4**
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

## 2. 数据库三档（Tier A / C / B）

| 档位 | 方案 | 一键切换 | 说明 |
| --- | --- | --- | --- |
| **Tier A** ★默认 | npm 内嵌 PostgreSQL 18.4 | — | 零系统安装，`provider = postgresql` |
| **Tier C** | 云 PG（Neon / Supabase） | `npm run db:use-cloud` | 填 `DATABASE_URL`（`sslmode=require&pgbouncer=true`） |
| **Tier B** | SQLite（最后手段） | `npm run db:use-sqlite` | enum/Json 降级（见架构 §2.6.3） |

切换只改 `.env.local`，**业务代码零改动**。

---

## 3. Windows 专项

### 3.1 慢网安装

`.npmrc` 已固化 npmmirror 与 Prisma / Playwright 镜像。若仍慢：

```bash
npm install --no-audit --no-fund
# 依赖树冲突时退一寸：
npm install --legacy-peer-deps
```

### 3.2 Prisma engine 下载

`registry=https://registry.npmmirror.com` 下 `@prisma/engines`（`libquery-engine-windows.dll.node`、
`schema-engine-windows.exe`）可正常分发。若失败，确认 `.npmrc` 中 `prisma_engines_mirror`，
或在 shell 中导出同名大写环境变量 `PRISMA_ENGINES_MIRROR`。

### 3.3 零系统安装起 PG（Tier A）

- 数据目录：`.data/pg`（已 gitignore，**禁止提交**）；pid：`.data/pg.pid`
- 端口：**5433**；认证：`scram-sha-256`；`initdb` 参数：`--encoding=UTF8 --locale=C`
- 连接串：`postgresql://englishai:englishai@localhost:5433/englishai?schema=public`
- **已知坑**：
  1. `initialise()` 非幂等 —— 目录非空会报 `exists but is not empty`；守护脚本以 `PG_VERSION` 判断是否已初始化。
  2. `createDatabase()` 非幂等 —— 已存在会抛错；守护脚本已 try/catch。
- 失败排查：`npm run db:status`；端口占用 `netstat -ano | findstr :5433`；
  半成品目录可 `Remove-Item -Recurse -Force .data\pg` 后重启。
- 建议把项目目录加入 **Windows Defender 排除项**（显著加速 `npm i` / `initdb` / `postgres` 启停）。

### 3.4 中文路径

项目路径含中文（`D:/徐浩然/...`），**已实测 Prisma 6 + PostgreSQL 18 正常工作**。若个别工具链异常，
可用目录联接：`mklink /J D:\work\englishai "D:\徐浩然\2026-09-26-21-59-15\englishai"`。

---

## 4. 词库

Phase 1 采用开源 [ECDICT](https://github.com/skywind3000/ECDICT) 精简子集：

```bash
npm run db:fetch:vocab   # 下载 62.9MB ecdict.csv → .data/ecdict/ecdict.csv（已 gitignore）
npm run db:build:vocab   # 流式解析，按 tag 筛选 → prisma/data/cet4-words.csv(3000) + cet6-words.csv(2000)
npm run db:seed          # 批量 upsert 入库（按 lemma 唯一键，幂等）
```

若下载失败，seed 会自动使用内置的 **200 词 fallback 词表**（`prisma/data/fallback-words.csv`），
并打印警告提示补齐。**商用授权待确认前仅限本地/自评用途**。

---

## 5. 技术栈版本（精确锁定，勿用 `^` / `latest`）

`next 15.5.26` · `react/react-dom 19.2.8` · `typescript 5.9.3` · `tailwindcss 3.4.19` ·
`zod 3.25.76` · `prisma 6.19.3` / `@prisma/client 6.19.3` · `@node-rs/argon2 2.2.1` ·
`embedded-postgres 18.4.0-beta.17` · `jose 5.10.0`。

> ⚠️ `prisma` 的 npm `latest` 指向 `8.0.0-rc.17`（预发布）。**严禁** `@latest` / `^` / `*`。
> `package.json` 已写死精确版本并在 `overrides` 中兜底。

---

## 6. 目录结构

见 `docs/02-architecture.md` §6。核心：

```
prisma/     schema.prisma · migrations · seed/** · data/*.csv
scripts/    pg-daemon.mjs · pg-stop.mjs · pg-status.mjs · use-driver.ts · gen-sqlite-schema.ts
src/        app/ · components/ · features/ · services/ · lib/ · types/ · styles/
```

---

## 7. 工程规范

- 提交信息遵循 Conventional Commits（`feat|fix|chore|docs|refactor|test|perf|ci`）。
- `package-lock.json` 必须提交；`.env*` 除 `.env.example` 全部 gitignore。
- 跨文件约定见 `docs/02-architecture.md` §10（别名 / 命名 / 类型 / env / 日志 / 错误处理）。
