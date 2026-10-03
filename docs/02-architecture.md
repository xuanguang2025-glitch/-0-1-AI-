# EnglishAI · 智能英语学习平台 — 技术架构设计

| 项目信息 | 内容 |
| --- | --- |
| Language | 简体中文（技术名词保留英文） |
| Project Name | `englishai` |
| 文档版本 | v1.2（2026-09-27 二次修订：**§5.1 SRS 口径裁决** A 追认 + B 回改 1 项承重结构；**§5.2 任务生成** A 追认 + Phase 2 规格保留） |
| 作者 | 高见远 · Architect |
| 上游输入 | `docs/01-prd.md`（77 路由 / 21 页面模块 / R001-R052 / A1-A18 / §9.4 设计输入） |
| QA 输入 | `docs/03-qa-report.md`（问题 #1 SRS 口径、#9 任务生成 → 本文 §5.1.4 / §5.2 裁决） |
| 下游交付对象 | 工程师（Phase 1 编码唯一依据） |
| 运行环境（**已实测确认**） | Windows 10/11 · Node **v22.22.2**（基线锁 22 LTS）· npm **10.9.7** · registry 已为 `registry.npmmirror.com` · **无 Docker** · **无系统 PostgreSQL** · 目录 `D:/徐浩然/2026-09-26-21-59-15/englishai`（含中文目录名，已实测兼容） |
| 数据库起法（**已实测通过**） | **Tier A · npm 内嵌 PostgreSQL 18.4**（`embedded-postgres@18.4.0-beta.17`）+ **Prisma 6.19.3** —— 零系统安装，`provider` 保持 `postgresql` |

## 目录（Table of Contents）

| 章节 | 标题 |
| --- | --- |
| 1 | 系统架构（分层图 / ADR / 横切关注点） |
| 2 | 数据库设计（52 表 Prisma schema / ER 图 / 索引与聚合策略 / **§2.6 三档启动方案 Tier A·C·B**） |
| 3 | API 设计（Envelope / 错误码 / 140 条接口 / 流式约定） |
| 4 | AI Service 设计（Gateway / Provider Adapter / Prompt / 降级矩阵） |
| 5 | 核心算法约定（SRS **§5.1.4 裁决** / 任务生成 **§5.2 裁决** / 推荐 / XP / CEFR / 计划调整） |
| 6 | 项目目录结构 |
| 7 | 组件设计（Design Token / 基础与复合组件 / 状态组件 / 响应式） |
| 8 | Phase 1 任务分解 T01–T10 |
| 9 | 依赖包清单（版本锁定表 / npmmirror / 密码哈希 / Windows 风险 / **§9.6 版本锁定与升级策略** / **§9.7 Node 兼容性**） |
| 10 | 共享知识（跨文件约定） |
| 11 | 待明确事项（**§11.0 已确认环境事实** / §11.1 架构侧默认决策 / §11.2 需用户拍板） |

> **★ 实测背书（2026-09-27）**：本机 **无 Docker、无系统 PostgreSQL**，已用 `embedded-postgres@18.4.0-beta.17` 在中文路径下成功拉起 **PostgreSQL 18.4**，并用 **Prisma 6.19.3** 完成 `db push` + 原生 enum + JSONB 路径查询 + 热路径索引查询的端到端验证（详见 §2.6.1-②）。


---

## 一、系统架构

### 1.1 技术选型总表

| 层 | 选型 | **锁定版本** | 理由 |
| --- | --- | --- | --- |
| 框架 | Next.js（App Router） | **`15.5.26`** | 单体优先，Route Handlers 承担后端；RSC 减少首屏 JS 保障 M5（≤3s）。不取 `16.3.6`（见 §9.6.2） |
| 语言 | TypeScript strict | **`5.9.3`** | 严格模式，禁止 `any` 逃逸（见 §10.3） |
| UI | Tailwind CSS | **`3.4.19`** | **不用 v4（`4.3.3`）**：v4 引擎与配置语法全变，shadcn 生态当前以 v3 为已验证组合 |
| 组件 | shadcn/ui + Radix UI | 由 CLI 写入，**lockfile 锁定** | 代码进仓库可二开，无黑盒版本锁定 |
| 动效 | Framer Motion | **`11.18.2`** | 入场/翻卡/打勾动画，支持 `useReducedMotion` |
| 图表 | Recharts | **`2.15.4`** | 折线/柱/饼/雷达齐全，全部动态 import |
| 图标 | Lucide React | **`0.577.0`** | tree-shaking 友好 |
| 服务端数据 | TanStack Query | **`5.104.0`** | 缓存/重试/乐观更新；SSR 用 hydration |
| 客户端状态 | Zustand | **`5.0.15`** | 仅 UI 状态（侧栏折叠、播放器、过滤器），业务数据不进 Zustand |
| i18n | next-intl | **`3.26.5`** | 中/英双语，路由前缀 `/[locale]`；不取 `4.x`（面向 Next 16） |
| ORM | Prisma | **`6.19.3`（精确）** | schema 即文档，迁移入库本库仓库。**`latest` 是 `8.0.0-rc.17` 预发布版，严禁 `^`/`latest`**（§9.6.1） |
| DB | PostgreSQL | **生产 `16+`；开发 `18.4`（Tier A 内嵌，已实测）** | JSONB、原生 enum、部分索引、窗口函数。**Tier A 零系统安装提供真实 PG**（§2.6.1）；SQLite 仅保底（§2.6.3） |
| 认证 | `jose` JWT + httpOnly Cookie | **`5.10.0`** | Edge Runtime 兼容，Access/Refresh 轮换 |
| 密码哈希 | **`@node-rs/argon2`（主，`2.2.1`）** / `bcryptjs`（备，`3.0.3`） | 见 §9.3 | 主选已有 `win32-x64-msvc` 预编译包，**Windows 编译风险实测为「低」** |
| 校验 | Zod | **`3.25.76`** | 前后端共用 schema，AI 结构化输出同用；不取 `4.x` |
| 测试 | Vitest `3.2.7` + RTL `16.3.3` + Playwright `1.63.0` | — | 8 条主链路 E2E |
| 部署 | Docker 多阶段 + docker-compose（**可选**） | — | 本机无 Docker，开发默认走 **Tier A 内嵌 PG**；有 Docker 的环境可用 compose |

### 1.2 整体分层架构图

```mermaid
graph TB
    subgraph CLIENT["客户端 Client"]
        BROWSER["Browser / Mobile Web<br/>Next.js RSC + Client Components"]
        SW["PWA Service Worker (P2)"]
    end

    subgraph FE["Frontend Layer — Next.js App Router"]
        RL["Route & Layout Layer<br/>(app)/[locale]/** RSC/SSR"]
        UI["UI Layer<br/>components/ui · components/layout · components/charts"]
        FT["Feature Layer<br/>features/** (按能力域)"]
        SC["State Layer<br/>TanStack Query (server) + Zustand (UI)"]
        I18N["i18n Layer<br/>next-intl zh-CN / en"]
    end

    subgraph MID["Cross-Cutting Middleware"]
        MW["middleware.ts<br/>鉴权/路由守卫/CSRF Origin/locale"]
    end

    subgraph API["API Layer — Route Handlers (/app/api/**)"]
        W1["withApi() wrapper<br/>envelope · 错误映射 · 日志 · traceId"]
        W2["withAuth() / withRole()<br/>JWT 校验 · RBAC"]
        W3["RateLimit<br/>IP + User Token Bucket"]
        W4["Zod Request Validation"]
    end

    subgraph SVC["Service Layer — src/services/** (server-only)"]
        S1["auth · user · profile"]
        S2["placement · plan · dashboard"]
        S3["vocabulary + srs engine"]
        S4["listening · speaking · reading · writing · grammar · translation"]
        S5["exam + grading"]
        S6["mistake · favorite · search"]
        S7["analytics + aggregation"]
        S8["gamification (xp/level/streak/achievement)"]
        S9["admin · notification"]
    end

    subgraph GW["AI Gateway — src/services/ai/**"]
        G1["AiGateway<br/>能力路由 · 配额 · 并发 · 降级"]
        G2["PromptRegistry<br/>版本 · 灰度 · DB 优先"]
        G3["StructGuard<br/>Zod 校验 + 1次修补重试"]
        G4["Meter & Audit<br/>token / latency / cost"]
        G5["ProviderRegistry<br/>Failover + CircuitBreaker"]
    end

    subgraph PRV["AI Providers"]
        P1["DeepSeek<br/>(OpenAI 兼容)"]
        P2["Ollama Local<br/>localhost:11434/v1"]
        P3["Mock Provider<br/>零配置兜底"]
        P4["OpenAI / 通义 / Gemini<br/>(预留 Adapter)"]
    end

    subgraph DATA["Data Layer"]
        DB[("PostgreSQL 18.4 / 16+<br/>Prisma 6.19.3 · Tier A 内嵌")]
        CACHE[("In-Process Cache<br/>(可选 Redis)")]
        FS[("Object Storage<br/>audio / avatar / export")]
    end

    BROWSER --> RL --> MID
    MW --> W1 --> SVC
    API --> GW
    SVC --> GW
    SVC --> DB
    SVC --> CACHE
    SVC --> FS
    GW --> G5 --> PRV
    WL["写入侧"] -.-> DB
    G4 --> DB

    classDef ai fill:#eef2ff,stroke:#6366f1
    classDef db fill:#ecfdf5,stroke:#10b981
    class GW,G1,G2,G3,G4,G5 ai
    class DB,CACHE,FS db
```

### 1.3 ADR-001：为什么单体 Next.js 起步，未来如何拆分

**决策（Accepted）**：Phase 1–5 采用**单体 Next.js**，后端能力以 Route Handlers 承载，内部按能力域强制分层（`src/services/**`），所有跨层调用只走 service 导出的纯函数与 DTO，**禁止 Route Handler 直接 `prisma.xxx` 操作两个以上模型**（除单表 CRUD 查询外）。理由：①团队规模小，单体把部署/联调/迁移成本压到最低，直接保障 Phase 1 交付；②AI Gateway、SRS、考试评分这类核心逻辑本身是 CPU/IO 无状态型，放在同一进程内共享 Prisma 连接池与事务边界，比跨服务 RPC 简单一个数量级；③Next Route Handlers 天然支持 SSE 流式，实时链路不需要额外网关。

**未来拆分路径（Strangler Fig）**：当且仅当出现下列任一信号时才启动拆分——AI 调用导致 Node 事件循环阻塞明显、团队 ≥ 3 个并行小组、或需要独立伸缩 AI Worker。剥离顺序固定为：**①`ai-gateway`（最先，天然无状态，改一行 env `AI_GATEWAY_URL` 切到独立 FastAPI/Node 服务）→ ②`exam-service`（评分长耗时，改异步队列）→ ③`analytics-service`（报表不与交易库争抢 IO，迁只读副本）**。

**前置约束（现在就要做）**：所有 service 不得 import `next/*`、不得直接读写 `NextRequest/NextResponse`，入参出参必须是纯 TS 类型；所有 AI 能力必须通过 `AiGateway` 单一入口；SRS/评分算法必须是无 IO 的纯函数（输入 state → 输出 state）。满足这三条，拆分即改 import 路径。

### 1.4 关键横切关注点

#### 1.4.1 请求生命周期

```mermaid
sequenceDiagram
    participant C as Client
    participant M as middleware.ts
    participant H as Route Handler
    participant W as withApi/withAuth
    participant S as Service
    participant G as AiGateway(可选)
    participant D as PostgreSQL

    C->>M: fetch /api/**
    M->>M: 解析 locale + Origin 校验 + JWT 快筛
    alt 未携带有效 token 且非 PUBLIC 路由
        M-->>C: 401 {success:false, error:AUTH_TOKEN_MISSING}
    end
    M->>H: next() (注入 x-trace-id / x-user-id)
    H->>W: withApi(handler, {auth:true, roles:[], schema, rateLimit})
    W->>W: RateLimit 取令牌
    W->>W: Zod 校验 body/query
    W->>W: 二次 JWT 校验 + RBAC 角色比对
    W->>S: 调用 service（纯业务）
    alt 需要 AI
        S->>G: gateway.run(capability, input)
        G->>G: 配额 → Prompt → 调 Provider
        alt 成功
            G-->>S: {data, usage, degraded:false}
        else 失败/超时
            G->>G: Failover → Mock/兜底
            G-->>S: {fallbackData, degraded:true}
        end
    end
    S->>D: 事务读写
    D-->>S: 结果
    S-->>W: DTO
    W-->>C: 200 {success:true, data, meta, traceId}
```

#### 1.4.2 认证中间件与 RBAC

- `middleware.ts` 仅做**粗粒度路由守卫**（PUBLIC / USER / ADMIN 三大组的存在性判断），**不做真正的权限判决**；真正的判决在服务端 `withAuth()`，形成**双重校验**（PRD §9.4-5）。
- 角色：`USER` / `TEACHER` / `ADMIN`，存 `users.role`（冗余快路径）+ `user_role` 关系表（可编辑矩阵，供 `/admin/roles`）。
- Cookie：`access_token`（15min，httpOnly + SameSite=Lax）、`refresh_token`（30d，httpOnly + SameSite=Strict，路径限定 `/api/auth/refresh`）。
- Refresh 轮换 + **重放检测**：`auth_sessions` 表记录 `tokenHash + familyId + revokedAt`；检测到已撤销 token 被复用 → 整个 family 全部撤销并强制登出。

#### 1.4.3 统一响应 Envelope

见 §3.1。所有 Route Handler 必须经由 `withApi()` 包装，**禁止裸 `NextResponse.json`**。

#### 1.4.4 错误码体系

见 §3.2。格式为 `DOMAIN_NNN`（如 `AUTH_003`），HTTP 状态码与错误码分离，前端按错误码做文案映射。

#### 1.4.5 日志规范

- 统一 `createLogger(module)`，结构化 JSON 输出： `{time, level, msg, traceId, userId, module, durationMs, err}`。
- **`traceId`** 由 middleware 生成，透传到 service → AI Gateway → provider 调用日志，并在响应体返回。
- 禁止记录：密码/token/身份证/完整邮箱（邮箱脱敏 `a***@b.com`）。
- 开发环境 pretty-print，生产 JSON（`pino`-like 自研轻量实现，避免多依赖）。

#### 1.4.6 限流策略

| 场景 | 维度 | 阈值 | 处理 |
| --- | --- | --- | --- |
| 全局 API | IP + path | 300 req / 60s | 429 `SYS_RATE_LIMIT` |
| 登录/注册/找回密码 | IP + email | 10 req / 10min，连续失败 5 次锁定 15min | 429 / 423 `AUTH_ACCOUNT_LOCKED` |
| AI 能力（用户级） | userId + capability | 默认 100 次/日（后台可配，见 `ai_capability_config`） | 429 `AI_QUOTA_EXCEEDED` |
| AI 全局 | provider | 并发 ≤ 8，QPS ≤ 20 | 排队 + 熔断 |
| 考试自动保存 | userId + attemptId | 1 次 / 5s | 409 `EXAM_SAVE_TOO_FREQUENT` |

实现：`lib/auth/rate-limit.ts` 内存 Token Bucket（单实例够用）；**预留 `RedisRateLimiter` 接口**，多实例时替换实现即可。

#### 1.4.7 缓存策略

| 数据 | 策略 | TTL |
| --- | --- | --- |
| 词库列表 / 语法分类 / 场景角色角色配置 | 进程内 `memoryCache` + `revalidateTag` | 300s |
| 单词详情（静态词典部分） | TanStack Query staleTime | 5min |
| Dashboard 概览 | SSR 直出，无缓存（需实时今日任务） | — |
| Analytics 报表 | `unstable_cache` key=`{userId,range}` | 60s |
| AI 结构化结果（同 input hash） | 命中则复用，`ai_call_logs.requestHash` | 24h（仅非流式能力，可在后台关） |
| 排行榜 | 基于 `daily_learning_stats` 预聚合 | 300s |

#### 1.4.8 安全基线

| 项 | 措施 |
| --- | --- |
| CSRF | SameSite Cookie + 服务端 `Origin`/`Referer` 白名单校验（`NEXT_PUBLIC_APP_ORIGIN`） |
| XSS | React 默认转义；AI/用户富文本经 `sanitize-html` 消毒后才 `dangerouslySetInnerHTML`；CSP header |
| SQL 注入 | Prisma 参数化；`$queryRaw` 必须使用 `Prisma.sql` 模板标签，禁止字符串拼接 |
| 上传 | 白名单（jpg/png/webp ≤ 2MB；mp3/wav/m4a ≤ 20MB）+ 服务端 magic number 校验 + 随机文件名 + 存 public 之外目录由 route 代理 |
| 暴力破解 | 见限流表 + 登录失败计数持久化 `users.failedLoginCount` |
| 越权 | 所有 userId 相关查询**强制**从 session 取 userId，禁止信任 query/body 中的 userId（除 ADMIN 显式指定并审计） |
| AI Key | 仅服务端 env；禁止进入 `NEXT_PUBLIC_*`；禁止回传给前端 |

---

## 二、数据库设计

### 2.1 设计原则

| 原则 | 说明 |
| --- | --- |
| **PostgreSQL 唯一正式目标** | 使用原生 `enum`、`Json`（JSONB）、`@db.*` 原生类型；SQLite 仅为开发期逃生（§2.6） |
| **禁止 Prisma scalar list** | 一律不用 `String[]`，改用 `Json`（既兼容数据库差异，也便于扩展），并在 Zod 层约束元素类型 |
| 软删 | 内容表、用户表、会话表统一 `deletedAt DateTime?`；查询一律 `deletedAt: null` |
| 主键 | 统一 `String @id @default(cuid())`（可读、可分库、URL 安全）；**不使用自增 int**（便于未来迁移与离线草稿同步） |
| 时间 | 全部 `DateTime` 存 UTC；用户本地日期由 `user_settings.timezone` 派生（用于 streak / 日历） |
| 枚举 | 一律 Prisma `enum`（PG native），并在 `src/lib/constants/enums.ts` 导出同名 TS 常量与 Zod schema（三方同源，禁止手写字符串字面量） |
| 金额/配额 | 用 `Int`（分为单位）或计数，禁止 Float |
| 审计 | 所有 ADMIN 写操作落 `audit_logs` |

### 2.2 数据库 Schema 总览（**52 张表**）

| 域 | 表 | 数量 |
| --- | --- | --- |
| **用户域 User** | `users` `profiles` `user_stats` `user_settings` `learning_goals` `roles` `permissions` `role_permissions` `user_roles` `auth_sessions` `password_reset_tokens` `admin_users` | 12 |
| **学习域 Learning** | `study_plans` `study_tasks` `vocabulary_books` `vocabulary` `vocabulary_book_items` `user_vocabulary` `vocabulary_reviews` `speaking_sessions` `speaking_messages` `listening_records` `reading_records` `writing_submissions` `translation_records` `learning_records` `daily_learning_stats` `placement_tests` | 16 |
| **内容域 Content** | `listening_materials` `listening_questions` `reading_articles` `reading_questions` `grammar_topics` `grammar_questions` `writing_tasks` `questions` | 8 |
| **考试域 Exam** | `exam_papers` `exam_questions` `exam_attempts` `exam_answers` `wrong_questions` | 5 |
| **复习/激励域 Review & Gamification** | `favorites` `achievements` `user_achievements` `notifications` | 4 |
| **AI 域** | `ai_conversations` `ai_messages` `ai_prompts` `ai_call_logs` `ai_capability_config` | 5 |
| **运营域 Ops** | `subscriptions` `audit_logs` | 2 |

> 合计 **52 张模型**（其中 Prisma 隐式多对多显式化为 `vocabulary_book_items` / `role_permissions` / `user_roles` 三张关联表，便于加排序/审计字段）。

### 2.3 ER 图（按域分组）

```mermaid
erDiagram
    %% ================= 用户域 =================
    users ||--o| profiles : "has"
    users ||--o| user_stats : "aggregates"
    users ||--o| user_settings : "configures"
    users ||--o| learning_goals : "sets"
    users ||--o| auth_sessions : "logs in"
    users ||--o| password_reset_tokens : "requests"
    users ||--o| admin_users : "granted"
    users ||--o| user_roles : "assigned"
    roles ||--o| user_roles : "contains"
    roles ||--o| role_permissions : "has"
    permissions ||--o| role_permissions : "granted"

    %% ================= 学习域 =================
    users ||--o| study_plans : "owns"
    study_plans ||--o{ study_tasks : "contains"
    users ||--o{ user_vocabulary : "tracks"
    vocabulary ||--o{ user_vocabulary : "tracked by"
    user_vocabulary ||--o{ vocabulary_reviews : "generates"
    vocabulary_books ||--o{ vocabulary_book_items : "includes"
    vocabulary ||--o{ vocabulary_book_items : "in book"
    users ||--o{ speaking_sessions : "practices"
    speaking_sessions ||--o{ speaking_messages : "contains"
    users ||--o{ listening_records : "completes"
    users ||--o{ reading_records : "reads"
    users ||--o{ writing_submissions : "submits"
    users ||--o{ translation_records : "translates"
    users ||--o{ learning_records : "logs"
    users ||--o{ daily_learning_stats : "daily rollup"
    users ||--o{ placement_tests : "takes"

    %% ================= 内容域 =================
    listening_materials ||--o{ listening_questions : "has"
    reading_articles ||--o{ reading_questions : "has"
    grammar_topics ||--o{ grammar_topics : "sub topics"
    grammar_topics ||--o{ grammar_questions : "has"
    writing_tasks ||--o{ writing_submissions : "assigned to"
    listening_materials ||--o{ listening_records : "practiced by"
    reading_articles ||--o{ reading_records : "read by"

    %% ================= 考试域 =================
    exam_papers ||--o{ exam_questions : "composes"
    exam_papers ||--o{ exam_attempts : "attempted"
    exam_attempts ||--o{ exam_answers : "answers"
    exam_questions ||--o{ exam_answers : "answered"
    exam_attempts ||--o{ wrong_questions : "produces"

    %% ================= 复习/激励 =================
    users ||--o{ favorites : "collects"
    users ||--o{ wrong_questions : "owns"
    achievements ||--o{ user_achievements : "unlocked by"
    users ||--o{ user_achievements : "earns"
    users ||--o{ notifications : "receives"

    %% ================= AI 域 =================
    users ||--o{ ai_conversations : "chats"
    ai_conversations ||--o{ ai_messages : "messages"
    ai_conversations ||--o| speaking_sessions : "bound session"
    users ||--o{ ai_call_logs : "usage"
    ai_capability_config ||--o{ ai_call_logs : "metered"
    ai_prompts ||--o{ ai_call_logs : "versioned"

    %% ================= 运营域 =================
    users ||--o| subscriptions : "subscribes"
    users ||--o{ audit_logs : "audits"
```

### 2.4 完整 Prisma Schema（可复制粘贴即用）

> 文件路径：`prisma/schema.prisma`。以下为**完整文件**，直接复制即可 `npx prisma migrate dev`。

