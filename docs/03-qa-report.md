# EnglishAI Phase 1 · 独立 QA 验证报告

- **执行人**: 严过关（Edward）· QA Engineer（独立验证，未参与编码）
- **日期**: 2026-09-27
- **验证对象**: Phase 1 批次 T01-T10（工程师自称 IS_PASS: YES）
- **环境纪律遵守**: 未占用 3000 端口（检测到 PID 31028 LISTENING，用户使用中）、未跑 `next build`、未清 `.next`、未改业务代码、未 commit/push

---

## 总体结论：**YES WITH CONDITIONS**（有条件可交付）

质量门数字全部复现、安全实现无 P0 级可绕过漏洞、数据库 seed 与声明一致、前端基建达标。
但 **Placement 评分体系与 gamification 数值口径同架构文档不符（5 处 P1）**、**rotateSession 存在并发竞态（P1）**，需裁决对齐后放行。

---

## A. 质量门复跑（工程师声称数字 vs 实测）

| 项目 | 工程师声称 | QA 实测 | 判定 |
| --- | --- | --- | --- |
| `npx tsc --noEmit` | 0 错 | 0 错（exit 0，无输出） | ✅ 复现 |
| `npm run lint` | 0 error | `✔ No ESLint warnings or errors`（exit 0） | ✅ 复现 |
| `npx vitest run` | 64/64 | **64 passed (64)**：srs 26 + cefr 18 + level 8 + streak 6 + ai-mock 6，5 文件全绿 | ✅ 复现 |
| 覆盖率（核心算法 ≥80%） | ≥80% | **srs 81.2%**（formula/engine 100%）、**gamification 91.3%**（level.ts 100%） | ✅ 复现 |
| E2E 10 条 | 10/10 chromium | **未实跑**（3000 被占，纪律 3）；代码级审查：8 spec 文件恰好 10 个 `test()`，断言真实（唯一邮箱注册 → 登录 → 操作 → 可见性断言），非空跑 | ⚠️ 待窗口 |
| build 103kB | 103kB shared | 未复跑（禁 build） | ⚠️ 未复验 |

> 覆盖率复跑注：本机安全删除护栏会拦截 vitest 清理旧 `coverage/` 目录，需加 `--coverage.clean=false` 才能跑通（环境问题，非项目问题）。

---

## B. 核心算法正确性审查（对照 docs/02-architecture.md §5）

### B1. SRS（src/services/vocabulary/srs/*）—— 4 文件

| 检查项 | 结果 |
| --- | --- |
| EF 公式 `EF + 0.1-(5-q)(0.08+(5-q)0.02)` | ✅ srs.formula.ts:39 与 §5.1.3 逐字一致 |
| EF 边界 clamp [1.3, 2.8] | ✅ srs.constants.ts:18-19 + formula.ts:39 |
| mastery 0-100 clamp | ✅ formula.ts:46/48 |
| 六状态 | ✅ 六枚举齐全（srs.types.ts:8） |
| LAPSE/ADVANCE/MASTERED 三路径 | ✅ formula.ts:52/74/94 |
| 间隔表 [1,3,7,14,30] | ✅ 与团队任务书一致；**但文档 §5.1.3 LADDER_DAYS=[0,1,3,7,14,30,60,120,240]** → 见问题 #1 |
| 幂等 | ✅ `vocabulary_reviews.idempotencyKey` 唯一索引实测存在于库；review route 支持 header/body 双通道 |
| 乐观锁/服务端计算 | ✅ engine 注释 + service 层实现 |

**问题 #1（P2 · 文档-实现偏差）**: 阶段阈值实现 25/50/75/90（srs.constants.ts:11-14），文档 §5.1.1 为 20/45/70/90；LAPSE 间隔实现 1 天（formula.ts:59），文档为 0 天（10 分钟同轮重试，§5.1.3）；毕业间隔 45 天 vs 文档 ≥120 天；timeFactor 实现为离散 ±4/-3，文档为连续 [0.8,1.2]。→ 与团队任务书口径一致（任务书即 [1,3,7,14,30]），判定为 **Phase 1 有意简化，但文档未同步** → 建议架构师更新 §5.1 或工程师对齐，二选一。

### B2. Placement（src/services/placement.service.ts）—— ❌ 与文档不符

**问题 #2（P1 · 公式与文档不符）**: 权重实现 `vocabulary*0.3 + grammar*0.25 + reading*0.25 + listening*0.2`（placement.service.ts:45），文档 §十一 Q9（4810 行）明确 **词汇 30% / 语法 30% / 阅读 25% / 听力 15%**。
**问题 #3（P1 · 公式与文档不符）**: CEFR 映射实现 85→C1 / 70→B2 / 55→B1 / 40→A2（service:50-56，**无 C2**），文档 §5.5 mapCefr 为 88→C2 / 78→C1 / 65→B2 / 50→B1 / 33→A2。且工程师单测 cefr.spec.ts:11 的注释自称"§5.5 分段"但断言的是自制分段——**测试通过 ≠ 符合规格**。
**问题 #4（P1 · 公式与文档不符）**: CET 估算实现线性 `250+round(overall/100*380)+bump`（service:59-66），文档 §5.5 为 CET_BASE/BAND_CENTER 查表 + CET-6 ×0.92 + clamp [220,700]（实现下限 0，允许估出 220 以下）。
**问题 #5（P2 · 配比不一致）**: 抽题 12/7/6/5（startTest:80-85，即 40/23/20/17%）与任何一版权重都对不上，且 `take: count*4` 依赖题池 ≥4 倍（seed 恰好 60 题满足，数据不足时维度题量会静默缩水）。

### B3. Gamification（src/services/gamification/level.ts）—— ❌ 与文档不符