```prisma
// =============================================================================
// EnglishAI · Prisma Schema
// Target: PostgreSQL (official). Dev default = Tier A embedded PostgreSQL 18.4
//         (embedded-postgres@18.4.0-beta.17, zero system install — see §2.6.1)
//         SQLite (generated by `npm run prisma:sqlite`) is a LAST-RESORT hatch (§2.6.3)
// Conventions:
//   - PK: String cuid() everywhere (URL-safe, merge-safe)
//   - Timestamps: UTC always. Local dates derived from user_settings.timezone
//   - Soft delete: deletedAt DateTime? — always filter `deletedAt: null` in reads
//   - NO Prisma scalar lists (String[]) — use Json instead
//   - Enums are PostgreSQL-native; mirror them in src/lib/constants/enums.ts + Zod
// =============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================================================
// ENUMS
// =============================================================================

enum Role {
  USER
  TEACHER
  ADMIN
}

enum UserStatus {
  ACTIVE
  DISABLED
  PENDING
  DELETED
}

enum CEFRLevel {
  A1
  A2
  B1
  B2
  C1
  C2
}

/// SRS 六状态：未学习 / 陌生 / 初步掌握 / 熟悉 / 熟练 / 完全掌握
enum MasteryStage {
  NEW
  STRANGER
  LEARNING
  FAMILIAR
  PROFICIENT
  MASTERED
}

enum GoalType {
  CET4
  CET6
  KAOYAN
  IELTS
  TOEFL
  DAILY
  BUSINESS
  INTEREST
  ABROAD
}

enum GoalStatus {
  ACTIVE
  ACHIEVED
  ABANDONED
}

enum ExamType {
  /// CET4/CET6/考研/雅思/托福 + 模拟卷/自定义/水平测试
  CET4
  CET6
  KAOYAN
  IELTS
  TOEFL
  MOCK
  CUSTOM
  PLACEMENT
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum QuestionType {
  SINGLE_CHOICE
  MULTI_CHOICE
  TRUE_FALSE
  FILL_BLANK
  CLOZE
  MATCHING
  SHORT_ANSWER
  ESSAY
  TRANSLATION
  DICTATION
  RETELL
  SUMMARY
}

enum ExamSection {
  LISTENING
  READING
  WRITING
  TRANSLATION
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  GRADING
  GRADED
  ABANDONED
  EXPIRED
}

enum PublishStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  OFFLINE
  REJECTED
}

enum PlanSource {
  AI
  RULE
  MANUAL
}

enum PlanStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
}

enum TaskType {
  VOCAB
  REVIEW
  LISTENING
  READING
  WRITING
  SPEAKING
  GRAMMAR
  TRANSLATION
  EXAM
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
  EXPIRED
}

enum ReviewSource {
  LEARN
  REVIEW
  QUIZ
  EXAM
  NOTEBOOK
  CHALLENGE
}

enum AiCapability {
  WORD_EXPLAIN          // A1
  WRITING_REVIEW        // A2
  SPEAKING_SCORE        // A3
  PRONUNCIATION_ANALYZE // A4
  READING_EXPLAIN       // A5
  GRAMMAR_EXPLAIN       // A6
  PLAN_GENERATE         // A7
  PLAN_ADJUST           // A8
  DAILY_DIAGNOSIS       // A9
  TUTOR_CHAT            // A10
  TRANSLATE             // A11
  LISTENING_ANALYZE     // A12
  MISTAKE_CLASSIFY      // A13
  READING_QUIZ_GENERATE // A14
  WORD_SCENARIO         // A15
  RECOMMEND             // A16
  EXAM_ESSAY_SCORE      // A17
  CET_ADVICE            // A18
}

enum AiCallStatus {
  SUCCESS
  ERROR
  TIMEOUT
  DEGRADED
  RATE_LIMITED
  CONTENT_BLOCKED
}

enum PromptStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum ConversationType {
  TUTOR
  SPEAKING_PARTNER
  WORD_EXPLAINER
  GRAMMAR_EXPLAINER
  READING_EXPLAINER
}

enum SpeakingStatus {
  ACTIVE
  COMPLETED
  ABANDONED
}

enum Speaker {
  USER
  AI
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
  GRADING
  SCORED
}

enum NotificationType {
  STUDY_REMINDER
  REVIEW_REMINDER
  PLAN_REMINDER
  EXAM_REMINDER
  STREAK_REMINDER
  ACHIEVEMENT
  SYSTEM
}

enum Channel {
  IN_APP
  EMAIL
  PUSH
}

enum AchievementCategory {
  STREAK
  VOCABULARY
  STUDY_TIME
  EXAM
  WRITING
  SPEAKING
  LISTENING
  READING
  SPECIAL
}

enum SubscriptionPlan {
  FREE
  PRO
  PREMIUM
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  EXPIRED
  CANCELLED
}

// =============================================================================
// DOMAIN 1 · USER — 用户域
// =============================================================================

model User {
  id            String     @id @default(cuid())
  email         String     @unique // 软删时需改写为 deleted_<ts>_<email>，见 §2.5.3 说明
  emailVerifiedAt DateTime?
  passwordHash  String
  nickname      String
  avatarUrl     String?
  role          Role       @default(USER)
  status        UserStatus @default(PENDING)
  locale        String     @default("zh-CN")
  timezone      String     @default("Asia/Shanghai")
  /// 登录失败计数，成功后清零；配合 lockedUntil 做爆破锁定
  failedLoginCount Int     @default(0)
  lockedUntil   DateTime?
  lastLoginAt   DateTime?
  lastLoginIp   String?
  deletedAt     DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  profile              Profile?
  stats                UserStats?
  settings             UserSettings?
  goals                LearningGoal[]
  sessions             AuthSession[]
  resetTokens          PasswordResetToken[]
  adminGrants          AdminUser[]
  userRoles            UserRole[]
  studyPlans           StudyPlan[]
  studyTasks           StudyTask[]
  userVocabularies     UserVocabulary[]
  speakingSessions     SpeakingSession[]
  listeningRecords     ListeningRecord[]
  readingRecords       ReadingRecord[]
  writingSubmissions   WritingSubmission[]
  translationRecords   TranslationRecord[]
  learningRecords      LearningRecord[]
  dailyStats           DailyLearningStat[]
  placementTests       PlacementTest[]
  favorites            Favorite[]
  wrongQuestions       WrongQuestion[]
  userAchievements     UserAchievement[]
  notifications        Notification[]
  aiConversations      AiConversation[]
  aiCallLogs           AiCallLog[]
  subscriptions        Subscription[]
  auditLogs            AuditLog[]
  examAttempts         ExamAttempt[]

  @@index([status, createdAt])
  @@index([deletedAt])
  @@map("users")
}

model Profile {
  id          String     @id @default(cuid())
  userId      String     @unique
  realName    String?
  bio         String?
  gender      String? // male | female | other | undisclosed
  birthDate   DateTime?
  country     String?    @default("CN")
  /// PRD §5.19：CEOFR 等级 + 预估 CET 分数
  cefrLevel   CEFRLevel?
  cetEstimatedScore Int?
  /// 用户自评/实测的当前分与目标分（0-710）
  currentScore  Int?
  targetScore   Int?
  /// 六维能力分 0-100（vocabulary/grammar/listening/speaking/reading/writing）
  abilityVector Json?
  /// Onboarding 8 步原始答案快照，供 AI 计划回溯
  onboardingData Json?
  onboardingCompletedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}

/// 热计数器独立表：避免 profiles 行频繁更新导致的行锁与 MVCC 膨胀
model UserStats {
  id             String   @id @default(cuid())
  userId         String   @unique
  xp             Int      @default(0)
  level          Int      @default(1)
  totalStudySeconds Int   @default(0)
  wordsLearned   Int      @default(0)
  wordsReviewed  Int      @default(0)
  wordsMastered  Int      @default(0)
  listeningCount Int      @default(0)
  listeningSeconds Int    @default(0)
  readingCount   Int      @default(0)
  writingCount   Int      @default(0)
  speakingSeconds Int     @default(0)
  examCount      Int      @default(0)
  correctCount   Int      @default(0)
  wrongCount     Int      @default(0)
  /// 连续学习天数 + 最长记录；lastStudyDate 为"用户本地日期 YYYY-MM-DD"
  streakDays     Int      @default(0)
  longestStreak  Int      @default(0)
  lastStudyDate  String?
  challengeCompleted Int  @default(0)
  aiCallCount    Int      @default(0)
  /// 乐观锁版本号，所有更新必须带版本号，防止计数漂移
  version        Int      @default(0)
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_stats")
}

model UserSettings {
  id        String   @id @default(cuid())
  userId    String   @unique
  theme     String   @default("system") // light | dark | system
  language  String   @default("zh-CN")  // zh-CN | en
  dailyGoalMinutes Int @default(30)
  weeklyGoalDays   Int @default(5)
  /// PRD §5.19 通知设置：开关 + 提醒时间
  notificationPrefs Json?
  /// AI 设置：各能力开关、回复长度、严格度、音效
  aiPrefs           Json?
  /// 隐私：数据可见性、排行榜匿名、个性化推荐
  privacyPrefs      Json?
  reduceMotion      Boolean @default(false)
  soundEffects      Boolean @default(false)
  autoPlayAudio     Boolean @default(true)
  defaultPlaybackRate Float @default(1.0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_settings")
}

model LearningGoal {
  id          String     @id @default(cuid())
  userId      String
  goalType    GoalType
  targetExam  ExamType?
  targetScore Int?
  targetDate  DateTime?
  dailyMinutes Int      @default(30)
  weeklyDays   Int      @default(5)
  status      GoalStatus @default(ACTIVE)
  priority    Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@map("learning_goals")
}

model RoleModel {
  id          String   @id @default(cuid())
  code        String   @unique // USER | TEACHER | ADMIN | custom
  name        String
  description String?
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@map("roles")
}

model Permission {
  id          String   @id @default(cuid())
  code        String   @unique // e.g. "content:write" "user:disable" "ai:config"
  name        String
  group       String   // content | user | ai | system
  description String?
  createdAt   DateTime @default(now())

  rolePermissions RolePermission[]

  @@map("permissions")
}

model RolePermission {
  id           String @id @default(cuid())
  roleId       String
  permissionId String
  grantedAt    DateTime @default(now())
  grantedBy    String?

  role       RoleModel  @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

model UserRole {
  id        String   @id @default(cuid())
  userId    String
  roleId    String
  grantedAt DateTime @default(now())
  grantedBy String?

  user User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role RoleModel  @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@index([roleId])
  @@map("user_roles")
}

model AuthSession {
  id        String   @id @default(cuid())
  userId    String
  /// refresh token 的 sha256 摘要，明文不下库
  tokenHash String   @unique
  /// 同一登录批次生成的 token 家族，重放检测时整体撤销
  familyId  String
  expiresAt DateTime
  revokedAt DateTime?
  rotateCount Int    @default(0)
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([familyId])
  @@map("auth_sessions")
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
  @@map("password_reset_tokens")
}

model AdminUser {
  id        String   @id @default(cuid())
  userId    String
  role      Role     @default(TEACHER)
  grantedBy String?
  grantedAt DateTime @default(now())
  revokedAt DateTime?
  note      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@map("admin_users")
}

// =============================================================================
// DOMAIN 2 · CONTENT — 内容域
// =============================================================================

model VocabularyBook {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  examType    ExamType?
  cefrLevel   CEFRLevel?
  description String?
  coverUrl    String?
  wordCount   Int          @default(0)
  isPublic    Boolean      @default(true)
  sortOrder   Int          @default(0)
  status      PublishStatus @default(PUBLISHED)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  items VocabularyBookItem[]

  @@index([examType, status])
  @@map("vocabulary_books")
}

model Vocabulary {
  id          String       @id @default(cuid())
  word        String
  /// 规范化去重键（小写去空格）；**一个单词一行**，多词性统一放在 pos/definitions Json 内
  lemma       String   @unique
  phoneticUk  String?
  phoneticUs  String?
  audioUrl    String?
  /// ["n.","v.","adj."] 词性标签
  pos         Json?
  /// [{pos, zh, en}] 释义列表（同一单词多词性全部塞在本字段内）
  definitions Json
  /// [{en, zh, source}] 例句
  examples    Json?
  synonyms    Json?
  antonyms    Json?
  collocations Json?
  derivatives Json?
  rootAffix   String?
  /// 词源/记忆法（静态，AI 解释走 ai explain capability）
  mnemonic    String?
  cefrLevel   CEFRLevel?
  difficulty  Difficulty  @default(MEDIUM)
  /// 词频序号，越小越常见
  frequencyRank Int?
  tags        Json?
  source      String?      @default("seed")
  status      PublishStatus @default(PUBLISHED)
  deletedAt   DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  bookItems      VocabularyBookItem[]
  userVocabularies UserVocabulary[]

  @@index([difficulty, cefrLevel, status])
  @@index([frequencyRank])
  @@map("vocabulary")
}

model VocabularyBookItem {
  id           String @id @default(cuid())
  bookId       String
  vocabularyId String
  orderIndex   Int    @default(0)

  book       VocabularyBook @relation(fields: [bookId], references: [id], onDelete: Cascade)
  vocabulary Vocabulary     @relation(fields: [vocabularyId], references: [id], onDelete: Cascade)

  @@unique([bookId, vocabularyId])
  @@index([bookId, orderIndex])
  @@map("vocabulary_book_items")
}

model ListeningMaterial {
  id          String       @id @default(cuid())
  title       String
  description String?
  category    String // daily | campus | cet4 | cet6 | business | travel | news | movie
  difficulty  Difficulty   @default(MEDIUM)
  cefrLevel   CEFRLevel?
  audioUrl    String
  /// 音频字节数，用于估算下载/缓存
  audioSize   Int?
  durationSec Int
  /// [{startSec, endSec, en, zh}] 时间轴字幕（字幕点击定位的唯一数据源）
  transcript  Json
  translation String?
  sourceName  String?
  sourceUrl   String?
  wordCount   Int          @default(0)
  /// ["cet4","news"] 多维标签
  tags        Json?
  coverUrl    String?
  playCount   Int          @default(0)
  status      PublishStatus @default(PUBLISHED)
  publishedAt DateTime?
  createdBy   String?
  deletedAt   DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  questions ListeningQuestion[]
  records   ListeningRecord[]

  @@index([category, difficulty, status])
  @@index([status, publishedAt])
  @@map("listening_materials")
}

model ListeningQuestion {
  id            String       @id @default(cuid())
  materialId    String
  type          QuestionType
  /// 题干；听写/填空类可用 {stem} 占位
  stem          String
  options       Json?
  answer        String
  /// 模糊匹配容忍（听写/填空）
  answerAliases Json?
  explanation   String?
  startSec      Float?
  endSec        Float?
  difficulty    Difficulty   @default(MEDIUM)
  knowledgePoints Json?
  sortOrder     Int          @default(0)

  material ListeningMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@index([materialId, sortOrder])
  @@map("listening_questions")
}

model ReadingArticle {
  id            String       @id @default(cuid())
  title         String
  slug          String       @unique
  subtitle      String?
  category      String // news | tech | business | campus | culture | history | travel | society | exam | cet4 | cet6
  difficulty    Difficulty   @default(MEDIUM)
  cefrLevel     CEFRLevel?
  coverUrl      String?
  /// 段落数组：[{index, en, zh}] —— 便于逐段翻译与阅读进度恢复
  contentBlocks Json
  contentZh     String?
  wordCount     Int          @default(0)
  readingMinutes Int         @default(5)
  /// [{word, pos, meaning}] 重点词高亮列表
  keyWords      Json?
  /// [{sentence, structure, translation}] 长难句分析
  sentences     Json?
  /// ["CET4","technology"]
  tags          Json?
  sourceName    String?
  sourceUrl     String?
  audioUrl      String?
  viewCount     Int          @default(0)
  status        PublishStatus @default(PUBLISHED)
  publishedAt   DateTime?
  createdBy     String?
  deletedAt     DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  questions ReadingQuestion[]
  records   ReadingRecord[]

  @@index([category, difficulty, status])
  @@index([status, publishedAt])
  @@map("reading_articles")
}

model ReadingQuestion {
  id          String       @id @default(cuid())
  articleId   String
  type        QuestionType
  stem        String
  options     Json?
  answer      String
  explanation String?
  /// 答案定位：{blockIndex, charStart, charEnd} 用于"文章定位"UI
  location    Json?
  difficulty  Difficulty   @default(MEDIUM)
  isAiGenerated Boolean    @default(false)
  sortOrder   Int          @default(0)

  article ReadingArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId, sortOrder])
  @@map("reading_questions")
}

model GrammarTopic {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  /// 14 类：词性/时态/语态/从句/虚拟语气/非谓语/倒装/强调/主谓一致/介词/冠词/情态动词/条件句/比较结构
  category    String
  parentId    String?
  description String?
  /// [{title, content}] 知识点讲解
  content     Json?
  /// [{en, zh, structure}] 例句
  examples    Json?
  /// [{wrong, right, reason}] 错误示例对照
  errorExamples Json?
  difficulty  Difficulty   @default(MEDIUM)
  orderIndex  Int          @default(0)
  status      PublishStatus @default(PUBLISHED)

  parent   GrammarTopic?  @relation("TopicTree", fields: [parentId], references: [id])
  children GrammarTopic[] @relation("TopicTree")
  questions GrammarQuestion[]

  @@index([category, orderIndex])
  @@map("grammar_topics")
}

model GrammarQuestion {
  id          String       @id @default(cuid())
  topicId     String
  type        QuestionType
  stem        String
  options     Json?
  answer      String
  explanation String?
  /// ["past-perfect"] 知识点标签, volume name
  knowledgePoints Json?
  difficulty  Difficulty   @default(MEDIUM)
  sortOrder   Int          @default(0)

  topic GrammarTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@index([topicId, sortOrder])
  @@map("grammar_questions")
}

model WritingTask {
  id          String       @id @default(cuid())
  title       String
  /// essay | email | plan | report | cover_letter | daily_expression | cet4 | cet6
  taskType    String
  difficulty  Difficulty   @default(MEDIUM)
  examType    ExamType?
  prompt      String
  /// [{key, value}] 写作要求（字数、要点）
  requirements Json?
  wordMin      Int?
  wordMax      Int?
  /// AI 评分 rubric，供 EXAM_ESSAY_SCORE / WRITING_REVIEW 使用
  rubric       Json?
  sampleAnswer String?
  /// CET 分值权重
  totalScore   Int         @default(15)
  tags         Json?
  status       PublishStatus @default(PUBLISHED)
  createdBy    String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  submissions WritingSubmission[]

  @@index([taskType, difficulty, status])
  @@map("writing_tasks")
}

/// 通用题库：统一承载跨模块的题目（Placement、每日挑战、混入练习）
model Question {
  id           String       @id @default(cuid())
  type         QuestionType
  category     String       @default("general") // vocab | grammar | reading | listening | translation
  difficulty   Difficulty   @default(MEDIUM)
  examType     ExamType?
  stem         String
  options      Json?
  answer       String
  answerAliases Json?
  explanation  String?
  knowledgePoints Json?
  /// 附加材料：{audioUrl, passage, imageUrl}
  material     Json?
  /// 用于 CAT 简化版：题目的区分度参数 0-1
  discrimination Float      @default(0.5)
  /// 用于 CAT：难度参数 -3~3
  irtDifficulty  Float      @default(0)
  tags         Json?
  source       String       @default("seed")
  status       PublishStatus @default(PUBLISHED)
  deletedAt    DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  examQuestions ExamQuestion[]

  @@index([category, difficulty, status])
  @@index([examType, type, status])
  @@map("questions")
}

// =============================================================================
// DOMAIN 3 · LEARNING — 学习域
// =============================================================================

model StudyPlan {
  id          String     @id @default(cuid())
  userId      String
  title       String
  goalType    GoalType?
  targetExam  ExamType?
  targetScore Int?
  targetDate  DateTime?
  startDate   DateTime
  endDate     DateTime
  /// AI 生成的周目标快照 [{weekNo, vocabCount, listeningMin, readingCount, writingCount, speakingMin}]
  weekTargets Json?
  source      PlanSource @default(RULE)
  status      PlanStatus @default(ACTIVE)
  /// 每次调整 version+1，保存历史快照便于/plan/history
  version     Int        @default(1)
  /// AI 生成时的依据标签（测试成绩/错题/掌握度…）
  inputTags   Json?
  /// 最近一次调整原因
  lastAdjustReason String?
  lastAdjustedAt   DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user  User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks StudyTask[]

  @@index([userId, status])
  @@index([userId, version])
  @@map("study_plans")
}

model StudyTask {
  id          String     @id @default(cuid())
  planId      String?
  userId      String
  /// 用户本地日期 YYYY-MM-DD
  date        String
  taskType    TaskType
  title       String
  targetValue Int        @default(1)
  /// word | piece | minute | count
  unit        String     @default("count")
  completedValue Int     @default(0)
  status      TaskStatus @default(PENDING)
  /// 深链，点击直达对应学习页：{type:'vocabulary_learn'} / {type:'listening', id:'xxx'}
  payload     Json?
  sortOrder   Int        @default(0)
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  plan  StudyPlan? @relation(fields: [planId], references: [id], onDelete: Cascade)
  user  User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date, status])
  @@index([userId, date, taskType])
  @@index([planId, date])
  @@map("study_tasks")
}

/// SRS 状态行：每个用户 × 每个单词一条
model UserVocabulary {
  id           String       @id @default(cuid())
  userId       String
  vocabularyId String
  /// 0-100 掌握度
  masteryScore Int          @default(0)
  masteryStage MasteryStage @default(NEW)
  learnCount   Int          @default(0)
  reviewCount  Int          @default(0)
  correctCount Int          @default(0)
  wrongCount   Int          @default(0)
  /// SM-2 ease factor，默认 2.5，范围 [1.3, 2.8]
  easeFactor   Float        @default(2.5)
  intervalDays Int          @default(0)
  reps         Int          @default(0)
  lapses       Int          @default(0)
  consecutiveCorrect Int    @default(0)
  learnedAt    DateTime?
  lastReviewedAt DateTime?
  nextReviewAt DateTime?
  /// 平均反应时长 ms，进入 SRS 公式的 timeFactor
  avgResponseMs Int        @default(0)
  isFavorite   Boolean      @default(false)
  inNotebook   Boolean      @default(false)
  /// 乐观锁，复习并发保护
  version      Int          @default(0)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  vocabulary Vocabulary @relation(fields: [vocabularyId], references: [id], onDelete: Cascade)
  reviews    VocabularyReview[]

  @@unique([userId, vocabularyId])
  @@index([userId, nextReviewAt])
  @@index([userId, masteryStage])
  @@index([userId, inNotebook])
  @@index([userId, isFavorite])
  @@map("user_vocabulary")
}

/// SRS 事件流水（append-only），用于回溯、补算与双向演练
model VocabularyReview {
  id           String       @id @default(cuid())
  userId       String
  userVocabId  String
  vocabularyId String
  /// 自评 0-5：0 完全不会 / 1 陌生 / 2 初步 / 3 熟悉 / 4 熟练 / 5 完全掌握
  rating       Int
  /// 本次是否回答正确（自评 >= 2 视为正确）
  isCorrect    Boolean
  responseMs   Int          @default(0)
  prevMastery  Int
  newMastery   Int
  prevStage    MasteryStage
  newStage     MasteryStage
  prevIntervalDays Int
  newIntervalDays Int
  prevEaseFactor  Float
  newEaseFactor   Float
  source       ReviewSource @default(REVIEW)
  /// 幂等键，防止重复提交导致间隔被多次推进
  idempotencyKey String?    @unique
  occurredAt   DateTime     @default(now())

  userVocab UserVocabulary @relation(fields: [userVocabId], references: [id], onDelete: Cascade)

  @@index([userVocabId, occurredAt])
  @@index([userId, occurredAt])
  @@map("vocabulary_reviews")
}

model SpeakingSession {
  id            String         @id @default(cuid())
  userId        String
  conversationId String?       @unique
  /// 11 角色：friend|teacher|interviewer|tourist|classmate|boss|colleague|client|waiter|airport|hotel
  roleKey       String
  /// 9 场景：restaurant|airport|hotel|shopping|university|interview|business_meeting|travel|daily
  sceneKey      String
  mode          String         @default("partner") // partner | pronunciation
  status        SpeakingStatus @default(ACTIVE)
  startedAt     DateTime       @default(now())
  endedAt       DateTime?
  durationSec   Int            @default(0)
  messageCount  Int            @default(0)
  /// AI 完整对话文本（评分输入）
  fullTranscript String?
  /// {pronunciation, grammar, vocabulary, fluency, naturalness, total}
  aiScores      Json?
  aiTotalScore  Int?
  aiSummary     String?
  /// {errors:[{sentence, correct, moreNatural}], suggestions:[]}
  aiCorrections Json?
  aiDegraded    Boolean        @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation AiConversation?   @relation(fields: [conversationId], references: [id])
  messages     SpeakingMessage[]

  @@index([userId, status, startedAt])
  @@map("speaking_sessions")
}

model SpeakingMessage {
  id         String   @id @default(cuid())
  sessionId  String
  speaker    Speaker
  textContent String?
  /// 用户录音 / AI TTS 音频
  audioUrl   String?
  durationMs Int      @default(0)
  /// STT 置信度 0-1
  sttConfidence Float?
  /// 实时提示：修正建议 [{original, suggestion, reason}]
  hints      Json?
  /// 本条消息的 AI token 用量
  tokensUsed Int      @default(0)
  model      String?
  latencyMs  Int      @default(0)
  isFavorite Boolean  @default(false)
  createdAt  DateTime @default(now())

  session SpeakingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("speaking_messages")
}

model ListeningRecord {
  id            String       @id @default(cuid())
  userId        String
  materialId    String
  /// intensive | extensive | dictation | choice | keyword | retell | cloze | comprehension
  mode          String
  accuracy      Float        @default(0)
  totalCount    Int          @default(0)
  correctCount  Int          @default(0)
  /// 本次生词 [{word, meaning}]
  unknownWords  Json?
  durationSec   Int          @default(0)
  playbackRate  Float        @default(1.0)
  /// [{questionId, userAnswer, isCorrect}]
  answers       Json?
  /// A12 AI 听力分析结果
  aiAnalysis    Json?
  aiDegraded    Boolean      @default(false)
  completedAt   DateTime     @default(now())

  user     User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  material ListeningMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@index([userId, completedAt])
  @@index([userId, materialId])
  @@map("listening_records")
}

model ReadingRecord {
  id          String   @id @default(cuid())
  userId      String
  articleId   String
  /// 阅读进度 0-100
  progress    Int      @default(0)
  readSeconds Int      @default(0)
  lastBlockIndex Int   @default(0)
  ///  quiz 结果 {score, total, correctCount}
  quizResult  Json?
  /// 划词收藏的高亮 [{word, meaning, blockIndex}]
  highlights  Json?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  article ReadingArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([userId, articleId])
  @@index([userId, updatedAt])
  @@map("reading_records")
}

model WritingSubmission {
  id             String           @id @default(cuid())
  userId         String
  taskId         String
  title          String?
  content        String           @db.Text
  wordCount      Int              @default(0)
  paragraphCount Int              @default(0)
  /// 用户自评 / 规则引擎基础分
  selfScore      Int?
  status         SubmissionStatus @default(DRAFT)
  /// A2 六维评分 {grammar, vocabulary, structure, coherence, content, naturalness, total}
  aiScores       Json?
  /// 冗余提升列：必须与 aiScores.total 同步写入，用于列表排序
  aiTotalScore   Int?
  /// [{original, issue, fixed, reason, advanced}]
  aiCorrections  Json?
  /// {basic, college, cet, advanced, spoken}
  aiRewrites     Json?
  aiSummary      String?
  /// 规则引擎基础检查结果（降级时使用）
  ruleCheck      Json?
  aiDegraded     Boolean          @default(false)
  tokensUsed     Int              @default(0)
  submittedAt    DateTime?
  scoredAt       DateTime?
  isFavorite     Boolean          @default(false)
  deletedAt      DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  task WritingTask  @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([userId, status, createdAt])
  @@index([userId, deletedAt, updatedAt])
  @@map("writing_submissions")
}

model TranslationRecord {
  id            String   @id @default(cuid())
  userId        String
  /// zh2en | en2zh
  direction     String
  sourceText    String   @db.Text
  /// {literal, natural, formal, academic, spoken}
  aiResult      Json?
  aiNotes       String?
  aiDegraded    Boolean  @default(false)
  isFavorite    Boolean  @default(false)
  tokensUsed    Int      @default(0)
  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("translation_records")
}

/// 统一学习流水：所有学习行为的明细，事件溯源与历史时间线的唯一数据源
model LearningRecord {
  id           String   @id @default(cuid())
  userId       String
  activityType String // vocab_learn | vocab_review | listening | reading | writing | speaking | grammar | translation | exam | placement | challenge
  refType      String?
  refId        String?
  durationSec  Int      @default(0)
  value        Int      @default(0) // 词数 / 篇数 / 条数
  score        Int?
  accuracy     Float?
  xpEarned     Int      @default(0)
  meta         Json?
  occurredAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, occurredAt])
  @@index([userId, activityType, occurredAt])
  @@map("learning_records")
}

/// 预聚合日表：Dashboard / 日历 / 热力图 / 趋势的唯一读源
model DailyLearningStat {
  id              String   @id @default(cuid())
  userId          String
  /// YYYY-MM-DD（用户本地日期）
  date            String
  studySeconds    Int      @default(0)
  wordsLearned    Int      @default(0)
  wordsReviewed   Int      @default(0)
  listeningSeconds Int     @default(0)
  listeningCount  Int      @default(0)
  readingCount    Int      @default(0)
  speakingSeconds Int      @default(0)
  writingCount    Int      @default(0)
  examCount       Int      @default(0)
  translationCount Int     @default(0)
  grammarCount    Int      @default(0)
  tasksTotal      Int      @default(0)
  tasksCompleted  Int      @default(0)
  correctCount    Int      @default(0)
  wrongCount      Int      @default(0)
  xpEarned        Int      @default(0)
  aiCallCount     Int      @default(0)
  /// 各模块秒数 {vocab, listening, reading, writing, speaking}
  breakdown       Json?
  version         Int      @default(0)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([date])
  @@map("daily_learning_stats")
}

model PlacementTest {
  id            String       @id @default(cuid())
  userId        String
  status        AttemptStatus @default(IN_PROGRESS)
  questionCount Int          @default(30)
  startedAt     DateTime     @default(now())
  completedAt   DateTime?
  /// [{questionId, userAnswer, isCorrect, dimension, responseMs}]
  answers       Json?
  /// {vocabulary, grammar, reading, listening, overall} 0-100
  scores        Json?
  cefrLevel     CEFRLevel?
  /// {cet4, cet6}
  cetEstimate   Json?
  /// AI 报告 {strengths[], problems[], suggestions[], etaWeeks}
  aiReport      Json?
  aiDegraded    Boolean      @default(false)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userId, completedAt])
  @@map("placement_tests")
}

// =============================================================================
// DOMAIN 4 · EXAM — 考试域
// =============================================================================

model ExamPaper {
  id          String       @id @default(cuid())
  title       String
  examType    ExamType
  year        Int?
  /// 总分：CET 710
  totalScore  Int          @default(710)
  durationMin Int          @default(125)
  /// [{section, title, durationMin, questionRefs[]}] 卷面结构
  structure   Json?
  description String?
  /// 是否真题
  isRealPast  Boolean      @default(false)
  status      PublishStatus @default(PUBLISHED)
  createdBy   String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  questions ExamQuestion[]
  attempts  ExamAttempt[]

  @@index([examType, status])
  @@map("exam_papers")
}

model ExamQuestion {
  id             String       @id @default(cuid())
  paperId        String
  questionId     String?
  section        ExamSection
  type           QuestionType
  stem           String
  options        Json?
  answer         String?
  answerAliases  Json?
  explanation    String?
  /// 关联音频/文章：{audioUrl, articleId, passage}
  material       Json?
  score          Float        @default(0)
  knowledgePoints Json?
  sortOrder      Int          @default(0)
  /// 是否 AI 阅卷（写作/翻译主观题）
  needsAiGrading Boolean      @default(false)

  paper    ExamPaper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  question Question?  @relation(fields: [questionId], references: [id])

  @@index([paperId, section, sortOrder])
  @@map("exam_questions")
}

model ExamAttempt {
  id           String        @id @default(cuid())
  userId       String
  paperId      String
  status       AttemptStatus @default(IN_PROGRESS)
  startedAt    DateTime      @default(now())
  /// 服务端倒计时基准：倒计时一律以服务端时间为准（PRD §9.4-4）
  deadlineAt   DateTime?
  submittedAt  DateTime?
  timeUsedSec  Int           @default(0)
  objectiveScore Float       @default(0)
  subjectiveScore Float      @default(0)
  totalScore   Float         @default(0)
  /// {listening, reading, writing, translation} 分项分（CET 换算）
  sectionScores Json?
  /// {cet4, cet6} 换算后的 710 分制
  cetEstimate  Json?
  aiDegraded   Boolean       @default(false)
  /// 自动保存自增版本，乱序到达保护
  saveVersion  Int           @default(0)
  ip           String?
  userAgent    String?

  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  paper   ExamPaper    @relation(fields: [paperId], references: [id], onDelete: Cascade)
  answers ExamAnswer[]
  wrongQuestions WrongQuestion[]

  @@index([userId, status, startedAt])
  @@index([userId, paperId])
  @@map("exam_attempts")
}

model ExamAnswer {
  id             String   @id @default(cuid())
  attemptId      String
  examQuestionId String
  userAnswer     String?  @db.Text
  isCorrect      Boolean?
  score          Float    @default(0)
  /// AI 主观题评分 {score, dimensions[], comments[]}
  aiScore        Json?
  aiFeedback     String?
  flagged        Boolean  @default(false)
  answeredAt     DateTime?
  savedAt        DateTime @default(now())

  attempt      ExamAttempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  examQuestion ExamQuestion @relation(fields: [examQuestionId], references: [id], onDelete: Cascade)

  @@unique([attemptId, examQuestionId])
  @@index([attemptId, flagged])
  @@map("exam_answers")
}

model WrongQuestion {
  id             String   @id @default(cuid())
  userId         String
  source         String // exam | quiz | grammar | vocab | listening | reading | challenge
  attemptId      String?
  refType        String? // question | exam_question | listening_question | reading_question | grammar_question
  refId          String?
  stem           String   @db.Text
  options        Json?
  userAnswer     String?
  correctAnswer  String?
  explanation    String?
  knowledgePoints Json?
  /// A13 AI 分类：vocab | grammar | comprehension | careless | knowledge_gap
  aiCategory     String?
  aiReason       String?
  aiExplanation  String?
  aiClassified   Boolean  @default(false)
  errorCount     Int      @default(1)
  lastWrongAt    DateTime @default(now())
  masteredAt     DateTime?
  isFavorite     Boolean  @default(false)
  createdAt      DateTime @default(now())

  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  attempt ExamAttempt? @relation(fields: [attemptId], references: [id])

  @@index([userId, masteredAt, lastWrongAt])
  @@index([userId, source, masteredAt])
  @@index([userId, aiCategory])
  @@map("wrong_questions")
}

// =============================================================================
// DOMAIN 5 · REVIEW & GAMIFICATION — 复习与激励域
// =============================================================================

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  /// word | sentence | article | question | grammar | writing | conversation | translation
  targetType String
  targetId  String
  /// 快照标题，避免列表时多次 join
  title     String?
  note      String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, targetType, targetId])
  @@index([userId, targetType, createdAt])
  @@map("favorites")
}

model Achievement {
  id          String              @id @default(cuid())
  code        String              @unique
  name        String
  description String?
  iconUrl     String?
  category    AchievementCategory
  /// 解锁条件 {metric:'streak_days', operator:'>=', value:7}
  condition   Json
  xpReward    Int                 @default(0)
  /// 是否隐藏（彩蛋成就）
  isHidden    Boolean             @default(false)
  sortOrder   Int                 @default(0)

  unlocks UserAchievement[]

  @@index([category, sortOrder])
  @@map("achievements")
}

model UserAchievement {
  id            String   @id @default(cuid())
  userId        String
  achievementId String
  /// 进度快照 {current, target}
  progress      Json?
  isNotified    Boolean  @default(false)
  unlockedAt    DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)

  @@unique([userId, achievementId])
  @@index([userId, unlockedAt])
  @@map("user_achievements")
}

model Notification {
  id          String           @id @default(cuid())
  userId      String
  type        NotificationType
  title       String
  content     String?
  /// 深链 {route:'/vocabulary/review', params:{}}
  deepLink    Json?
  channel     Channel          @default(IN_APP)
  isRead      Boolean          @default(false)
  readAt      DateTime?
  scheduledAt DateTime?
  sentAt      DateTime?
  createdAt   DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead, createdAt])
  @@index([userId, type])
  @@map("notifications")
}

// =============================================================================
// DOMAIN 6 · AI
// =============================================================================

model AiConversation {
  id           String           @id @default(cuid())
  userId       String
  type         ConversationType @default(TUTOR)
  title        String?
  /// {roleKey, sceneKey, level, goal}
  context      Json?
  messageCount Int              @default(0)
  tokensUsed   Int              @default(0)
  lastMessageAt DateTime?
  isFavorite   Boolean          @default(false)
  deletedAt    DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages         AiMessage[]
  speakingSession  SpeakingSession?

  @@index([userId, type, lastMessageAt])
  @@index([userId, deletedAt, updatedAt])
  @@map("ai_conversations")
}

model AiMessage {
  id             String      @id @default(cuid())
  conversationId String
  role           MessageRole
  content        String      @db.Text
  /// 结构化附加数据：Insights / four-part answer structure
  structured     Json?
  tokensPrompt   Int         @default(0)
  tokensCompletion Int       @default(0)
  model          String?
  provider       String?
  latencyMs      Int         @default(0)
  /// 首 token 延迟
  firstTokenMs   Int         @default(0)
  isStreamed     Boolean     @default(false)
  isFavorite     Boolean     @default(false)
  /// 降级标记：本条为兜底内容
  degraded       Boolean     @default(false)
  errorCode      String?
  createdAt      DateTime    @default(now())

  conversation AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@map("ai_messages")
}

/// Prompt 版本管理：后台可编辑 + 灰度
model AiPrompt {
  id            String        @id @default(cuid())
  /// 能力唯一标识，见 AiCapability
  key           String
  version       Int
  title         String
  systemPrompt  String        @db.Text
  /// Handlebars 风格模板 {{variable}}
  userTemplate  String        @db.Text
  /// 模板变量声明 [{name, required, description}]
  variables     Json?
  /// {model, temperature, maxTokens, topP}
  modelOverrides Json?
  status        PromptStatus  @default(DRAFT)
  /// 灰度流量比例 0-100，仅 ACTIVE 生效
  trafficRatio  Int           @default(100)
  /// 输出 Zod schema 名，对应 src/services/ai/schemas/*.ts
  outputSchema  String?
  createdBy     String?
  publishedAt   DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  callLogs AiCallLog[]

  @@unique([key, version])
  @@index([key, status])
  @@map("ai_prompts")
}

model AiCapabilityConfig {
  id            String       @id @default(cuid())
  capability    AiCapability
  providerKey   String
  model         String
  enabled       Boolean      @default(true)
  /// 降级总开关：关闭则永远走 fallback
  fallbackEnabled Boolean    @default(true)
  temperature   Float        @default(0.7)
  maxTokens     Int          @default(2048)
  timeoutMs     Int          @default(30000)
  /// 流式首 token 超时（针对流式能力）
  firstTokenTimeoutMs Int    @default(3000)
  maxRetries    Int          @default(1)
  /// 单用户日调用上限，null = 不限
  dailyQuotaUser Int?
  /// 全局日调用上限
  dailyQuotaGlobal Int?
  isStreaming   Boolean      @default(false)
  /// 是否缓存结构化结果（按 inputHash）
  cacheEnabled  Boolean      @default(true)
  updatedBy     String?
  updatedAt     DateTime     @updatedAt

  callLogs AiCallLog[]

  @@unique([capability])
  @@map("ai_capability_config")
}

model AiCallLog {
  id            String        @id @default(cuid())
  userId        String?
  capability    AiCapability
  status        AiCallStatus
  errorCode     String?
  errorMessage  String?
  inputTokens   Int           @default(0)
  outputTokens  Int           @default(0)
  /// 成本估算（单位：分）
  costCents     Int           @default(0)
  latencyMs     Int           @default(0)
  firstTokenMs  Int?
  /// 是否命中结果缓存
  cacheHit      Boolean       @default(false)
  /// 是否走了降级兜底
  degraded      Boolean       @default(false)
  /// input 的 sha256 前 32 位，用于缓存与去重
  requestHash   String?
  traceId       String?
  ip            String?
  createdAt     DateTime      @default(now())

  /// 直接关联到具体 Prompt 版本（单一 FK，避免复合可选关系的兼容性问题）
  promptId  String?
  /// 冗余快照，即使 Prompt 被删除报表仍可读
  promptKey     String?
  promptVersion Int?
  /// 关联到能力配置（单一 FK）
  configId  String?
  provider      String?
  model         String?

  user   User?               @relation(fields: [userId], references: [id])
  prompt AiPrompt?           @relation(fields: [promptId], references: [id])
  config AiCapabilityConfig? @relation(fields: [configId], references: [id])

  @@index([userId, createdAt])
  @@index([capability, createdAt])
  @@index([createdAt])
  @@index([status, createdAt])
  @@map("ai_call_logs")
}

// =============================================================================
// DOMAIN 7 · OPS — 运营与合规
// =============================================================================

model Subscription {
  id          String             @id @default(cuid())
  userId      String
  plan        SubscriptionPlan   @default(FREE)
  status      SubscriptionStatus @default(ACTIVE)
  startedAt   DateTime           @default(now())
  expiresAt   DateTime?
  orderNo     String?            @unique
  /// AI 日调用配额覆盖（null=跟随 plan 默认）
  aiDailyQuota Int?
  source      String?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@map("subscriptions")
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String
  action     String // user.disable | content.publish | ai.config.update | role.grant
  targetType String
  targetId   String?
  before     Json?
  after      Json?
  reason     String?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())

  actor User @relation(fields: [actorId], references: [id], onDelete: Cascade)

  @@index([actorId, createdAt])
  @@index([targetType, targetId])
  @@index([createdAt])
  @@map("audit_logs")
}
```


### 2.5 关键设计说明

#### 2.5.1 枚举清单（Prisma enum ↔ TS ↔ Zod 三方同源）

| 枚举 | 取值 | 用途 |
| --- | --- | --- |
| `Role` | `USER` `TEACHER` `ADMIN` | RBAC |
| `UserStatus` | `ACTIVE` `DISABLED` `PENDING` `DELETED` | 账号状态 |
| `CEFRLevel` | `A1` `A2` `B1` `B2` `C1` `C2` | 欧洲语言等级 |
| `MasteryStage` | `NEW` `STRANGER` `LEARNING` `FAMILIAR` `PROFICIENT` `MASTERED` | SRS 六状态（未学习/陌生/初步掌握/熟悉/熟练/完全掌握） |
| `GoalType` | `CET4` `CET6` `KAOYAN` `IELTS` `TOEFL` `DAILY` `BUSINESS` `INTEREST` `ABROAD` | 学习目的 |
| `ExamType` | 同 `GoalType` + `MOCK` `CUSTOM` `PLACEMENT` | 试卷/ manufacturing |
| `Difficulty` | `EASY` `MEDIUM` `HARD` | 难度三档 |
| `QuestionType` | `SINGLE_CHOICE` `MULTI_CHOICE` `TRUE_FALSE` `FILL_BLANK` `CLOZE` `MATCHING` `SHORT_ANSWER` `ESSAY` `TRANSLATION` `DICTATION` `RETELL` `SUMMARY` | 通用题型 |
| `PublishStatus` | `DRAFT` `PENDING_REVIEW` `PUBLISHED` `OFFLINE` `REJECTED` | 内容审核流（PRD Q3） |
| `PlanSource` | `AI` `RULE` `MANUAL` | 计划来源（降级可追溯） |
| `PlanStatus` | `ACTIVE` `PAUSED` `COMPLETED` `ARCHIVED` | 计划状态 |
| `TaskType` | `VOCAB` `REVIEW` `LISTENING` `READING` `WRITING` `SPEAKING` `GRAMMAR` `TRANSLATION` `EXAM` | 任务类型 |
| `TaskStatus` | `PENDING` `IN_PROGRESS` `COMPLETED` `SKIPPED` `EXPIRED` | 任务状态 |
| `ExamSection` | `LISTENING` `READING` `WRITING` `TRANSLATION` | 卷面分区 |
| `AttemptStatus` | `IN_PROGRESS` `SUBMITTED` `GRADING` `GRADED` `ABANDONED` `EXPIRED` | 考试态 |
| `AiCapability` | 见 §4.2 的 18 项 | AI 能力唯一标识 |
| `AiCallStatus` | `SUCCESS` `ERROR` `TIMEOUT` `DEGRADED` `RATE_LIMITED` `CONTENT_BLOCKED` | AI 调用结果 |
| `MessageRole` | `USER` `ASSISTANT` `SYSTEM` | 对话角色 |
| `ConversationType` | `TUTOR` `SPEAKING_PARTNER` `WORD_EXPLAINER` `GRAMMAR_EXPLAINER` `READING_EXPLAINER` | 会话类型 |
| `NotificationType` | `STUDY_REMINDER` `REVIEW_REMINDER` `PLAN_REMINDER` `EXAM_REMINDER` `STREAK_REMINDER` `ACHIEVEMENT` `SYSTEM` | 通知 5 类 + 2 |
| `AchievementCategory` | `STREAK` `VOCABULARY` `STUDY_TIME` `EXAM` `WRITING` `SPEAKING` `LISTENING` `READING` `SPECIAL` | 成就分类 |
| `SubscriptionPlan` | `FREE` `PRO` `PREMIUM` | 订阅 |
| `ReviewSource` | `LEARN` `REVIEW` `QUIZ` `EXAM` `NOTEBOOK` `CHALLENGE` | 行为来源 |

#### 2.5.2 JSON 字段使用边界（硬性约定）

| 允许用 Json | 禁止用 Json |
| --- | --- |
| 结构不稳定/多语言多形态（AI 输出、第三方平台配置、评分明细） | 需要被 WHERE / JOIN / ORDER BY 的字段 |
| 嵌套变长子集合且不做条件查询（例句、字幕轴、仅供富端渲染的 `options[]`） | 需要参与聚合统计的数值（时长、分数、计数） |
| 冷数据快照（`before`/`after` 审计、`corrections[]`） | 高频更新字段（放独立列，避免 JSONB 整重写放大 WAL） |

**规则**：凡热路径查询/排序/聚合字段，一律提升为独立列（例：`writing_submissions.aiTotalScore Int?` 与 `aiScores Json?` 并存，前者用于列表排序，后者用于详情渲染）。

#### 2.5.3 索引策略（按热路径）

| 热路径 | 查询 | 索引 |
| --- | --- | --- |
| 今日待学/待复习词 | `userId + nextReviewAt <= now`，按 SRS 到期排序 | `user_vocabulary(userId, nextReviewAt)` `@@index([userId, nextReviewAt])` |
| 今日任务列表 | `userId + date` | `study_tasks(userId, date, status)` |
| Dashboard 聚合 | `userId + date` 单日 | `daily_learning_stats(userId, date) UNIQUE` |
| 错题本 | `userId + masteredAt is null`，按 `lastWrongAt desc` | `wrong_questions(userId, masteredAt, lastWrongAt)` |
| 应收 talk AI 历史 | `userId + type + lastMessageAt desc` | `ai_conversations(userId, type, lastMessageAt)` |
| AI 用量报表 | `capability + createdAt` 分日聚合 | `ai_call_logs(capability, createdAt)` |
| 学习记录时间线 | `userId + occurredAt desc` | `learning_records(userId, activityType, occurredAt)` |
| 考试正在进行的作答 | `userId + status` | `exam_attempts(userId, status, startedAt)` |
| 收藏查重 | `userId + targetType + targetId` | `favorites` UNIQUE |
| 词库/题目分页筛选 | `type + difficulty + status` | `questions(type, difficulty, status)` |

> **局部索引（PG-only）**：SQLite 逃生通道下不可用，Phase 1 不引入。软删统一通过 `deletedAt: null` 普通复合索引前缀处理。

#### 2.5.4 聚合策略决策：**预聚合为主 + 实时 SQL 补冷路径**

| 场景 | 决策 | 理由 |
| --- | --- | --- |
| Dashboard 今日进度环 / Streak / 30 天日历 / 热力图 | **预聚合** `daily_learning_stats`（每学习事件 upsert 增量） | 首屏 ≤3s（M5），实时算要扫百万级 `learning_records` |
| Analytics 趋势（7/30/90/全部） | **预聚合** 按日 SUM；>90 天在日表上再滚动 GROUP BY | 日表行数可控（userId × 天数） |
| 能力雷达 / 掌握度分布 | 混合：`profiles` 缓存最近值 + 每 24h 重算；写入稀疏、读多写少；需要即时状态时走实时 SQL | 写入稀疏，读多写少 |
| Admin 多维报表、留存漏斗、CSV 导出 | **实时 raw SQL** + 异步任务 + 结果写临时文件 | 低频、后台、允许慢 |
| 排行榜 | 基于 `daily_learning_stats` 窗口 SUM + 300s 缓存 | 周/月榜数据量小 |

**写入保证**：`lib/db.ts` 提供 `tx()` 事务包装；`daily_learning_stats` 的 upsert 必须在**同一事务**内伴随明细写入，失败则整体回滚，不允许出现明细已写汇总未写的漂移。提供 `npm run stats:rebuild -- --userId=xxx` 校正脚本。

### 2.6 开发期数据库启动方案（三档决策树）

> **已确认的环境事实（本机实测，2026-09-27）**：Windows 10/11 · Node **v22.22.2**（团队基线见 §9.7）· npm **10.9.7** · npm registry 已是 `https://registry.npmmirror.com` · **Docker 未安装** · **PostgreSQL 未安装（无 psql）** · 项目路径 `D:/徐浩然/2026-09-26-21-59-15/englishai`（**含中文字符**，已实测兼容）。
>
> 因此"用 `docker compose up -d db` 起 PG"这条常规路径**在本机不可用**，必须走下面的 Tier A。

| 档位 | 方案 | 是否需要系统安装 | schema 一致性 | 定位 |
| --- | --- | --- | --- | --- |
| **Tier A** ★默认 | **npm 内嵌真实 PostgreSQL**（`embedded-postgres`，PG 18.4 真实二进制） | **否（零安装）** | **与生产 100% 一致**（`provider = "postgresql"`） | **开发默认** |
| **Tier C** | 云 PG（Neon / Supabase 免费版） | 否（仅需注册账号） | 一致 | 网络异常 / 需要团队共享同一库时 |
| **Tier B** | SQLite | 否 | **有差异**（enum/Json 降级为 String） | **最后手段**，仅当 A、C 都不可用 |

**决策树**

```mermaid
graph TD
    START["npm run db:start"] --> A{"Tier A<br/>embedded-postgres 可用?"}
    A -->|"已实测通过 ✅<br/>PG 18.4 / 0 系统安装"| AOK["用 127.0.0.1:5433<br/>provider=postgresql<br/>schema 与生产一致"]
    A -->|"二进制下载失败<br/>(企业代理/墙)"| C{"有 Neon/Supabase 账号?"}
    C -->|有| COK["填 DATABASE_URL(sslmode=require)<br/>业务代码零改动"]
    C -->|无 / 不想注册| BOK["Tier B: SQLite<br/>npm run prisma:sqlite<br/>接受 enum/Json 降级"]
    AOK --> DEV["npm run db:migrate && npm run db:seed<br/>→ npm run dev"]
    COK --> DEV
    BOK --> DEV
```

---

#### 2.6.1 Tier A · npm 内嵌真实 PostgreSQL（开发默认，**已实测通过**）

##### ① 方案取舍

| 候选 | 内容 | 结论 |
| --- | --- | --- |
| **`embedded-postgres`** | npm 包 → 拉 `@embedded-postgres/windows-x64`（含完整 PG 18.4 Windows 二进制、`initdb`/`pg_ctl`/`postgres.exe`）；Node API 直接 `initialise()/start()/stop()` | ✅ **选作默认**：一条 `npm i` 搞定，跨平台、无手工下载、无 PATH 配置，且已被实测 |
| 「脚本下载 PostgreSQL 官方 Windows zip → 解压到 `.data/pg` → `initdb`」 | 官方 `postgresql-18.x-windows-x64-binaries.zip`（约 340MB），自写下载/解压/initdb 脚本 | ⬜ **备选**：不依赖任何 npm 包、不依赖 beta 版本；但需自写下载与解压逻辑，且下载源在国内不稳。**仅当 `embedded-postgres` 不可用时启用** |

##### ② ★实测结果（真实输出，非推断）

| 项目 | 实测值 |
| --- | --- |
| 安装命令 | `npm i embedded-postgres@18.4.0-beta.17 pg@8 --registry https://registry.npmmirror.com` |
| 安装耗时 | **29 秒**（17 个包） |
| 二进制包 | `@embedded-postgres/windows-x64@18.4.0-beta.17` 存在 ✅ |
| 磁盘占用 | `node_modules/@embedded-postgres` = **107 MB**；初始化后数据目录 `.data/pg` = **48 MB**（写入数据后 ~72 MB） |
| **`SELECT version()` 真实返回** | **`PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35226, 64-bit`** ✅ |
| 数据目录编码 | `server_encoding = UTF8` ✅ |
| `initdb` 耗时（首次，`--locale=C`） | **13.7 s** |
| `initdb` 耗时（首次，默认中文 locale） | **17.5 s** |
| `postgres` 启动耗时 | **1.7 s ~ 7.0 s**（同一数据目录复用；受 Defender 实时扫描影响有波动） |
| **首次启动总耗时（`npm run db:start` 冷启动）** | **≈ 16 ~ 25 s**（initdb + start + createDatabase） |
| 后续启动（已有数据目录） | **≈ 2 ~ 7 s** |
| **中文路径 `D:/徐浩然/2026-09-26-21-59-15/` 兼容性** | **✅ 完全正常** —— `initdb` 成功创建集群、`pg_ctl` 正常启停、监听 127.0.0.1 成功。（唯一副作用：`initdb` 提示 `could not find suitable text search configuration for locale "Chinese (Simplified)_China.utf8"`，属**信息级提示**，非错误；且**加 `--locale=C` 后消失，并额外获得 `default_text_search_config = pg_catalog.english`**，对英文全文检索更有利） |
| **Prisma 6.19.3 集成** | ✅ **成功**：`npx prisma db push` → `Your database is now in sync with your Prisma schema. Done in 1.20s`；Prisma Client 写入含 **原生 enum**、**JSONB（含 `definitions->0->>'zh'` 路径查询）**、1-1 关联、`@@unique([userId,vocabularyId])`、`@@index([userId,nextReviewAt])` 热路径到期查询 —— 全部正确执行，返回 `SMOKE=SUCCESS` |
| Prisma engine 下载 | ✅ 无需额外镜像配置即成功（`@prisma/engines` 由 npmmirror 正常分发；`libquery-engine-windows.dll.node`、`schema-engine-windows.exe` 均就位） |

**⚠️ 实测中发现的两个真实坑（已纳入守护脚本设计）**

1. **`initialise()` 不是幂等的**：数据目录若非空（尤其是上一次被中断留下的半成品 `.pgdata`），`initdb` 直接报 `directory ... exists but is not empty`（code 1）。→ **守护脚本必须先用 `PG_VERSION` 文件判断"是否已初始化"**，已初始化则跳过 `initialise()`。
2. **`createDatabase(name)` 不是幂等的**：库已存在会抛错。→ 必须 `try/catch` 吞掉"already exists"。

**⚠️ beta 版本依赖的风险与缓解**

`embedded-postgres` 的 **174 个发行版全部是 `-beta.N` 预发布标签，从未发布 stable**（`dist-tags.latest` = `18.4.0-beta.17`）。它跟随上游 PG 版本号走 beta 后缀，属该项目的一贯做法，非"半成品"，但仍是风险：

| 风险 | 缓解措施 |
| --- | --- |
| 预发布版本不够"合规" | **精确锁定版本号** `"embedded-postgres": "18.4.0-beta.17"`（**不加 `^` / `~`**，见 §9.6），并在 `package.json` 里用 `optionalDependencies` 之外单独一段注释标注"开发专用，可摘除" |
| 上游发新 beta 引入不兼容 | 锁定后 npm 不会自动升级；升级需人工有意识执行并在 README 记录 |
| 商用合规审查不认可 beta 依赖 | 该依赖**仅在 `devDependencies`**，生产 `Dockerfile` 的 `runner` 阶段**完全不安装**（生产走外部 PG），对产物零影响 |
| 需要一键回退 | `npm run db:use-sqlite` / `npm run db:use-cloud` 两个脚本切换 `.env` 中的 `DB_DRIVER` 与 `DATABASE_URL`，**无需改任何业务代码** |

##### ③ 关键确认：schema 与生产 100% 一致

```prisma
// prisma/schema.prisma —— 三种 Tier 下这一行都不变
datasource db {
  provider = "postgresql"          // ← 始终是 postgresql，绝不改成 sqlite
  url      = env("DATABASE_URL")   // ← 只换这个变量值
}
```

| Tier | `DATABASE_URL` | `provider` |
| --- | --- | --- |
| A（本地内嵌） | `postgresql://englishai:englishai@localhost:5433/englishai?schema=public` | `postgresql` |
| C（云 PG） | `postgresql://user:pwd@xxx.neon.tech/englishai?sslmode=require&pgbouncer=true` | `postgresql` |
| B（SQLite） | `file:./dev.db`（配合 `prisma/schema.sqlite.prisma`） | `sqlite`（**仅此档**） |

> **切生产只改一行 env**，不需要改 schema、不需要改 service、不需要改任何查询。

##### ④ 落地细节

| 项 | 约定 |
| --- | --- |
| 数据目录 | **`.data/pg`**（`.gitignore` 必须包含 `.data/`） |
| 监听端口 | **`5433`**（避开系统上可能存在的 5432；docker-compose 的 PG 也映射 `5433:5432`，两条路径互相兼容） |
| 连接串 | `postgresql://englishai:englishai@localhost:5433/englishai?schema=public` |
| 认证方式 | `scram-sha-256`（与生产一致，避免"只支持 password 认证"的坑） |
| initdb 参数 | `['--encoding=UTF8', '--locale=C']` —— `--locale=C` 可消除中文 locale 警告并获得 `pg_catalog.english` 全文检索配置 |
| 数据库名 | `englishai`（开发）+ `englishai_test`（集成测试用，`vitest` 连它） |
| PID / 单例 | pid 文件 `.data/pg.pid`；启动前检测端口占用与 pid 存活，已在跑则**直接 exit 0**（可重复执行） |
| 进程退出策略 | 前台运行（`npm run db:start` 独占一个终端，Ctrl+C 优雅 stop）；另提供 `npm run db:start -- -d` 分离模式；**绝不 `persistent: false`**（会删库） |

**守护脚本设计（`scripts/pg-daemon.mjs`）**

```js
// scripts/pg-daemon.mjs —— 单例守护：已初始化则跳过 initdb；已在跑则直接退出
import path from 'node:path'
import fs from 'node:fs'
import EmbeddedPostgres from 'embedded-postgres'

const ROOT      = path.resolve(process.cwd())
const DATA_DIR  = path.join(ROOT, '.data', 'pg')
const PID_FILE  = path.join(ROOT, '.data', 'pg.pid')
const PORT      = Number(process.env.PG_PORT ?? 5433)
const USER      = 'englishai'
const DB        = 'englishai'
const TEST_DB   = 'englishai_test'

const isInitialised = () => fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))   // 坑① 的解法
const pidAlive = () => {
  try { const pid = Number(fs.readFileSync(PID_FILE, 'utf8')); process.kill(pid, 0); return true }
  catch { return false }
}

fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true })

if (pidAlive()) { console.log('[db] already running (pid file) → skip'); process.exit(0) }

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: USER,
  password: USER,
  persistent: true,                          // 绝不要 false：false 会在 stop() 时删库
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (m) => process.stdout.write(`[pg] ${String(m).trim()}\n`),
  onError: (m) => process.stderr.write(`[pg-err] ${String(m).trim()}\n`),
})

if (!isInitialised()) {
  console.log('[db] initialising cluster at', DATA_DIR, '(first run, ~14-18s)')
  await pg.initialise()
} else {
  console.log('[db] existing cluster found → skip initdb')
}

await pg.start()
fs.writeFileSync(PID_FILE, String(process.pid))

for (const name of [DB, TEST_DB]) {
  try { await pg.createDatabase(name) } catch (e) { /* 坑②：already exists，忽略 */ }
}

const ping = pg.getPgClient(DB, 'localhost')
await ping.connect()
const { rows } = await ping.query('SELECT version() AS v, current_database() AS db')
await ping.end()
console.log(`[db] READY ${rows[0].db} → ${rows[0].v}`)
console.log(`[db] DATABASE_URL=postgresql://${USER}:${USER}@localhost:${PORT}/${DB}?schema=public`)

const shutdown = async () => { try { await pg.stop() } catch {} fs.rmSync(PID_FILE, { force: true }); process.exit(0) }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
```

**npm scripts 全集（`package.json`）**

```jsonc
{
  "scripts": {
    "db:start":      "node scripts/pg-daemon.mjs",                 // 前台起 PG（Ctrl+C 停）
    "db:start:bg":   "node scripts/pg-daemon.mjs > .data/pg.log 2>&1 &",  // 后台起（Git Bash）
    "db:stop":       "node scripts/pg-stop.mjs",                   // 读 pid 文件优雅 stop
    "db:status":     "node scripts/pg-status.mjs",                 // 打印：是否已初始化/是否在跑/版本/端口/库大小
    "db:migrate":    "prisma migrate dev",
    "db:deploy":     "prisma migrate deploy",
    "db:seed":       "tsx prisma/seed/index.ts",
    "db:reset":      "prisma migrate reset --force && npm run db:seed",
    "db:studio":     "prisma studio",
    "db:push":       "prisma db push",
    "prisma:sqlite": "tsx scripts/gen-sqlite-schema.ts",
    "db:use-sqlite": "tsx scripts/use-driver.ts sqlite",
    "db:use-cloud":  "tsx scripts/use-driver.ts cloud",
    "dev":           "npm run db:status && next dev -p 3000"
  }
}
```

> **`.gitignore` 必含**：`.data/`（PG 数据目录 + pid + log）、`prisma/dev.db*`、`.env.local`。

##### ⑤ 首次启动耗时预估与失败诊断

| 阶段 | 耗时 | 说明 |
| --- | --- | --- |
| `npm i embedded-postgres@18.4.0-beta.17` | **29 s**（实测，npmmirror） | 下载 107MB 平台包 |
| `npm run db:start` 首次（initdb + start + create db） | **16 ~ 25 s** | 其中 initdb 13.7 s（`--locale=C`） |
| `npm run db:start` 后续 | **2 ~ 7 s** | 直接 start |
| `npm run db:migrate`（52 表首次） | 预计 **5 ~ 15 s** | 52 表 + 索引 |
| `npm run db:seed` | 预计 **30 ~ 90 s** | 5000 词 + 内容 + AI Prompt |

**失败诊断步骤（按序排查）**

| 症状 | 原因 | 处置 |
| --- | --- | --- |
| `npm i` 卡在下载 / ETIMEDOUT | npmmirror 未生效或企业代理拦截 | 确认 `.npmrc` 的 `registry`；或 `npm i --registry=https://registry.npmmirror.com`；极端情况网络不可达 → 转 **Tier C** |
| `initdb: error: directory ... exists but is not empty` | **坑①**：上次中断留下半成品数据目录 | `rmdir /s /q .data\pg`（Windows）或 `Remove-Item -Recurse -Force .data\pg`，再 `npm run db:start`。**不要手工往数据目录里放任何文件** |
| `could not find suitable text search configuration for locale "Chinese (Simplified)_China.utf8"` | 中文 locale 无对应 PG 全文配置 | **信息级提示，可忽略**；已在设计里加 `--locale=C` 消除 |
| `Port 5433 is already in use` / `could not bind` | 端口被占用（另一个 PG 实例 / 残留进程） | `npm run db:status` 查看；`netstat -ano \| findstr :5433`；kill 对应 pid 或改 `PG_PORT` |
| `initdb: could not access directory ... Permission denied` | 数据目录权限 / 杀软锁定 | 确认 `.data` 无只读属性；把项目目录加入 Windows Defender 排除列表（**同时显著加速 initdb 与 postgres 启动**） |
| `EACCES` / `spawn ENOENT` / 路径乱码 | **中文路径**（实测已确认**可正常工作**，但个别工具链仍可能异常） | 建目录联接绕开：`mklink /J D:\work\englishai "D:\徐浩然\2026-09-26-21-59-15\englishai"`，改在 `D:\work\englishai` 开发（**保留为兜底手段，非默认建议**） |
| `prisma generate` 报文件写入/删除失败 | 杀软/沙箱拦截 `node_modules/.prisma` 覆盖写 | 关闭实时防护或换目录；sandbox 环境下可先删除 `node_modules/.prisma` 再 `npx prisma generate` |
| Prisma 报 `Can't reach database server at localhost:5433` | PG 未起 / 已退出 | `npm run db:status`；确认守护进程还活着（**不要在 `db:start` 的终端里 Ctrl+C 后再跑 migrate**） |

---

#### 2.6.2 Tier C · 云 PostgreSQL（Neon / Supabase 免费版）

无需任何本地二进制，**业务代码与 schema 零改动**。

```bash
# 1) 在 neon.tech 或 supabase.com 建免费库，复制连接串
# 2) 写入 .env.local
DATABASE_URL="postgresql://<user>:<pwd>@<host>/englishai?sslmode=require&pgbouncer=true"
DB_DRIVER=postgres
# 3) 直接跑迁移（无需 db:start）
npm run db:deploy && npm run db:seed && npm run dev
```

| 注意 | 说明 |
| --- | --- |
| `sslmode=require` | 云 PG 必须，缺了会报 SSL 错误 |
| `pgbouncer=true` | 使用连接池（Neon/Supabase 必开），否则 52 表迁移期间易打满连接 |
| 迁移用 `migrate deploy` | 云库用 `migrate dev` 可能因连接池 + 影子库权限失败；**生产与云库统一用 `migrate deploy`** |
| 时区 | 云库默认 UTC，与本项目"全 UTC 存储 + 用户时区派生本地日期"的设计一致 ✅ |

---

#### 2.6.3 Tier B · SQLite（最后手段）

> **立场**：SQLite 只是"让项目跑起来"的开发降级，**不改构图、不改业务代码**。仅在 Tier A 与 Tier C 均不可用时使用。

**启用方式（三步）**

1. `npm run prisma:sqlite` → 由 `scripts/gen-sqlite-schema.ts` 从 `prisma/schema.prisma` 机械转换，输出 `prisma/schema.sqlite.prisma`：
   - 删除所有 `enum X { ... }` 块，且把所有 `X` 类型字段改写为 `String`（并追加 `// was enum: X` 注释）
   - `Json` → `String`（业务层用 `safeJsonParse/safeJsonStringify` 适配，见 §10.6）
   - 移除 `@db.*` 原生类型注解
   - `datasource provider` → `sqlite`，`url = env("DATABASE_URL_SQLITE")`
2. `.env` 中设置 `DATABASE_URL_SQLITE="file:./dev.db"` 并切换 env 开关 `DB_DRIVER=sqlite`（`lib/db.ts` 依据该开关选用 schema 目录）。**也可用 `npm run db:use-sqlite` 自动切换**。
3. `npx prisma migrate dev --schema prisma/schema.sqlite.prisma --name init`

**已知不兼容清单**（工程师必须知晓）

| 特性 | SQLite 表现 | 应对 |
| --- | --- | --- |
| `enum` | 不支持 → 转为 String，DB 层不做值校验 | Zod 在应用层校验（与正常路径行为一致） |
| `Json` | 不支持 → 转 String | `lib/utils/safe-json.ts` 适配读写（**所有 Json 字段必须经此适配**） |
| `String[]` | 不支持 | 本项目**已禁用 scalar list**，无影响 |
| 并发写 | 写锁串行，高并发 SQLite 报 `database is locked` | 开发期单实例足够；出现即 "SQLITE_BUSY" 由 Prisma 重试处理 |
| `@db.Timestamptz` / `citext` / 部分索引 | 不支持 | Phase 1 未引入 |
| `@@index` 中的 `Json` 字段 | 不支持 | 无 |
| `Decimal` 精度 | SQLite 用 REAL | 本项目金额用 Int，无影响 |
| 全文检索 | 无 `tsvector` | 开发期 `q=` 搜索退化为 `contains` 模糊匹配 |

> **回退路径**：若 SQLite 档位下出现 Prisma 迁移或 JSON/枚举相关问题，请立即切回 **Tier A**（首选）或 **Tier C**，不要试图修补 SQLite 差异 —— SQLite 只是保底，不是目标环境。

---

## 三、API 设计

### 3.1 统一响应 Envelope

```ts
// src/types/api.ts —— 所有 Route Handler 的唯一返回形态
export interface ApiError {
  code: string            // 见 §3.2 错误码表，如 "AUTH_003"
  message: string         // 面向用户的中文/英文提示（由 i18n 字典按 code 映射）
  details?: unknown       // 字段级校验错误：{ field: string; message: string }[]
}

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  hasNext?: boolean
  hasPrev?: boolean
}

export interface ApiAiMeta {
  degraded: boolean       // true = AI 不可用，data 为兜底内容
  provider?: string
  model?: string
  promptVersion?: number
  latencyMs?: number
  tokensUsed?: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta?: ApiMeta
  ai?: ApiAiMeta
  traceId: string         // 贯穿 middleware → service → ai gateway → db log
}

// 成功/失败构造器（lib/api/response.ts）
export const ok = <T>(data: T, meta?: ApiMeta, ai?: ApiAiMeta): ApiResponse<T> => ({...})
export const fail = (code: string, message?: string, httpStatus?: number): ApiResponse<never> => ({...})
```

**HTTP 状态码映射**

| 场景 | HTTP | `success` | 说明 |
| --- | --- | --- | --- |
| 成功读取 | 200 | true | |
| 成功创建 | 201 | true | register / 新建会话 / 新建作文 / 开始考试 |
| 成功但无内容 | 204 | — | 删除成功（不返回 body） |
| 参数校验失败 | 400 | false | `VALIDATION_ERROR` |
| 未携带 token / token 无效 | 401 | false | `AUTH_TOKEN_MISSING` / `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED` |
| 已登录但权限不足 | 403 | false | `PERM_FORBIDDEN` |
| 资源不存在或不属于当前用户 | 404 | false | `RESOURCE_NOT_FOUND`（越权一律伪装成 404，避免资源枚举） |
| 业务冲突 | 409 | false | 邮箱已注册 / 重复复习提交 / 考试已提交 |
| 内容长度超限 | 413 | false | `CONTENT_TOO_LONG` |
| 频率限制 | 429 | false | `SYS_RATE_LIMIT` / `AI_QUOTA_EXCEEDED` |
| 账号锁定 | 423 | false | `AUTH_ACCOUNT_LOCKED` |
| 服务端异常 | 500 | false | `SYS_INTERNAL`（生产环境不回传堆栈） |
| AI 超时/失败但已降级 | **200** | **true** | `ai.degraded = true`（**非错误**） |
| 上游 AI 不可用 | 503 | false | `AI_UNAVAILABLE`（仅当 `fallbackEnabled=false` 时） |

### 3.2 错误码表（30 个）

| 错误码 | HTTP | 含义 | 前端建议 |
| --- | --- | --- | --- |
| `SUCCESS` | 200 | 成功 | — |
| `SYS_INTERNAL` | 500 | 服务内部错误 | Toast + Retry |
| `SYS_RATE_LIMIT` | 429 | 请求过于频繁 | 倒计时后自动重试 |
| `SYS_MAINTENANCE` | 503 | 系统维护 | 维护页 |
| `SYS_DEPENDENCY_DOWN` | 503 | 数据库等依赖不可用 | 全屏错误 + Retry |
| `VALIDATION_ERROR` | 400 | 入参校验失败 | 字段级红字 |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 | 空态 + 返回 |
| `PERM_FORBIDDEN` | 403 | 无权限 | Toast + 跳 403 |
| `AUTH_TOKEN_MISSING` | 401 | 缺少 token | 跳 `/login` |
| `AUTH_TOKEN_INVALID` | 401 | token 无效 | 清 Cookie + 跳登录 |
| `AUTH_TOKEN_EXPIRED` | 401 | token 过期 | 静默 refresh，失败跳登录 |
| `AUTH_SESSION_REVOKED` | 401 | 会话已撤销（疑似重放） | 强制登出全部设备 |
| `AUTH_BAD_CREDENTIALS` | 401 | 邮箱或密码错误 | 表单错误 + 剩余次数 |
| `AUTH_EMAIL_TAKEN` | 409 | 邮箱已注册 | 引导登录/找回密码 |
| `AUTH_WEAK_PASSWORD` | 400 | 密码强度不足 | 强度提示 |
| `AUTH_ACCOUNT_LOCKED` | 423 | 连续失败被锁定 | 显示解锁时间 |
| `AUTH_ACCOUNT_DISABLED` | 403 | 账号被禁用 | 联系管理员 |
| `AI_UNAVAILABLE` | 503 | AI 服务不可用且未启用降级 | Banner + Retry |
| `AI_QUOTA_EXCEEDED` | 429 | 超过每日 AI 配额 | 显示配额用量 + 明日恢复 |
| `AI_TIMEOUT` | 200 | AI 超时（已降级） | 显示降级内容 |
| `AI_STRUCT_INVALID` | 200 | AI 输出不符合 Schema（已重试后降级） | 显示降级内容 |
| `AI_CONTENT_BLOCKED` | 400 | 内容安全拦截 | 明确安全提示 |
| `AI_CAPABILITY_DISABLED` | 403 | 该能力被后台关闭 | 隐藏入口 |
| `AI_CONCURRENCY_LIMIT` | 429 | 并发超限 | 排队提示 |
| `VOCAB_NO_BOOK_SELECTED` | 400 | 未选词库 | 引导 `/vocabulary/library` |
| `VOCAB_QUEUE_EMPTY` | 200 | 今日无可学/可复习词 | 庆祝空态 + 引导 |
| `EXAM_SAVE_TOO_FREQUENT` | 409 | 自动保存过于频繁 | 静默忽略（本地已存） |
| `EXAM_ALREADY_SUBMITTED` | 409 | 已交卷 | 跳成绩报告 |
| `EXAM_TIME_EXPIRED` | 409 | 倒计时已到 | 强制自动交卷 |
| `CONTENT_TOO_LONG` | 413 | 写作/翻译文本超限 | 字数提示 |

### 3.3 分页 / 筛选 / 排序 / 幂等统一约定

```text
GET /api/vocabulary/records?page=1&pageSize=20&sort=occurredAt:desc&filter[source]=LEARN&q=abandon
```

| 约定 | 规则 |
| --- | --- |
| 分页 | `page` 从 1 开始，默认 20，最大 100；响应 `meta {page,pageSize,total,totalPages,hasNext,hasPrev}` |
| 筛选 | `filter[field]=value`，多值用逗号分隔 `filter[difficulty]=EASY,MEDIUM`；范围用 `filter[createdAt.gte]=...` |
| 排序 | `sort=field:asc|desc`，多字段逗号分隔；**白名单校验**（每个接口在 Zod schema 内声明允许排序的字段，防注入） |
| 搜索 | `q=` 走统一 search 索引（词汇/语法/文章/题目/课程），`types` 限定范围，`limit` 默认 10 |
| 时间范围 | `startDate` / `endDate`（`YYYY-MM-DD`，按用户时区换算），或快捷 `range=7d\|30d\|90d\|all` |
| 幂等 | 写操作支持 `Idempotency-Key` header；服务端以 key 的 sha256 记入 result cache，7 天内重复请求直接返回首次结果 |
| 幂等适用范围 | 仅在写操作上生效：考试交卷、单词复习、AI 结构化能力、写作批改 |

**并发处理**

| 场景 | 方案 |
| --- | --- |
| 单词复习提交 | `UserVocabulary.version` 乐观锁：`updateMany({where:{id, version}, data:{..., version:{increment:1}}})`，返回 0 行则重读后重算一次；前端禁止重复点击（disabled + 本地去重） |
| 考试自动保存 | `PATCH /api/exams/attempts/:id/answers` 携带 `clientVersion`；服务端 `saveVersion` 单调递增，落后版本直接丢弃返回当前最新（`409` + 最新快照），前端以服务端为准 |
| 考试交卷 | `attempt.status` 状态机（`IN_PROGRESS → SUBMITTED`）作为幂等保护；交卷落 `EXAM_ALREADY_SUBMITTED` 但返回已有报告 |
| 积分/Streak | 全部在 `$transaction` 内用 `updateMany` 带版本条件 + 失败重试 1 次；或直接 `increment` 原子操作（推荐） |
| AI 重复提交 | `requestHash`（input 的 sha256）命中缓存则直接返回上次结构化结果（`cacheHit: true`） |

### 3.4 AI 流式接口实现约定

**决策：SSE over ReadableStream（`Content-Type: text/event-stream`）+ 前端 `fetch` + `ReadableStream` 消费**

理由：①比裸 ReadableStream 有明确的事件边界与 `[DONE]` 语义；②不用原生 `EventSource` 是因为需要 **POST + 自定义鉴权 header**；③比 WebSocket 轻量，无需额外网关，Next Route Handler 原生支持；④未来若需双向实时语音再切 WebSocket，仅改消费端。

**服务端骨架（伪代码，非实现）**

```ts
// app/api/ai/chat/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'   // 禁止静态化

export async function POST(req: NextRequest) {
  const { user, body, traceId } = await withAuth(req, ChatRequestSchema)
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      let full = ''
      try {
        for await (const chunk of gateway.stream({ capability: 'TUTOR_CHAT', ...body, userId: user.id, traceId })) {
          full += chunk
          send('delta', { text: chunk })
        }
        send('done', { messageId, degraded: false, tokensUsed, latencyMs })
      } catch (e) {
        send('degraded', { code: 'AI_TIMEOUT', fallbackText: getFallback('TUTOR_CHAT', body) })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',      // 禁止 Nginx/CDN 缓冲
      'X-Trace-Id': traceId,
    },
  })
}
```

**事件协议**

| event | payload | 说明 |
| --- | --- | --- |
| `meta` | `{traceId, model, degraded:false}` | 连接建立即发，用于测量首字节 |
| `delta` | `{text}` | 文本增量，逐字/逐块 |
| `struct` | `{partial}` | （部分能力）结构化字段增量，如 `corrections[]` 逐条产出 |
| `error` | `{code, message}` | 可恢复错误 |
| `degraded` | `{code, fallback:{...}}` | AI 失败，`ui` 显示降级 Banner |
| `done` | `{messageId, tokensUsed, latencyMs, degraded}` | 结束，含最终落库信息 |

**前端消费Hook（伪代码）**

```ts
// hooks/use-ai-stream.ts
async function* readSSE(res: Response) {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const frames = buf.split('\n\n'); buf = frames.pop() ?? ''
    for (const f of frames) {
      const ev = /^event: (.+)$/m.exec(f)?.[1]
      const dt = /^data: (.+)$/m.exec(f)?.[1]
      if (ev && dt) yield { event: ev, data: JSON.parse(dt) }
    }
  }
}

// 组件内
const streamChat = async (payload: ChatRequest) => {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': nonceRef.current },
    body: JSON.stringify(payload),
    signal: abortRef.current.signal,                 // 支持"停止生成"
  })
  for await (const { event, data } of readSSE(res)) {
    if (event === 'delta') setDraft(d => d + data.text)
    if (event === 'degraded') { setDegraded(true); setDraft(d => d + data.fallback.fallbackText) }
    if (event === 'done') { commit(data.messageId); break }
  }
}
```

> **注意**：流式 route 必须 `export const runtime='nodejs'` 且 `dynamic='force-dynamic'`；`middleware.ts` 的 matcher 必须**排除** `/api/ai/**` 之外的流式路径不被缓存。

### 3.5 完整 REST API 清单（140 条）

权限图例：**P**=PUBLIC · **U**=USER · **T**=TEACHER · **A**=ADMIN

#### 3.5.1 Auth & User（16 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/api/auth/register` | 注册 | P | `email,password,confirmPassword,nickname,locale?` | `user{id,email,nickname,role},Set-Cookie` | |
| 2 | POST | `/api/auth/login` | 登录 | P | `email,password,remember?` | `user,accessTokenExpiresIn` | |
| 3 | POST | `/api/auth/logout` | 登出（撤销当前 session） | U | — | `ok` | |
| 4 | POST | `/api/auth/refresh` | 静默刷新（轮换 Refresh） | P(cookie) | — | `ok` + 新 Cookie | |
| 5 | POST | `/api/auth/forgot-password` | 发重置码 | P | `email` | `ok`（不泄露邮箱是否存在） | |
| 6 | POST | `/api/auth/reset-password` | 重置密码 | P | `token,newPassword` | `ok` | |
| 7 | GET | `/api/auth/me` | 当前会话用户 | U | — | `user,profile,stats,settings,role,permissions[]` | |
| 8 | GET | `/api/user/profile` | 个人资料 | U | — | `profile,stats,cefrLevel,cetEstimatedScore,streak,level` | |
| 9 | PATCH | `/api/user/profile` | 更新资料 | U | `nickname?,avatarUrl?,bio?,gender?` | `profile` | |
| 10 | GET | `/api/user/settings` | 读取设置 | U | — | `settings` | |
| 11 | PATCH | `/api/user/settings` | 更新设置 | U | `theme?,language?,notificationPrefs?,aiPrefs?,privacyPrefs?,dailyGoalMinutes?` | `settings` | |
| 12 | POST | `/api/user/avatar` | 头像上传（multipart） | U | `file` | `avatarUrl` | |
| 13 | POST | `/api/user/export` | 申请数据导出（异步） | U | — | `taskId,etaSeconds` | |
| 14 | DELETE | `/api/user` | 注销账户（二次确认） | U | `confirmText` | 204 | |
| 15 | GET | `/api/user/goals` | 学习目标列表 | U | — | `goals[]` | |
| 16 | PUT | `/api/user/goals` | 全量更新目标 | U | `goals[{goalType,targetExam,targetScore,targetDate,dailyMinutes,weeklyDays}]` | `goals[]` | |