**问题 #6（P1 · 公式与文档不符）**: 等级曲线实现 `100*n(n+1)/2`（level.ts:6-9，Lv2=300/Lv3=600…），文档 §5.4 为 `LEVEL_THRESHOLDS=[0,500,1500,3500,7000,15000]`。
**问题 #7（P1 · 公式与文档不符 + 边界遗漏）**: XP 值实现 learn=4/review=2/task=10/exam=50（level.ts:49-60），文档 §5.4 表为 +2/+1/+5/+80；且**未实现"复习正确 1 次 XP 上限 100/日防刷"**（文档明确要求，代码无对应逻辑）。
Streak（calcStreakDays, level.ts:32-46）: 逻辑正确（今天未学不打断、昨天起回溯），但依赖调用方传入本地日期；`localDate()` 为 UTC 口径，对 UTC+8 用户在 0:00-8:00 会归到前一天 → **问题 #8（P2 · 时区边界）**。

### B4. Onboarding（src/services/onboarding.service.ts）

- 首周任务 7 天 ×3 类、covered 日期跳过（幂等）✅（onboarding.service.ts:108-156）
- **问题 #9（P2 · 边界遗漏）**: §5.2 每日任务权重算法（BASE_WEIGHT + 弱项 +0.08 等）**整体未实现**（全仓库无 `generateDailyTasks`/`BASE_WEIGHT`），首周任务仅按 dailyMinutes 线性分配，未按目标/弱项差异化。
- **问题 #10（P2 · 竞态）**: `generateFirstWeekTasks` 先查后建非事务，并发双提交可重复生成任务行。

---

## C. 安全实现抽查

| # | 检查项 | 结果 |
| --- | --- | --- |
| 1 | Access 15min / Refresh 30d | ✅ config.ts:74-75（900s/30d），jwt.ts 签发一致 |
| 2 | 重放检测 → 整族撤销 | ⚠️ 串行重放可靠（session.ts:64-71 检出 revoked → updateMany 整族撤销，事务原子）；**并发轮换有 TOCTOU 竞态** → 问题 #11（P1） |
| 3 | password.ts argon2 | ✅ 19456 KiB / t=2 / p=1（config.ts:78-80）= OWASP 推荐值；强度 ≥8 位+字母+数字 |
| 4 | RBAC 双重校验 | ✅ middleware 粗筛（§403/401）+ withAuth 内 verifyAccessToken + hasRole 二次判决（handler.ts:107-114）；未发现 method 篡改/locale 大小写（/EN/admin → 剥离失败 → 仍要求登录）/路径大小写提权路径 |
| 5 | csrf.ts | ✅ 无 Origin 且无 Referer → fail-closed（csrf.ts:41）；Origin 在白名单比对；middleware 第一道 + handler 第二道双保险 |
| 6 | rate-limit | ⚠️ 内存固定窗口，单实例局限已注释声明 + RateLimiter 接口预留（rate-limit.ts:1-4,21-24）；buckets Map 无淘汰 → 长期内存增长（问题 #12 P2）；clientIp 信任 x-forwarded-for 可伪造绕 IP 限流（问题 #13 P2）；login-guard 持久化锁定（DB 字段）✅ 但 recordFailure 两次 update 非原子（问题 #14 P2） |
| 7 | JWT dev fallback secret | ⚠️ jwt.ts:12 / middleware.ts:42 空 secret 时静默回退 `'englishai-dev-secret-change-in-production'` → 生产漏配环境变量不会 fail-fast（问题 #15 P2） |

**问题 #11（P1 · 竞态/重放检测绕过窗口）**: `rotateSession`（session.ts:54-107）先 `findUnique` 检查 `revokedAt`，后事务中 `update({ where: { id: session.id } })` **无条件**置 revoked。两个携带同一 refresh token 的并发请求都能通过 revokedAt 检查并各自成功创建新会话——并发复用不会触发整族撤销，违背"重放检测"设计意图。
**建议修法**: 改条件更新 `updateMany({ where: { id, revokedAt: null } })` 并检查 `count === 0` → 走整族撤销分支；或对 tokenHash 加唯一约束利用唯一冲突判定。
**路由判定**: → Engineer

---

## D. API envelope 一致性抽查（11 个 route）

抽查：auth/login、auth/register、auth/refresh 群组、vocabulary/{review,learn,review-queue}、dashboard、placement/[id]/submit、analytics、user/settings、ai/cet-advice。

- ✅ 全部经 `withApi/withAuth` 统一 `ok()/fail()` → `{success,data,error,traceId}`；错误码使用符合 §3.2 表（AUTH_TOKEN_MISSING/EXPIRED、PERM_FORBIDDEN、SYS_RATE_LIMIT、VALIDATION_ERROR、RESOURCE_NOT_FOUND、AUTH_WEAK_PASSWORD 等均正确）；Zod body/query schema 齐全；RBAC roles 注解正确（公开接口 withApi、业务接口 withAuth）。
- **问题 #16（P2 · 一致性缺口）**: `ai/chat/route.ts` 手工实现认证与 SSE，**绕过 withApi**：无 rateLimit（AI 是高成本资源，其他 AI 路由也无——AI 系列整体缺 SYS_RATE_LIMIT）、events() 内异常未包装为 SSE error 帧、cookie 手工 `split('=')` 解析对含 `=` 值脆弱（JWT 为 base64url，实际风险低）。
- **问题 #17（P2 · 类型断言）**: `placement/[id]/submit/route.ts:14` 用 `as unknown as` 强转 Next 路由类型，掩盖 params 契约。

## E. 数据库与 seed 抽查（node + pg 直连 5433 实测）

| 声称 | 实际表名（schema @@map） | 实测 | 判定 |
| --- | --- | --- | --- |
| words=5000 | `vocabulary` | 5000 | ✅ |
| listening=20 | `listening_materials` | 20 | ✅ |
| reading=60 | `reading_articles` | 60 | ✅ |
| placement=60 | `questions` | 60 | ✅ |
| aiConfigs=18 全 mock | `ai_capability_config` | 18 行，providerKey **全部='mock'** | ✅ |
| achievements=24 | `achievements` | 24 | ✅ |
| users 含 1 ADMIN | `users` | 51（1 ADMIN + 50 USER） | ✅ |

- 总表数 53（52 域表 + `_prisma_migrations`）与文档"52 张表"一致 ✅
- 外键/索引抽查（3 张）：`auth_sessions`（tokenHash unique / familyId idx / userId_revokedAt idx）、`user_vocabulary`（userId+vocabularyId unique 等 5 索引）、`vocabulary_reviews`（idempotencyKey unique、userId_occurredAt idx）及对应 FK 约束 → 与 schema.prisma 一致 ✅

## F. 前端代码级抽查

1. **响应式** ✅：Sidebar `hidden lg:block`（app-shell.tsx:30，≥1024）、BottomNav `md:hidden`（bottom-nav.tsx:48，≤768）、中间档 TopNav + 抽屉 —— 与 PRD 断点一致。
2. **主题** ✅：`ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`（providers.tsx）三态 + root layout `suppressHydrationWarning` 防闪白。
3. **i18n** ✅：扁平化 diff 脚本实测 zh-CN 286 键 = en 286 键，**双向 0 差异**。
4. **三态** ✅：EmptyState 用于 notifications/vocabulary 主页/learn/review/notebook/dashboard-today-tasks；ErrorState + RetryBoundary 用于 dashboard/placement report；SkeletonKit 覆盖 10+ 页面。
5. **AI 降级闭环** ✅：`degrade.ts buildFallback` 按能力键给兜底结构 → `result.degraded/degradedReason` → `AiDegradedBanner` 按 REASON_TEXT 映射（覆盖 AI_CAPABILITY_DISABLED/QUOTA/TIMEOUT/UNAVAILABLE + 默认文案）。

## G. E2E

3000 端口被占用（PID 31028），按纪律**未实跑**。代码级审查结论：8 spec × 10 用例（login 2、analytics 2、register/word-learn/exam-submit/submit-exercise/ai-chat/writing-analyze 各 1），helpers 提供真实 API 引导（注册→onboarding→登录态），断言基于可见性与业务文案，无 `.skip`/空断言。**E2E 实跑待窗口复验。**

## 安全整改复核（API Key 残留）

- 代码/seed：`grep -rniE "sk-[a-z0-9]{8,}|apiKey:=['\"][A-Za-z0-9]{16,}"` 于 scripts/ prisma/ src/ → **0 命中** ✅
- env：`.env`/`.env.local` 仅含 DATABASE_URL + DB_DRIVER，无任何密钥 ✅
- DB：ai_capability_config 18 行 providerKey 全部 'mock' ✅

---

## 问题清单汇总

| # | 级别 | 文件:行号 | 描述 | 建议修法 | 路由 |
| --- | --- | --- | --- | --- | --- |
| 2 | **P1** | placement.service.ts:45 | 评分权重 30/25/25/20 ≠ 文档 Q9 的 30/30/25/15 | 改权重系数并对齐 cefr.spec 断言 | Engineer |
| 3 | **P1** | placement.service.ts:50-56 | CEFR 分段 85/70/55/40 且缺 C2 ≠ §5.5 的 88/78/65/50/33 | 按 §5.5 重写 mapCefr + 修测试 | Engineer |
| 4 | **P1** | placement.service.ts:59-66 | CET 估算线性公式 ≠ §5.5 CET_BASE/BAND_CENTER 查表，且下限 0 而非 220 | 按 §5.5 实现 estimateCet | Engineer |
| 6 | **P1** | gamification/level.ts:6-9 | 等级曲线 100n(n+1)/2 ≠ §5.4 [0,500,1500,3500,7000,15000] | 改 LEVEL_THRESHOLDS | Engineer |
| 7 | **P1** | gamification/level.ts:49-60 | XP 值 4/2/10/50 ≠ §5.4 的 2/1/5/80，且缺复习 100/日上限 | 对齐 XP 表 + 补日上限 | Engineer |
| 11 | **P1** | lib/auth/session.ts:54-107 | rotateSession 并发 TOCTOU：同 token 并发轮换双双成功，重放检测失效窗口 | 条件 updateMany + count 判定 | Engineer |
| 1 | P2 | srs.constants.ts / formula.ts | SRS 阈值/间隔/毕业口径与 §5.1.1/§5.1.3 不一致（疑为有意简化） | 架构师裁决：改文档或改码 | Architect/Engineer |
| 5 | P2 | placement.service.ts:80-98 | 抽题配比 12/7/6/5 与权重不符；题池不足时静默缩水 | 配比改 9/9/7.5/4.5 取整方案或按维度权重抽题 | Engineer |
| 8 | P2 | lib/utils/date.ts（localDate） | UTC 口径使 UTC+8 用户 0-8 点 streak/当日统计归错日 | 按用户 settings.timezone 计算 | Engineer |
| 9 | P2 | onboarding.service.ts | §5.2 权重式任务生成整体未实现，首周任务仅按时长线性分配 | Phase 2 实现或文档标注简化 | Architect |
| 10 | P2 | onboarding.service.ts:108-156 | 首周任务生成非事务，并发可重复建任务 | 包 $transaction 或 userId+date 唯一约束 | Engineer |
| 12 | P2 | lib/auth/rate-limit.ts:31 | buckets Map 无淘汰，key 无限增长 | 定期清扫或 LRU | Engineer |
| 13 | P2 | lib/auth/rate-limit.ts:69-73 | 信任 x-forwarded-for，无代理部署可伪造绕 IP 限流 | 直连时取 socket 地址 / 部署文档标注 | Engineer |
| 14 | P2 | lib/auth/login-guard.ts:42-58 | recordFailure 两次 update 非原子，竞态可多试 1-2 次 | 合并为条件 update 单语句 | Engineer |
| 15 | P2 | lib/auth/jwt.ts:12 / middleware.ts:42 | 生产漏配 AUTH_JWT_SECRET 静默回退弱密钥 | 生产环境启动 fail-fast | Engineer |
| 16 | P2 | app/api/ai/chat/route.ts | 绕过 withApi：无限流、SSE 异常未包装 | AI 系列补 rateLimit；异常转 SSE error 帧 | Engineer |
| 17 | P2 | app/api/placement/[id]/submit/route.ts:14 | `as unknown as` 强转路由类型 | 使用 Next 15 标准泛型签名 | Engineer |