#### 3.5.2 Onboarding / Placement / Dashboard（10 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17 | GET | `/api/onboarding` | 读取已填内容（续填） | U | — | `draft,completed` | |
| 18 | POST | `/api/onboarding` | 提交 8 步并触发计划生成 | U | `steps{goal,level,dailyTime,weeklyDays,targetExam,targetDate,weakest,style}` | `profile,planId` | |
| 19 | POST | `/api/placement/start` | 开始水平测试 | U | `mode?=standard\|adaptive` | `attemptId,questions[],deadlineAt` | |
| 20 | GET | `/api/placement/:id/questions` | 分页取题 | U | `page` | `questions[],meta` | |
| 21 | POST | `/api/placement/:id/answer` | 逐题作答（自动保存） | U | `questionId,answer,responseMs` | `saved,progress` | |
| 22 | POST | `/api/placement/:id/submit` | 交卷并生成报告 | U | — | `attemptId,scores,cefrLevel,cetEstimate,reportId` | |
| 23 | GET | `/api/placement/:id/report` | 获取能力报告 | U | — | `scores,cefrLevel,radar[],problems[],strengths[],suggestions[],etaWeeks,ai{degraded}` | |
| 24 | GET | `/api/dashboard` | Dashboard 全量聚合 | U | `timezone?` | `greeting,progressRing{},todayTasks[],ability[],continueItems[],recommendations[],streak{},calendar[],level{}` | |
| 25 | POST | `/api/dashboard/tasks/:id/complete` | 标记任务完成 | U | `completedValue?` | `task,progressRing,streak,xp` | |
| 26 | GET | `/api/dashboard/ai-suggestion` | AI 今日建议（独立降级单元） | U | — | `suggestion,ai{degraded}` | ✓ |

#### 3.5.3 Study Plan（6 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 27 | GET | `/api/study-plan` | 当前计划（周视图 + 7 天清单） | U | `week?` | `plan{id,weekTargets,tasks[],progress},history` | |
| 28 | POST | `/api/study-plan/generate` | AI 生成计划（A7） | U | `useLatest?` | `planId,weeks[],source:"AI",ai{degraded}` | |
| 29 | POST | `/api/study-plan/adjust` | AI 调整计划（A8） | U | `reason?,intensity?` | `planId,changedItems[],reason,encouragement` | |
| 30 | GET | `/api/study-plan/history` | 计划历史与调整记录 | U | `page` | `plans[]` | |
| 31 | PATCH | `/api/study-plan/tasks/:id` | 更新任务完成量 | U | `completedValue\|status` | `task,planProgress` | |
| 32 | POST | `/api/study-plan/mode` | 切换学习模式 | U | `mode=FREE\|TASK\|EXAM\|SPRINT\|AI_PARTNER\|NIGHT_REVIEW` | `recommendedTasks[]` | |

#### 3.5.4 Vocabulary + SRS（12 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 33 | GET | `/api/vocabulary/today` | 今日待学词队列 | U | `limit?=30` | `words[{id,word,phonetic,definitions,examples,masteryScore,masteryStage}],target,total,remaining` | |
| 34 | GET | `/api/vocabulary/review-queue` | SRS 到期复习队列 | U | `limit?=50` | `queue[{wordId,word,dueReason,nextDueAt,stage}],total,intervalHint[]` | |
| 35 | POST | `/api/vocabulary/review` | 提交复习评分 **（服务端算 SRS）** | U | `wordId,rating(0-5),responseMs,source,Idempotency-Key` | `newMastery,newStage,nextReviewAt,intervalDays,reward{xp,streak}` | |
| 36 | POST | `/api/vocabulary/learn` | 提交学习效果（9 种练习通用） | U | `wordId,mode,isCorrect,responseMs,userAnswer?` | `mastery,stage,isWrong→加入错词` | |
| 37 | GET | `/api/vocabulary/books` | 词库列表 | U | `examType?` | `books[{id,name,wordCount,learnedCount}]` | |
| 38 | POST | `/api/vocabulary/books/:id/enroll` | 加入词库 | U | — | `enrolled,totalAdded` | |
| 39 | GET | `/api/vocabulary/search` | 单词搜索/联想 | U | `q,limit?` | `words[]` | |
| 40 | GET | `/api/vocabulary/:id` | 单词详情（词典部分） | U | — | `word,phonetic,definitions,examples,synonyms,antonyms,collocations,derivatives,rootAffix,isFavorite,inNotebook,mastery` | |
| 41 | GET | `/api/vocabulary/records` | 学习记录曲线 | U | `range=30d` | `daily[{date,learned,reviewed}],total` | |
| 42 | GET | `/api/vocabulary/mastery` | 掌握度分布 | U | `stage?` | `distribution{NEW..MASTERED:count},page` | |
| 43 | GET | `/api/vocabulary/notebook` | 生词本（错词/收藏/自定义 3 Tab） | U | `tab` | `words[]` | |
| 44 | POST | `/api/vocabulary/notebook` | 加入/移出生词本 | U | `wordId` | `ok` | |

#### 3.5.5 Listening（7 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 45 | GET | `/api/listening` | 听力材料列表 | U | `category?,difficulty?,page` | `materials[],categories[]` | |
| 46 | GET | `/api/listening/:id` | 材料详情（精听页） | U | — | `audioUrl,durationSec,transcript[],translation,playbackPrefs` | |
| 47 | GET | `/api/listening/:id/questions` | 按模式取题 | U | `mode=intensive\|dictation\|cloze\|choice…` | `questions[]` | |
| 48 | POST | `/api/listening/:id/attempts` | 提交训练作答 | U | `mode,answers[],durationSec,unknownWords[]` | `recordId,accuracy,correctCount` | |
| 49 | GET | `/api/listening/report/:recordId` | 训练报告 | U | — | `accuracy,unknownWords[],weakPoints[],ai{degraded}` | |
| 50 | POST | `/api/listening/:recordId/analyze` | AI 听力分析（A12） | U | — | `analysis{suggestions[],nextMaterials[]},ai{degraded}` | |
| 51 | POST | `/api/listening/progress` | 更新播放进度 | U | `materialId,positionSec,completed?` | `ok` | |

#### 3.5.6 Speaking（8 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 52 | GET | `/api/speaking/catalog` | 11 角色 × 9 场景配置 | U | — | `roles[],scenes[]` | |
| 53 | POST | `/api/speaking/session` | 创建/继续对话会话 | U | `roleKey,sceneKey,mode,conversationId?` | `sessionId,conversationId,greeting{text,audioUrl}` | |
| 54 | POST | `/api/speaking/session/:id/messages` | 发送一条（文本或录音） | U | `text?\|audioBlob,sessionId` | `reply{text,audioUrl,hints[]},latencyMs` | ✓ |
| 55 | POST | `/api/speaking/session/:id/end` | 结束并评分（A3） | U | — | `reportId,scores{},ai{degraded}` | |
| 56 | GET | `/api/speaking/report/:id` | 口语评分报告 | U | — | `scores{total,pronunciation,grammar,vocabulary,fluency,naturalness},errors[],suggestions[]` | |
| 57 | POST | `/api/speaking/transcribe` | STT 转写（Web Speech 兜底/云 ASR） | U | `audio,referenceText?` | `transcript,confidence` | |
| 58 | POST | `/api/speaking/pronunciation` | 发音分析（A4） | U | `audio,referenceText` | `scores{},phonemeErrors[],advice[],shadowingTips[]` | |
| 59 | GET | `/api/speaking/sessions` | 历史会话列表 | U | `page` | `sessions[]` | |

#### 3.5.7 Reading / Writing / Grammar / Translation（22 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | GET | `/api/reading` | 阅读列表 | U | `category?,difficulty?,page` | `articles[]` | |
| 61 | GET | `/api/reading/:id` | 文章详情 | U | — | `contentBlocks[],contentZh,keyWords[],sentences[],readingMinutes,progress` | |
| 62 | POST | `/api/reading/:id/progress` | 保存阅读进度 | U | `progress,lastBlockIndex,readSeconds` | `ok` | |
| 63 | GET | `/api/reading/:id/quiz` | 获取/生成理解题 | U | `forceGenerate?` | `questions[]` | |
| 64 | POST | `/api/reading/:id/quiz/submit` | 提交并评分 | U | `answers[]` | `score,results[{questionId,correct,explanation,location}],wrongSaved` | |
| 65 | POST | `/api/reading/:id/explain` | AI 阅读讲解（A5） | U | `targetSentences?,scope=main\|sentence\|vocab` | `{mainIdea,background,sentenceAnalysis[],vocabNotes[]}` | ✓ |
| 66 | GET | `/api/writing/tasks` | 写作任务列表 | U | `taskType?,page` | `tasks[]` | |
| 67 | POST | `/api/writing/submissions` | 新建草稿 | U | `taskId,title?` | `submissionId` | |
| 68 | GET | `/api/writing/:id` | 草稿详情 | U | — | `content,wordCount,paragraphCount,ruleCheck,status` | |
| 69 | PATCH | `/api/writing/:id` | 自动保存草稿 | U | `content` | `savedAt,wordCount,paragraphCount` | |
| 70 | POST | `/api/writing/analyze` | **AI 写作批改（A2）** | U | `submissionId,targetLevel?` | `scores{},corrections[],rewrites{},summary` | ✓ |
| 71 | GET | `/api/writing/:id/report` | 批改报告 | U | — | `scores{},corrections[],rewrites{},ai{degraded}` | |
| 72 | GET | `/api/writing/submissions` | 我的作文列表 | U | `page` | `submissions[]` | |
| 73 | GET | `/api/grammar/topics` | 14 类语法 + 掌握度 | U | — | `topics[{id,name,category,mastery}]` | |
| 74 | GET | `/api/grammar/:id` | 知识点详情 | U | — | `content,examples[],errorExamples[]` | |
| 75 | GET | `/api/grammar/:id/exercise` | 练习题 | U | `limit?` | `questions[]` | |
| 76 | POST | `/api/grammar/:id/exercise/submit` | 提交（错自动入库） | U | `answers[]` | `score,results[]` | |
| 77 | POST | `/api/grammar/:id/explain` | AI 语法讲解（A6） | U | `question,userErrors[]` | `{answer,explanation,examples[],miniExercise}` | ✓ |
| 78 | POST | `/api/translation/translate` | AI 翻译五档（A11） | U | `sourceText,direction` | `{literal,natural,formal,academic,spoken,notes}` | ✓ |
| 79 | GET | `/api/translation/history` | 翻译历史 | U | `page` | `records[]` | |
| 80 | POST | `/api/vocabulary/explain` | AI 单词深度解释（A1） | U | `wordId\|word,pos?,scene?` | `{meaning,howToRemember,confusables[],usageScenarios[],collocations[],examTips{},mnemonic}` | ✓ |
| 81 | POST | `/api/vocabulary/scenario` | AI 情景使用（A15） | U | `wordId,scene?` | `{dialogue[],blanks[],usageTips}` | ✓ |

#### 3.5.8 Exam / Mistakes / Favorites（15 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 82 | GET | `/api/exams` | 试卷列表 / 考试中心 | U | `examType?,page` | `papers[],history[]` | |
| 83 | GET | `/api/exams/zones/:type` | CET-4/6 专区聚合 | U | `type=cet4\|cet6` | `countdownDays,scoreGap{current,target,gap},moduleProgress{},trend[],aiAdvice{priorityModule,reason}` | |
| 84 | POST | `/api/exams/:id/start` | 开始考试 | U | `mode=timed\|practice` | `attemptId,deadlineAt,serverTime,paper{structure,questions[]}` | |
| 85 | PATCH | `/api/exams/attempts/:id/answers` | **自动保存（≤10s 一次）** | U | `clientVersion,answers[{eqId,answer,flagged}]` | `savedVersion,serverConflicts?` | |
| 86 | POST | `/api/exams/attempts/:id/submit` | 交卷并评分 | U | `Idempotency-Key` | `attemptId,totalScore,sectionScores{},cetEstimate{}` | |
| 87 | GET | `/api/exams/attempts/:id` | 恢复未完成答卷 | U | — | `attempt,answers[],remainingSec` | |
| 88 | GET | `/api/exams/attempts/:id/report` | 成绩报告 + 趋势 | U | — | `totalScore,sectionScores{},trend[],review[]` | |
| 89 | GET | `/api/mistakes` | 错题本 | U | `source?,aiCategory?,mastered?,page` | `mistakes[]` | |
| 90 | POST | `/api/mistakes/:id/mastered` | 标记已掌握（出列） | U | — | `ok` | |
| 91 | POST | `/api/mistakes/:id/analyze` | AI 错题分类与解析（A13） | U | — | `{category,reason,explanation,similarPractice[]}` | |
| 92 | DELETE | `/api/mistakes/:id` | 移除错题 | U | — | 204 | |
| 93 | POST | `/api/mistakes/repractice` | 批量再练生成练习卷 | U | `ids[]` | `sessionId,questions[]` | |
| 94 | GET | `/api/favorites` | 收藏列表（7 类 Tab） | U | `targetType?,page` | `favorites[]` | |
| 95 | POST | `/api/favorites` | 加入收藏 | U | `targetType,targetId,title?` | `favorite` | |
| 96 | DELETE | `/api/favorites/:targetType/:targetId` | 取消收藏 | U | — | 204 | |

#### 3.5.9 Analytics / Gamification / Search / Notification（10 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 97 | GET | `/api/analytics` | 学习统计概览 | U | `range=7d\|30d\|90d\|all` | `metrics{},trend[],distribution[],ability[],heatmap[]` | |
| 98 | GET | `/api/analytics/trend` | 趋势（可切维度） | U | `metric=studyTime\|words\|accuracy,range` | `points[]` | |
| 99 | GET | `/api/analytics/history` | 学习历史时间线 | U | `activityType?,page` | `records[]` | |
| 100 | GET | `/api/analytics/calendar` | 学习日历热力 | U | `days=30\|365` | `days[{date,studySeconds,level}]` | |
| 101 | GET | `/api/achievements` | 成就与等级 | U | — | `level,xp,nextLevelAt,achievements[]` | |
| 102 | GET | `/api/challenge` | 每日挑战 | U | — | `challenge{tasks[],progress},reward` | |
| 103 | GET | `/api/leaderboard` | 排行榜（默认匿名） | U | `metric=weeklyTime\|monthlyWords\|streak` | `top[],myRank` | |
| 104 | GET | `/api/search` | 全局搜索 | U | `q,types?,limit?` | `results[]{type,id,title,highlight}` | |
| 105 | GET | `/api/notifications` | 通知列表 | U | `type?,isRead?,page` | `notifications[],unreadCount` | |
| 106 | PATCH | `/api/notifications/read` | 标记已读 | U | `ids[]\|"all"` | `unreadCount` | |

#### 3.5.10 AI Chat & Recommend（10 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 107 | GET | `/api/ai/conversations` | 会话列表 | U | `type?,page` | `conversations[]` | |
| 108 | POST | `/api/ai/conversations` | 新建会话 | U | `type,context?` | `conversationId` | |
| 109 | GET | `/api/ai/conversations/:id/messages` | 消息列表 | U | `page` | `messages[]` | |
| 110 | PATCH | `/api/ai/conversations/:id` | 改标题/收藏 | U | `title?,isFavorite?` | `conversation` | |
| 111 | DELETE | `/api/ai/conversations/:id` | 删除会话（软删） | U | — | 204 | |
| 112 | POST | `/api/ai/chat` | **AI Tutor 对话（A10）** | U | `conversationId,message,level,goal,stream=true` | SSE: `delta{text}` | **✓** |
| 113 | POST | `/api/ai/diagnosis` | AI 每日诊断（A9） | U | `date?` | `{summary,metricsReview,weakPoints[],tomorrowPlan[]}` | ✓ |
| 114 | POST | `/api/ai/recommend` | AI 推荐（A16） | U | `limit?=6` | `items[{type,id,reason,difficulty}]` | |
| 115 | POST | `/api/ai/cet-advice` | AI CET 提升建议（A18） | U | `examType,targetScore` | `{gapAnalysis,priorityModule,weeklyFocus[],expectedGain}` | |
| 116 | PATCH | `/api/ai/messages/:id/favorite` | 收藏消息 | U | — | `ok` | |

#### 3.5.11 Admin（24 条）

| # | Method | Path | 说明 | 权限 | 请求关键字段 | 响应关键字段 | 流式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 117 | GET | `/api/admin/overview` | 后台 Dashboard | A | `range` | `metrics{users,dau,mau,studyHours,aiCalls,errorRate,examCount},trend[]` | |
| 118 | GET | `/api/admin/analytics` | 多维报表 | A | `dimension,filters` | `rows[]` | |
| 119 | POST | `/api/admin/analytics/export` | 导出 CSV/Excel（异步） | A | `report,filters` | `taskId` | |
| 120 | GET | `/api/admin/users` | 用户管理列表 | A | `q?,status?,role?,page` | `users[]` | |
| 121 | GET | `/api/admin/users/:id` | 用户详情 + 学习数据 | A | — | `user,stats,plans,aiUsage` | |
| 122 | PATCH | `/api/admin/users/:id` | 改状态/角色 | A | `status?\|role?` | `user` | |
| 123 | POST | `/api/admin/users/:id/reset-password` | 强制重置密码 | A | `tempPassword` | `ok` | |
| 124 | GET | `/api/admin/content/:entity` | 内容列表（words/listenings/readings/questions/exams） | T/A | `q?,status?,page` | `items[]` | |
| 125 | POST | `/api/admin/content/:entity` | 新增内容 | T/A | 各实体字段 | `item` | |
| 126 | PATCH | `/api/admin/content/:entity/:id` | 编辑 | T/A | 部分字段 | `item` | |
| 127 | DELETE | `/api/admin/content/:entity/:id` | 删除（软删） | T/A | — | 204 | |
| 128 | POST | `/api/admin/content/:entity/import` | CSV 批量导入 | T/A | `file` | `imported,errors[]` | |
| 129 | GET | `/api/admin/ai/config` | AI 能力配置列表 | A | — | `configs[]` | |
| 130 | PATCH | `/api/admin/ai/config/:capability` | 改配置/启停/降级开关 | A | `enabled?,fallbackEnabled?,model?,timeoutMs?,dailyQuotaUser?` | `config` | |
| 131 | GET | `/api/admin/ai/prompts` | Prompt 列表 | A | `key?` | `prompts[]` | |
| 132 | POST | `/api/admin/ai/prompts` | 新建版本 | A | `key,systemPrompt,userTemplate,variables,modelOverrides` | `prompt` | |
| 133 | POST | `/api/admin/ai/prompts/:id/activate` | 发布/灰度 | A | `trafficRatio` | `prompt` | |
| 134 | POST | `/api/admin/ai/prompts/:id/test` | Prompt 在线试跑 | A | `variables{}` | `output,tokens,latencyMs` | ✓ |
| 135 | GET | `/api/admin/ai/usage` | Token 用量报表 | A | `groupBy=day\|capability` | `rows[],totals` | |
| 136 | GET | `/api/admin/ai/logs` | AI 调用日志/失败率 | A | `status?,capability?,page` | `logs[]` | |
| 137 | GET | `/api/admin/roles` | 角色与权限矩阵 | A | — | `roles[],permissions[],matrix{}` | |
| 138 | POST | `/api/admin/roles/:id/permissions` | 更新权限 | A | `permissionIds[]` | `matrix` | |
| 139 | GET | `/api/admin/audit-logs` | 审计日志 | A | `page` | `logs[]` | |
| 140 | GET | `/api/health` | 健康检查 | P | — | `{status,db,ai:{provider,mode}}` | |

> **合计 140 条**（含 Admin 24 条；核心用户侧 116 条）。所有接口均授予 Role：`(P)` 允许匿名，`(U)` 任意已登录用户，`(T)` 需 `content:*` permission，`(A)` 需 `ai:*`/`user:*` permission。

---

## 四、AI Service 设计

### 4.1 AI Gateway 类型签名（`src/services/ai/types.ts`）

```ts
// ---------- 通用 ----------
export type AiCapabilityKey =
  | 'WORD_EXPLAIN' | 'WRITING_REVIEW' | 'SPEAKING_SCORE' | 'PRONUNCIATION_ANALYZE'
  | 'READING_EXPLAIN' | 'GRAMMAR_EXPLAIN' | 'PLAN_GENERATE' | 'PLAN_ADJUST'
  | 'DAILY_DIAGNOSIS' | 'TUTOR_CHAT' | 'TRANSLATE' | 'LISTENING_ANALYZE'
  | 'MISTAKE_CLASSIFY' | 'READING_QUIZ_GENERATE' | 'WORD_SCENARIO'
  | 'RECOMMEND' | 'EXAM_ESSAY_SCORE' | 'CET_ADVICE'

export interface AiRunContext {
  userId: string
  traceId: string
  locale: 'zh-CN' | 'en'
  userLevel?: CEFRLevel
  targetLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  preferStream?: boolean
  signal?: AbortSignal
}

export interface AiResult<T> {
  data: T
  degraded: boolean          // true = 走了兜底
  degradedReason?: string
  provider?: string
  model?: string
  promptVersion?: number
  tokensUsed: number
  latencyMs: number
  cacheHit: boolean
}

// ---------- Provider Adapter ----------
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ProviderRequest {
  messages: ChatMessage[]
  model: string
  temperature: number
  maxTokens: number
  stream: boolean
  /** JSON Mode / response_format 提示，Adapter 自行翻译成目标厂商协议 */
  jsonMode?: boolean
  timeoutMs: number
  firstTokenTimeoutMs?: number
  signal?: AbortSignal
}

export interface ProviderChunk { text: string; finishReason?: 'stop' | 'length' | null }
export interface ProviderUsage { inputTokens: number; outputTokens: number }

export interface AiProvider {
  readonly key: string                                  // 'deepseek' | 'openai' | 'ollama' | 'mock'
  readonly displayName: string
  healthCheck(): Promise<boolean>
  complete(req: ProviderRequest): AsyncIterable<ProviderChunk> & { usage(): Promise<ProviderUsage> }
  estimateCost(usage: ProviderUsage, model: string): number   // 单位：分
}

// ---------- Gateway ----------
export interface AiGateway {
  /** 非流式：内部完成 Prompt 装配 → Provider → Zod 校验 → 失败重试/修补 → 降级 */
  run<T>(capability: AiCapabilityKey, input: unknown, ctx: AiRunContext): Promise<AiResult<T>>
  /** 流式：逐段产出文本；底层仍先走模板与校验，但降级只能在 stream 内以 degraded 事件通知 */
  stream(capability: AiCapabilityKey, input: unknown, ctx: AiRunContext): AsyncIterable<string>
  /** 流式 + 结构化：先流文本，结束时产出经 Zod 校验的结构（如写作批改逐句 + 最终 scores） */
  streamStruct<T>(
    capability: AiCapabilityKey, input: unknown, ctx: AiRunContext,
  ): AsyncIterable<{ kind: 'delta'; text: string } | { kind: 'struct'; data: T } | { kind: 'degraded'; fallback: T }>
  /** 读取能力当前的可用性与配额，供前端决定是否展示入口 */
  status(capability: AiCapabilityKey): Promise<{ enabled: boolean; healthy: boolean; quotaLeft: number }>
}

// ---------- 18 个能力的显式方法（在网关之上做语义封装，业务层只调这些方法） ----------
export class AiService {
  constructor(private gw: AiGateway) {}
  explainWord(i: ExplainWordInput, ctx: AiRunContext): Promise<AiResult<WordExplain>>          // A1
  analyzeWriting(i: WritingAnalyzeInput, ctx: AiRunContext): Promise<AiResult<WritingReport>>  // A2
  analyzeSpeaking(i: SpeakingScoreInput, ctx: AiRunContext): Promise<AiResult<SpeakingReport>> // A3
  analyzePronunciation(i: PronInput, ctx: AiRunContext): Promise<AiResult<PronunciationReport>>// A4
  explainReading(i: ReadingInput, ctx: AiRunContext): Promise<AiResult<ReadingExplain>>        // A5
  explainGrammar(i: GrammarInput, ctx: AiRunContext): Promise<AiResult<GrammarExplain>>        // A6
  generateStudyPlan(i: PlanInput, ctx: AiRunContext): Promise<AiResult<GeneratedPlan>>         // A7
  adjustStudyPlan(i: PlanAdjustInput, ctx: AiRunContext): Promise<AiResult<AdjustedPlan>>      // A8
  diagnoseDaily(i: DiagnosisInput, ctx: AiRunContext): Promise<AiResult<DailyDiagnosis>>       // A9
  chat(i: ChatInput, ctx: AiRunContext): AsyncIterable<string>                                  // A10 流式
  translate(i: TranslateInput, ctx: AiRunContext): Promise<AiResult<TranslationOutput>>        // A11
  analyzeListening(i: ListeningInput, ctx: AiRunContext): Promise<AiResult<ListeningAnalysis>> // A12
  classifyMistake(i: MistakeInput, ctx: AiRunContext): Promise<AiResult<MistakeAnalysis>>      // A13
  generateReadingQuiz(i: QuizGenInput, ctx: AiRunContext): Promise<AiResult<Quiz>>             // A14
  wordScenario(i: ScenarioInput, ctx: AiRunContext): Promise<AiResult<ScenarioOutput>>         // A15
  recommend(i: RecommendInput, ctx: AiRunContext): Promise<AiResult<Recommendation[]>>         // A16
  gradeExamEssay(i: ExamEssayInput, ctx: AiRunContext): Promise<AiResult<EssayGrade>>          // A17
  cetAdvice(i: CetAdviceInput, ctx: AiRunContext): Promise<AiResult<CetAdvice>>                // A18
}
```

### 4.2 能力 × PRD AI 清单映射（A1–A18）

| AI 能力 | Capability Key | PRD # | 是否流式 | 输入摘要 | 输出 Zod Schema | 超时 |
| --- | --- | --- | --- | --- | --- | --- |
| 单词深度解释 | `WORD_EXPLAIN` | A1 | 是 | `word,pos,userLevel,mastery,goal` | `WordExplainSchema` | 30s |
| 写作批改 | `WRITING_REVIEW` | A2 | 是 | `essayText,taskType,targetLevel` | `WritingReportSchema` | **60s** |
| 口语评分 | `SPEAKING_SCORE` | A3 | 否 | `transcript,audioMeta,scene,role` | `SpeakingReportSchema` | 30s |
| 发音分析 | `PRONUNCIATION_ANALYZE` | A4 | 否 | `audioUrl,referenceText` | `PronunciationSchema` | 30s |
| 阅读讲解 | `READING_EXPLAIN` | A5 | 是 | `articleBlocks,targetSentences,unknownWords` | `ReadingExplainSchema` | 45s |
| 语法讲解 | `GRAMMAR_EXPLAIN` | A6 | 是 | `grammarPoint,question,userErrors[]` | `GrammarExplainSchema` | 30s |
| 计划生成 | `PLAN_GENERATE` | A7 | 否 | `scores,mistakes,mastery,time,frequency,goal` | `GeneratedPlanSchema` | 45s |
| 计划调整 | `PLAN_ADJUST` | A8 | 否 | `planId,missStreak,actualData` | `AdjustedPlanSchema` | 30s |
| 每日诊断 | `DAILY_DIAGNOSIS` | A9 | 是 | `todayStats` | `DailyDiagnosisSchema` | 30s |
| Tutor 对话 | `TUTOR_CHAT` | A10 | **是** | `message,history[],level,goal` | 纯文本（无 JSON Mode） | 60s |
| 翻译 | `TRANSLATE` | A11 | 是 | `sourceText,direction` | `TranslationSchema` | 30s |
| 听力分析 | `LISTENING_ANALYZE` | A12 | 否 | `answers,unknownWords,difficulty,history` | `ListeningAnalysisSchema` | 30s |
| 错题分类 | `MISTAKE_CLASSIFY` | A13 | 否 | `question,userAnswer,correctAnswer,points` | `MistakeAnalysisSchema` | 20s |
| 阅读出题 | `READING_QUIZ_GENERATE` | A14 | 否 | `articleBlocks,difficulty,count` | `QuizSchema` | 45s |
| 单词情景 | `WORD_SCENARIO` | A15 | 是 | `word,userLevel,scene` | `ScenarioOutputSchema` | 30s |
| 推荐引擎 | `RECOMMEND` | A16 | 否 | `profile,weakness,exposures,completion` | `RecommendationSchema` | 20s |
| 考试作文评分 | `EXAM_ESSAY_SCORE` | A17 | 否 | `essayText,examType,rubric` | `EssayGradeSchema` | 45s |
| CET 提升建议 | `CET_ADVICE` | A18 | 否 | `sectionScores,target,daysLeft,progress` | `CetAdviceSchema` | 30s |

> 超时统一由 `AiCapabilityConfig` 控制（此处为默认值），**所有超时必须有 `AbortSignal` 兜底**，不能只靠 provider 自身超时。

### 4.3 Provider Adapter、注册表、优先级与 Failover

```mermaid
classDiagram
    class AiGateway {
        +run(capability, input, ctx) AiResult
        +stream(capability, input, ctx) AsyncIterable
        +streamStruct(capability, input, ctx) AsyncIterable
        +status(capability) CapabilityStatus
    }
    class PromptRegistry {
        +resolve(capability, userId) ResolvedPrompt
        +render(prompt, variables) ChatMessage[]
        +fallbackSeed(capability) boolean
    }
    class StructGuard {
        +validate(raw, schema) T
        +repairPrompt(raw, schema, err) ChatMessage[]
    }
    class ProviderRegistry {
        +select(capability) AiProvider
        +failover(current) AiProvider
        +circuitBreaker AiCircuitBreaker
    }
    class AiCircuitBreaker {
        +isOpen(providerKey) boolean
        +recordSuccess(providerKey)
        +recordFailure(providerKey)
    }
    class Meter {
        +charge(ctx, usage, capability) Promise
        +quotaLeft(userId, capability) number
    }
    class DegradeStrategy {
        +fallback(capability, input) unknown
    }

    class AiProvider {
        <<interface>>
        +complete(req)
        +healthCheck()
        +estimateCost(usage, model)
    }
    class DeepSeekProvider
    class OpenAIProvider
    class OllamaProvider
    class MockProvider

    AiGateway --> PromptRegistry
    AiGateway --> StructGuard
    AiGateway --> ProviderRegistry
    AiGateway --> Meter
    AiGateway --> DegradeStrategy
    ProviderRegistry --> AiCircuitBreaker
    ProviderRegistry --> AiProvider
    AiProvider <|.. DeepSeekProvider
    AiProvider <|.. OpenAIProvider
    AiProvider <|.. OllamaProvider
    AiProvider <|.. MockProvider
```

**配置优先级（从高到低）**

1. `AiCapabilityConfig` 表（后台 `/admin/ai` 实时改）
2. 环境变量 `AI_PROVIDER` / `AI_MODEL_*`（部署级覆盖）
3. `AiPrompt.modelOverrides`（Prompt 版本级）
4. `src/lib/constants/config.ts` 默认值

**Failover 顺序**

```
主 Provider（默认 deepseek，由 AI_PROVIDER 指定）
   ↓ 失败(超时/5xx/invalid key) 且 maxRetries 用完 且 circuit closed
备用 Provider（AI_FAILOVER_PROVIDER，默认 openai→ 若配置）
   ↓ 仍未配置/同样失败
Mock Provider（永远可用，返回规则生成的合理内容）
   ↓ fallbackEnabled = true
返回 { data: DegradeStrategy.fallback(...), degraded: true }
   ↓ fallbackEnabled = false
抛 AI_UNAVAILABLE → 503
```

**熔断器**：滑动窗口 60s，失败率 ≥ 50% 且采样 ≥ 10 次 → OPEN 30s，期间直接走下一 Provider；HALF_OPEN 探测一次成功即恢复。**DB 记录每次结果到 `ai_call_logs`，`/admin/ai` 展示失败率。**

### 4.4 Prompt 管理方案

**决策：DB 表（`ai_prompts`）为主 + 代码常量文件（`src/services/ai/prompts/seed/*.ts`）为唯一来源的种子**

理由：①PRD §5.21 明确要求"Prompt 在线编辑 + 版本管理 + 一键回滚"；②纯文件常量无法灰度、无法不停服调整；③但纯 DB 又在全新环境无数据 → 因此用 **`prisma/seed/seed-ai-prompts.ts` 从代码常量 upsert 到 DB**，代码是"真相源"，DB 是"运行时真相"。

```
启动 →ensure prompts 已 seed（缺 key 自动插入，已存在不覆盖）
运行 →resolve(capability, userId):
        候选 = prompts where key=capability and status=ACTIVE order by version desc
        若有多个 ACTIVE：按 trafficRatio 做 userId 哈希灰度（stable bucketing）
        取 hash(`${capability}:${userId}`) % 100 < trafficRatio ? 新版 : 次新版
渲染 →模板变量 {{var}} 严格替换（缺 required 变量直接抛 VALIDATION_ERROR，不静默填空）
seed →缺失时，取 seed 常量中新版本，INSERT status=DRAFT，管理员可在后台发布
```

| 规则 | 说明 |
| --- | --- |
| 版本不可变 | 已发布版本只允许改 `status` 与 `trafficRatio`，编辑内容必须"复制为新版本" |
| 灰度 | `trafficRatio` 默认 100；调低到 10 即进入 10% 灰度 |
| 回滚 | `/admin/ai` 一键把旧版本置 ACTIVE、新版置 ARCHIVED |
| 变量声明 | `variables Json`：`[{name:'word',required:true,description:'目标单词'}]`，后台试跑时自动生成表单 |
| 测试 | `POST /api/admin/ai/prompts/:id/test` 用真实变量跑一次并记录 latency/tokens |
| 缺失兜底 | 若某能力 DB 中无 ACTIVE prompt → **自动降级到规则兜底**并告警 |

### 4.5 结构化输出保障

```
1. 请求时对 jsonMode=true 的能力，Adapter 设置 response_format={type:'json_object'}（兼容 OpenAI 协议）；
   Prompt 中额外注入输出 Schema 的 JSON Example（提升成功率）
2. 拿到文本 → JSON.parse 失败 → 提取 ```json ... ``` 代码块重试一次
3. Zod 校验（schema 定义在 src/services/ai/schemas/<capability>.ts）
   ├─ 通过 → 返回
   └─ 失败 → 把 zodError 拼成 repair message，连同原始输出再请求 1 次（maxRetries=1）
             ├─ 二次通过 → 返回，标记 selfRepaired=true
             └─ 二次失败 → 记录 AI_STRUCT_INVALID → 走降级
4. 所有数值字段用 .catch() 提供安全默认值（如 z.number().min(0).max(100).catch(0)），
   防止 AI 乱给值导致 UI 崩溃
5. 流式能力：文本部分流式，结构部分在 [DONE] 前一次性产出并校验
```

### 4.6 Token 计量与限流

| 项 | 规则 |
| --- | --- |
| 计量点 | `AiGateway` 出口统一写 `ai_call_logs`（含 `cacheHit`、`degraded`、`traceId`、promptVersion） |
| 成本估算 | `Adapter.estimateCost(usage, model)` 返回分；各厂商单价表 `src/lib/ai/pricing.ts`（可后台配） |
| 用户配额 | 默认 100 次/日（可通过 `subscription.aiDailyQuota` 或 `AiCapabilityConfig.dailyQuotaUser` 覆盖）；按 **userId + 本地自然日** 计数，超限返回 `AI_QUOTA_EXCEEDED` |
| 重能力排队 | `WRITING_REVIEW` / `READING_QUIZ_GENERATE` / `PLAN_GENERATE` 走并发信号量（`limit ≤ 4`），超限返回 `AI_CONCURRENCY_LIMIT` 并提示"稍后自动重试" |
| 结果缓存 | 非流式、幂等输入能力（A1/A13/A11/A14）按 `requestHash` 缓存 24h，命中直接返回 |
| 日报 | `/admin/ai` 的 Token 用量报表由 `ai_call_logs` 按日 + capability 聚合 |