**统计**: P0/BLOCKER 0 · P1/MAJOR 6 · P2/MINOR 11

## 智能路由判定

- **Engineer（业务代码）**: #2 #3 #4 #6 #7 #11 必修；#5 #8 #10 #12 #13 #14 #15 #16 #17 建议随批修复
- **QA（测试代码）**: 无——抽查发现 cefr.spec.ts 断言与文档不符属"测试固化了错误实现"，修正应随 #3 一起回流给 Engineer（测试与实现须同改）
- **Architect 裁决**: #1 #9（SRS/任务生成简化是否追认进文档）
- **NoOne**: A/D/E/F 全部通过项

## 结论

**YES WITH CONDITIONS**：建议 (1) 工程师修复 6 项 P1（预计半天内：数值常量对齐 + rotateSession 条件更新）；(2) 架构师对 #1/#9 简化口径追认或回改；(3) E2E 在 3000 空闲窗口实跑复核后关闭条件。

---
---

# 第二轮复验（Round 2 · 2026-10-03）

- **复验对象**: commit `afba52d`（34 文件，+1103/-273，未 push）+ 架构师对 #1/#9 的裁决（docs v1.2，工作区 modified，未计入 diff）
- **复验人**: 严过关（Edward）· 仍未修改任何 `src/` 业务代码
- **环境约束遵守**: 3000 端口未触碰、未跑 `next build`、未清 `.next`、未 commit/push；覆盖率命令加 `--coverage.clean=false`

## 复验结论：**PASS（6 项 P1 全部真落地，无回归）**

P1 全部修复且经独立数值交叉验证，非"仅测试通过"。另发现 **1 项 MAJOR（P2→升级）**：CI 覆盖率门禁配置失效。

## 一、回归基线（工程师声称 vs 实测）

| 项目 | 声称 | 实测 | 判定 |
| --- | --- | --- | --- |
| `npx vitest run` | 105/105 | **105 passed (7 files)**：srs 26 + cefr 31 + level 17 + rate-limit 10 + date 9 + streak 6 + ai-mock 6 | ✅ 复现 |
| `npx tsc --noEmit` | 0 错 | 0 错（exit 0） | ✅ 复现 |
| `npm run lint` | 0 错 | `✔ No ESLint warnings or errors` | ✅ 复现 |
| 关键算法覆盖 | ≥80% | srs.formula/engine/constants 100%、level.ts 100%、placement.service 32.5%（纯函数全覆盖，DB 流程未覆盖属正常） | ✅ 见问题 R-1 |

## 二、P1 六项逐条复验

### #2 维度权重 30/30/25/15 —— [PASS]
- `placement.service.ts:44-50` 提取 `DIMENSION_WEIGHTS = {vocabulary:0.3, grammar:0.3, reading:0.25, listening:0.15}`
- **抽题配比复用同一常量** ✅：`allocateQuestionCounts()`（service:159-182）按权重最大余额法分配，`startTest` 的 plan 直接取该函数结果（原硬编码 `[12,7,6,5]` 已删）
- 独立验证：`allocateQuestionCounts(30)` → 9/9/8/4，总和守恒；cefr.spec:39-55 断言语法=30、听力=15 与旧值区分
- 题池不足改为 `log.warn` 显式告警（service:186-190），不再静默缩水 ✅

### #3 CEFR 88/78/65/50/33 + C2 —— [PASS]
- `scoreToCefr`（service:71-78）五段阈值与文档 §5.5 逐字一致，含 C2 顶档
- `cefr.spec.ts` 已重写为文档值（31 例，含边界 33/50/65/78/88 及 `scoreToCefr(99.9)='C2'`）
- **独立复算交叉验证**（不依赖被测代码，按文档公式在 node 内重算 10 个分数点）：overall=33→A2、50→B1、65→B2、78→C1、88→C2，与实现逐点一致 ✅

### #4 estimateCet 查表 + ×0.92 + clamp[220,700] —— [PASS]
- `CET_BASE`（A1 220…C2 660）、`BAND_CENTER`（20/42/58/72/84/94）、`CET_MIN=220`/`CET_MAX=700` 全部按 §5.5 常量落地（service:83-140）
- `estimateCetFor` = `base + round(0.5*(overall-BAND_CENTER[level]))`，CET-6 走 `*0.92`，末端 `clamp` ✅
- **独立复算**：10 个分数点的 cet4/cet6 与实现完全一致（如 overall=88 → C2 → cet4=657 / cet6=604）✅

### #6 LEVEL_THRESHOLDS —— [PASS]
- `level.ts:14` `LEVEL_THRESHOLDS = [0,500,1500,3500,7000,15000]`，附 `LEVEL_NAMES` 六档名称与文档逐行对应
- `levelFromXp`/`totalXpForLevel`/`levelProgress` 重写，**满级收敛正确**（level ≥ MAX_LEVEL 时 progressPct=100、xpToNext=0，不再出现旧实现的除零/递增到 100 级）
- `level.spec.ts` 重写为阈值表断言（17 例）