### 4.7 降级策略矩阵（每个 AI 能力降级后给什么）

> **总原则**：`ai.degraded=true` 时，**核心学习闭环必须照常可用**，UI 显示统一的 `AiDegradedBanner`（"AI Service Temporarily Unavailable"）+ "重试"按钮。

| Capability | 降级兜底内容 | UI 表现 |
| --- | --- | --- |
| `WORD_EXPLAIN` | 静态词典字段：释义/例句/近反义/搭配/派生/词根词缀 | AI 区块显示静态内容 + Banner |
| `WRITING_REVIEW` | 规则引擎：拼写检查（词典比对）+ 基础语法正则检查（主谓一致/时态/冠词）+ 字数段落/句长分布打分 | 报告页显示"仅基础检查"徽章 + 可重试 |
| `SPEAKING_SCORE` | 转写文本 + 时长/语速/停顿统计 + 通用口语建议模板（按时长选 1 条） | 分数区显示"待评分"，保留统计 |
| `PRONUNCIATION_ANALYZE` | 仅 STT 转写 + 跟读文本 | 隐藏评分，保留跟读练习 |
| `READING_EXPLAIN` | **隐藏 AI 区块**，保留原文 + 词典翻译 + 预设题目 | 不显示 Banner，只隐藏入口 |
| `GRAMMAR_EXPLAIN` | 静态知识点讲解 + 例句 + 错误示例 | AI 区块替换为静态内容 |
| `PLAN_GENERATE` | 规则模板：按每日学习时间 × 固定比例（词汇40% / 听力25% / 阅读20% / 写作10% / 口语5%）线性分配 | 计划页显示"自动生成（规则版）"标签 |
| `PLAN_ADJUST` | 规则降级：按完成率 ×0.8 线性缩减任务量 | 同上 |
| `DAILY_DIAGNOSIS` | 展示纯数据卡（时长/词数/正确率），文案总结位显示"AI 总结生成中…"占位 | 数据卡照常 |
| `TUTOR_CHAT` | 返回引导文本："AI 老师暂时不可用，你可以：①查看语法/词汇页 ②使用搜索 ③稍后重试" + 6 个快捷入口 | 聊天气泡内系统提示 |
| `TRANSLATE` | 词典直译（逐词映射，仅 `literal` 档），其余四档置空 | 仅显示"直译"Tab |
| `LISTENING_ANALYZE` | 仅客观统计：正确率 / 生词数 / 难度 | AI 分析块隐藏 |
| `MISTAKE_CLASSIFY` | 显示正确答案 + 知识点标签，分类置"未分类" | 分类筛选 Chip 显示"未分类" |
| `READING_QUIZ_GENERATE` | 用预设题库中该文章的题目；无则显示"暂无题目，AI 出题暂不可用" | 空态 + Retry |
| `WORD_SCENARIO` | 切换为静态例句填空（例句库） | 练习位自动切换模式 Toast |
| `RECOMMEND` | 规则推荐：按分类热门 + 未学过内容排序（取 TOP 6） | 推荐卡照常，无 reason 文案 |
| `EXAM_ESSAY_SCORE` | 客观题照常评分；主观题标记"待评分" + 附评分标准自评表 | 成绩报告显示"写译待评分" |
| `CET_ADVICE` | 规则文案："你的阅读分最低（X 分），建议本周优先练习阅读" | 建议卡显示通用文案 |

### 4.8 流式、超时与并发

| 项 | 约定 |
| --- | --- |
| 协议 | SSE over `ReadableStream`（见 §3.4） |
| 首 token 超时 | **3s**（`firstTokenTimeoutMs`）；超时 → 立即降级发 `degraded` 事件 |
| 整体超时 | **30s**；写作批改/阅读出题/计划生成 **60s**；每日诊断/Tutor **45s** |
| 超时实现 | `AbortController` + `setTimeout`，父超时同时作用于 provider 请求；超时后必须释放 reader 并 `controller.close()` |
| 并发控制 | 全局 AI 并发 ≤ 8；单个 userId 并发 ≤ 2（防止用户多点导致配额穿透） |
| 停止生成 | 前端 `AbortController.abort()` → `req.signal` → provider signal → 服务端仍要把已生成部分落库（`ai_messages` 标记 `interrupted`） |
| 断流处理 | 前端收到流中断（非 `done`）→ 保留已渲染文本 + 显示"连接中断" + 「重试」按钮（重试携带相同 `conversationId`，服务端继续上下文） |
| 心跳 | 每 5s 发送 `:ping\n\n` 注释帧，防止代理断连 |

### 4.9 AI 调用时序（含降级）

```mermaid
sequenceDiagram
    autonumber
    participant UI as Client Component
    participant RT as /api/ai/chat (Route Handler)
    participant SV as ChatService
    participant GW as AiGateway
    participant PR as PromptRegistry
    participant CB as ProviderRegistry/Breaker
    participant PV as DeepSeekProvider
    participant MT as Meter
    participant DB as PostgreSQL

    UI->>RT: POST /api/ai/chat {message, conversationId}
    RT->>SV: sendMessage(userId, payload)
    SV->>DB: insert ai_messages(role=USER)
    SV->>GW: stream(TUTOR_CHAT, input, ctx)
    GW->>MT: checkQuota(userId) → ok / AI_QUOTA_EXCEEDED
    GW->>PR: resolve(TUTOR_CHAT, userId) → {systemPrompt, userTemplate, version}
    GW->>CB: select('TUTOR_CHAT') → deepseek (circuit closed?)
    alt provider 可用
        GW->>PV: ProviderRequest{stream:true, timeout:60s, firstToken:3s}
        loop SSE chunks
            PV-->>GW: chunk
            GW-->>SV: delta
            SV-->>RT: SSE event:delta
            RT-->>UI: 打字机渲染
        end
        PV-->>GW: usage{inputTokens, outputTokens}
        GW->>MT: charge() → write ai_call_logs(SUCCESS)
        GW-->>SV: done{messageId, tokensUsed}
    else 超时 / 5xx / 额度异常
        CB->>CB: failover → OpenAIProvider
        alt 备用成功
            CB-->>GW: chunks
            GW-->>SV: done{degraded:false, provider:'openai'}
        else 全部失败
            GW->>GW: DegradeStrategy.fallback(TUTOR_CHAT)
            GW->>MT: write ai_call_logs(DEGRADED, errorCode)
            GW-->>SV: degraded{fallbackText}
        end
    end
    SV->>DB: insert ai_messages(role=ASSISTANT, degraded)
    SV->>DB: update ai_conversations(messageCount, tokensUsed, lastMessageAt)
    SV-->>RT: SSE event:done
    RT-->>UI: {degraded:true} → 显示 AiDegradedBanner
```

---

## 五、核心算法约定

> **总原则**：所有算法必须是**纯函数**（`src/services/**/engine/*.ts`），输入 `{state, event}`，输出 `{newState, sideEffects}`，**不允许直接做 IO**。便于单元测试与未来拆服务。

### 5.1 SRS 间隔重复算法（服务端计算，SM-2 变体 + 掌握度）

#### 5.1.1 状态机

> **口径声明（v1.2 裁决，2026-09-27）**：本节已与 Phase 1 实现对齐。§5.1.1 阈值、§5.1.3 的 `timeFactor` 与 `wrongPenalty` 采用**实现的 Phase 1 口径**（追认，见 §5.1.4 裁决 A）；**唯独间隔阶梯长尾与毕业间隔保留文档口径并列为 Phase 2 必做项**（见 §5.1.4 裁决 B）。

```mermaid
stateDiagram-v2
    [*] --> NEW : 词进入计划
    NEW --> STRANGER : 首次学习 / 自评 0-1
    STRANGER --> LEARNING : 自评 2
    LEARNING --> FAMILIAR : 自评 3
    FAMILIAR --> PROFICIENT : 自评 4
    PROFICIENT --> MASTERED : 自评 5
    LEARNING --> STRANGER : 遗忘 lapses
    FAMILIAR --> LEARNING : 遗忘 lapses
    PROFICIENT --> LEARNING : 遗忘 lapses
    MASTERED --> PROFICIENT : 长期未复习衰减
    MASTERED --> [*] : 毕业后进入 60→120→240 天低频维护
```

**掌握度 `masteryScore` (0-100) 与六状态阈值（Phase 1 实现口径 · 追认）**

| 状态 | masteryScore | 含义 |
| --- | --- | --- |
| `NEW` | — (`learnCount = 0`，未学习) | 未学习 |
| `STRANGER` | 0 – 24 | 陌生 |
| `LEARNING` | 25 – 49 | 初步掌握 |
| `FAMILIAR` | 50 – 74 | 熟悉 |
| `PROFICIENT` | 75 – 89 | 熟练 |
| `MASTERED` | 90 – 100 | 完全掌握 |

> 实现见 `srs.constants.ts:9-15` `STAGE_THRESHOLDS = { STRANGER: 0, LEARNING: 25, FAMILIAR: 50, PROFICIENT: 75, MASTERED: 90 }`。
> **阈值本身不影响调度**（间隔由 `reps` + `easeFactor` 决定，与 stage 标签解耦），仅影响 UI 标签与统计分布，故差异风险为零。


#### 5.1.2 输入与输出

```ts
export type SelfRating = 0 | 1 | 2 | 3 | 4 | 5
export type MasteryStage = 'NEW' | 'STRANGER' | 'LEARNING' | 'FAMILIAR' | 'PROFICIENT' | 'MASTERED'
export type ReviewPath = 'LAPSE' | 'ADVANCE' | 'MASTERED'

export interface SrsState {
  masteryScore: number      // 0-100
  stage: MasteryStage
  easeFactor: number        // SM-2 EF，默认 2.5，clamp [1.3, 2.8]
  intervalDays: number      // 上次间隔天数
  reps: number              // 连续成功次数
  lapses: number            // 遗忘次数
  consecutiveCorrect: number
  avgResponseMs: number
}
export interface SrsEvent {
  rating: SelfRating        // 0 完全不会 … 5 完全掌握；>=2 视为答对
  responseMs: number
  now?: Date
}
export interface SrsOutcome extends SrsState {
  path: ReviewPath          // 三条路径，对应实现的 LAPSE / ADVANCE / MASTERED
  nextReviewAt: Date        // = now + intervalDays*86400_000
  isCorrect: boolean
}
```


#### 5.1.3 公式（Phase 1 实现口径 · 伪代码与 `srs.formula.ts` 一一对应）

> 以下为**已落地实现**的等价伪代码（`src/services/vocabulary/srs/srs.formula.ts` + `srs.constants.ts`）。与 v1.1 文档稿的差异见 §5.1.4 裁决表。

```ts
// src/services/vocabulary/srs/srs.constants.ts
export const ADVANCE_INTERVALS = [1, 3, 7, 14, 30] as const   // 答对推进阶梯（天）
export const STAGE_THRESHOLDS = { STRANGER: 0, LEARNING: 25, FAMILIAR: 50, PROFICIENT: 75, MASTERED: 90 } as const
export const EASE_MIN = 1.3, EASE_MAX = 2.8, EASE_DEFAULT = 2.5
export const MASTERY = { correctBase: 12, wrongPenalty: 25, speedBonus: 4, slowPenalty: 3 } as const
export const RESPONSE_FAST_MS = 4000      // < 4s 视为快速作答
export const RESPONSE_SLOW_MS = 12000     // > 12s 视为反应迟缓

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function stageFromMastery(mastery: number): MasteryStage {
  if (mastery >= STAGE_THRESHOLDS.MASTERED) return 'MASTERED'
  if (mastery >= STAGE_THRESHOLDS.PROFICIENT) return 'PROFICIENT'
  if (mastery >= STAGE_THRESHOLDS.FAMILIAR) return 'FAMILIAR'
  if (mastery >= STAGE_THRESHOLDS.LEARNING) return 'LEARNING'
  return 'STRANGER'
}

const nextReviewFrom = (now: Date, d: number) => new Date(now.getTime() + d * 86_400_000)

export function advance(state: SrsState, rating: SelfRating, responseMs: number, now = new Date()): SrsOutcome {
  const isCorrect = rating >= 2
  const q = clamp(rating, 0, 5)

  // ---- ① EF：SM-2 原始公式（与文档 v1.1 逐字一致）----
  const newEase = clamp(state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), EASE_MIN, EASE_MAX)

  // ---- ② 掌握度：离散时间因子（Phase 1 简化，见裁决 A-3）----
  const timeFactor = responseMs > 0 && responseMs < RESPONSE_FAST_MS ? MASTERY.speedBonus
                  : responseMs > RESPONSE_SLOW_MS ? -MASTERY.slowPenalty : 0
  let newMastery: number
  if (isCorrect) {
    const ratingWeight = rating >= 4 ? 1.2 : rating === 3 ? 1 : 0.6
    newMastery = clamp(state.masteryScore + Math.round((MASTERY.correctBase + timeFactor) * ratingWeight), 0, 100)
  } else {
    newMastery = clamp(state.masteryScore - MASTERY.wrongPenalty, 0, 100)
  }

  // ---- ③ 路径 A：LAPSE（答错）→ 间隔回 1 天，EF 惩罚，reps 清零 ----
  if (!isCorrect) {
    return { ...state, masteryScore: newMastery, stage: stageFromMastery(newMastery), easeFactor: newEase,
             intervalDays: 1, reps: 0, lapses: state.lapses + 1, consecutiveCorrect: 0,
             path: 'LAPSE', nextReviewAt: nextReviewFrom(now, 1), isCorrect }
  }

  const reps = state.reps + 1
  const consecutiveCorrect = state.consecutiveCorrect + 1

  // ---- ④ 路径 B：MASTERED（毕业）→ mastery ≥ 90 且连续 3 次答对 → 间隔 45 天 ----
  if (newMastery >= STAGE_THRESHOLDS.MASTERED && consecutiveCorrect >= 3) {
    return { ...state, masteryScore: newMastery, stage: 'MASTERED', easeFactor: newEase,
             intervalDays: 45, reps, lapses: state.lapses, consecutiveCorrect,
             path: 'MASTERED', nextReviewAt: nextReviewFrom(now, 45), isCorrect }
  }

  // ---- ⑤ 路径 C：ADVANCE → 查表 × EF 缩放（EF ∈ [1.3,2.8] → 系数 ∈ [0.76, 1.06]）----
  const tableIndex = Math.min(reps - 1, ADVANCE_INTERVALS.length - 1)
  const baseInterval = ADVANCE_INTERVALS[tableIndex] ?? 30
  const scaled = Math.max(1, Math.round(baseInterval * (0.5 + (newEase / 2.5) * 0.5)))
  return { ...state, masteryScore: newMastery, stage: stageFromMastery(newMastery), easeFactor: newEase,
           intervalDays: scaled, reps, lapses: state.lapses, consecutiveCorrect,
           path: 'ADVANCE', nextReviewAt: nextReviewFrom(now, scaled), isCorrect }
}
```

**补充规则**

| 规则 | 说明 |
| --- | --- |
| 新学词队列 | 每日新词上限 = `min(plan.vocabCount, 60)`；新词与复习词穿插呈现（每学 5 个新词插 3 个复习词） |
| 到期判定 | `nextReviewAt <= now`（服务端 UTC 比较），队列排序 `nextReviewAt ASC, wrongCount DESC` |
| 首次学习 | `learnCount=0` → 学习正确给 `masteryScore = 25`（落入 `LEARNING`），第一次复习 **1 天后** |
| 幂等 | 同一 `wordId + Idempotency-Key` 只推进一次（`vocabulary_reviews.idempotencyKey` 唯一索引），避免连点导致间隔暴涨 |
| 复习未完成 | 到期未完成**不惩罚**；连续 3 天未复习仅 `lapses += 1`，不降 mastery（避免"不用心也掉分"的挫败感） |
| 事件流水 | 每次推进写 `vocabulary_reviews`（append-only），含 `prevMastery/newMastery/prevInterval/newInterval/prevEase/newEase`，用于回溯与补算 |

#### 5.1.4 ★ 裁决：Phase 1 简化口径 vs Phase 2 增强点（QA 问题 #1）

**裁决：A（追认简化）为主 + B（回改 1 项承重结构）**

| # | 项 | v1.1 文档 | Phase 1 实现 | 裁决 | 理由 |
| --- | --- | --- | --- | --- | --- |
| A-1 | 阶段阈值 | 20/45/70/90 | 25/50/75/90 | **A 追认** | 阈值与调度**解耦**（间隔只由 `reps`+`EF` 决定），仅影响 UI 标签与分布统计，零行为风险。25/50/75 的等距划分对用户更直观 |
| A-2 | `wrongPenalty` | `-18 - lapsePenalty(≤12)` | 固定 `-25` | **A 追认** | 动态惩罚会让"lapses 多的词"反复掉到 0 附近，Phase 1 缺乏调参数据支撑，固定值更可预测、更易单测 |
| A-3 | `timeFactor` | 连续 `clamp(1.2 - ms/10000, 0.8, 1.2)` | 离散 `+4 / 0 / -3` | **A 追认** | 离散实现对"熟练度"的影响更可解释（快=加分、慢=扣分），且避免连续浮点在边界反复抖动；SM-2 体系本身也不使用连续时间因子 |
| **B-1** | **间隔阶梯长尾** | `[0,1,3,7,14,30,60,120,240]` | `[1,3,7,14,30]` 封顶 | **⚠️ B 必须回改（Phase 2 P0）** | **这是承重结构，见下方量化论证** |
| B-2 | 毕业间隔 | ≥120 天 | 45 天 | **B 部分回改（Phase 2 P1）** | 45 天可跑通闭环，但会让"已掌握词"长期占用复习队列；建议随 B-1 一并延长至 `60 → 120 → 240` 三级阶梯 |
| B-3 | LAPSE 同轮重试 | 0 天（10 分钟后） | 1 天 | **A 追认（记为 Phase 2 增强）** | 同轮重试会打乱"今日复习队列"的计数与完成率判定（M3），Phase 1 不引入；Phase 2 以"队列内重排"而非"改 nextReviewAt"的方式实现，可完全规避该副作用 |

**B-1 量化论证（为什么间隔阶梯不能封顶在 30 天）**

设用户已掌握词量 `W`，平均复习间隔 `I` 天 → 稳态日复习量 ≈ `W / I`：

| 方案 | 阶梯 | W=5000（CET-4 全量） | W=20000（含 CET-6） | 按 8s/词折算 |
| --- | --- | --- | --- | --- |
| Phase 1 实现（封顶 30 天 + EF 缩放 ≤1.06 → 实际 ~32 天） | 1/3/7/14/30 | **~167 词/天** | **~667 词/天** | **22 min / 89 min** |
| 文档口径（含 60/120/240 长尾，均值 ~120 天） | …/60/120/240 | **~42 词/天** | **~167 词/天** | **5.6 min / 22 min** |

- **M2 成功指标 = 22 min/DAU**。按实现口径，**仅词汇维护一项就吃满 100% 的时间预算**（5000 词时），听力/口语/阅读/写作全部无处安放 → **M3 计划完成率必然崩塌**。
- 5000 词规模下，长尾阶梯把词汇维护从 **22 min 压到 5.6 min**，释放的 16.4 min 正好容纳听力+口语+阅读+写作四类任务（§5.2 预算）。
- 因此 **B-1 不是代码风格问题，是产品指标能否成立的问题**，必须回改。

**Phase 2 增强点清单（写入 Backlog，不在 Phase 1 范围）**

| ID | 增强项 | 目标 | 优先级 |
| --- | --- | --- | --- |
| SRS-P2-1 | `ADVANCE_INTERVALS` 扩展为 `[1,3,7,14,30,60,120,240]`，毕业改为 `60 → 120 → 240` 三级递进 | 稳态复习量降至 1/4，保住 M2 预算 | **P0** |
| SRS-P2-2 | `LEARNING/review` 队列内"答错词本轮末尾重排"（**不改 `nextReviewAt`**） | 提升短期巩固，同时不污染 M3 完成率 | P1 |
| SRS-P2-3 | `lapses ≥ 2` 的词触发 `MASTERY` 惩罚递增（恢复文档的动态惩罚） | 长期顽固错词更快回落 | P1 |
| SRS-P2-4 | 依据 `avgResponseMs` 的分位数（而非固定 4s/12s 阈值）动态标定快慢边界 | 消除"快慢"的主观阈值 | P2 |
| SRS-P2-5 | 复习负担预测：`Σ (1/I_i) × 8s` 作为每日复习 ETA 展示在 `/vocabulary/review` | 用户可预期、可调节 | P2 |

### 5.2 每日任务生成算法（输入：目标/可用时间/弱项）

> **口径声明（v1.2 裁决，QA 问题 #9）**：**A 追认 Phase 1 线性分配**，但**本节承诺不删除**——权重式算法作为 **Phase 2 P0** 实现，规格见 §5.2.2。
>
> **裁决的关键依据（这是"数据时序约束"，不是"实现偷懒"）**：`abilityVector` 的唯一写入点是 `placement.service.ts:224`，即**用户完成 Placement Test 之后**。而 Onboarding（第 3 步）在 PRD 主路径中**先于** Placement Test：
>
> ```
> Landing → 注册 → Onboarding(8步) → Placement Test → AI 学习计划
>                    ↑                    ↑
>             首周任务在此生成      abilityVector 在此才产生
> ```
>
> 因此在 `generateFirstWeekTasks()` 被调用的时刻，**弱项数据在物理上尚不存在**，权重算法无法运行。当前线性分配的 `dailyMinutes × 固定系数`（`onboarding.service.ts:115-117`：词汇 0.4 / 复习 0.3 / 阅读 0.3）是该时点下**唯一可用的正确解**。

#### 5.2.1 Phase 1 口径（已落地 · 追认）

```ts
// src/services/onboarding.service.ts · generateFirstWeekTasks()
const vocabCount   = Math.max(5,  Math.round(dailyMinutes * 0.4))   // 词汇：新词
const reviewCount  = Math.max(10, Math.round(dailyMinutes * 0.3))   // 复习：到期词
const readingMin   = Math.max(5,  dailyMinutes - Math.round(dailyMinutes * 0.7))  // 阅读：剩余分钟
// 7 天 × 3 类；已存在任务的日期跳过（幂等）
```

| 项 | Phase 1 实际行为 | 说明 |
| --- | --- | --- |
| 任务种类 | 仅 `VOCAB` + `REVIEW` + `READING` 三类 | 听力/口语/写作任务待 Phase 2 |
| 分配依据 | 仅 `dailyMinutes` 线性 | 无弱项差异化（数据尚不存在） |
| 天数 | 7 天（`date` 本地日期，UTC 口径 `dateOffset`） | 与 §5.1 `nextReviewAt` 口径一致 |
| 幂等 | 先查已有 `date` 集合，命中则跳过 | ✅ 已实现 |
| 完成率自适应 | ❌ 未实现 | Phase 2（依赖 §5.6 的 `history`） |

**产品影响评估（诚实结论）**

| 维度 | 影响 | 严重度 |
| --- | --- | --- |
| 闭环可用性 | ✅ 无影响。注册→测评→看板→学词全链路通，7 天任务足够撑起 D1–D7 留存 | — |
| PRD 卖点"千人千面" | ⚠️ **首周未体现**。所有同 `dailyMinutes` 的用户首周任务完全一致 | 中（Phase 2 补齐） |
| M3 完成率 ≥60% | ✅ 反而**更有利**：线性分配目标可完成度高，权重分配在能力数据不足时易产生"听不懂的听力任务"导致完成率塌陷 | — |
| A7 `PLAN_GENERATE`（AI 计划） | ✅ 不受影响。AI 计划走 `POST /api/study-plan/generate`（§3.5.3 #28），可在 Placement 之后运行 | — |

> **一句话结论**：Phase 1 的线性分配在"Placement 之前"这个时点是**正确工程决策**，而非功能缺失；真正缺失的是**权重算法本身**，已列为 Phase 2 P0。

#### 5.2.2 Phase 2 规格（权重式任务生成 · P0 · 不删承诺）

**触发时机（关键变更）**：Phase 2 的权重式任务生成**不在 Onboarding 阶段触发**，而在以下三个时机之一：

```ts
export type PlanRegenerateTrigger =
  | { kind: 'PLACEMENT_COMPLETED' }                       // Placement 交卷后立即重算剩余首周任务
  | { kind: 'DAILY_CRON' }                                // 每日 06:00（用户本地时区）滚动生成次日任务
  | { kind: 'PLAN_ADJUST'; reason: string }              // §5.6 计划调整时重算
```

**算法规格（保持原设计不变）**

```ts
export interface PlanInput {
  dailyMinutes: number
  weeklyDays: number
  ability: AbilityVector                  // 0-100 六维，Phase 2 起由 Placement 填充
  goal: { examType: ExamType; targetScore?: number; targetDate?: Date }
  history: { avgCompletionRate: number; last7Completion: number[] }
  dueReviewCount: number
}

const BASE_WEIGHT = { VOCAB: 0.35, LISTENING: 0.25, READING: 0.20, WRITING: 0.10, SPEAKING: 0.10 }

export function generateDailyTasks(i: PlanInput): DailyTask[] {
  // ① 权重调整：弱项优先（能力分最低的 2 项各 +0.08）；强项（>=85）-0.05
  const sorted = Object.entries(i.ability).sort((a, b) => a[1] - b[1])
  const w = { ...BASE_WEIGHT }
  for (const [k] of sorted.slice(0, 2)) w[k] += 0.08
  for (const [k, v] of Object.entries(i.ability)) if (v >= 85) w[k] -= 0.05
  // ② 考试目标加权：CET4/6 目标者加大阅读+听力，口语权重让位
  if (['CET4', 'CET6'].includes(i.goal.examType)) { w.READING += 0.05; w.LISTENING += 0.05; w.SPEAKING -= 0.10 }
  // ③ 完成率自适应
  const M = Math.round(i.dailyMinutes * (i.history.avgCompletionRate < 0.5 ? 0.8 : 1))
  const sum = Object.values(w).reduce((a, b) => a + b, 0)
  for (const k in w) w[k] /= sum
  return [
    { type: 'VOCAB',     target: clamp(Math.round(M * w.VOCAB * 1.2), 10, 60), unit: 'word' },   // ~1.2 词/分钟
    { type: 'REVIEW',    target: Math.min(i.dueReviewCount, Math.round(M * w.VOCAB * 0.8) + 10), unit: 'word' },
    { type: 'LISTENING', target: Math.max(Math.round(M * w.LISTENING), 5), unit: 'minute' },
    { type: 'READING',   target: clamp(Math.round(M * w.READING / 8), 1, 5), unit: 'piece' },   // ~8min/篇
    { type: 'WRITING',   target: clamp(Math.round(M * w.WRITING / 25), 0, 2), unit: 'piece' },  // ~25min/篇
    { type: 'SPEAKING',  target: Math.max(Math.round(M * w.SPEAKING), 0), unit: 'minute' },
  ].filter(t => t.target > 0)
}
```

**验收标准（Phase 2）**

| # | 标准 |
| --- | --- |
| 1 | Placement 交卷后，**未完成的**首周任务被权重重算（已完成的**不动**，保证 M3 口径稳定） |
| 2 | 弱项用户（`listening=30`）的每日听力分钟数显著高于强项用户（`listening=90`），差异 ≥ 2 倍 |
| 3 | CET4/6 目标用户的任务结构中 `SPEAKING` 占比 ≤ 5%，`READING + LISTENING` ≥ 45% |
| 4 | `avgCompletionRate < 0.5` 的用户总时长自动降档 20% |
| 5 | 生成算法为**纯函数**，单测覆盖 4 条分支（弱项/强项/CET 加权/完成率降档） |
| 6 | 幂等：同 `(userId, date, taskType)` 不重复建行；重跑覆盖未完成任务 |

**周目标 = 每日目标 × `weeklyDays`（保留 15% 弹性缓冲），剩余天数按 `Math.round(total/7)` 摊薄，保证哪怕只学 5 天也能接近周目标。**


### 5.3 推荐引擎规则（弱项优先 + 难度渐进 + 去重）

```ts
const DEDUPE_WINDOW_DAYS = 14
const HALF_LIFE_DAYS = 7   // 曝光衰减半衰期

/**
 * @param it.item - 候选内容 { type, id, difficulty, abilityDimension, popularity, tags }
 * @param ctx.user - { ability, recentItems(14天内曝光), avgAccuracy }
 */
export function score(item: Candidate, ctx: RecommendContext): number {
  const weaknessFit   = 1 - (ctx.ability[item.abilityDimension] ?? 50) / 100        // 越弱分越高
  const target = 50 + ctx.avgAccuracy * 0.4                                          // 目标难度随正确率上浮
  const difficultyFit = 1 / (1 + Math.abs(item.difficultyScore - target) / 25)       // 越贴近越好
  const freshness     = 0.5 ** (daysSince(item.publishedAt) / 30)                    // 新内容略加权
  const exposure      = ctx.recentItems.filter(x => x.id === item.id).length         // 曝光次数
  const exposurePenalty = exposure === 0 ? 1 : 1 / (1 + exposure)                    // 曝光越多越降权
  const s = 0.40 * weaknessFit + 0.25 * difficultyFit + 0.10 * freshness + 0.25 * Math.log1p(item.popularity) / 10
  return s * exposurePenalty * (item.type === 'SPEAKING' && !ctx.micGranted ? 0.3 : 1)
}

export function recommend(ctx: RecommendContext, pools: Candidate[], limit = 6): Recommendation[] {
  return pools
    .filter(i => !ctx.blockedIds.includes(i.id))
    .filter(i => !ctx.recentItems.some(r => r.id === i.id && r.daysAgo <= DEDUPE_WINDOW_DAYS)) // 去重窗口硬过滤
    .map(i => ({ item: i, score: score(i, ctx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ ...r.item, reason: buildReason(r.item, ctx) }))  // "你最近过去完成时错误率较高"
}
```

**难度渐进规则（推荐 + 内容分配统一）**

| 当前 mastery / 正确率 | 选难度 |
| --- | --- |
| `< 40` 或 正确率 `< 60%` | `EASY` |
| `40 – 70` | `MEDIUM` |
| `> 70` 且 正确率 `> 85%` | `HARD` |

### 5.4 XP / 等级 / Streak 计算规则

**XP 来源表（`src/services/gamification/level.ts`）**

| 行为 | XP | 备注 |
| --- | --- | --- |
| 学会 1 个新词 | +2 | 首次 `learnCount 0→1` |
| 复习正确 1 次 | +1 | 上限 100/日，防刷 |
| 完成 1 篇听力材料 | +20 | 按 mode 加成 精听 ×1.2 |
| 完成 1 篇听力训练 | +15 | |
| 读完 1 篇文章 | +25 | quiz ≥ 80% 额外 +10 |
| 完成 1 次口语会话 | +30 | ≥ 3 分钟才计 |
| 提交 1 篇作文 | +50 | AI 批改额外 +20 |
| 完成 1 次模拟考 | +80 | |
| 完成 1 项每日任务 | +5 | |
| 达成当日全部任务 | +30 | Bonus |
| 完成每日挑战 | +100 | |
| 考试分数每 1 分 | +0.5 | |

**等级阈值（累计 XP）**

| Lv | 名称 | 累计 XP |
| --- | --- | --- |
| 1 | Beginner | 0 |
| 2 | Learner | 500 |
| 3 | Explorer | 1,500 |
| 4 | Achiever | 3,500 |
| 5 | Expert | 7,000 |
| 6 | Master | 15,000 |

```ts
export const LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7000, 15000]
export const levelOf = (xp: number) => LEVEL_THRESHOLDS.reduce((lv, t, i) => (xp >= t ? i + 1 : lv), 1)
export const levelProgress = (xp: number) => {
  const lv = levelOf(xp)
  const cur = LEVEL_THRESHOLDS[lv - 1]
  const next = LEVEL_THRESHOLDS[lv] ?? null
  return { level: lv, current: xp - cur, needed: next ? next - cur : null, percent: next ? ((xp - cur) / (next - cur)) * 100 : 100 }
}
```

**Streak 规则（关键：以"用户本地日期"为准）**

```ts
export function updateStreak(stats: { streakDays: number; longestStreak: number; lastStudyDate: string | null },
                             todayLocal: string /* YYYY-MM-DD */) {
  if (stats.lastStudyDate === todayLocal) return stats                    // 今天已记过
  const yesterday = formatDate(subDays(parseLocalDate(todayLocal), 1))
  const streakDays = stats.lastStudyDate === yesterday ? stats.streakDays + 1 : 1
  return {
    streakDays,
    longestStreak: Math.max(stats.longestStreak, streakDays),
    lastStudyDate: todayLocal,
  }
}
```

> **触发点**：任何写 `learning_records` 的行为都必须在同一事务调用 `updateStreak` + `daily_learning_stats` upsert。
> **连续性宽限**：不做"补卡"，但提供 `STREAK_REMINDER` 通知（用户自定义时间推送，数据保留遵循 Q13 决策）。

### 5.5 CEFR 与 CET 分数估算映射

```ts
// Placement 综合分 0-100 与分项 sex.wave dimension
export function mapCefr(score: number): CEFRLevel {
  if (score >= 88) return 'C2'
  if (score >= 78) return 'C1'
  if (score >= 65) return 'B2'
  if (score >= 50) return 'B1'
  if (score >= 33) return 'A2'
  return 'A1'
}

const CET_BASE: Record<CEFRLevel, number> = { A1: 220, A2: 330, B1: 420, B2: 520, C1: 600, C2: 660 }
const BAND_CENTER: Record<CEFRLevel, number> = { A1: 20, A2: 42, B1: 58, B2: 72, C1: 84, C2: 94 }

/** 粗估 710 分制；Phase 1 用规则标定（PRD Q9），后续用真实样本回归替换系数 */
export function estimateCet(overall: number, level: CEFRLevel, exam: 'CET4' | 'CET6') {
  const base = CET_BASE[level]
  const adjust = Math.round(0.5 * (overall - BAND_CENTER[level]))          // ±25 区间内
  const raw = exam === 'CET4' ? base + adjust : (base + adjust) * 0.92     // CET-6 同水平分略低
  return clamp(Math.round(raw), 220, 700)
}

/** 达标剩余周数（PRD §5.4 B7）*/
export function etaWeeksToTarget(current: number, target: number, dailyMinutes: number, exam: 'CET4' | 'CET6') {
  if (target <= current) return 0
  const gapMonthly = 3.5 * Math.sqrt(dailyMinutes / 30) * (target - current > 100 ? 0.8 : 1)  // 每周提升的分值
  return Math.max(1, Math.ceil((target - current) / Math.max(gapMonthly, 1)))
}

/** 六维能力分（0-100）：PlacementTest.scores 直接映射，随学习事件滚动更新 */
export function updateAbility(prev: AbilityVector, ev: LearningEvent): AbilityVector {
  // 指数移动平均，新事件权重 0.15
  const alpha = 0.15
  return { LISTENING: prev.LISTENING * (1 - alpha) + ev.dimensionScore * alpha, ... }
}
```

### 5.6 学习计划自动调整触发条件