### #7 XP 2/1/5/80 + 每日上限 —— [PASS]（**已验证非摆设**）
- `XP_REWARDS = {learn_word:2, review_word:1, complete_task:5, exam_submit:80}`（level.ts:79-88）✅
- **重点核验上限是否真生效**：`REVIEW_XP_DAILY_CAP=100` 不是死常量——`reviewXpAward()`（level.ts:96-108）按 `correctReviewsToday < 100` 判定，且已接线到真实业务路径：`vocabulary.service.ts:21-28` `resolveReviewXp()` 查当日 `isCorrect=true` 的复习数后调用 ✅
- 上限逻辑含 `!isCorrect → 0`（答错不给分）✅

### #11 rotateSession 并发窗口 —— [PASS]（**已构造并发测试实证**）
- 实现改为交互式事务内 `updateMany({ where: { id, revokedAt: null } })` 原子抢占，`claimed.count === 0` → 事务回滚 → `revokeFamily(familyId)` + 抛 `AUTH_SESSION_REVOKED`（session.ts:88-115）
- **独立构造真实 PG 并发测试**（临时 spec，连 localhost:5433 真实库，未改业务代码，测毕已删除）：
  - 2 并发同 token → `fulfilled=1 / rejected=1 code=AUTH_SESSION_REVOKED`，族内 `alive sessions=0` ✅
  - **8 并发压力放大** → `fulfilled=1 revoked=7`（只有一方抢到）✅
  - 串行重放（复用已撤销 token）→ `AUTH_SESSION_REVOKED` + 整族撤销 ✅
- **TOCTOU 窗口已消除**，无回归

## 三、两处偏离 QA 建议的处置 —— 均 [ACCEPTED-DEVIATION]

### #13 clientIp / TRUST_PROXY —— [ACCEPTED-DEVIATION]（等效不退化）
- **(a) 独立核实工程师口述**：`node_modules/next/dist/server/web/spec-extension/request.d.ts` 中**确无 `ip` 字段**（grep 零命中），Next 版本 `15.5.26`。"Next 15 已移除 `request.ip`"属实，未采信口述而是查了类型定义 ✅
- **(b) 伪造绕过路径审查**：默认 `trustProxy()=false`（仅 `TRUST_PROXY=1/true` 开启，rate-limit.ts:141-144）→ `clientIp` 直接返回 `'direct'`，**任何 `x-forwarded-for`/`x-real-ip`/`cf-connecting-ip` 均不被采信**，伪造头无效 ✅；`.env.example:27` 已显式写入 `TRUST_PROXY=0`；开启时代理头取 `split(',')[0]`，符合可信代理链惯例
- **(c) 直连部署不退化**：`handler.ts:141-155` 在 IP 桶之外追加**身份二级桶**（`route-guards.ts` 的 `identity` 回调，登录/注册按归一化 email 归一 —— `normalizeEmail` 已 trim+lowercase，防大小写绕过），AI 路由按 userId（`userRateLimitRule`）✅；rate-limit.spec:73-95 四例覆盖默认/1/true/0 四种开关组合
- **残留建议（P3）**：`identity` 桶当前未绑定"答对才计数"外的失败语义，且 AI 路由仅 cet-advice/diagnosis/recommend 覆盖，chat 走独立 20/min 桶——覆盖面可接受，不构成缺陷

### #15 生产 fail-fast —— [ACCEPTED-DEVIATION]（两文件行为一致）
- `jwt.ts:18-30` `resolveSecret()`：`appConfig.app.isProd` 且 secret 长度 <16 → throw；dev 走 fallback
- `middleware.ts:41-55` `secret()`：`NODE_ENV === 'production'` 且长度 <16 → throw；dev 走 fallback
- **两文件判定条件等价**（`appConfig.app.isProd` 即 `NODE_ENV==='production'`），阈值同为 16 位，错误信息均带 `openssl rand -base64 48` 修复指引 ✅ 仅 production 生效，dev/vitest 零配置可跑 ✅

## 四、其余 P2 修复抽验 —— 全部 [PASS]

| # | 判定 | 证据 |
| --- | --- | --- |
| #5 抽题配比 | [PASS] | `allocateQuestionCounts` 最大余额法，题池不足 `log.warn`（service:186-190） |
| #8 时区 | [PASS] | 新增 `lib/utils/user-date.ts`（`userToday`/`todayFor`，60s 缓存），已接入 analytics/dashboard/onboarding/placement/vocabulary 五处 service；date.spec 9 例覆盖 UTC+8 跨日、跨月跨年、非法时区回退 |
| #10 事务 | [PASS] | onboarding.service:118 `prisma.$transaction` 包裹「读已覆盖日期 + 批量写」，消除并发重复建任务 |
| #12 内存淘汰 | [PASS] | rate-limit.ts:36-66 `MAX_BUCKETS=10_000` + 60s 周期清扫 + LRU 插入序淘汰；rate-limit.spec:43-52 压测大量 key 不抛错 |
| #14 锁定原子性 | [PASS] | login-guard.ts:50-57 单条 `UPDATE ... CASE ... RETURNING`，读改写合并为一次原子操作 |
| #16 AI 限流 | [PASS] | ai/chat 补 userId 桶 20/min（route:63-64）+ events() 异常包成 SSE `error` 帧带 partial 标记（route:117-126）；cet-advice/diagnosis/recommend 同步 `aiRateLimitRule` |
| #17 类型强转 | [PASS] | 6 个动态路由改 `withAuth<unknown, unknown, { id: string }>` 标准泛型签名，`as unknown as` 已清除 |

## 五、回归中新增发现

### R-1（P2 · MAJOR · 路由 Engineer）CI 覆盖率门禁配置失效
- **现象**：`vitest.config.ts` 的 `coverage.thresholds`（lines/functions/statements 80、branches 70）在实际执行中**未生效**——按配置原样跑 `npx vitest run --coverage`，即使被门禁纳入的 5 个核心文件聚合覆盖率仅 **59.33% lines / 76.92% funcs**（低于阈值 80），也**不会触发任何 ERROR、不影响 exit code**
- **对照实验**：显式传 `--coverage.thresholds.lines=80`（其余同配置）→ 立即输出 `ERROR: Coverage for lines (59.33%) does not meet global threshold (80%)`。即**阈值对象本身没被 provider 消费**，疑似 `coverage.include` 用了相对 glob 导致 `all` 语义下 include 失效、聚合口径与阈值口径不一致
- **影响**：CI（`.github/workflows/ci.yml:30-31` "Unit tests (coverage gate ≥80%)"）当前是**假绿**——门禁形同虚设，任何覆盖率下滑都不会让流水线失败
- **建议修法**：改用 `coverage.thresholds: { lines: 80, ..., perFile: false }` 并显式给 `coverage.all: true` + 绝对路径 glob；修完用上述对照实验验证"能报错"再合入
- **注**：本项是**门禁工具链缺陷**，非业务代码缺陷，不影响运行时行为，故不升 P1

## 六、第二轮判定汇总

| 类别 | 数量 | 明细 |
| --- | --- | --- |
| P1 修复 | **6/6 PASS** | #2 #3 #4 #6 #7 #11（均含独立数值复算或并发实证） |
| 偏离处置 | **2/2 ACCEPTED** | #13（查类型定义核实 + 伪造审查 + 二级桶确认）、#15（两文件等价） |
| P2 修复 | **7/7 PASS** | #5 #8 #10 #12 #14 #16 #17 |
| 新增问题 | **1（P2 MAJOR）** | R-1 覆盖率门禁失效 → Engineer |
| 回归 | **无** | tsc/lint/105 用例全绿；P1 修复未破坏既有行为 |

**最终结论：YES**（R-1 属工程门禁改进项，不阻塞 Phase 1 业务交付；建议下一批次修门禁并在 3000 空闲窗口补跑 E2E 关闭最后条件）

---
---

# 第四轮 · Phase 2 批次 A 验证（commit `f38a682`）

- **验证人**: 严过关（Edward）· QA Engineer（仍未参与编码、未改动任何 `src/` 业务代码）
- **对象**: `f38a682`（18 文件 +1126/-80，未 push）：T11 SRS 长尾回改 + T12 权重式任务生成
- **环境前提**: 本地内嵌 PG 因宿主管理员权限不可用（非项目缺陷）→ 连库项标注 `[BLOCKED-ENV]`
- **纪律**: 未跑 `next build`、未占 3000、未 commit/push

## 结论：**CONDITIONAL PASS** —— 纯函数层质量高，但有 1 项 P1 功能未闭环 + 2 项测试效力问题必须记录

---

## 一、回归基线（实测）

| 项目 | 声称 | 实测 | 判定 |
| --- | --- | --- | --- |
| `npx vitest run` | 126/126 | **126 passed (10 files)** | ✅ 复现 |
| `npx tsc --noEmit` | 0 错 | exit 0 | ✅ 复现 |
| `npm run lint` | 0 错 | `✔ No ESLint warnings or errors` | ✅ 复现 |
| 覆盖率 核心面 | lines 97.95% / branches 91.05% | **97.95 / 91.05 / 96.77 / 97.95**（无 threshold ERROR） | ✅ 复现 |
| SRS 模块 lines | 100% | srs.constants / srs.engine / srs.formula **均 100% lines** | ✅ 复现 |

> 附注：上一轮 R-1（覆盖率门禁静默失效）已在 `127492f` 修复——`coverage` 从根级移入 `test.coverage` 后门禁真正生效（本轮阈值判定会报错并影响 exit code）。

## 二、T11 SRS 长尾回改

### 1. `estimateReviewLoad(5000)` 独立复算 —— [PASS]
- **不依赖被测代码手算**：`5000 / 120 = 41.6667` 词/天 → `41.6667 × 8s = 333.33` → `Math.round = 333` 秒/天，`333 ≤ 400` 验收线 ✅
- 实现 `srs.engine.ts:78-98` 与我手算逐字一致（`dailyReviews=41.67 / etaSeconds=333 / etaMinutes=5.6`）
- 对照口径自洽：`5000/30×8 = 1333`（Phase 1 封顶）✓、`20000/120×8 = 1333` ✓
- **口径脆弱性提示（P3，非缺陷）**：333 全部依赖 `STEADY_STATE_AVG_INTERVAL_DAYS=120` 这一**建模常量**而非实测值（`srs.constants.ts:66`）。该值偏保守——稳态下多数词会沉淀在 240 档，真实日均更接近 `5000/240×8 ≈ 167s`。结论方向不变，但「≤400」应理解为「在文档假设均值 120 天下的结论」。

### 2. `reps=1..8` 间隔序列 —— [FAIL]（测试声称与实际不符）
- 测试 `srs.spec.ts:120-132` 断言 `[1,3,7,14,30,60,120,240]`，但其构造方式为**每轮复位** `masteryScore:10, consecutiveCorrect:0`（测试第 123、130 行），即**人为关闭毕业分支**来隔离 ADVANCE 查表。
- **我独立驱动被测函数、不复位状态**（临时脚本，测毕已删）得到真实「连续答对」序列：
  | 场景 | 实际序列 |
  | --- | --- |
  | rating=4 **常态** 8s | `1,3,7,14,30,60,`**`240`**`,240…`（**120 档被跳过**，r7 触发 MASTERED） |
  | rating=4 **慢速** 15s | `1,3,7,14,30,60,120,240,240…`（唯一能走满 8 档的真实路径） |
  | rating=5 快速 2s | `1,3,7,`**`15`**`,60,120,240…`（EF 升至 2.8，缩放 1.06） |
- 结论：测试标题「EF=2.5 **连续答对**」名不副实——它验证的是**查表下标**，不是连续答对路径。真实主流场景下 **120 档永不到达**。测试通过 ≠ 产品行为符合「8 档阶梯」的直觉预期。→ 列为问题 **R2-2**。