```ts
export interface AdjustTriggerResult {
  action: 'DOWNGRADE' | 'UPGRADE' | 'KEEP' | 'RESCUE_DATE'
  factor: number
  reason: string
}

export function evaluateAdjust(history: { rate: number }[] /* 最近 N 天，history[0]=昨天 */): AdjustTriggerResult {
  const missStreak = takeWhile(history, h => h.rate < 0.6).length
  const strongStreak = takeWhile(history, h => h.rate >= 0.95).length

  if (missStreak >= 5)  return { action: 'RESCUE_DATE', factor: 1, reason: '连续 5 天未完成，建议延长目标日期或降低每周天数' }
  if (missStreak >= 3)  return { action: 'DOWNGRADE', factor: 0.7, reason: `检测到连续 ${missStreak} 天未完成，已为你下调本周强度` }
  if (strongStreak >= 3) return { action: 'UPGRADE', factor: 1.15, reason: '连续 3 天超额完成，已为你略微增加强度' }
  return { action: 'KEEP', factor: 1, reason: '' }
}

/** DOWNGRADE 的裁剪优先级：先砍 SPEAKING → WRITING → READING → LISTENING，VOCAB 与弱项最后砍 */
export function applyAdjust(tasks: DailyTask[], trigger: AdjustTriggerResult, ability: AbilityVector) {
  const order: TaskType[] = ['SPEAKING', 'WRITING', 'READING', 'LISTENING', 'REVIEW', 'VOCAB']
  const budget = 1 - trigger.factor
  let remaining = tasks.filter(t => t.type !== 'VOCAB').reduce((s, t) => s + t.target, 0) * budget
  return tasks.map(t => {
    if (t.type === 'VOCAB') return { ...t, target: Math.max(10, Math.round(t.target * trigger.factor / 5) * 5) }  // 保底 10 词
    if (remaining <= 0) return { ...t, target: Math.max(0, t.target) }
    const cut = Math.min(Math.round(t.target * budget), Math.round(remaining))
    remaining -= cut
    return { ...t, target: t.target - cut }
  }).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
}
```

**触发时机**：每日 06:00（用户本地时区）由 `npm run cron:daily`（或 Next Route Handler + Vercel Cron / node-cron）扫描活跃用户；用户下次打开 `/plan` 时若发现未确认的调整 → 显示 `AdjustNotice` 卡（接受 / 还原）。**调整必须 `study_plans.version += 1` 并写 `lastAdjustReason`**，历史版本可在 `/plan/history` 查看。

---

## 六、项目目录结构

### 6.1 顶层

```
D:/徐浩然/2026-09-26-21-59-15/englishai/
├── .env.example                    # 环境变量样例（必须纳入仓库）
├── .env.local                      # 本地实际值（.gitignore）
├── .npmrc                          # npmmirror 镜像 + Prisma/Playwright 走代理
├── .nvmrc                          # 团队 Node 基线：22
├── .gitignore
├── .editorconfig
├── .eslintrc.json / eslint.config.mjs
├── .prettierrc
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json                   # strict + paths @/*
├── components.json                 # shadcn/ui 配置
├── vitest.config.ts
├── playwright.config.ts
├── Dockerfile                      # 多阶段构建（runner 阶段不含 embedded-postgres）
├── docker-compose.yml              # app + postgres（有 Docker 的环境才需要，可选）
├── README.md
├── package.json
├── .data/                          # ★ Tier A 内嵌 PG 数据目录（.gitignore，禁止提交）
│   ├── pg/                         #   PG cluster（PG_VERSION / base / global …）
│   ├── pg.pid                      #   守护进程 pid（单例控制）
│   └── pg.log                      #   守护进程日志
├── prisma/                         # 见 6.2
├── public/                         # 静态资源
├── scripts/                        # 见 6.3
├── docs/                           # 01-prd.md 02-architecture.md (本文档)
└── src/                            # 见 6.4
```

### 6.2 `prisma/` — 数据层

| 路径 | 职责 |
| --- | --- |
| `prisma/schema.prisma` | **正式 schema（PostgreSQL，`provider = "postgresql"` 永不改动）**，唯一权威 |
| `prisma/schema.sqlite.prisma` | 由脚本生成的 SQLite 逃生版本（**不要手工改**） |
| `prisma/migrations/**` | Prisma 迁移脚本，纳入仓库 |
| `prisma/seed/index.ts` | seed 总入口（幂等，可重复执行） |
| `prisma/seed/seed-roles.ts` | 初始化 `roles/permissions/user_roles` 矩阵 |
| `prisma/seed/seed-admin.ts` | 初始化超级管理员 `admin@englishai.dev` / `EnglishAI@2026` |
| `prisma/seed/seed-vocabulary.ts` | CET-4 3000 / CET-6 2000 高频词（CSV → DB） |
| `prisma/seed/seed-content.ts` | 听力 20 篇 / 阅读 60 篇 / 语法 14 类 / 写作任务 30 个 |
| `prisma/seed/seed-questions.ts` | Placement 题 60 题（CAT 分档）+ 通用题库 |
| `prisma/seed/seed-ai.ts` | `ai_capability_config` 18 条 + `ai_prompts` v1 全量 |
| `prisma/seed/seed-achievements.ts` | 成就定义 24 条 |
| `prisma/data/*.csv` | 词表/题目原始数据（体积小，纳入仓库） |

### 6.3 `scripts/` — 运维脚本

| 路径 | 职责 |
| --- | --- |
| **`scripts/pg-daemon.mjs`** | ★ **Tier A 内嵌 PostgreSQL 单例守护**：`PG_VERSION` 判已初始化 → 跳过 initdb；pid 文件判已在跑 → exit 0；启动后建 `englishai` / `englishai_test` 并打印 `DATABASE_URL`（设计全文见 §2.6.1-④） |
| `scripts/pg-stop.mjs` | 读 `.data/pg.pid` 优雅停止 PG，清理 pid 文件 |
| `scripts/pg-status.mjs` | 打印：是否已初始化 / 是否在跑 / PG 版本 / 端口 / 数据目录大小 |
| `scripts/use-driver.ts` | `npm run db:use-sqlite` / `db:use-cloud`：只改 `.env`，一键切换 Tier（业务代码零改动） |
| `scripts/gen-sqlite-schema.ts` | `schema.prisma → schema.sqlite.prisma`（enum→String / Json→String） |
| `scripts/check-env.ts` | 启动前校验 env 完整性 + **Node 版本符合 `engines`** + DB 连通性 + AI provider 健康检查 |
| `scripts/rebuild-stats.ts` | `npm run stats:rebuild -- --userId=xxx` 重算预聚合日表 |
| `scripts/export-user-data.ts` | 用户数据导出（GDPR / PRD R051） |

### 6.4 `src/` — 源码

```text
src/
├── app/
│   ├── api/                                    # 仅放 Route Handler（薄层）
│   │   ├── health/route.ts
│   │   ├── auth/{register,login,logout,refresh,forgot-password,reset-password,me}/route.ts
│   │   ├── user/{profile,settings,avatar,export}/route.ts
│   │   ├── user/goals/route.ts
│   │   ├── onboarding/route.ts
│   │   ├── placement/{route.ts,[id]/{questions,answer,submit,report}/route.ts}
│   │   ├── dashboard/{route.ts,ai-suggestion/route.ts,tasks/[id]/complete/route.ts}
│   │   ├── study-plan/{route.ts,generate/route.ts,adjust/route.ts,history/route.ts,mode/route.ts}
│   │   ├── study-plan/tasks/[id]/route.ts
│   │   ├── vocabulary/{today,review-queue,review,learn,books,search,records,mastery,notebook,explain,scenario}/route.ts
│   │   ├── vocabulary/[id]/route.ts
│   │   ├── listening/{route.ts,[id]/{route.ts,questions/route.ts,attempts/route.ts},report/[recordId]/route.ts,…}
│   │   ├── speaking/{catalog,session,transcribe,pronunciation,sessions}/route.ts
│   │   ├── reading/[id]/{route.ts,quiz/route.ts,quiz/submit/route.ts,explain/route.ts,progress/route.ts}
│   │   ├── writing/{tasks,submissions,analyze}/route.ts  writing/[id]/{route.ts,report/route.ts}
│   │   ├── grammar/topics/route.ts  grammar/[id]/{route.ts,exercise/route.ts,explain/route.ts}
│   │   ├── translation/{translate,history}/route.ts
│   │   ├── exams/{route.ts,[id]/start/route.ts,attempts/[id]/…,zones/[type]/route.ts}
│   │   ├── mistakes/{route.ts,[id]/…,repractice/route.ts}
│   │   ├── favorites/route.ts
│   │   ├── analytics/{route.ts,trend,history,calendar}/route.ts
│   │   ├── ai/{conversations,chat,diagnosis,recommend,cet-advice}/route.ts
│   │   ├── search/route.ts
│   │   ├── notifications/route.ts
│   │   ├── achievements|challenge|leaderboard/route.ts
│   │   └── admin/{overview,analytics,users,content,ai,roles,audit-logs}/**/route.ts
│   │
│   ├── globals.css
│   ├── layout.tsx                              # Root html/body + ThemeProvider + i18n provider
│   ├── error.tsx / not-found.tsx / global-error.tsx
│   └── [locale]/
│       ├── layout.tsx                          # 公共/认证共用外壳（AuthProvider + QueryClientProvider）
│       ├── page.tsx                            # Landing
│       ├── (auth)/{login,register,forgot-password}/page.tsx
│       ├── (app)/
│       │   ├── layout.tsx                      # AppShell：Sidebar + TopNav（PC）/ BottomNav（移动）+ 路由守卫
│       │   ├── dashboard/page.tsx
│       │   ├── onboarding/page.tsx
│       │   ├── placement/page.tsx              #  + placement/report/[id]/page.tsx
│       │   ├── plan/page.tsx                   #  + plan/history/page.tsx
│       │   ├── modes/page.tsx   diagnosis/page.tsx
│       │   ├── vocabulary/{page,learn,review,library,search,records,mastery,notebook}/page.tsx
│       │   ├── vocabulary/word/[id]/page.tsx
│       │   ├── listening/{page,player/[id],training/[id],report/[id]}/page.tsx
│       │   ├── speaking/{page,partner/[id],pronunciation,report/[id]}/page.tsx
│       │   ├── reading/{page,[id]/page,[id]/quiz/page}/page.tsx
│       │   ├── writing/{page,[id]/page,[id]/report/page}/page.tsx
│       │   ├── translation/page.tsx
│       │   ├── grammar/{page,[id]/page,[id]/exercise/page}/page.tsx
│       │   ├── exam/{page,cet4,cet6,paper/[id],report/[id],practice/[id]}/page.tsx
│       │   ├── mistakes|favorites/page.tsx
│       │   ├── analytics|history|study-calendar/page.tsx
│       │   ├── achievements|challenge|leaderboard/page.tsx
│       │   ├── ai/{tutor,chats}/page.tsx
│       │   ├── profile/page.tsx
│       │   ├── settings/{layout,page,account,security,privacy,notification,goal,ai,appearance,data}/page.tsx
│       │   ├── search|notifications|error/page.tsx
│       │   └── admin/{page,analytics,users,roles,ai}/page.tsx + admin/content/[entity]/page.tsx
│       └── admin/layout.tsx                    # ADMIN 守卫 + 审计上下文
│
├── components/
│   ├── ui/                                     # shadcn/ui 生成的原始组件（不改逻辑，只加 variant）
│   │   button.tsx card.tsx dialog.tsx sheet.tsx tabs.tsx toast.tsx input.tsx select.tsx
│   │   dropdown-menu.tsx skeleton.tsx progress.tsx badge.tsx avatar.tsx slider.tsx
│   │   switch.tsx checkbox.tsx radio-group.tsx textarea.tsx tooltip.tsx popover.tsx
│   │   accordion.tsx alert-dialog.tsx table.tsx data-table.tsx command.tsx separator.tsx scroll-area.tsx
│   ├── layout/                                 # AppShell 组合
│   │   app-shell.tsx sidebar.tsx sidebar-nav.tsx top-nav.tsx bottom-nav.tsx
│   │   page-header.tsx page-container.tsx theme-toggle.tsx locale-switcher.tsx
│   │   user-menu.tsx global-search-trigger.tsx notification-bell.tsx mobile-nav-drawer.tsx
│   ├── common/                                 # 通用业务无关复合组件
│   │   stat-card.tsx empty-state.tsx error-state.tsx loading-overlay.tsx
│   │   skeleton-kit.tsx confirm-dialog.tsx pagination.tsx infinite-scroll.tsx
│   │   section-title.tsx chip-filter.tsx tag-badge.tsx avatar-upload.tsx date-range-picker.tsx
│   ├── charts/                                 # 全部 client-only + dynamic import
│   │   lazy-line-chart.tsx lazy-bar-chart.tsx lazy-pie-chart.tsx
│   │   lazy-radar-chart.tsx lazy-heatmap.tsx
│   │   progress-ring.tsx ability-radar.tsx streak-calendar.tsx level-ring.tsx
│   └── feedback/                               # AI 与反馈
│       ai-stream-bubble.tsx ai-thinking.tsx ai-degraded-banner.tsx
│       retry-boundary.tsx global-error-boundary.tsx
│
├── features/                                   # 按能力域组织，每个域内部自洽
│   └── <domain>/
│       ├── components/                         # 该域私有 UI
│       ├── hooks/                              # 该域私有 hooks（TanStack Query 为主）
│       ├── api.ts                              # 该域对 /api 的调用封装（纯函数）
│       └── schemas.ts                          # 该域 Zod schema（前后端共用）
│   例：auth/ dashboard/ onboarding/ placement/ plan/ vocabulary/
│        listening/ speaking/ reading/ writing/ grammar/ translation/
│        exam/ mistakes/ favorites/ analytics/ gamification/ ai/
│        profile/ settings/ search/ notification/ admin/
│
├── services/                                   # server-only 业务层（禁止 import next/*）
│   ├── auth.service.ts  user.service.ts  profile.service.ts
│   ├── onboarding.service.ts  placement.service.ts  dashboard.service.ts
│   ├── plan.service.ts          plan/planner.ts  plan/adjust.ts
│   ├── vocabulary.service.ts
│   ├── vocabulary/srs/srs.engine.ts  srs.formula.ts  srs.types.ts  srs.constants.ts
│   ├── listening.service.ts  speaking.service.ts  reading.service.ts
│   ├── writing.service.ts     writing/rule-check.ts
│   ├── grammar.service.ts     translation.service.ts
│   ├── exam.service.ts        exam/grading.ts  exam/answer-lock.ts
│   ├── mistake.service.ts     favorite.service.ts  search.service.ts
│   ├── analytics.service.ts   analytics/aggregation.ts  analytics/report.ts
│   ├── gamification.service.ts  gamification/level.ts  gamification/streak.ts  gamification/achievement.ts
│   ├── notification.service.ts  admin.service.ts  audit.service.ts
│   └── ai/
│       ├── gateway.ts          # AiGateway 实现（唯一出口）
│       ├── ai.service.ts       # 18 个语义方法
│       ├── types.ts            # 全部类型签名
│       ├── registry.ts         # ProviderRegistry + CircuitBreaker
│       ├── prompt-registry.ts  # DB 优先 + 灰度
│       ├── struct-guard.ts     # Zod 校验 + 修补重试
│       ├── degrade.ts          # 降级策略矩阵
│       ├── meter.ts            # token 计量 + 配额
│       ├── pricing.ts
│       ├── providers/{openai-compatible,deepseek,ollama,mock,index}.ts
│       ├── prompts/seed/*.ts   # Prompt 种子常量（真相源）
│       └── schemas/*.ts        # 每个能力的输出 Zod schema
│
├── lib/
│   ├── db.ts                                   # PrismaClient 单例（dev 防热重载多实例）
│   ├── tx.ts                                   # 事务包装 + 乐观锁重试
│   ├── api/{response,errors,handler,pagination,zod}.ts
│   ├── auth/{jwt,password,session,rbac,csrf,rate-limit,login-guard}.ts
│   ├── http/{client,endpoints,sse}.ts          # 客户端 API 封装 + SSE 读取器
│   ├── ai/{adapter,pricing}.ts
│   ├── cache/{memory-cache,keys}.ts
│   ├── logger/{logger,request-context}.ts
│   ├── i18n/{request,navigation,routing}.ts
│   ├── utils/{cn,date,format,id,safe-json,size,magic-number}.ts
│   └── constants/{enums,config,routes,ui,breakpoints}.ts
│
├── hooks/                                      # 跨域通用 hooks
│   use-ai-stream.ts  use-debounce.ts  use-local-draft.ts  use-media-recorder.ts
│   use-hotkey.ts  use-theme.ts  use-mounted.ts  use-abortable.ts
│
├── stores/                                     # Zustand（仅 UI 状态）
│   ui.store.ts  sidebar.store.ts  audio-player.store.ts  review.store.ts  filters.store.ts
│
├── types/
│   ├── api.ts                                  # ApiResponse / ApiError / ApiMeta
│   ├── dto/{auth,user,vocabulary,plan,exam,ai,…}.dto.ts
│   ├── domain/{ability,srs,plan,task,content}.ts
│   └── enums.ts                                # 由 Prisma enum 镜像出的 TS 常量 + Zod
│
├── styles/
│   ├── globals.css  tokens.css  themes.css  utilities.css
│
└── tests/
    ├── unit/{srs,planner,level,streak,cefr,grading,degrade}.spec.ts
    ├── integration/{auth,vocabulary-review,exam-submit,plan-adjust}.spec.ts
    ├── fixtures/                               # 测试夹具
    └── e2e/                                    # Playwright
        register.spec.ts  login.spec.ts  word-learn.spec.ts  submit-exercise.spec.ts
        ai-chat.spec.ts   writing-analyze.spec.ts  exam-submit.spec.ts  analytics.spec.ts
```

### 6.5 命名与导出约定

| 项 | 约定 | 示例 |
| --- | --- | --- |
| 目录 | `kebab-case` | `ai-stream-bubble/` `srs.engine.ts`（同目录用点分职能） |
| React 组件文件 | `kebab-case.tsx`，默认导出 PascalCase 组件 | `word-card.tsx` → `export default function WordCard()` |
| 非组件文件 | `kebab-case.ts`，**命名导出**（禁 default，便于重构） | `export function nextSchedule()` |
| Prisma 模型 | PascalCase 单数 → `@@map` 到 snake_case 复数 | `User` → `users` |
| Zod schema | `xxxSchema` / 输入 `xxxInputSchema` | `writingAnalyzeInputSchema` |
| DTO | `<Entity><Action>Dto` | `VocabularyTodayResponseDto` |
| Service | **class 单例导出**，方法为动词短语 | `export const vocabularyService = new VocabularyService()` |
| API route 文件 | 固定 `route.ts`，内部导出 `GET/POST/PATCH/DELETE` 常量 | |
| 常量 | `SCREAMING_SNAKE_CASE` | `LADDER_DAYS` `LEVEL_THRESHOLDS` |
| i18n key | `域.模块.键` | `vocabulary.review.empty.title` |

### 6.6 Server / Client Component 边界

```mermaid
graph LR
    SC["Server Component<br/>(默认)"] -->|需要交互/浏览器 API| CC["'use client'"]
    SC --> LAYOUT["app/[locale]/(app)/layout.tsx<br/>取 session → AppShell"]
    LAYOUT --> GUARD["服务端鉴权 + 重定向"]
    LAYOUT --> HYD["QueryClientProvider (dehydrate/hydrate)"]
    CC --> DATA["TanStack Query 拉 /api/**"]
    CC --> STREAM["useAiStream（SSE）"]
    SC --> DIRECT["直接调用 service 拉首屏数据<br/>（不经 HTTP，减少往返）"]
```

| 规则 | 说明 |
| --- | --- |
| 默认 Server Component | 页面级 `page.tsx` 默认 SC，**首屏数据直接调 service 拿**（不经自己的 HTTP API），保障 M5 ≤ 3s |
| 何时 `'use client'` | 需要 `useState/useEffect`、浏览器 API（audio/MediaRecorder/localStorage）、事件处理、Framer Motion、TanStack Query Provider |
| Props 边界 | 传给 Client Component 的 props 必须可序列化；**禁止把 Prisma 对象直接当 props**（先过 DTO mapper） |
| 水合一致性 | `ssr:false` 的动态 import 只用于图表/播放器；禁止在 SC 内用 `Date.now()` 渲染 UI |
| Server Actions 边界 | **仅用于表单类简单写操作**（设置、资料更新、收藏）；**AI 调用、考试交卷、SRS 复习一律走 Route Handler**（需要精细的错误码/流式/幂等控制）。Server Actions 必须 `revalidatePath` + 返回 `{ok, error}` |
| `lib/services` 禁止 | `services/**` 内禁止 `import 'server-only'` 之外再引用 `next/headers` 等（应在 handler 里取好后以参数传入） |

---

## 七、组件设计

### 7.1 Design Token（`src/styles/tokens.css`）

> 全部走 CSS 变量（`hsl` 通道值，便于 Tailwind `hsl(var(--x))` 引用）；`.dark` 类由 `next-themes` 切换，支持 `system`。

```css
/* ================= 调色板（Light 默认） ================= */
:root {
  /* Brand / Primary — Indigo-Violet（AI + Education 的双关） */
  --brand-50: 240 100% 98%;   --brand-100: 239 100% 96%;  --brand-200: 238 100% 93%;
  --brand-300: 236 96% 88%;   --brand-400: 234 89% 80%;   --brand-500: 232 84% 70%;
  --brand-600: 231 76% 61%;   /* 主色 */                  --brand-700: 228 70% 51%;
  --brand-800: 226 68% 42%;   --brand-900: 224 64% 35%;

  /* Semantic */
  --background: 0 0% 100%;        --foreground: 224 24% 12%;
  --surface: 0 0% 100%;           --surface-muted: 220 20% 98%;
  --surface-raised: 0 0% 100%;    --overlay: 224 24% 12%;  --overlay-alpha: 0.45;
  --border: 220 14% 91%;          --border-strong: 220 12% 82%;
  --ring: 231 76% 61%;
  --primary: var(--brand-600);    --primary-foreground: 0 0% 100%;
  --secondary: 220 20% 96%;       --secondary-foreground: 224 24% 18%;
  --muted: 220 20% 96%;           --muted-foreground: 220 10% 46%;
  --accent: 231 76% 61%;          --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;       --destructive-foreground: 0 0% 100%;
  --success: 142 71% 45%;         --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;          --warning-foreground: 224 24% 12%;
  --info: 199 89% 48%;            --info-foreground: 0 0% 100%;

  /* 学科色（图表六维固定映射，禁止随主题乱跳） */
  --c-vocabulary:  231 76% 61%;   --c-grammar:      262 83% 66%;
  --c-listening:   199 89% 48%;   --c-speaking:     330 81% 60%;
  --c-reading:     142 71% 45%;   --c-writing:       38 92% 50%;

  /* 图表通用 */
  --chart-1: 231 76% 61%;  --chart-2: 199 89% 48%;  --chart-3: 142 71% 45%;
  --chart-4:  38 92% 50%;  --chart-5: 330 81% 60%;  --chart-6: 262 83% 66%;
  --chart-grid: 220 14% 91%;  --chart-axis: 220 10% 46%;

  /* 圆角 */
  --radius-xs: 6px;  --radius-sm: 8px;  --radius-md: 12px;
  --radius-lg: 16px; --radius-xl: 20px; --radius-2xl: 28px;  --radius-full: 9999px;

  /* 阴影（柔和、多层） */
  --shadow-xs: 0 1px 2px 0 hsl(224 24% 12% / 0.04);
  --shadow-sm: 0 1px 3px 0 hsl(224 24% 12% / 0.06), 0 1px 2px -1px hsl(224 24% 12% / 0.06);
  --shadow-md: 0 4px 12px -2px hsl(224 24% 12% / 0.08), 0 2px 4px -2px hsl(224 24% 12% / 0.05);
  --shadow-lg: 0 12px 28px -6px hsl(224 24% 12% / 0.12), 0 4px 8px -4px hsl(224 24% 12% / 0.06);
  --shadow-xl: 0 24px 48px -12px hsl(224 24% 12% / 0.18);
  --shadow-brand: 0 8px 24px -6px hsl(231 76% 61% / 0.35);
  --shadow-inset: inset 0 1px 0 0 hsl(0 0% 100% / 0.06);

  /* 间距（4pt 栅格） */
  --space-0: 0; --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* 字阶 */
  --font-sans: ui-sans-serif, "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --font-en: "Inter", ui-sans-serif, system-ui, sans-serif;   /* 英文正文优先 Inter */
  --text-xs:   12px/16px;   --text-sm:   14px/20px;  --text-base: 16px/24px;
  --text-lg:   18px/28px;   --text-xl:   20px/28px;  --text-2xl: 24px/32px;
  --text-3xl:  30px/38px;   --text-4xl:  36px/44px;  --text-5xl: 48px/56px;
  --tracking-tight: -0.02em;  --tracking-normal: 0;  --tracking-wide: 0.02em;

  /* 层级 */
  --z-dropdown: 40; --z-sticky: 50; --z-overlay: 60; --z-modal: 70; --z-toast: 80;

  /* 动效（reduce-motion 时全部置 0.01ms） */
  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* 布局尺寸 */
  --sidebar-w: 260px;  --sidebar-w-collapsed: 72px;  --topbar-h: 60px;
  --bottomnav-h: 64px;  --content-max: 1200px;
}

/* ================= Dark ================= */
.dark {
  --background: 224 24% 8%;        --foreground: 220 20% 96%;
  --surface: 224 24% 11%;          --surface-muted: 224 20% 14%;
  --surface-raised: 224 22% 15%;   --overlay-alpha: 0.6;
  --border: 222 16% 22%;           --border-strong: 222 14% 30%;
  --ring: 234 89% 76%;
  --secondary: 222 18% 18%;        --secondary-foreground: 220 20% 96%;
  --muted: 222 18% 18%;            --muted-foreground: 220 12% 62%;
  --accent: 234 89% 74%;
  --warning: 38 95% 58%;
  --chart-grid: 222 16% 22%;       --chart-axis: 220 12% 62%;
  --shadow-md: 0 4px 12px -2px hsl(0 0% 0% / 0.4), 0 2px 4px -2px hsl(0 0% 0% / 0.3);
  --shadow-lg: 0 12px 28px -6px hsl(0 0% 0% / 0.5);
  --shadow-brand: 0 8px 24px -6px hsl(231 76% 61% / 0.45);
}

/* 尊重系统减弱动效 + 用户在设置里手动关闭 */
@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 0.01ms; --dur-base: 0.01ms; --dur-slow: 0.01ms } }
[data-reduce-motion='true'] { --dur-fast: 0.01ms; --dur-base: 0.01ms; --dur-slow: 0.01ms }
```

**Tailwind 映射要点**（`tailwind.config.ts`）：`colors.extend` 全部引用 `hsl(var(--x) / <alpha-value>)`；`borderRadius` 映射 `--radius-*`；`boxShadow` 映射 `--shadow-*`；`fontFamily.sans` 走 `--font-sans`（中文/英文自动混排）。

### 7.2 基础组件清单（shadcn/ui 需安装）

| 组件 | CLI 命令 | 备注 |
| --- | --- | --- |
| `button` `card` `badge` `input` `textarea` `label` `separator` | `npx shadcn@latest add ...` | 基础 |
| `dialog` `sheet` `alert-dialog` `popover` `tooltip` `hover-card` | | 浮层；移动端优先 `sheet`（底部抽屉） |
| `tabs` `accordion` `scroll-area` `collapsible` | | 组织内容 |
| `select` `combobox` `command` `checkbox` `radio-group` `switch` `slider` | | 表单；`command` 用于全局搜索 ⌘K |
| `table` + `@tanstack/react-table` → `data-table` | | Admin 表格与列表的统一底座 |
| `progress` `skeleton` `avatar` `toast`/`toaster` | | 状态反馈 |
| `dropdown-menu` `context-menu` `breadcrumb` `pagination` | | 导航 |
| `form`（react-hook-form 集成） `sonner`（替代 toast，更轻量） | | 表单与通知 |

**自研增补（不在 shadcn 内）**：`progress-ring`（SVG 环形）、`level-ring`、`streak-calendar`（热力日历）、`ability-radar`、`ai-stream-bubble`、`waveform`、`ab-loop-player`、`word-highlight-text`、`chip-filter`、`stat-card`、`empty-state`、`error-state`、`skeleton-kit`。

### 7.3 复合组件清单

| 类别 | 组件 | 文件 | 依赖 | 说明 |
| --- | --- | --- | --- | --- |
| **Layout** | `AppShell` | `layout/app-shell.tsx` | Sidebar/TopNav/BottomNav | 响应式外壳，含鉴权重定向 |
| | `Sidebar` | `layout/sidebar.tsx` | nav config | PC 220/260px，可折叠到 72px |
| | `TopNav` | `layout/top-nav.tsx` | Search/Notify/UserMenu | Logo + 全局搜索 + 通知 + 头像 |
| | `BottomNav` | `layout/bottom-nav.tsx` | 5 入口 | 移动端 ≤768px 常驻：首页/学习/AI/统计/我的 |
| | `PageHeader` `PageContainer` | `layout/page-*.tsx` | — | 统一页头（标题+副标题+返回+操作）与内容宽度 `max-w-content` |
| **Dashboard** | `TodayProgressRing` `TaskCard` `AbilityRadar` `LevelRing` `StreakCard` `ContinueLearningRail` `RecommendedRail` `AiSuggestionCard` | `features/dashboard/components/*` | charts | 9 个 Block 一一对应 PRD §5.1 |
| **Vocabulary** | `WordCard`（翻转）`ModeSwitcher`（9 选）`MasteryBar`（六状态）`ReviewQueueCard` `SelfRatingBar`（六档）`IntervalHint` `WordDetailPanel` | `features/vocabulary/components/*` | — | |
| **Listening** | `AudioPlayer`（0.5–2x / 循环 / A-B / 单句）`TranscriptSync`（逐句高亮+点击定位）`AbLoopBar` `TrainingAnswerArea` | `features/listening/components/*` | howler or 原生 `<audio>`（推荐原生 + 自定义控制） | |
| **Speaking** | `RolePicker` `ScenePicker` `ChatBubble` `StartSpeakingButton`（长按录音）`Waveform` `PronunciationPanel` `ScoreRadar` | `features/speaking/components/*` | Web Speech API / MediaRecorder | |
| **Reading** | `ArticleBody`（划词）`KeyWordRail` `SentenceAnalysis` `TranslationToggle` `QuizArea` `QuizResultCard` | `features/reading/components/*` | — | |
| **Writing** | `WritingEditor`（Textarea + 计数）`InlineCheckPanel` `AutoScoreBadge` `CorrectionList` `RewriteTabs` | `features/writing/components/*` | — | 富文本用 `textarea` + 高亮层（避免引入重依赖） |
| **Exam** | `ExamHeader`（倒计时）`SectionTabs` `AnswerSheet`（标记/导航）`AutoSaveIndicator` `SubmitDialog` `ReportScoreCard` | `features/exam/components/*` | — | |
| **AI** | `AiStreamBubble`（打字机 + 停止）`AiThinking`（首字延迟动效）`AiDegradedBanner` `InsightsPanel` `ConversationList` | `components/feedback/*` `features/ai/components/*` | SSE | |
| **Charts** | `LazyLine/Bar/Pie/RadarChart` `HeatmapCalendar` `ProgressRing` | `components/charts/*` | Recharts + `next/dynamic ssr:false` | 全部懒加载 |
| **Review** | `MistakeCard` `AiCategoryChips` `FavoriteTabs` | `features/mistakes|favorites/components/*` | — | |

### 7.4 状态组件规范（全站统一）

| 状态 | 组件 | 触发条件 | UI 表现 |
| --- | --- | --- | --- |
| **Initial Loading** | `<SkeletonKit variant="card-list" />` | query `isLoading` | 与真实布局同构的占位块（环形/卡片/表格各有 variant），**禁止全屏 Spinner 遮首屏** |
| **Fetching More** | `<InlineSpinner />` / `InfiniteScroll` footer | `isFetchingNextPage` | 底部细进度条 |
| **Empty（无数据）** | `<EmptyState icon title description primaryCta secondaryCta />` | `data.length === 0` | 插画 + 引导文案 + 主 CTA（每种空态文案不同，见 PRD） |
| **Filtered Empty** | `<EmptyState variant="filtered" />` | 有筛选但无结果 | "没有符合条件的"+「清除筛选」 |
| **Error** | `<ErrorState code onRetry />` | `query.isError` | 错误文案 + Retry 按钮 + 折叠的技术详情（traceId） |
| **Partial Error** | 区块级 `ErrorState` | 某个区块单独失败 | **只降级该区块**，其余照常渲染（Dashboard 必须如此） |
| **Streaming** | `<AiStreamBubble state="thinking\|streaming\|done\|interrupted" />` | SSE 生命周期 | thinking：三点动效 + "AI 正在思考…"；streaming：打字机 + 停止按钮；interrupted：保留已生成文本 + 重试 |
| **AI Degraded** | `<AiDegradedBanner onRetry />` | `ai.degraded === true` | 琥珀色横幅："AI Service Temporarily Unavailable"+ 「重试」；内容区显示兜底结果 |
| **Submitting** | 按钮 `loading` 态 + `disabled` | mutation pending | 防重复点击 |
| **Offline** | `<OfflineBanner />` | `navigator.onLine === false` | 顶部提示 + 本地草稿标记（R052 前仅提示） |

### 7.5 响应式策略（7 断点）

| 断点 | Tailwind | 宽度 | 布局规则 |
| --- | --- | --- | --- |
| 2XL | `2xl` | ≥1920 | 内容居中 `--content-max: 1200px` 并放大到 1320px；Sidebar 260px 常开；Dashboard 三栏（任务 / 雷达+AI / 侧栏卡片） |
| XL | `xl` | ≥1440 | Dashboard 两栏 + 右栏；Sidebar 常开 260px |
| LG | `lg` | ≥1280 | 主内容 + 右栏；Sidebar 常开 |
| MD | `md` | ≥1024 | Sidebar 默认折叠 72px；图表双列；AI Tutor 三栏（≥1024 才显示 Insights） |
| SM | `sm` | ≥768 | **切换临界**：≥768 用 Sidebar，<768 用 BottomNav；Dashboard 单列；设置页从"列表+详情"降为"仅列表→进子页" |
| XS | （自定义 `xs:390px`） | ≥390 | 移动端标准：BottomNav 常驻、图表全宽、模态改 Sheet、编辑器全屏、雷达图下方全宽 |
| XXS | 默认 | ≥375 | iPhone SE 最小：指标卡 2 列、入口 3 列、触控目标 ≥44px、字号降一档 |

**统一规则**

1. **临界值只有两个真正切换**：`md(768)` 决定 Sidebar ↔ BottomNav；`lg(1024)` 决定单栏 ↔ 多栏。
2. 所有触控目标 ≥ **44×44px**（移动端）；桌面 ≥ 32px。
3. 图表组件在 `<768` 一律全宽单列，禁用 tooltip hover（改点击）。
4. 表格在 `<768` 转卡片列表；Admin 表格 `<768` 走横向滑动 + 行详情 Sheet。
5. AI 讲解/详情面板：PC 为右侧 Drawer / 内联面板；移动端为底部 Sheet。
6. 播放器：移动端吸底；考试倒计时移动端吸顶。

---

## 八、Phase 1 任务分解

> **工程纪律**：每个任务 ≥ 3 个文件、按能力域分组（禁止一个文件一个任务）；T01 为强制起点，其余尽量只依赖 T01/T02 以保持可并行。每个任务结束必须 `npm run lint && npx tsc --noEmit` 通过。

### 8.1 任务清单

#### **T01 · 项目基础设施与工程配置**
- **依赖**：无（起点）
- **优先级**：P0
- **预估文件数**：20
- **涉及文件**：
  - `package.json` `package-lock.json` `.npmrc` `.gitignore` `.editorconfig` **`.nvmrc`**
  - `tsconfig.json`（`strict: true`、`noUncheckedIndexedAccess`、`paths: {"@/*": ["./src/*"]}`）
  - `next.config.mjs`（`experimental.serverActions`、`images.remotePatterns`、bundle analyzer 开关）
  - `tailwind.config.ts` `postcss.config.mjs` `components.json`
  - `src/app/layout.tsx` `src/app/globals.css` `src/app/error.tsx` `src/app/not-found.tsx` `src/app/global-error.tsx`
  - `src/styles/tokens.css` `src/styles/themes.css` `src/styles/utilities.css`
  - `src/lib/utils/cn.ts` `src/lib/constants/config.ts` `src/lib/logger/logger.ts`
  - `.eslintrc.json` `.prettierrc` `.env.example` `README.md`
- **验收标准**：
  1. `.npmrc` 已配置 npmmirror 与 `PRISMA_ENGINES_MIRROR`；`npm install` 全程 ≤ 8 分钟且**无 node-gyp 编译**
  2. `npm run dev` 能启动，访问 `/` 显示带主题变量的占位首页，控制台无报错
  3. `npm run build` 通过；`npm run lint` 与 `npx tsc --noEmit` 零错误
  4. 切换 `<html class="dark">` 主题变量生效
  5. `.env.example` 含全部必需变量（见 §9.5）
  6. **`.nvmrc` 内容为 `22`**（团队基线 Node 22 LTS，见 §9.7）；`package.json` 的 `engines` 声明 `{"node": ">=20.11 <25"}`；`npm run check:env` 在 Node 版本不符时给出明确提示
  7. 所有依赖版本按 §9.6「版本锁定表」**精确 pin**（Prisma 系列**不带 `^`**）

#### **T02 · 数据层：Prisma Schema + 迁移 + Seed**
- **依赖**：T01
- **优先级**：P0
- **预估文件数**：24
- **涉及文件**：
  - `prisma/schema.prisma`（§2.4 全文）
  - `prisma/seed/index.ts` `seed-roles.ts` `seed-admin.ts` `seed-vocabulary.ts` `seed-content.ts` `seed-questions.ts` `seed-ai.ts` `seed-achievements.ts`
  - `prisma/data/cet4-words.csv` `cet6-words.csv` `placement-questions.csv`
  - `src/lib/db.ts`（PrismaClient 单例 + `dev` 下挂 global 防多实例）
  - `src/lib/tx.ts`（事务 + 乐观锁重试包装）
  - `src/lib/utils/safe-json.ts`（Json 适配层，SQLite 逃生必需）
  - `src/types/enums.ts`（Prisma enum 的 TS 镜像 + Zod）
  - **`scripts/pg-daemon.mjs` `scripts/pg-stop.mjs` `scripts/pg-status.mjs`**（Tier A 内嵌 PG 单例守护，设计见 §2.6.1-④）
  - `scripts/use-driver.ts`（Tier A / C / B 一键切换 `.env`）
  - `scripts/gen-sqlite-schema.ts` `scripts/check-env.ts`
  - `docker-compose.yml`（postgres:16 + adminer，**仅供有 Docker 的环境**）`Dockerfile`
  - `.gitignore`（补 `.data/`、`prisma/dev.db*`）
- **验收标准**：
  1. **零系统安装即可完成迁移**：在**无 Docker、无 psql** 的本机执行 `npm run db:start` → `npm run db:migrate` → `npm run db:seed` 全绿（Tier A 内嵌 PostgreSQL 18.4，`provider` 保持 `postgresql`）
  2. `npm run db:start` 可重复执行：第二次运行检测到 `PG_VERSION` 与 pid 后**直接提示已在运行并 exit 0**（不报错、不重复 initdb）
  3. `npm run db:status` 输出：是否已初始化 / 是否在跑 / PG 版本 / 端口 / 数据库大小
  4. `npm run db:seed` 幂等可重复执行；产出：1 个 ADMIN（`admin@englishai.dev`）、3 个角色、CET-4 3000 + CET-6 2000 词、听力 20 篇、阅读 60 篇、语法 14 类、写作任务 30、Placement 题 60、18 条 `ai_capability_config`、18 条 `ai_prompts` v1、成就 24 条
  5. `npx prisma studio` 可查看全部 52 张表（含 `enum` 与 `Json`/JSONB 字段正常展示）
  6. `npm run db:use-cloud` 切到云 PG 后业务代码零改动可跑通；`npm run db:use-sqlite` 切到 SQLite 亦可跑通（Tier B 保底路径验证）
  7. `.data/` 未被提交进 git


#### **T03 · 后端内核 + 认证授权**
- **依赖**：T02
- **优先级**：P0
- **预估文件数**：24
- **涉及文件**：
  - `src/lib/api/{response,errors,handler,pagination,zod}.ts`
  - `src/lib/auth/{jwt,password,session,rbac,csrf,rate-limit,login-guard}.ts`
  - `src/lib/cache/{memory-cache,keys}.ts` `src/lib/logger/request-context.ts`
  - `src/middleware.ts`（route matcher + locale + traceId + Origin 校验）
  - `src/services/auth.service.ts` `src/services/user.service.ts` `src/services/audit.service.ts`
  - `src/types/api.ts` `src/types/dto/{auth,user}.dto.ts`
  - `src/features/auth/schemas.ts` `src/features/auth/api.ts`
  - `src/app/api/auth/{register,login,logout,refresh,forgot-password,reset-password,me}/route.ts`
  - `src/app/api/user/{profile,settings,avatar}/route.ts` `src/app/api/user/goals/route.ts`
  - `src/app/api/health/route.ts`
  - `src/tests/unit/password.spec.ts` `src/tests/integration/auth.spec.ts`
- **验收标准**：
  1. 注册 → 登录 → `/api/auth/me` 拿到用户；JWT 存 httpOnly Cookie，前端 JS 读不到
  2. Access 15min / Refresh 30d 轮换正常；Refresh 重放检测生效（旧 token 二次使用 → 整个 family 撤销）
  3. 密码用 `@node-rs/argon2` 存哈希；失败 5 次锁定 15 分钟
  4. 所有写接口有 CSRF Origin 校验；`withAuth({roles:['ADMIN']})` 对普通用户返回 403
  5. 响应全部为 `{success,data,error,traceId}` envelope；错误码覆盖 §3.2

#### **T04 · AI Gateway + Provider + Prompt + 降级**
- **依赖**：T02（可并行于 T03）
- **优先级**：P0
- **预估文件数**：26
- **涉及文件**：
  - `src/services/ai/types.ts` `gateway.ts` `ai.service.ts` `registry.ts` `prompt-registry.ts` `struct-guard.ts` `degrade.ts` `meter.ts` `pricing.ts`
  - `src/services/ai/providers/{index,openai-compatible,deepseek,ollama,mock}.ts`
  - `src/services/ai/prompts/seed/{word-explain,writing-review,tutor-chat,plan-generate,daily-diagnosis,index}.ts`
  - `src/services/ai/schemas/{word-explain,writing-report,daily-diagnosis,generated-plan,index}.ts`
  - `src/app/api/ai/{chat,diagnosis,recommend,cet-advice,conversations}/route.ts`
  - `src/app/api/ai/conversations/[id]/{route,messages}/route.ts`
  - `src/lib/http/sse.ts` `src/hooks/use-ai-stream.ts`
  - `src/components/feedback/{ai-stream-bubble,ai-thinking,ai-degraded-banner}.tsx`
  - `src/tests/unit/degrade.spec.ts` `src/tests/unit/providers.spec.ts`
- **验收标准**：
  1. **不配任何 API Key 时**，`POST /api/ai/chat` 仍能返回（Mock Provider）且 SSE 分帧正确
  2. 配 DeepSeek Key 后走真实模型；配 `AI_PROVIDER=ollama` 走本地
  3. 结构化能力（如 DIAGNOSIS）在 AI 返回非法 JSON 时：Zod 校验失败 → 修补重试 1 次 → 仍失败返回 `degraded:true` 的兜底内容
  4. `ai_call_logs` 每次调用有记录（含 tokens/latency/status/degraded）
  5. 全局降级开关（`AiCapabilityConfig.enabled=false`）立即生效

#### **T05 · UI 基建 + 全局 Layout + 状态组件**
- **依赖**：T01（可与 T02/T03 并行）
- **优先级**：P0
- **预估文件数**：30
- **涉及文件**：
  - `src/components/ui/*.tsx`（shadcn 初始化产出 ~20 个）
  - `src/components/layout/{app-shell,sidebar,sidebar-nav,top-nav,bottom-nav,page-header,page-container,theme-toggle,locale-switcher,user-menu,mobile-nav-drawer}.tsx`
  - `src/components/common/{stat-card,empty-state,error-state,loading-overlay,skeleton-kit,confirm-dialog,pagination,infinite-scroll,chip-filter,tag-badge,section-title}.tsx`
  - `src/components/charts/{lazy-line-chart,lazy-bar-chart,lazy-pie-chart,lazy-radar-chart,lazy-heatmap,progress-ring,ability-radar,streak-calendar,level-ring}.tsx`
  - `src/components/feedback/{retry-boundary,global-error-boundary}.tsx`
  - `src/stores/{ui,sidebar,filters}.store.ts`
  - `src/hooks/{use-theme,use-debounce,use-mounted,use-hotkey}.ts`
  - `src/lib/constants/{routes,ui,breakpoints}.ts`
  - `src/lib/i18n/{routing,navigation,request}.ts` `messages/{zh-CN,en}.json`
- **验收标准**：
  1. `/dashboard` 占位页在 PC ≥1024 显示 Sidebar + TopNav，在 ≤768 显示 BottomNav
  2. 主题 Light/Dark/System 三态切换持久化，刷新不闪白（SSR 注入 class）
  3. 中英文切换立即生效（next-intl）
  4. `<EmptyState> <ErrorState> <SkeletonKit> <AiDegradedBanner>` 4 个状态组件在 `/dev/ui-kit`（临时页）可预览全部 variant
  5. 图表组件全部 `dynamic(ssr:false)`，首屏 JS ≤ 200KB gzip

#### **T06 · Landing + Auth 页面 + Onboarding 8 步**
- **依赖**：T03, T05
- **优先级**：P0
- **预估文件数**：22
- **涉及文件**：
  - `src/app/[locale]/page.tsx`（Landing）+ `src/features/landing/components/*`（hero/features/cta/footer）
  - `src/app/[locale]/(auth)/{login,register,forgot-password}/page.tsx`
  - `src/features/auth/components/{login-form,register-form,forgot-form,password-strength,social-login}.tsx`
  - `src/app/[locale]/(app)/onboarding/page.tsx`
  - `src/features/onboarding/components/{stepper,step-goal,step-level,step-time,step-days,step-exam,step-date,step-weakest,step-style,summary}.tsx`
  - `src/features/onboarding/{hooks,schemas,api}.ts`
  - `src/app/api/onboarding/route.ts`
  - `src/services/onboarding.service.ts`
- **验收标准**：
  1. Landing 首屏 TTI ≤ 3s（本地 `npm run dev` 用 Lighthouse mobile 跑 ≥ 75 分）
  2. 注册成功自动登录并跳 Onboarding；表单字段级校验 + 服务端错误码 映射到中文提示
  3. Onboarding 8 步单屏单步，本地暂存防丢，跳过后回写 Profile
  4. 完成后写 `profiles.onboardingData` 并标记 `onboardingCompletedAt`

#### **T07 · Placement Test + 能力报告 + Dashboard**
- **依赖**：T02, T03, T05
- **优先级**：P0
- **预估文件数**：30
- **涉及文件**：
  - `src/app/[locale]/(app)/placement/page.tsx` `placement/report/[id]/page.tsx`
  - `src/features/placement/components/{test-intro,question-area,timer,answer-sheet,submit-bar,score-cards,cefr-badge,radar-report,problems-list,eta-time}.tsx`
  - `src/features/placement/{hooks,schemas,api}.ts`
  - `src/services/placement.service.ts`（规则评分 + CEFR/CET 映射）
  - `src/services/dashboard.service.ts`
  - `src/app/api/placement/{route,[id]/questions,[id]/answer,[id]/submit,[id]/report}/route.ts`
  - `src/app/api/dashboard/{route,ai-suggestion,tasks/[id]/complete}/route.ts`
  - `src/app/[locale]/(app)/dashboard/page.tsx`
  - `src/features/dashboard/components/{greeting-bar,today-progress-ring,today-tasks,ability-radar,ai-suggestion,continue-learning,recommended-for-you,streak-card,level-ring}.tsx`
  - `src/services/gamification/{level,streak}.ts`
  - `src/tests/unit/cefr.spec.ts`
- **验收标准**：
  1. 完成 30 题 → 提交 → 生成 `{vocabulary,grammar,reading,listening,overall}` → CEFR → CET 估算，跳报告页
  2. 报告页六区块齐全；AI 建议区块独立降级（失败不影响其余）
  3. Dashboard 9 个 Block 全部渲染；**AI 区块失败时其余区块照常**
  4. Dashboard 首屏（SSR 直出）LCP ≤ 2.5s（本地）

#### **T08 · 词汇模块 + SRS 引擎 + 基础统计**
- **依赖**：T02, T03, T05, T07（Dashboard 所需的任务/统计结构）
- **优先级**：P0
- **预估文件数**：32
- **涉及文件**：
  - `src/services/vocabulary.service.ts`
  - `src/services/vocabulary/srs/{srs.engine,srs.formula,srs.types,srs.constants}.ts`
  - `src/services/analytics.service.ts` `src/services/analytics/aggregation.ts`
  - `src/app/api/vocabulary/{today,review-queue,review,learn,books,search,records,mastery,notebook}/route.ts`
  - `src/app/api/vocabulary/[id]/route.ts`
  - `src/app/api/analytics/{route,trend,history,calendar}/route.ts`
  - `src/app/[locale]/(app)/vocabulary/{page,learn,review,library,notebook}/page.tsx`
  - `src/features/vocabulary/components/{word-card,mode-switcher,mastery-bar,review-queue-card,self-rating-bar,interval-hint,word-list,notebook-tabs}.tsx`
  - `src/features/vocabulary/components/word-detail.tsx`
  - `src/features/vocabulary/{hooks,schemas,api}.ts`
  - `src/stores/review.store.ts` `src/hooks/use-local-draft.ts`
  - `src/tests/unit/srs.spec.ts` `src/tests/integration/vocabulary-review.spec.ts`
- **验收标准**：
  1. `/vocabulary/today` 返回 30 词；学完一个词 mastery 更新，错词入生词本
  2. 复习流程：自评 → **服务端**算 `newMastery/newStage/nextReviewAt`，返回 1/3/7/14/30 天预测，与 §5.1 公式一致（单测覆盖 LAPSE/ADVANCE/MASTERED 三条路径）
  3. 重复提交同一 Idempotency-Key 不产生二次推进
  4. `/vocabulary/review` 队列按到期时间排序；空队列显示庆祝空态
  5. `/analytics` 显示指标卡 + 30 天折线（来自 `daily_learning_stats`）

#### **T09 · 个人中心 + 设置 + 双语 + 通知占位**
- **依赖**：T03, T05
- **优先级**：P0
- **预估文件数**：22
- **涉及文件**：
  - `src/app/[locale]/(app)/profile/page.tsx`
  - `src/app/[locale]/(app)/settings/{layout,page}.tsx` + `settings/{account,security,privacy,notification,goal,ai,appearance,data}/page.tsx`
  - `src/features/profile/components/{profile-header,key-stats,achievement-preview,settings-nav}.tsx`
  - `src/features/settings/components/{account-form,security-form,privacy-form,notification-form,goal-form,ai-form,appearance-form,data-zone}.tsx`
  - `src/features/settings/{schemas,api}.ts`
  - `src/app/api/user/export/route.ts` `src/app/api/user/route.ts`(DELETE)
  - `src/app/api/notifications/route.ts`
  - `messages/{zh-CN,en}.json`（补齐 Day1 全量键值，≥200 条）
  - `src/services/notification.service.ts`
- **验收标准**：
  1. 修改昵称/头像/主题/语言即时生效并持久化
  2. 修改密码需校验旧密码；成功后其他会话全部登出
  3. 学习目标修改后提示"计划将在下次打开时重算"
  4. 删除账户二次确认 + 输入 `DELETE` 确认后软删
  5. `/api/user/export` 返回 JSON 打包任务

#### **T10 · 端到端联调 + 冒烟 + 部署脚本**
- **依赖**：T06, T07, T08, T09, T04
- **优先级**：P0
- **预估文件数**：18
- **涉及文件**：
  - `vitest.config.ts` `playwright.config.ts` `src/tests/setup.ts`
  - `src/tests/e2e/{register,login,word-learn,submit-exercise,ai-chat,writing-analyze,exam-submit,analytics}.spec.ts`
  - `Dockerfile`（多阶段：deps → builder → runner）
  - `docker-compose.yml`（app + postgres + redis 可选）
  - `README.md`（Windows 专项：npmmirror / Node 版本 / Prisma engine 镜像 / Docker 缺失方案）
  - `.github/workflows/ci.yml`（lint + tsc + vitest）
  - `scripts/check-env.ts`（补全）`scripts/rebuild-stats.ts`
  - `src/app/[locale]/(app)/error/page.tsx`
- **验收标准**：
  1. **完整链路冒烟**：`npm run dev` → 注册 → Onboarding → Placement → Dashboard → 学词 → 复习 → 统计，**无需任何外部 AI Key**（Mock Provider 兜底）
  2. 8 条 Playwright E2E 全部通过（`npx playwright test`）
  3. Vitest 单测覆盖率：SRS/planner/level/streak/cefr ≥ 80%
  4. `docker compose up --build` 能起完整栈（**有 Docker 的环境**）；README 中含"无 Docker 时走 Tier A 内嵌 PG（默认）→ Tier C 云 PG → Tier B SQLite"的三档指引（对齐 §2.6 决策树）
  5. 生产 `npm run build` 无 TypeScript 错误、无 ESLint error
  6. `Dockerfile` 的 `runner` 阶段**不包含** `embedded-postgres`（生产用外部 PG，开发专用依赖不进产物）

### 8.2 任务依赖关系图

```mermaid
graph TD
    T01["T01 项目基础设施<br/>配置/别名/Theme/日志<br/>20 files"]
    T02["T02 数据层<br/>Prisma 52表/迁移/Seed<br/>18 files"]
    T03["T03 后端内核+认证<br/>Envelope/错误码/JWT/RBAC<br/>24 files"]
    T04["T04 AI Gateway<br/>Provider/Prompt/降级<br/>26 files"]
    T05["T05 UI 基建+Layout<br/>shadcn/状态组件/图表/响应式<br/>30 files"]
    T06["T06 Landing+Auth+Onboarding<br/>22 files"]
    T07["T07 Placement+能力报告+Dashboard<br/>30 files"]
    T08["T08 词汇+SRS+统计<br/>32 files"]
    T09["T09 Profile+Settings+i18n<br/>22 files"]
    T10["T10 联调+E2E+部署<br/>18 files"]

    T01 --> T02
    T01 --> T05
    T02 --> T03
    T02 --> T04
    T02 --> T07
    T05 --> T06
    T05 --> T07
    T05 --> T08
    T05 --> T09
    T03 --> T06
    T03 --> T07
    T03 --> T08
    T03 --> T09
    T07 --> T08
    T06 --> T10
    T07 --> T10
    T08 --> T10
    T09 --> T10
    T04 --> T10

    classDef infra fill:#eef2ff,stroke:#6366f1,stroke-width:2px
    classDef ai fill:#ecfdf5,stroke:#10b981,stroke-width:2px
    classDef final fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    class T01 infra
    class T04 ai
    class T10 final
```

### 8.3 Phase 1 完成判定（Definition of Done）

| # | 判定项 |
| --- | --- |
| 1 | `npm install && npm run db:start && npm run db:migrate && npm run db:seed && npm run dev` 一条链路起得来（**无 Docker、无系统 PG 的机器上也可**；含无 AI Key 场景） |
| 2 | 数据库 52 张表落库，seed 数据可查；**Tier A 内嵌 PostgreSQL 18.4 为默认**，Tier C 云 PG / Tier B SQLite 均可一键切换 |
| 3 | 注册 → Onboarding(8步) → Placement(30题) → 能力报告(含 CEFR/CET) → Dashboard(9 Block) 全链路通 |
| 4 | `/vocabulary/learn` 学词 → `/vocabulary/review` SRS 复习 → mastery/下一次时间正确变化 |
| 5 | `/analytics` 有真实数据（源自 `daily_learning_stats`） |
| 6 | AI 全部能力在无 Key 时降级可用，`ai.degraded=true` 前端有 Banner |
| 7 | Light/Dark + 中/英切换全站生效；PC Sidebar / 移动 BottomNav 断点正确 |
| 8 | 所有列表页具备 Skeleton / Empty / Error+Retry 三态 |
| 9 | 8 条 E2E + 核心算法单测通过；`npm run build` 零错误 |
| 10 | README 含 Windows 慢网安装、**零系统安装起 PG（Tier A）**、Tier 切换三档 三个专项章节 |

---

## 九、依赖包清单

### 9.1 核心依赖（**全部经 `npm view` 实测核实，精确 pin**）

> 核实时间：2026-09-27；registry = `https://registry.npmmirror.com`。
> **⚠️ 铁律**：本表版本为**精确锁定**，`package.json` 中**除标注 `^` 的项外一律不写 `^` / `~` / `*` / `latest`**。原因见 §9.6。

#### 运行时依赖（`dependencies`）

| 包名 | **锁定版本** | 用途 | 必需 | Windows 安装风险 |
| --- | --- | --- | --- | --- |
| `next` | **`15.5.26`** | 框架（Next 15 线最新） | ✅ | 低（纯 JS） |
| `react` / `react-dom` | **`19.2.8`** | UI 运行时 | ✅ | 低 |
| `tailwindcss` | **`3.4.19`** | 样式（v3 线最新；**不用 v4**） | ✅ | 低 |
| `tailwindcss-animate` | **`1.0.7`** | shadcn 动画插件 | ✅ | 低 |
| `class-variance-authority` | **`0.7.1`** | 组件变体 | ✅ | 低 |
| `clsx` | **`2.1.1`** | cn 工具 | ✅ | 低 |
| `tailwind-merge` | **`2.6.1`** | cn 工具（**v2 用于 Tailwind v3**；v3.x 面向 TW4） | ✅ | 低 |
| `@radix-ui/react-*` | **`^1.x`**（由 shadcn add 时写入并**提交 lockfile**） | 无头组件 | ✅ | 低 |
| `lucide-react` | **`0.577.0`** | 图标 | ✅ | 低 |
| `framer-motion` | **`11.18.2`** | 动效（v11 线最新） | ✅ | 低 |
| `@tanstack/react-query` | **`5.104.0`** | 服务端数据 | ✅ | 低 |
| `@tanstack/react-table` | **`8.21.3`** | Admin 表格 | ✅ | 低 |
| `zustand` | **`5.0.15`** | UI 状态 | ✅ | 低 |
| `next-intl` | **`3.26.5`** | i18n（v3 线，适配 Next 15） | ✅ | 低 |
| `next-themes` | **`0.4.6`** | 主题切换 | ✅ | 低 |
| `zod` | **`3.25.76`** | 校验（**锁定 v3**） | ✅ | 低 |
| `react-hook-form` | **`7.89.0`** | 表单 | ✅ | 低 |
| `@hookform/resolvers` | **`3.10.0`** | RHF ↔ Zod 3 桥接（v5 要求 Zod 4） | ✅ | 低 |
| `sonner` | **`1.7.4`** | Toast | ✅ | 低 |
| `jose` | **`5.10.0`** | JWT（Edge 运行时兼容） | ✅ | 低（纯 WebCrypto） |
| `@node-rs/argon2` | **`2.2.1`** | **密码哈希（主选）** | ✅ | **低 ✅ 已实测**：存在 `@node-rs/argon2-win32-x64-msvc` 预编译包，**无需 node-gyp / VS Build Tools** |
| `bcryptjs` | **`3.0.3`** | 密码哈希（逃生备选） | ⬜ | 无（零原生模块） |
| `@prisma/client` | **`6.19.3`** | ORM Client | ✅ | 中（需 engines；npmmirror 实测可正常分发，见 §9.2） |
| `recharts` | **`2.15.4`** | 图表（v2 线；v3 为最新但不取） | ✅ | 低 |
| `date-fns` | **`4.4.0`** | 日期计算 | ✅ | 低 |
| `@date-fns/tz` | **`^1.5.0`** | date-fns v4 时区伴侣（Streak 本地日期） | ✅ | 低 |
| `nanoid` | **`5.1.16`** | 幂等键 / 短 ID | ✅ | 低（纯 ESM） |
| `sanitize-html` | **`2.17.7`** | AI/用户富文本消毒 | ✅ | 低 |
| `server-only` | **`0.0.1`** | 防止 service 被客户端误引 | ✅ | 低 |
| `lru-cache` | **`11.5.3`** | 进程内缓存 / 限流桶 | ✅ | 低 |

#### 开发依赖（`devDependencies`）

| 包名 | **锁定版本** | 用途 | 必需 | Windows 安装风险 |
| --- | --- | --- | --- | --- |
| `typescript` | **`5.9.3`** | 类型 | ✅ | 低 |
| `@types/node` | **`22.20.4`** | 类型（对齐 Node 22 基线） | ✅ | 低 |
| `@types/react` | **`^19.3.0`** | 类型 | ✅ | 低 |
| `@types/react-dom` | **`^19.3.0`** | 类型 | ✅ | 低 |
| `postcss` | **`8.5.28`** | Tailwind 依赖 | ✅ | 低 |
| `autoprefixer` | **`10.6.1`** | Tailwind 依赖 | ✅ | 低 |
| **`prisma`** | **`6.19.3`**（**严禁 `^`**） | CLI / migrate / generate | ✅ | 中（engines；实测 npmmirror 可用） |
| **`embedded-postgres`** | **`18.4.0-beta.17`**（**严禁 `^`**） | ★ **Tier A 内嵌 PostgreSQL**（见 §2.6.1） | ✅ | **低 ✅ 已实测**：`@embedded-postgres/windows-x64` 预编译二进制，安装 29s，`SELECT version()` → `PostgreSQL 18.4 on x86_64-windows` |
| `pg` | **`8.23.0`** | pg-daemon 探活 / 集成测试直连 | ⬜ | 低（纯 JS） |
| `tsx` | **`4.23.15`** | 跑 TS 脚本（seed / script） | ✅ | 低 |
| `dotenv` | **`^16.6.1`** | `.env` 加载（脚本用；Next 自带） | ⬜ | 低 |
| `vitest` | **`3.2.7`** | 单测（v3 线最新；**不取 v5**） | ✅ | 低 |
| `@vitejs/plugin-react` | **`4.7.0`** | Vitest React 支持 | ✅ | 低 |
| `jsdom` | **`26.1.0`** | DOM 环境 | ✅ | 低 |
| `@testing-library/react` | **`16.3.3`** | 组件测试 | ✅ | 低 |
| `@testing-library/jest-dom` | **`6.10.0`** | 断言扩展 | ✅ | 低 |
| `@testing-library/user-event` | **`14.6.7`** | 交互模拟 | ✅ | 低 |
| `@playwright/test` | **`1.63.0`** | E2E | ✅ | 中（需下载浏览器，**必须配镜像**，见 §9.2） |
| `eslint` | **`9.39.5`** | Lint | ✅ | 低 |
| `eslint-config-next` | **`15.5.26`** | Next 规则（**必须与 `next` 版本严格一致**） | ✅ | 低 |
| `prettier` | **`3.9.9`** | 格式化 | ✅ | 低 |
| `prettier-plugin-tailwindcss` | **`^0.8.1`** | class 排序 | ⬜ | 低 |


**建议延迟引入（避免 Phase 1 膨胀）**

| 包名 | 何时引入 | 理由 |
| --- | --- | --- |
| `howler` / `wavesurfer.js` | Phase 3（口语波形/高级播放器） | 原生 `<audio>` + Web Audio 足够做转写高亮与 A-B 循环 |
| `openai`（官方 SDK） | **不引入** | 直接 `fetch` OpenAI 兼容协议，少一层依赖、少一层协议锁定 |
| `redis` / `ioredis` | 多实例部署时 | 单实例内存缓存先行 |
| `@tiptap/react` | Phase 2 写作编辑器升级时 | MVP 用 `textarea` + 高亮层即可 |
| `resend` / `nodemailer` | 找回密码邮件真正上线时 | 开发期把验证链接打印到服务端日志 |
| `sharp` | 需要图片优化时（Next 自带，Window 偶有安装失败） | 如安装失败用 `NEXT_IMAGE_OPTIMIZATION=off` |

### 9.2 npmmirror 慢网方案（**必做**）

> ✅ **实测结果**：本机 registry 已是 `https://registry.npmmirror.com`。实测安装 `embedded-postgres@18.4.0-beta.17` + `pg@8` 用时 **29 秒**、`prisma@6.19.3` CLI **59 秒**、`@prisma/client@6.19.3` **27 秒**，且 **Prisma engines（`libquery-engine-windows.dll.node` / `schema-engine-windows.exe`）无需额外镜像配置即正常下载**。下面的配置仍建议写入 `.npmrc` 固化，作为新机器/新成员的兜底。

`package.json` 同级的 `.npmrc`（纳入仓库，团队共享）：

```ini
# ---- npm 包本体走 npmmirror ----
registry=https://registry.npmmirror.com
fetch-retries=5
fetch-retry-maxtimeout=120000
fetch-timeout=300000
# 原生模块二进制走国内镜像（若后续引入 bcrypt/sharp 等）
@mapbox:registry=https://registry.npmmirror.com
sharp_binary_host=https://npmmirror.com/mirrors/sharp
sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips
node_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/sqlite3
# ---- Prisma / Playwright 走镜像（最关键）----
prisma_engines_mirror=https://registry.npmmirror.com/-/binary/prisma
PRISMA_CLI_QUERY_ENGINE_TYPE=binary
playwright_download_host=https://npmmirror.com/mirrors/playwright
# ---- 关掉遥测，省一次网络往返 ----
NEXT_TELEMETRY_DISABLED=1
```

**命令行一次性配置（若 `.npmrc` 被忽略）**

```bash
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 5
npm config set prisma_engines_mirror https://registry.npmmirror.com/-/binary/prisma
npm config set playwright_download_host https://npmmirror.com/mirrors/playwright
```

**首次安装推荐命令**

```bash
npm install --no-audit --no-fund          # 关闭审计省一大段时间
# 若依赖树冲突再退一寸：
npm install --legacy-peer-deps
```

### 9.3 密码哈希决策（argon2 vs bcrypt）

| 方案 | 安全性 | Windows 安装风险 | 性能 |
| --- | --- | --- | --- |
| `argon2`（node-gyp 原生） | Argon2id，最优 | **高**：需 VS Build Tools + Python + node-gyp，中文路径下极易失败 | 最快 |
| **`@node-rs/argon2`** ✅ | **Argon2id（OWASP 首选）** | **低**：Rust N-API，发布各平台预编译 `.node`（npmmirror 有完整镜像），零编译 | 最快 |
| `bcrypt`（node-gyp 原生） | 良好 | **高**：同 argon2 | 中 |
| `bcryptjs`（纯 JS） | 良好 | **无**：零原生依赖，100% 装得上 | 慢（cost=10 约 80ms，可接受） |

**决策：主选 `@node-rs/argon2@2.2.1`（内存 19456 KiB / 迭代 2 / 并行 1，即 OWASP 推荐参数），逃生 `bcryptjs@3.0.3`。**

> ✅ **实测确认**：`@node-rs/argon2@2.2.1` 在 npm 上**存在 `@node-rs/argon2-win32-x64-msvc` 预编译包**，Windows 下安装**不需要 node-gyp / VS Build Tools / Python**，原生编译风险确认为 **「低」**。因此原"主选 `@node-rs/argon2`"的判断成立，`bcryptjs` 仅作为极端环境（预编译包被代理拦截）的逃生通道保留。

实现方式：`src/lib/auth/password.ts` 封装 `PasswordHasher` 接口，`AUTH_HASHER=argon2|bcryptjs` 决定实现。运行时若 `@node-rs/argon2` 加载失败自动降级到 `bcryptjs` 并打印 WARN，**保证任何 Windows 机器都能启动**。

```ts
// src/lib/auth/password.ts（示意）
export interface PasswordHasher { hash(p: string): Promise<string>; verify(p: string, h: string): Promise<boolean> }
export const hasher: PasswordHasher = process.env.AUTH_HASHER === 'bcryptjs'
  ? new BcryptJsHasher()
  : await tryImport(() => new Argon2Hasher(), () => new BcryptJsHasher())
```

### 9.4 Windows 环境专项风险清单

| # | 风险 | 影响 | 应对 |
| --- | --- | --- | --- |
| 1 | **项目路径含中文**（`D:/徐浩然/2026-09-26-21-59-15/englishai`） | 少数原生模块/gyp 脚本、部分 CLI 对非 ASCII 路径支持不佳 | ✅ **已实测**：`embedded-postgres` 的 `initdb`/`pg_ctl`、Prisma 6.19.3 的 `db push`/`generate` **在中文路径下全部正常**。**默认继续使用当前路径**；若个别工具仍报 `Cannot find module` / `spawn ENOENT`，再用目录联接绕开：`mklink /J D:\work\englishai "D:\徐浩然\2026-09-26-21-59-15\englishai"` |
| 2 | Prisma engines 下载慢/失败 | `prisma generate` 卡死 | ✅ **已实测**：`registry=https://registry.npmmirror.com` 下 `prisma@6.19.3` 安装与 engines 分发**正常**；如仍失败再配 `PRISMA_ENGINES_MIRROR`（§9.2） |
| 3 | Playwright 浏览器下载失败 | E2E 跑不了 | 配 `playwright_download_host`；或 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 后手动 `npx playwright install chromium --with-deps` |
| 4 | PowerShell/CMD 编码导致 CSV 乱码 | seed 词表乱码 | seed CSV 统一 **UTF-8 BOM**；读取时用 `iconv-lite` 兜底或直接用 UTF-8 无 BOM + 显式 encoding |
| 5 | 文件监听（`--watch`）在 NTFS 抖动 | dev 热重载慢 | `next.config.mjs` 打开 `webpack: { watchOptions: { poll: 1000 } }`（仅在必要时） |
| 6 | 端口 5433/3000 被占用 | 起不来 | 本项目统一用 **5433**（Tier A 与 docker-compose 一致）；冲突时改 `PG_PORT` 或 docker-compose 映射宿主机 `5434:5432` |
| 7 | **本机无 Docker、无系统 PostgreSQL**（**已实测确认**） | 常规 `docker compose up -d db` 路径不可用 | ✅ **走 §2.6 Tier A**：`npm i embedded-postgres` + `npm run db:start`（零系统安装，**已实测跑通 PG 18.4 + Prisma 6.19.3 全链路**）。备选 Tier C 云 PG / Tier B SQLite |
| 8 | Node 版本不符 | Next 15 / Prisma 报错 | 团队基线 **Node 22 LTS**（`.nvmrc` = `22`），`engines: {"node": ">=20.11 <25"}`。详见 §9.7 |
| 9 | Windows Defender 实时扫描拖慢 `initdb` / `postgres` 启停 | 首次启动从 16s 涨到 25s+ | 把项目目录与 `node_modules` 加入 Defender 排除项（同时能显著加速 `npm i` 与 `prisma generate`） |
| 10 | `prisma generate` 覆盖写被沙箱/杀软拦截 | `@prisma/client did not initialize yet` | 先删除 `node_modules/.prisma` 与生成目录再 `npx prisma generate`；必要时把 Prisma Client 输出到项目内目录（`generator client { output = "../generated/client" }`） |