### 3. 毕业递进 `60→120→240` 是否绕过 —— [PASS]
- `srs.spec.ts:148-160` 起始 `reps=4, mastery=95, cc=3`，**状态逐轮向前携带**（`s = { ...out }`），每轮断言 `path === 'MASTERED'`，得到 `[60,120,240]`。
- 对应实现 `srs.formula.ts:76-94`：`gradIndex = clamp(reps-5, 0, 2)` → 60/120/240。**是真实驱动毕业分支，非绕过** ✅
- 补充：毕业间隔**不做 EF 缩放**（直接用 `GRADUATED_INTERVALS`），与 ADVANCE 路径口径不同，属设计选择，已记录。

### 4. 无数据回填/迁移触碰历史 `vocabulary_reviews` —— [PASS]
- `prisma/migrations/` 仅 `20260927045208_init`，`vocabulary_reviews` 只在该初始化迁移中出现（建表+索引+外键），**无任何 UPDATE/回填语句**；
- `f38a682` **未新增迁移文件**（`git show --stat` 无 `migrations/`）；
- `scripts/rebuild-stats.ts:59` 仅 `vocabularyReview.findMany`（只读），写入目标只有 `daily_learning_stats`；且该脚本**未被本 commit 改动**。
- 结论：历史复习记录零触碰 ✅

### 5. SRS 三文件覆盖率 —— [PASS]
- 实测 `srs.constants.ts / srs.engine.ts / srs.formula.ts` **lines 100%**（见上表）。

## 三、T12 权重式任务生成

### 6. 四分支断言的「具体性」—— [PASS]（附口径说明）
- ③ CET（`plan-generator.spec.ts:68-79`）断言**具体数值**：`SPEAKING ≤ 0.05`、`READING+LISTENING ≥ 0.45`、`SPEAKING 任务被过滤` ✅
- ④ 完成率（`:82-89`）断言**具体整数**：`baseMinutes = 24 / 30 / 48`（含 0.5 边界不降档）✅
- ① 弱项（`:45-53`）：`weakHits.LISTENING === 30` 为精确值，权重侧用「大于基线」的相对断言；
- ② 强项（`:56-65`）：用「低于中性场景」的相对断言。
- 结论：无任何分支是「仅不抛错」；① ② 为相对断言但配合精确 `weakHits`，可接受。

### 7. ★「弱项 ≥2× 强项」断言 —— [FAIL]（边界拟合，验收规格需重述）
- **暴力扫描 6⁵=7776 个画像**（独立脚本驱动 `generateDailyTasks`）：
  - 听力目标 **max = 10**（画像 `v0/lst0/r100/w100/s100`），**min = 5**（`v0/lst100/r0/w0/s0`）→ **比值上限恰为 2.000**
  - 目标分布：`{5:625, 6:2377, 7:1330, 9:3339, 10:105}` —— 2× 只在极少数极端画像对之间成立
  - **单变量对照**（仅翻转 listening，其余固定 50）：`lst0=9 vs lst100=5 = 1.800×`
  - **权重比上界**（`computePlanWeights().weights.LISTENING`）：`max 0.3438 / min 0.1802 = 1.908×`
- 测试 `:92-106` 用**两个不同画像**（weak: lst30/其余90 → 10；strong: lst90/其余60 → 5）凑到 `10 vs 5 = 2.0`。
- **判定**：该断言的阈值**恰好等于数学上界（零裕量）**，其成立依赖 `Math.max(…,5)` 下限 + `clampInt` 取整，而非「弱项被设计成 2 倍权重」（底层权重比仅 ~1.9×）。任何对 `BASE_WEIGHT / WEAK_BONUS / 取整 / 下限` 的微调都会击穿它。**它验证的是「数字恰好落在 10 和 5」，不是「弱项需求被加权到 2×」**。
- **与工程师自述不符**：工程师称「受控条件下数学上限 ~1.56×」，我实测为 **1.800×（单变量）/ 1.908×（权重比）/ 2.000×（跨画像上界）**，未复现 1.56×。请工程师补充其 1.56× 的对照定义。
- **建议**：改为单调/相对性质断言（如「弱项画像的听力目标严格大于强项画像」或「≥1.5×」），并把产品意图（弱项应获得多大加权）交由架构师在 §5.2.2 明确。→ 问题 **R2-3**（路由 Architect 裁决 + Engineer 调整断言）

### 8. mock-prisma 能否证明真实并发安全 —— [效力边界，必须记录] → 问题 **R2-4**
- `plan-rebuild.spec.ts:22-42` 用 `vi.mock('@/lib/db')`：`$transaction` 被替换为**直通回调**，`upsert` 被替换为**只记录参数、永不判定唯一性的 spy**。
- 因此该测试能证明的只有**编排逻辑**：① 键选择为 `(userId,date,taskType)`；② COMPLETED 被 `continue` 跳过；③ 触发窗口（7 天 / 次日）正确。✅ 这三点确实覆盖了。
- 但**无法证明并发安全**：mock 中不存在「两个并发事务争抢同一唯一键」的语义，唯一约束与 `skipDuplicates` 行为全部落空。真实并发安全的承重结构是 **DB 层 `@@unique` + `createMany({skipDuplicates})` / `upsert`**，只能靠真库验证。
- 同类问题见 `onboarding.service.ts:171-177`：`createMany({ skipDuplicates: true })` 的并发语义同样只有真库能证。
- **结论**：T12 幂等/QA#10 竞态修复**当前仅有编排层证据**，真实并发安全 **`[BLOCKED-ENV]`，须待 PG 恢复后补验**（见文末清单）。