### 9.5 环境变量清单（`.env.example`）

```bash
# ---------- App ----------
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1

# ---------- Database (Tier A / C / B) ----------
# Tier A（默认，npm 内嵌 PG，见 §2.6.1）
DATABASE_URL="postgresql://englishai:englishai@localhost:5433/englishai?schema=public"
PG_PORT=5433
PG_DATA_DIR=.data/pg
# Tier C（云 PG，用 npm run db:use-cloud 切换）
# DATABASE_URL="postgresql://<user>:<pwd>@<host>/englishai?sslmode=require&pgbouncer=true"
# Tier B（SQLite 保底，用 npm run db:use-sqlite 切换）
DATABASE_URL_SQLITE="file:./dev.db"
DB_DRIVER=postgres           # postgres | sqlite
DB_TIER=A                    # A | C | B  （仅用于 README/状态展示，业务代码不分支）

# ---------- Auth ----------
AUTH_JWT_SECRET="<openssl rand -base64 48>"
AUTH_JWT_ISSUER=englishai
AUTH_ACCESS_TTL_SECONDS=900        # 15min
AUTH_REFRESH_TTL_DAYS=30
AUTH_HASHER=argon2                 # argon2 | bcryptjs
ARGON2_MEMORY_KB=19456
ARGON2_ITERATIONS=2
ARGON2_PARALLELISM=1
BCRYPT_COST=10

# ---------- AI ----------
AI_PROVIDER=deepseek               # deepseek | openai | dashscope | ollama | mock
AI_FAILOVER_PROVIDER=mock
AI_FALLBACK_ENABLED=true           # 全局降级开关
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama
OLLAMA_MODEL=qwen2.5:7b-instruct
AI_DEFAULT_TIMEOUT_MS=30000
AI_DEFAULT_FIRST_TOKEN_TIMEOUT_MS=3000
AI_GLOBAL_CONCURRENCY=8
AI_USER_DAILY_QUOTA=100

# ---------- Storage / Upload ----------
UPLOAD_DIR=./storage
UPLOAD_MAX_MB=20
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp
ALLOWED_AUDIO_TYPES=audio/mpeg,audio/wav,audio/mp4

# ---------- Feature Flags ----------
FEATURE_OFFLINE_CACHE=false
FEATURE_PUSH=false
FEATURE_SOCIAL_LOGIN=false

# ---------- Cron / Notifications ----------
DAILY_CRON_TOKEN=
TZ=Asia/Shanghai
```

> ⚠️ `prisma_engines_mirror` / `playwright_download_host` 在 `.npmrc` 中以 npm config 形式生效；若 Prisma CLI 仍去官方源下载，请**同时在 `.env` / shell profile 中导出同名大写环境变量**：`PRISMA_ENGINES_MIRROR`、`PLAYWRIGHT_DOWNLOAD_HOST`。

### 9.6 版本锁定与升级策略

#### 9.6.1 ⚠️ `latest` 陷阱（必须知道的事实）

| 包 | npm `latest` tag 指向 | **本项目采用** | 后果 |
| --- | --- | --- | --- |
| `prisma` | **`8.0.0-rc.17`（预发布！）** | **`6.19.3`** | **`npm i prisma@latest` / `^` / `*` 会拉到 8.0.0-rc，与 `@prisma/client@6` 版本错配，CLI 与 Client 行为不一致，migrate/generate 直接报错** |
| `@prisma/client` | `7.10.0` | `6.19.3` | 与 CLI 必须**同版本**，否则 generate 产物与 CLI 期望不匹配 |
| `next` | `16.3.6` | `15.5.26` | 跨大版本：App Router 缓存语义、React 版本要求、RSC API 均有变化 |
| `tailwindcss` | `4.3.3` | `3.4.19` | v4 全新引擎 + `@theme` 语法，shadcn 生态与既有配置全部不兼容 |
| `zod` | `4.6.5` | `3.25.76` | v4 破坏性变更；`@hookform/resolvers@3` 只支持 zod 3 |
| `vitest` | `5.0.2` | `3.2.7` | 跨大版本；v3 与 Vite/RTL 组合最成熟 |
| `framer-motion` | `13.4.4` | `11.18.2` | v12+ 有 API 收敛（`LazyMotion` 等） |
| `next-intl` | `4.14.7` | `3.26.5` | v4 面向 Next 16 |
| `jose` | `6.2.12` | `5.10.0` | v6 有导出变更 |
| `bcryptjs` | `3.0.3` | `3.0.3` | — |
| `embedded-postgres` | **`18.4.0-beta.17`（全系只有 beta）** | **`18.4.0-beta.17`** | 必须**精确锁定**，否则任何新 beta 都可能改 API |

**硬性要求**

1. **`prisma` 与 `@prisma/client` 一律写精确版本 `6.19.3`，禁止 `^` / `~` / `latest` / `*`。**
   `eslint-config-next` 必须与 `next` **严格同版本**（`15.5.26`）。
2. `embedded-postgres` 精确 `18.4.0-beta.17`。
3. `package.json` 加 `"overrides"` 兜底，防止间接依赖把 Prisma 顶到大版本：

```jsonc
{
  "engines": { "node": ">=20.11 <25", "npm": ">=10" },
  "overrides": {
    "prisma": "6.19.3",
    "@prisma/client": "6.19.3"
  }
}
```

4. **`package-lock.json` 必须提交**（锁死传递依赖，成员间可复现）。
5. 升级依赖时用 `npm i <pkg>@<exact>` 显式指定，**永不使用 `npm update` 批量升级**。

#### 9.6.2 为什么选 "Next 15 + Prisma 6 + Tailwind 3 + Zod 3"（而非各自的 latest）

| 维度 | 结论 |
| --- | --- |
| **生态兼容性** | shadcn/ui 的当前产出、`next-intl@3`、`eslint-config-next@15`、`@hookform/resolvers@3`、Prisma 官方 driver adapter 生态均以 **Next 15 / Prisma 6 / TW3 / Zod 3** 为已验证组合。Tailwind 4 与 Zod 4 需要 shadcn 与 resolvers 同步升版，当前组合会踩"半迁移状态"（部分包只支持旧版、部分只支持新版） |
| **文档与社区方案一致性** | 绝大多数 Next.js 教程、Prisma 迁移案例、Tailwind 配置片段都是 TW3/Zod3 语法。用 latest 会让搜索引擎与 AI 给出的代码片段**三分之一直接编译不过**，显著拖慢 Phase 1 |
| **AI 代码生成准确率** | 本项目的工程师大量借助 AI 辅助编码。模型对 **Next 15 App Router + Prisma 6 + TW3 + Zod 3** 的训练覆盖远高于 Next 16 / TW4 / Zod 4 / Prisma 7（这些新版本在训练数据中样本稀疏，且 API 已变）。**这是选择"次新版"最重要的实际理由** |
| **Windows 落地风险** | 已实测：Prisma 6.19.3 + embedded-postgres 18.4 在中文路径 Windows 下全链路通过。Prisma 7 引入的新 adapter/engine 分发模型在 Windows + 慢网环境**尚未验证** |
| **稳定性 vs 尝鲜** | 本项目 Phase 1 的目标是"**能跑通完整学习闭环**"，不是验证最新技术。次新版本已过社区大规模使用验证，bug 密度最低 |
| **代价与补偿** | 代价：无法使用 Next 16 / TW4 / Zod 4 的新语法。补偿：所有版本已精确 pin，后续升级是**有计划的单点动作**（见下） |

#### 9.6.3 升级触发条件（什么时候才允许动大版本）

| 触发条件 | 允许的升级 | 前置要求 |
| --- | --- | --- |
| Phase 6（AI 深度能力）启动前 | 评估 `next@16` | 先确认 `next-intl@4`、`eslint-config-next@16` 均 stable，且 App Router 缓存语义变更已消化 |
| 需要 Prisma 7 的新特性（如官方 PGlite adapter / 更快的 query compiler） | 评估 `prisma@7` | 官方 stable 且 Windows 实测通过；CLI + Client 同步升；回归全部集成测试 |
| shadcn/ui 官方默认切到 Tailwind 4 | 评估 `tailwindcss@4` | 全站 class 语法迁移 + `tailwind-merge@3` + 视觉回归截图比对 |
| 需要 Zod 4 的性能/`zod/mini` | 评估 `zod@4` | `@hookform/resolvers@5` + 全部 schema 迁移（`z.string().email()` 等 API 变更） |
| `embedded-postgres` 发布 **stable** 版 | 升级 | 只要 API 未变可直接升级；若 API 变，改 `scripts/pg-daemon.mjs` 一处 |
| **安全公告（CVE）** | **立即升级补丁版本** | 不需要等待上述条件；补丁升级（patch）始终允许 |

> **一条铁律**：任何大版本升级必须**单独成一个 PR**，且该 PR 只做升级、不做业务改动，便于二分定位。

---

### 9.7 Node 版本兼容性结论

#### 9.7.1 实测环境

| 项 | 值 |
| --- | --- |
| 本机 Node | **`v22.22.2`**（`node -v`；npm `10.9.7`） |
| 团队基线建议 | **Node 22 LTS**（`.nvmrc` = `22`） |
| `package.json` | `"engines": { "node": ">=20.11 <25", "npm": ">=10" }` |

> **说明**：team-lead 提交的探测清单中记录为 Node `v24.21.0`（可能是另一 shell / 另一 Node 发行版切换后的结果），而架构侧实测（`node -v`，用于跑通 Tier A 与 Prisma 的正是这个运行时）为 **`v22.22.2`**。**两者都落在 Next 15 支持的区间内**，因此下面给出 20 / 22 / 24 三档结论，并以 **22 LTS 作为团队基线**（LTS、生态最稳、Prisma 官方 CI 主力覆盖）。

#### 9.7.2 `Next 15.5.26 + React 19.2.8 + Prisma 6.19.3` 兼容性

| Node | 结论 | 依据 / 风险 |
| --- | --- | --- |
| **20.x LTS** | ✅ **完全支持** | Next 15 官方要求 `^18.18.0 || ^19.8.0 || >=20.0.0`；Prisma 6 支持 `>=18.18` |
| **22.x LTS** ★基线 | ✅ **完全支持（已实测）** | Next 15 官方 requirement `>=20.0.0` 命中；**Prisma 6.19.3 的实际运行验证就是在 Node v22.22.2 上完成的**（`prisma db push` / `prisma generate` / Prisma Client 读写 JSONB + 原生 enum + 关联查询全部通过） |
| **24.x（Current）** | ⚠️ **可用但不作基线** | Next 15 的 `engines` 为 `>=20`，24 满足；但 24 是 Current 而非 LTS，**Prisma 6.19.3 的官方支持矩阵以 18/20/22 为主**，且 24 的 V8/`--experimental-*` 与 WebCrypto 演进可能影响 Prisma engine 与 `jose` 的边缘路径。**建议开发机用 22 LTS**；若只能用 24，请以"§8.3 判定项 1 全链路冒烟通过"作为准入门槛 |

**已知需注意的点**

| 坑 | 说明 | 处置 |
| --- | --- | --- |
| Prisma engine + Node 24 | Prisma 6 的 Node-API engine（`libquery-engine-windows.dll.node`）在 Node 24 上未进入官方 CI 主力矩阵；node-api ABI 理论上向后兼容，但存在边缘风险 | 基线锁 22 LTS；`.nvmrc` + `check:env` 双重提示 |
| `jose` v5 与 Node 24 的 WebCrypto | `jose@5.10.0` 使用 WebCrypto；Node 24 对 `globalThis.crypto` 的实现无破坏性变更，风险低 | 保持 `jose@5.10.0`；JWT 相关单测覆盖（T03） |
| Next 15 对 Node 版本告警 | 版本不在支持区间时 Next 会打印 warning 并可能拒绝启动 | `engines` + `.nvmrc` + `npm run check:env` 在启动前明确报错，避免"以为是代码问题" |
| 零配置可跑性 | 任何 Node 版本下都必须能在**无 AI Key** 时降级跑通 | Mock Provider（§4.3）+ Tier A 内嵌 PG（§2.6.1）共同保证 |

**建议（写进 README 与 T01 验收）**

```bash
# .nvmrc
22

# package.json
"engines": { "node": ">=20.11 <25", "npm": ">=10" }

# 开发机切换（nvm-windows）
nvm install 22
nvm use 22
node -v   # 期望 v22.x
```


---

## 十、共享知识（工程师必须遵守）

### 10.1 目录别名

```jsonc
// tsconfig.json paths
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2022",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/features/*": ["./src/features/*"],
      "@/services/*": ["./src/services/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/types/*": ["./src/types/*"],
      "@/styles/*": ["./src/styles/*"],
      "@/messages/*": ["./messages/*"]
    }
  }
}
```

> **禁止**出现 3 层以上的相对路径 `../../../../lib/x`；跨 `features/` 引用必须走 `@/` 或直接调到 `features/<domain>/index.ts` 暴露的公共 API。

### 10.2 文件命名

| 类别 | 规则 | 示例 |
| --- | --- | --- |
| 目录 | `kebab-case` | `word-detail/` `srs/` |
| React 组件文件 | `kebab-case.tsx` | `word-card.tsx` |
| Hook 文件 | `use-*.ts` | `use-ai-stream.ts` |
| Store 文件 | `*.store.ts` | `audio-player.store.ts` |
| Zod schema 文件 | `*.schema.ts` 或 `schemas.ts` | `auth.schema.ts` |
| Server 业务文件 | `<domain>.service.ts` | `vocabulary.service.ts` |
| 引擎文件 | `<unit>.engine.ts` / `<unit>.formula.ts` | `srs.engine.ts` |
| 测试文件 | 同级 `__tests__/` 或 `src/tests/**/<name>.spec.ts` | `src/tests/unit/srs.spec.ts` |
| i18n 文案 | `messages/<locale>.json`，key 用点分驼峰 | `vocabulary.review.empty.title` |

### 10.3 类型定义位置

| 类型 | 位置 | 规则 |
| --- | --- | --- |
| Prisma 生成类型 | `@prisma/client`（**不手写**） | 数据库实体类型一律从 Prisma 取 |
| API 契约 DTO | `src/types/dto/<domain>.dto.ts` | 前后端唯一契约，`features/*/schemas.ts` 从此处派生 Zod |
| 领域概念类型 | `src/types/domain/*.ts` | 如 `AbilityVector`、`SrsState`、`TaskType` |
| Prisma enum 镜像 | `src/types/enums.ts` | **由脚本从 schema 同步**，禁止手改（见 10.11） |
| AI 能力类型 | `src/services/ai/types.ts` | 唯一归属 |

**`any` 纪律**：`tsconfig` 开启 `strict`；确需逃逸时使用 `unknown` + 窄化，禁止 `as any`。仅允许两处例外：`// eslint-disable-next-line @typescript-eslint/no-explicit-any` 且必须写注释说明。

### 10.4 API 客户端封装约定

```ts
// 1) 唯一出口，禁止在组件里裸 fetch('/api/...')
// src/lib/http/client.ts
export const api = {
  get: <T>(path: string, query?: QueryLike, init?: ReqInit) => Promise<T>,
  post: <T>(path: string, body?: unknown, init?: ReqInit) => Promise<T>,
  patch: <T>(...) => Promise<T>,
  del:  <T>(...) => Promise<T>,
  stream: (path: string, body: unknown, signal?: AbortSignal) => AsyncGenerator<SseEvent>,
}
// 行为内建：credentials:'include' | 自动 attach Idempotency-Key | 401 触发静默 refresh 重放
//            | 错误统一抛 ApiError{code,message,httpStatus,traceId} | 请求取消

// 2) 每个 feature 的 thin wrapper（唯一被组件引用的地方）
// src/features/vocabulary/api.ts
export const vocabularyApi = {
  today: (limit?: number) => api.get<WordDto[]>('/api/vocabulary/today', { limit }),
  review: (p: ReviewInput) => api.post<ReviewResult>('/api/vocabulary/review', p),
}

// 3) QueryKey 统一管理（禁止散写字符串）
// src/lib/http/endpoints.ts
export const QK = {
  vocabulary: {
    today: ['vocabulary', 'today'] as const,
    reviewQueue: ['vocabulary', 'review-queue'] as const,
    detail: (id: string) => ['vocabulary', 'detail', id] as const,
  },
}

// 4) 组件用法
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: QK.vocabulary.today,
  queryFn: () => vocabularyApi.today(30),
  staleTime: 60_000,
})
```

### 10.5 环境变量命名规范

| 前缀 | 含义 | 是否暴露到浏览器 |
| --- | --- | --- |
| `NEXT_PUBLIC_*` | 可在客户端使用 | ✅ **会被打进 bundle** |
| `DATABASE_*` | 数据库连接 | ❌ |
| `AUTH_*` | 认证相关 | ❌ |
| `AI_*` | AI Provider 与网关 | ❌ |
| `*_API_KEY` / `*_SECRET` | 密钥 | ❌ **绝不允许 `NEXT_PUBLIC_` 前缀** |
| `UPLOAD_*` / `STORAGE_*` | 存储 | ❌ |
| `FEATURE_*` | 功能开关 | 视需要（`FEATURE_OFFLINE_CACHE` 可以在客户端） |
| `TZ` | 服务端时区 | ❌ |

**规则**：①所有 env 必须在 `.env.example` 有一行占位；②读取统一走 `src/lib/constants/config.ts` 的解析函数并做 Zod 校验，**缺关键变量在启动即报错**（`scripts/check-env.ts`）；③`ANALYZE=true npm run build` 才出包体积报告。

### 10.6 Json 字段适配层（SQLite 逃生通道必需）

```ts
// src/lib/utils/safe-json.ts
export const parseJson = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback
  if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return fallback } }
  return v as T
}
export const stringifyJson = (v: unknown) => (process.env.DB_DRIVER === 'sqlite' ? JSON.stringify(v) : v)
```

> **铁律**：**任何 Prisma `Json` 字段的读写必须经此适配层**，禁止直接 `JSON.parse(model.column)`。这是 SQLite 逃生通道能否成立的唯一前提。

### 10.7 Git 提交规范

采用 **Conventional Commits**，`feat|fix|chore|docs|refactor|test|perf|ci|revert(scope): subject`。

| type | 场景 |
| --- | --- |
| `feat` | 新功能（对应需求 ID 写在 body：`Refs: R008`） |
| `fix` | bug 修复（含 `Fixes: #issue`） |
| `perf` | 性能优化（首屏/首屏 JS 体积相关请附 Lighthouse 前后对比） |
| `refactor` | 不改变行为的重构 |
| `test` | 测试 |
| `chore` | 配置/依赖 |

规则：①主干分支 `main`，功能分支 `feature/<task-id>-<slug>`（如 `feature/t08-vocabulary-srs`）；②`package-lock.json` 必须提交；③`.env*` 除 `.env.example` 全部 gitignore；④PR 必须关联 Task ID 并注明受影响的 Task ID。

### 10.8 错误处理统一方式

| 层 | 处理 |
| --- | --- |
| Service | 抛 `AppError(code, message?, httpStatus?)`（`src/lib/api/errors.ts`），**不允许吞异常** |
| Route Handler | `withApi()` 捕获 `AppError` → envelope；捕获 ZodError → `VALIDATION_ERROR` + 字段详情；其余 → `SYS_INTERNAL` + `logger.error` |
| Client - Query | `retry: (count, err) => err.httpStatus >= 500 && count < 2`（4xx 不重试） |
| Client - UI | 列表/区块用 `<ErrorState onRetry={refetch} />`；致命错误走 `error.tsx` Error Boundary |
| AI | **永不向上抛**：Gateway 内部消化为 `{degraded:true, data:fallback}`；仅 `fallbackEnabled=false` 时抛 `AppError('AI_UNAVAILABLE', 503)` |
| 前端全局 | `window.onerror` / `unhandledrejection` 上报到 `/api/log`（Phase 1 仅打日志） |

### 10.9 日志规范

```ts
logger.info({ module: 'vocabulary.service', userId, traceId, msg: 'review committed', newMastery, intervalDays })
logger.error({ module: 'ai.gateway', traceId, capability, err, msg: 'provider failed' })
```

| 级别 | 场景 |
| --- | --- |
| `debug` | 仅开发环境：SQL 参数摘要、AI 原始 prompt（截断 500 字符） |
| `info` | 关键业务事件：注册、登录成功/失败、计划生成、考试交卷、AI 调用结果 |
| `warn` | 可自愈：AI 降级、限流触发、出血（乐观锁重试成功） |
| `error` | 不可自愈：DB 失败、JWT 密钥缺失、AI 熔断打开 |

**脱敏红线（禁止入日志）**：密码/密文 token/完整邮箱/IP/IPv6 全量、身份证、手机号、AI API Key、用户写作全文。邮箱统一脱敏为 `a***@b.com`，IP 统一脱敏为 `192.168.*.*`。

### 10.10 性能预算（对应 M5）

| 指标 | 预算 |
| --- | --- |
| 首屏 JS（gzip） | Dashboard ≤ 200KB，`/` Landing ≤ 120KB |
| LCP（Dashboard） | ≤ 2.5s（本地 / 4G 节流 ≤ 3.5s） |
| API P95（非 AI） | ≤ 300ms |
| API P95（AI 流式首 token） | ≤ 3s |
| Recharts / 播放器 / 富文本 | **必须** `next/dynamic({ ssr: false })` |
| 单页图片总量 | ≤ 1MB（WebP + AVIF 优先） |

### 10.11 Prisma enum 同步

```bash
npm run enums:sync   # 读 prisma/schema.prisma → 生成 src/types/enums.ts（禁止手改）
```

> 生成物包含：TS union 类型、`as const` 数组、以及同名 Zod `z.enum([...])`。所有下拉框/选项列表必须消费它，保证 DB / TS / UI 三处取值永远一致。

---

## 十一、待明确事项

### 11.0 已确认的环境事实（**不再列为待确认项**）

| 项 | 确认结果 | 影响与结论 |
| --- | --- | --- |
| 操作系统 / 项目路径 | Windows；`D:/徐浩然/2026-09-26-21-59-15/englishai`（**含中文目录名**） | ✅ 已实测可在中文路径下完成 PG 初始化与 Prisma 迁移，**无需改造路径**；目录联接方案仅作兜底 |
| **Docker** | **未安装** | ❌ 原"`docker compose up -d db` 最省事"的结论作废；`docker-compose.yml` 保留但**仅供有 Docker 的环境**。**开发默认改走 §2.6.1 Tier A（npm 内嵌 PostgreSQL）** |
| **PostgreSQL** | **未安装（无 `psql`）** | 由 Tier A 提供真实 PG 18.4，**零系统安装** |
| npm registry | 已是 `https://registry.npmmirror.com` | `.npmrc` 再固化一次即可，无需另配代理 |
| Node / npm | `v22.22.2` / `10.9.7`（team-lead 探测记录为 `v24.21.0`，两者均在支持区间） | ✅ 团队基线锁 **Node 22 LTS**（`.nvmrc` = `22`），`engines: ">=20.11 <25"`；详见 §9.7 |
| 数据库起法 | **Tier A 内嵌 PG 已实测跑通**（`PostgreSQL 18.4 on x86_64-windows` + Prisma 6.19.3 建表/查询全通过） | Phase 1 的 T02 验收标准已按"零系统安装可完成 migrate + seed"改写 |

### 11.1 PRD 14 个待确认问题的**架构侧默认决策**（工程师照此执行，无需再问）

| # | PRD 问题 | **架构决策** | 影响 |
| --- | --- | --- | --- |
| **Q1** | 词库来源与版权 | Phase 1 采用 **开源 ECDICT 精简子集 + 自建 CET 高频补充**，去重后按 `lemma` 唯一入库 → `prisma/data/cet4-words.csv`（3000 词）/ `cet6-words.csv`（2000 词）。**结论**：seed 提供 5000 词即可满足 MVP；商用授权待确认前**仅限本地/自评用途**，正式上线前需替换或取得授权。字段按 §2.5 `Vocabulary` 建模，派生词/词根词缀等字段允许为空，并由 AI 解释能力补齐。 | 词汇全模块 |
| **Q2** | 听力音频/字幕 | **Phase 1 不引入真实版权音频**。Phase 1 seed 提供 **20 篇文本 + 时间轴字幕**，音频用 **TTS 生成 mp3 存 `public/audio/`**（可脚本批量产生），并预留 `listening_materials.audioUrl` 字段；真人版权音频在 Phase 3 接入。**摘要**：MVP 只有文本 + TTS 音频 + 人工校对字幕（种子自带）。 | 听力模块 |
| **Q3** | CET 真题授权 | 内容一律走 **AI 生成 → TEACHER 审核 → 上架**（`PublishStatus: DRAFT → PENDING_REVIEW → PUBLISHED`）。**结论**：Phase 1–5 不引入任何真题原文；"真题训练"用「同源难度自编题」代替，UI 文案标注"模拟真题"。 | 阅读/考试 |
| **Q4** | 初始内容量级（MVP） | 采用 PRD 建议值的**打折 MVP**：CET-4 3000 词 / CET-6 2000 词 / 阅读 60 篇 / 听力 20 篇 / 语法 14 类（每类 15 题）/ 写作任务 30 / Placement 题 60 / CET 模拟卷 **4 套**（非 6）。理由：首版内容可由脚本批量生成，先跑通学习闭环。Phase 5 前补齐到 PRD 量级。 | 排期 |
| **Q5** | AI Provider 选择 | **默认 `deepseek`**（国内可用、OpenAI 兼容、成本低、无需代理）；Failover 顺序 `deepseek → openai → mock`。**预留** `dashscope`(通义) / `anthropic` / `gemini` Adapter（接口已定义，接入只需实现 `complete()`）。`mock` 永远可用 → **零配置可跑通全部链路**。 | 全部 AI |
| **Q6** | STT / TTS 方案 | **Phase 1：STT 用浏览器原生 `Web Speech API`（`webkitSpeechRecognition`）**，零成本零依赖；**TTS 用浏览器 `speechSynthesis`**（单词发音、AI 回复朗读）。缺点：Chrome/Edge 可用，Firefox 需降级 → 降级时**（记录 `transcript` 为空则提示用户手动输入文本）**。架构上通过 `src/services/speaking/stt.ts` 的 `SttProvider` 接口隔离，**Phase 3 可无痛换成云 ASR（讯飞/阿里）**。录音何时上传：默认**不保留**（合规最优），仅当云 ASR 上线后按需临时上传并 24h 删除。 | 口语/听力 |
| **Q7** | 实时对话链路 | **串行链路**：录音 → STT → LLM → TTS → 播放。MVP 延迟目标 **< 3s**（本地 Ollama 可能 3–6s，属可接受）。Realtime 语音模型列入 Phase 7，`AI Provider` 接口已预留 `streamAudio` 扩展点。 | AI Speaking |
| **Q8** | AI 成本预算 | **默认每用户 100 次/日**（`AI_USER_DAILY_QUOTA`），后台可配；**写作批改/阅读出题/计划生成**三类重能力走并发信号量（≤4）+ 结果缓存（24h）。单条硬性红线：`maxTokens` 上限逐能力限定，`WRITING_REVIEW ≤ 4096`。 | 成本 |
| **Q9** | Placement 题量与 CEFR 标定 | **Phase 1 固定 30 题非自适应**（四维度分值占比：词汇 30% / 语法 30% / 阅读 25% / 听力 15%），CEFR 与 CET 用 §5.5 的**规则映射**打底；同时在 `placement_tests` 落 `scores` 原始分，**随真实样本累积后做线性回归替换系数**（替换只需改 `mapCefr`/`estimateCet` 两个函数）。CAT 自适应列为 Phase 6+（schema 已预留 `irtDifficulty`/`discrimination` 字段）。 | Assessment |
| **Q10** | TEACHER 人工批改 | Phase 1–5 **纯 AI**；但 `writing_submissions.status` 与 `speaking_sessions` 预留 `needsHumanReview` 扩展位（用 `ruleCheck Json` 携带标记），Phase 6 引入 TEACHER 复核队列时无需迁移表。 | 写作/口语 |
| **Q11** | 排行榜隐私 | **默认匿名昵称**（显示 `User***a1b2` + 默认头像），用户可在 `/settings/privacy` 选择「实名参与 / 匿名参与 / 退出排行榜」三档，默认「匿名」。 | Gamification |
| **Q12** | 多端（小程序/App） | 本期**仅 Web（PC + Mobile Web）**。架构保证：所有业务逻辑在 `services/` + REST API，**未来 App/小程序直接复用 `/api/**`**，仅需新增适配层。 | 技术栈 |
| **Q13** | 数据保留与合规 | **默认策略**：①录音**不落服务器**（Phase 1 浏览器 STT），未来云 ASR 上线后临时音频 **24h 后自动删除**；②AI 对话记录保留 **180 天**后可自动清理（提供 `/settings/data` 手动清除）；③敏感词双向过滤（输入输出）；④数据导出 JSON + 账户删除为软删（`users.deletedAt`）+ 30 天物理删除缓冲。**注：正式上线前仍需法务确认。** | 合规 |
| **Q14** | PWA / 离线 | Phase 1 **不引入 Service Worker**（避免与 Next dev 缓存冲突）。但**单词/复习队列的本地草稿**用 `localStorage` 实现（`use-local-draft` hook），静默失败后支持重放；PWA + IndexedDB 离线背词列入 R052（P2）。 | 体验 |

| **Q15** | 找回密码邮件发信 | **架构默认：Phase 1 不发真实邮件**，把重置链接/验证码输出到服务端日志（`logger.info`，仅开发环境），并在 UI 明确提示"开发环境请查看服务端日志"。`notification.service.ts` 的 `EmailChannel` 接口已预留，接入 Resend / 阿里云邮件只需实现一个 `send()`。（原 U6，转为默认决策） | 认证 |
| **Q16** | CET 目标分映射是否需要人工标定 | **架构默认：Phase 1 用 §5.5 规则映射**，并在报告页固定显示"估算值，仅供参考"。`placement_tests.scores` / `exam_attempts.cetEstimate` 保留原始分，**一旦有 ≥100 份真实样本（测试分 vs 实际 CET 分）即可做线性回归替换系数**（只改 `mapCefr` / `estimateCet` 两个纯函数，零迁移）。（原 U7，转为默认决策） | Assessment |

### 11.2 需要**用户拍板**的问题（请 team-lead 转交用户）

> 已按"能由架构决策的一律自带默认值"原则收敛：原清单中的 **Docker 安装 / 词表来源 / 邮箱发信 / CET 标定样本** 四项已转为架构默认决策（见 §11.0 与 Q1、Q15、Q16），不再占用用户决策带宽。

| # | 问题 | 为什么必须用户拍板 | 我的推荐 | 备选 / 影响 |
| --- | --- | --- | --- | --- |
| **U1** | **AI Provider 与 API Key**：Phase 1 是否采购/确认一个真实 LLM Key？ | 决定 AI 功能是"真跑"还是"降级兜底"。技术侧已做到零 Key 可跑通，**但演示真实感需要真实模型** | **DeepSeek**（OpenAI 兼容、国内直连无需代理、成本极低），注册送额度即可支撑 Phase 1 全部演示 | ① 本地 **Ollama**（零成本，需 ≥16GB 内存 + 另起服务，延迟 3–6s）；② 通义 `dashscope`（兼容协议，Adapter 已预留）；③ 暂不采购 → 全程 Mock + 降级（链路可验证，但输出是模板内容） |
| **U2** | **云 PostgreSQL 账号**：是否注册 Neon / Supabase 免费库？ | **非阻塞项**（Tier A 已实测可跑），但若需要**多人共享同一个库**、或需要随时随地从别的机器连库，则必须先有账号 | 注册一个 **Neon 免费库**（3 分钟，零成本），把连接串放 `.env.local`，用 `npm run db:use-cloud` 一键切换 | 不注册 → 纯本地 Tier A，多人协作时各自一份数据（Phase 1 可接受） |
| **U3** | **内容与音频版权**：词表来源授权 / CET 真题授权 / 听力音频素材 | **法律风险项，架构无法代替决策**。技术侧已给出"无版权素材也能跑"的路线（自建词表 + TTS 音频 + AI 生成题目），但一旦要商用或公开发布，必须先行厘清 | Phase 1 先按 Q1/Q2/Q3 默认决策（开源词表 + TTS + AI 自编题）推进，**上线前替换或取得授权** | ① 用户提供已授权素材 → 我在 T02 seed 中加导入器；② 采购商业词库 API；③ 维持"不出网、仅内部使用" |
| **U4** | **是否上线部署？目标环境？**（Vercel / 阿里云轻量 / 校内服务器 / 仅本机演示） | 决定 Dockerfile / cron 调度 / 对象存储 / 域名与 HTTPS 的取舍；也决定 U1、U2 是否必须落实 | 若仅内部演示 → **本机 Tier A + `npm run dev` 即可**，Phase 1 不投入部署；若要对外 → **阿里云轻量 2C4G + Neon PG**（可控成本、国内访问快） | Vercel（部署最简单，但 DB 必须外挂，且 Serverless Cold Start 对 M5 ≤3s 有压力；cron 也需改造） |


---

## 摘要（300 字内）

本文档给出 EnglishAI 智能英语学习平台**可直接落地的完整技术架构**：单体 Next.js 15.5.26 + Prisma 6.19.3 起步，含 ADR-001 拆分路径；**52 张表完整 Prisma schema**；**140 条 REST API**（统一 envelope + 30 错误码 + SSE 流式）；**AI Gateway** 以 18 能力对齐 A1–A18，Provider 可插拔并带 Failover、Zod 结构化校验与逐能力降级矩阵；核心算法含 SRS（SM-2 变体 + 六状态）、任务生成、推荐、XP/Streak、CEFR→CET 映射；**T01–T10 十个有序任务**确保 Phase 1 跑通"注册→测评→看板→学单词"。**v1.1 关键修订**：本机无 Docker/PG，已实测 **Tier A 内嵌 PostgreSQL 18.4**（`embedded-postgres`）+ **Prisma 6.19.3** 全链路（含中文路径、原生 enum、JSONB）；依赖全部精确锁定（`prisma` 的 latest 是 `8.0.0-rc.17` 预发布，严禁 `^`）。**v1.2 裁决**：§5.1 SRS 采 A 追认（阈值 25/50/75/90、离散时间因子、固定扣分）+ **B 回改 1 项承重结构**——间隔阶梯不得封顶 30 天，否则 5000 词稳态复习量达 167 词/天、吃满 M2 的 22min 预算，长尾阶梯可压到 42 词/天；§5.2 任务生成追认 Phase 1 线性分配（**Placement 之前 `abilityVector` 物理上不存在**，线性是唯一正确解），权重算法列为 Phase 2 P0 并保留完整规格与验收标准。