### 9. Placement 交卷 → rebuild「只重算未完成」—— [FAIL]（功能未闭环）
- 单测 `plan-rebuild.spec.ts:57-68` 对「跳过 COMPLETED」的编排断言**真实覆盖**（`skippedCompleted === 1` 且该 key 不出现在任何 upsert）✅
- **但触发链路是断的**：全仓库检索确认——**没有任何调用方**访问 `/api/study-plan/rebuild`：
  - 前端 `src/features/placement/api.ts:58-59` 的 `submit()` **只调** `/api/placement/${id}/submit`，无 rebuild 调用；
  - 服务端 `src/services/placement.service.ts` **不含** `rebuild` / `PLACEMENT_COMPLETED` 引用。
- 即：commit message 所述「Placement 交卷后由前端调用」**未实现**。真实用户交卷后计划不会重算，「M1 测评→计划重算」闭环缺失。→ 问题 **R2-1（P1）**，路由 **Engineer**。

## 四、顺带核查

### 10. `predictIntervals` 与 `interval-hint.tsx` 改 8 档同源 —— [PASS]（附 1 处 P3 观感）
- `vocabulary.service.ts:353-361` `predictIntervals` 用 `[...ADVANCE_INTERVALS]`（8 项）→ 返回 8 项；`interval-hint.tsx:10` `LABELS = ADVANCE_INTERVALS.map(...)`（8 项）→ **索引对齐，无错位** ✅
- P3（旧有观感问题，非本次引入）：当 `currentInterval` 较大时，`predictIntervals` 会把多档都返回同一 `currentInterval`（如全 240），UI 将显示「若1天档：约240天」×8 —— 语义上「不早于当前间隔」，但文案易误读。建议后续把文案改为「最早约 X 天」。

### 11. `sync-enums.ts` 移除 eslint-disable —— [PASS]
- 生成物 `src/types/enums.ts` 与 schema **逐值一致**：`TaskSource` 5 值 `ONBOARDING/PLACEMENT_COMPLETED/DAILY_CRON/PLAN_ADJUST/MANUAL`（`schema.prisma:177-183` ↔ `enums.ts:320-335`）✅
- 移除 `/* eslint-disable */` 后 `npm run lint` 仍 **0 错** → 生成物本身 lint-clean，无副作用 ✅

## 五、问题清单（本轮新增）

| 编号 | 级别 | 文件:行号 | 描述 | 建议 | 路由 |
| --- | --- | --- | --- | --- | --- |
| R2-1 | **P1** | `features/placement/api.ts:58` / `services/placement.service.ts` | Placement 交卷无任何调用 `/api/study-plan/rebuild`，PLACEMENT→重算闭环未接线 | 前端 submit 成功后调用；或在 `submitTest` 内服务端触发 | Engineer |
| R2-2 | P2 | `src/tests/srs.spec.ts:120-132` | 「连续答对」用例每轮复位 mastery/cc，实为查表测试；真实常态下 120 档不可达，标题与语义不符 | 改标题为「ADVANCE 查表」；补一条**不复位**的真实连续答对用例并写明期望（常态 240 跳档） | Engineer |
| R2-3 | P2 | `src/tests/plan-generator.spec.ts:92-106` | 「弱项≥2×强项」阈值恰等于数学上界（2.000），零裕量、靠取整+下限凑出，非加权设计使然；且与工程师自述 1.56× 不符（实测 1.8/1.908/2.0） | 改单调/≥1.5× 相对断言；产品意图由架构师在 §5.2.2 明确 | Architect 裁决 + Engineer |
| R2-4 | P2 | `src/tests/plan-rebuild.spec.ts:22-42` | mock-prisma 无法证明真实并发安全（`$transaction` 直通、`upsert` 不判唯一键） | 保留为编排层测试；真库并发用例待 PG 恢复补 | Engineer（补验） |
| R2-5 | P2 | `prisma/schema.prisma:917-934` | 新增 `source/weightSnapshot/weakHits` + `@@unique([userId,date,taskType])` 但**未执行 db push**；旧 DB 上运行新代码会报列不存在；且存量 `study_tasks` 可能违反新唯一约束导致 push 失败 | PG 恢复后 `db push`，先查存量重复 `(userId,date,taskType)` | Engineer（`[BLOCKED-ENV]`） |
| R2-6 | P3 | `src/services/vocabulary/srs/srs.constants.ts:66` | ETA 依赖建模常量 120 天（非实测），结论脆弱 | 文档标注假设；有真实数据后回归替换 | Architect |

## 六、`[BLOCKED-ENV]` 待 PG 恢复后补验清单

1. `prisma db push` 能否成功落库（先校验存量 `study_tasks` 是否有重复 `(userId,date,taskType)`，否则唯一约束会失败）—— R2-5
2. 真库**并发安全**验证：并发提交 onboarding / 并发 `rebuildTasks` 是否真被 `@@unique` + `skipDuplicates`/`upsert` 去重 —— R2-4
3. **Placement → rebuild 端到端**：交卷后今日起 7 天未完成任务被重算、已完成任务行不变 —— R2-1 修复后复验
4. 毕业递进在真实 `user_vocabulary` 行上的落库表现（`intervalDays` / `nextReviewAt` 写库一致性）
5. 上一轮遗留：**E2E 10 条实跑**（本轮/上轮均因 dev 服务与 `test-results` 清理被本机 safe-delete 护栏拦截而未完成，属环境阻塞，非代码问题）

## 七、批次 A 交付判定

**CONDITIONAL PASS** —— 纯函数层（SRS 公式/权重生成/评分映射）实现正确、覆盖率高，可交付；
但 **R2-1（PLACEMENT→rebuild 未接线，P1）必须在合并前修复**，否则 M1 闭环名存实亡；
R2-2/R2-3/R2-4 为测试效力问题，需修正或明确其边界后再视为验收证据；
R2-5 与第 2/3/5 项属环境阻塞，**必须待 PG 恢复后补验**方可解除条件。
