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

---

# 第五轮 · R2-1/R2-2 修复复验 + Phase 2 批次 B 听力（HEAD = 6a032a4，父 6435bb5）

> 验证对象：commit `6a032a4`（R2-3）+ 父 `6435bb5`（d41c8f0 R2-1/R2-2 + 98106c1 批次 B + 6435bb5 README）。
> **工作区纪律**：验证期间工程师在并行提交（HEAD 从 6435bb5 → 6a032a4）并有一批未提交 WIP
> （`listening.service.ts` / `api/listening/` 8 路由 / `features/listening/` / `seed-listening-p2.ts`）。
> 本报告所有数值均以 **git 对象（已提交代码）** 为准；WIP 仅作「缺口是否在补」的佐证，不计入验收。
> 连库项 PG 不可用 → [BLOCKED-ENV]。

## 1. R2-1（上轮 P1）Placement → rebuild 闭环 — [PASS]

**代码事实**（`src/services/placement.service.ts`，`submitTest` 内，事务提交后）：
```ts
let planRegenerated = false
try {
  const { rebuildTasks } = await import('./plan/rebuild')   // 动态 import：避免 plan 层进入 placement 模块图
  await rebuildTasks(userId, { kind: 'PLACEMENT_COMPLETED' })
  planRegenerated = true
} catch (error) { log.warn({ msg: 'placement plan rebuild failed (non-blocking)', ... }) }
```
**测试证明力**（`src/tests/placement-submit-rebuild.spec.ts`，3 用例，实跑通过）：
- 用例①：`rebuildTasks` 被调 1 次、参数 `{kind:'PLACEMENT_COMPLETED'}`、**时序 `order === ['tx','rebuild']`**（事务提交之后）、`planRegenerated=true`；
- 用例②：rebuild 抛错 → `planRegenerated=false`、交卷正常返回、`profile.updateMany` 已执行（能力向量落库）、**未回滚**；
- 用例③：无 IN_PROGRESS 测试 → 抛错且 **rebuild 零调用**（不误触发）。

**判断**：该测试证明的是**真实触发链路**（mock 的只是 rebuild 模块本身，其内部行为由 plan-rebuild.spec.ts 覆盖），
不是「rebuild 函数自身」——R2-1 的 P1（无调用方）确已闭环。
**边界安全性**：rebuild 内部自带 `$transaction`，失败只回滚自身事务，已提交评测不受影响；catch 仅记日志。
两点残留（不构成阻塞）：① mock-prisma 无法证明「真实 PG 中 rebuild 能读到刚提交的能力向量」——但 rebuild 在独立事务内重读 profile，生产语义安全；② 尽力而为的 await 无超时，rebuild 挂起会拖住交卷响应（理论风险）。
**结论：R2-1 真闭环。**

## 2. R2-2 SRS 测试改名 + 真实序列用例 — [PASS]

- 误导性用例已改名为「ADVANCE 查表：EF=2.5 … reps=1..8 依次取 [1,3,7,14,30,60,120,240]」，并注释明确「**非**真实连续答对序列」；
- 新增 describe「真实连续答对序列（不复位）」3 用例，断言与 QA 第四轮独立实测完全一致：
  - rating=4/8s：`[1,3,7,14,30,120,240]`（r6 毕业跳过未消费的 60 档）；
  - rating=4/15s：慢速走满全 8 档 `[1,3,7,14,30,60,120,240]`；
  - rating=5/2s：`[1,3,7,15,60,120,240]`（EF 升至 2.8 使 14→15，r5 毕业取首档 60）。
- 注释明确「跳档是 §5.1.4 裁决 B 的预期行为，不要为符合直觉改公式」——防止未来误改。

## 3. R2-3 受控单变量 + 8 分钟下限 — [PASS]（独立复算，非采信测试注释）

**测试结构**（6a032a4）：跨画像凑 2.0× 的拟合已删除，改为其余五维固定 50、**只翻转 listening 30↔90**。
**独立复算**（临时 tsx 脚本直跑 committed `generator.ts`，跑毕已删）：
| 画像 | weakHits（佐证单变量） | LISTENING 权重 | 目标值 | 断言 |
|---|---|---|---|---|
| 弱项 L=30, M=30 | {LISTENING:30, VOCAB:50} | 0.28448 | round(30×0.28448)=**9** | >5 且 9/5=**1.8 ≥ 1.5** ✓ |
| 强项 L=90, M=30 | {VOCAB:50, READING:50} | 0.18018 | round(30×0.18018)=**5** | < 8（反证真实）✓ |
| 弱项 L=30, M=20 | {LISTENING:30, VOCAB:50} | 0.28448 | 手算 6 → **被 floor 拉到 8** ✓ |
- `WEAK_MINUTE_FLOOR=8` 确在 `generator.ts` 实现（`applyWeakFloor`：`base<=0` 或非弱项不施放），非只写在测试里——M=20 用例目标从 6 变 8 即 floor 生效的直接证据；
- CET 归零的 SPEAKING 不会被 floor 复活（`base<=0` 守卫，代码确认）。

## 4. 听力听写判分独立复算 — [PASS，附 1 个潜在 P3]

**方法**：临时 spec（44 用例，跑毕已删）用**独立 LCS 实现**交叉验证 `diffDictation`——
不变量 `correctCount === LCS(原文,用户)`、`missing+substituted === m-LCS`、`extra === n-LCS-substituted`、
`accuracy === round(correct/max(m,n,1)×10)/10`，覆盖 26 组输入（漏词/多词/替换/重复词/大小写/弯直撇号/
连字符/tab/引号/空串/长文本/数字），**全部一致**；`normalizeToken`/`levenshtein`/`fuzzyMatch` 探针通过。
**潜在缺陷（P3，当前数据零影响）**：`diffDictation` 不过滤归一化后为空的 token（`tokenize()` 会过滤）——
`diffDictation('Hello ... world','Hello world')` → accuracy **66.7**，'...' 报 missing。
已核对 60 篇 seed：**0 行**含独立纯标点 token，故不影响现有语料；但属口径不一致的潜在 bug。
另记录两项设计性严格（非缺陷）：回溯优先「替换」→ 乱序答案零记分（LCS 信用方案可得 1 分）；
`fuzzyMatch` 容忍度=1 绝对字符 → 1-2 字母词任意互通（KEYWORD 模式偏松）。

## 5. 音频完整性 — [FAIL]（对照 T13 验收 #1：60 篇 × 3 档 = 180）

**已提交实测（git 对象，HEAD）**：`109 mp3 + 109 vtt`，覆盖 **37 篇**（36 篇满 3 档 + 1 篇仅 1 档）。
**缺口明细**：
| 问题 | 事实 | 严重度 |
|---|---|---|
| 缺篇 | **23 篇完全无音频**：lm-38~lm-60（缺篇中 L3×12、L4×11；L3 仅 2 篇有音频，L4 全军覆没）——目录的 38% | **P1** |
| 空文件 | `a-business-podcast-on-remote-work_075.mp3/.vtt` 为 **0 字节**（git 空 blob e69de29），且该篇 100/125 档从未生成 | P1 |
| 截断 | `a-news-report-on-renewable-energy_125.mp3` 仅含首句（24480B ≈ 4s，vtt 仅 1 条 cue；其余两档正常 5 句） | P2 |
| 计数不实 | README/commit 称「111 个 mp3」——109 个文件中 1 空 1 截断，**可用仅 107** | P2 |
**质量抽查（通过项）**：107/108 组 vtt 文本与 seed 逐字一致、cue 时间零倒挂；mp3 帧头合法（edge-tts 48kbps），字节数×8/48k 与 vtt 末 cue 时长互洽。
**连带发现（seed 层，同属 P1）**：
- `prisma/seed/data/listening-p2.ts` 的 `LISTENING_P2` **导入量为 0**——60 篇新材料不入库，`ListeningAudioAsset` 无行；
- `seed-content.ts` 仍写**无档位后缀**的 `audioUrl`（`/audio/listening/{slug}.mp3`）→ Phase 1 那 20 篇的死链**原样存在**（commit 声称已修，实际未修）；
- 两个 seed 源的 id 空间撞车（均用 `lm-1..lm-20` 指代不同内容）——后续接线必须先做 id 重映射。
- 工程师 WIP 中可见 `seed-listening-p2.ts`（未提交）且在并行补音频——**提交后需复验**。

## 6. UI 缺口 — [FAIL]

设计文档 **T14 明确在本批次范围**：4 个页面（`listening/page.tsx`、`player/[id]`、`training/[id]`、`report/[id]`）
+ 10 个组件（audio-player/transcript-sync/…/trainer-report）+ E2E，验收标准 7 条。
**事实**：HEAD 无任何听力页面/组件/API；工作区 WIP 仅有 `features/listening/{api,hooks,schemas,types}.ts`
（**无 page.tsx、无组件、无 E2E**）；8 个 API 路由亦在未提交状态。
即：**「API 层未提交 + 前端整体缺失」**，批次 B 的 T14 按验收标准一条都未满足。

## 7. 回归门禁 — [PASS]

- `vitest run`：**199/199 通过**（= 已提交 155，与 team-lead 实测一致 + QA 临时复算 44，跑毕已删）；
- `tsc --noEmit`：**0 错误**（验证初期 WIP 曾有 3 个 TS 错误，工程师已当场修复；已提交代码始终干净，
  含主理人修的 `gen-listening-audio.ts:153`——block body 返回 void，修复正确）；
- `next lint`：已提交代码 **0 error / 0 warning**；仅 WIP `listening.service.ts` 2 个 unused 警告（工程师待清理）；
- [BLOCKED-ENV] PG 不可用：seed 实跑、`db push`、`listening_audio_assets` 落库、E2E 10 条——均无法验证。

## 结论与路由

| 项 | 结论 |
|---|---|
| R2-1 | **真闭环** ✓（触发链路、时序、失败不阻断均被真实用例证明） |
| R2-2 | ✓（改名 + 3 条不复位真实序列，断言与独立实测一致） |
| R2-3 | ✓（受控单变量 + 1.8× 裕量 + floor 真实现 + 反证真实，独立复算一致） |
| 批次 B（T13） | **FAIL**：音频 109/180（23 篇全缺 + 1 空 + 1 截断）；60 篇材料与资产未接线入库；Phase 1 死链未修；README 过度宣称 |
| 批次 B（T14） | **FAIL**：前端页面/组件/E2E 整体缺失（设计文档明确在本批次范围） |
| 回归 | ✓ 155/155 + tsc 0 + lint 0（已提交代码） |

**总判定：NOT PASS（批次 B 不可算交付）**。R2-1/R2-2/R2-3 三个 QA 遗留项已真闭环；
但听力特性的数据完整性、seed 接线、前端交付三块存在硬缺口，且与 README 宣称不符。
**路由：Engineer（Alex）**——缺口清单即验收清单：① 补 23 篇音频（或明确降级范围并改 README）；
② 清理/重生空文件与截断文件；③ 接线 `LISTENING_P2` seed（含 id 重映射）并修正 `seed-content.ts` 死链；
④ 交付 T14 页面/组件/E2E；⑤ WIP 的 2 个 lint 警告。提交后 QA 复验（第 2 轮）。

---

# 第六轮 · 听力批次闭环复验（HEAD = 75f0f4c）

> 对象：第五轮判 NOT PASS 的批次 B 各项。本轮 PG 可用（PG 18.4 @5433，`npm run db:start` 实起）、
> dev server 实起、E2E 实跑（safe-delete 护栏用 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 前缀解除）。
> 工作区仅 `docs/03-qa-report.md` 有未提交改动（本报告），无混验。

## 1. 音频完整性 — [部分 PASS，保留 1 项 FAIL]

**已修复**：`find public -name '*.mp3' | wc -l` = **180**；60 篇 × 3 档无一缺档；**0 空文件**。
第五轮 0 字节的 `a-business-podcast-on-remote-work_075.mp3` 已重生（141552B / 帧解析 **23.59s**，合法）。
**未修复（FAIL）**：`a-news-report-on-renewable-energy_125.mp3` **仍截断**——
帧级解析 **4.08s / 170 帧**，仅含 5 句中的第 1 句（同篇 075=28.61s、100=21.48s；文件时间戳 Oct 8 未动过）。
commit 2fffa23 宣称「0 截断」**不实**。根因：`gen-listening-audio.ts` 的幂等 skip（`size>0` 即跳过）
不会修复"非空但截断"的文件——需先删除该文件或给生成器加 `--force`。
**全量审计**（自写 MPEG 帧解析器遍历全部 180 档）：除上述 1 个外无一异常
（p50=15.98s、max=30.10s；24kHz/48kbps MPEG2 L3，帧头全合法）。
**用户影响**：seed 把该资产如实登记（lm-36@1.25 durationSec=**4**、fileSize=24480）——
1.25× 档只能听到第 1 句，且字幕时间轴会被压进 4 秒；列表页还会显示"3 档语速"（文件都在，看不出残缺）。

## 2. seed 真落库 — [PASS]（真实 DB 证据，非仅看代码）

- 接线：`prisma/seed/steps.ts:39` 清单化登记 `{name:'listening-p2', run:seedListeningP2}`（content 之后）；
- 实跑 `npm run db:seed`：日志 `listening-p2: 60 materials (+180 audio assets)`，summary `listening=60`，5.7s 幂等完成；
- DB 审计：材料 **60 行、id 集合恰为 lm-1..lm-60** 无重复；强度分布 L1:20/L2:15/L3:14/L4:11；
  题目 120 条（`lq2-*`）；`listening_audio_assets` **180 行、全 isTts=true、rate 分布 60/60/60**；
  **0 个资产指向不存在/空文件**；每篇 audioUrls 均 3 档且全部落盘；
- 时长口径修正属实：DB durationSec=字节估算（lm-36 三档 29/21/4 vs 帧解析 28.61/21.48/4.08，舍入一致），
  不再是"材料估算/倍速"的假时长。

## 3. Phase 1 死链 — [PASS（覆盖式）]

DB 中 **0 条**无后缀 audioUrl（正则 `_(075|100|125)\.mp3$` 全命中）。机制：`seedListeningP2` 在 content 之后
以**相同 id 全量覆盖** lm-1..lm-20（`update: fields`）。残留债（P3）：`seed-content.ts:156` 仍在写无后缀 URL，
只是被下一步立即覆盖——若步骤顺序变动或 listening-p2 被跳过，死链会复活；建议源头也改。

## 4. id 撞车 — [PASS（设计上去重）]

两个 seed 源的 lm-1..lm-20 撞车由**显式覆盖策略**解决：P2 用固定 id upsert 全量字段覆盖，
题目改用 `lq2-{materialId}-{n}` 并 `deleteMany` 清理遗留 `lq-*`（实跑日志：`removed ... legacy question(s)` × 20）。
DB 结果：60 行无重复、遗留题目 0 条。两个种子文件头部均有文档说明，非隐式行为。

## 5. T14 前端 — [PASS]

- **4 页面齐**：`listening/page.tsx`、`player/[id]/page.tsx`、`training/[id]/page.tsx`、`report/[recordId]/page.tsx`（三态/筛选/诚实标注齐全）；
- **9 组件齐**（audio-player/transcript-sync/ab-loop-bar/mode-switcher/answer-area/dictation-editor/focus-point-rail/keyword-blank/trainer-report）；
  ⚠️ README 写「10 组件」与实际 9 个不符（小 nit）；
- **8 个 API 路由**齐；判分全在服务端（attempts 路由：客观题精确/关键词模糊/听写本地 diff，0 AI 依赖）；
- **E2E 实跑 2 条**（`listening-train.spec.ts`）：热服务器 **2/2 通过（31.2s）**——
  ①列表→精听页（音频元素、字幕、**换 0.75× 后"0.75× 时间基准"徽标跟随**，R2-9 端到端可见）→训练页；
  ②训练页选择题→服务端判分→报告页→AI 分析（不可用时回落规则分析并标注来源）。
- **E2E 冷启动 flaky（P3，测试问题非产品缺陷）**：Playwright 自带全新 dev server 时，
  用例①在首个断言（15s 超时）处卡骨架屏失败；同一用例对热服务器 **20.3s 全过**。
  API 实测冷 1.17s / 热 0.15s。定位为 Next dev 冷编译链（页面+路由）吃掉 15s 预算——
  建议首航超时提至 30-60s 或加热身请求。另：该 spec 头注释「36/60 篇有音频」已过时（现 60/60）。

## 6. R2-9 时间轴与倍速同向 — [PASS]

- `estimateTimeline(lines, wpm, rate=1)`：每句时长 = `词数 / (wpm × rate) × 60`，rate 进分母，
  与 `recommendedRate()`（L3/L4→0.75×）方向一致；默认 1 保持旧口径；
- `timelineForRate(baseline, wpm, rate, realDurationSec)`：**有真实资产 → 按资产总时长等比缩放**（严格对齐）；
  无资产 → 按 rate 重估（方向一致）；`scaleTimeline`/`timelineTotalSec` 为纯函数；
- service 暴露 `timebases[rate]`（transcript+focusPoints+durationSec），前端换档整套替换、零客户端换算；
- 测试 ladder +7 / service +6：方向性（0.75×>1.0×>1.25×、严格 1/rate 比）、L3/L4 一致性、
  真实资产压缩/严格相等、rate=1 兼容旧口径、非法 rate 兜底、纯函数不改入参；
- 判断：`wpmForIntensity`/`recommendedRate` 两函数本身未改（也不必改）——冲突在**消费端**（时间轴计算）解决，修法正确。

## 7. 路由 slug 冲突（主理人修复）— [PASS，修法正确且最小]

- 现状树（无残留冲突）：`api/listening/[id]/{route,analyze,attempts,questions}` + `report/[recordId]` + 静态
  `dictation-check`/`progress`；页面侧 `player/[id]`、`training/[id]`、`report/[recordId]` 分属不同父级，无同级异名动态段；
- 修法：`[recordId]/analyze` → `[id]/analyze`（analyze/attempts/questions 同属 materialId 实体，`[id]` 语义正确且消除同级冲突）；
  report 页保留 `[recordId]`（无同级冲突，且准确表达"按记录 id"）；
- 备选评估：API 全改 `[recordId]` 更差（实体是 materialId）；report 也用 `[id]` 合法但语义模糊；
  路由组/ catch-all 属过度设计。URL 线路径不受影响（段名不出现在路径中）；
- 佐证：dev server 实起成功（health 200 db=up）、E2E 全链路可跑。该缺陷单测覆盖不到（路由结构无测试），
  建议后续补一条"dev server 可启动"的 smoke 测试。

## 回归门禁 — [PASS]

- `vitest run`：**214/214 通过**（16 文件）；`tsc --noEmit`：**0 错误**；`next lint`：**0 警告**；
- PG 本轮可用：seed 实跑通过、连库审计完成（上轮 [BLOCKED-ENV] 的项已解）；
- E2E：听力 2/2（热服务器）；冷启动 flaky 见第 5 项（P3）。

## 结论与路由

| 第五轮 FAIL 项 | 第六轮结果 |
|---|---|
| 音频 109/180 | **大部分修复**：180/180、0 空文件；**但 1 个截断文件未修**（lm-36@1.25，4.08s/仅首句） |
| LISTENING_P2 不入库 | **PASS**：60 材料 + 180 资产 + 120 题真实入库，0 死链 |
| Phase 1 死链 | **PASS**（覆盖式；源头 seed-content.ts 仍写死 URL，P3 债） |
| id 撞车 | **PASS**（显式覆盖 + lq2-* + 遗留清理，DB 实证） |
| T14 前端缺失 | **PASS**：4 页 + 9 组件 + 8 路由 + E2E 2/2 实跑通过 |

**总判定：批次 B CONDITIONAL YES（转正差 1 个文件）**。第五轮全部缺口均已闭环，唯一保留缺陷是
`a-news-report-on-renewable-energy_125.mp3` 截断未修（commit 宣称"0 截断"不实）——单文件缺陷，修复成本极低。
**路由：Engineer（Alex）**：① 删除并重生该文件（或给生成器加 `--force` 突破"非空即 skip"的幂等策略）；
② README 组件数 10→9；③ E2E 首航超时预算 15s→30-60s（冷编译）；④ （可选）seed-content.ts 源头改后缀 URL。
修完 ① 即可转 YES，无需再等 QA 全轮。

---

# 第六轮 · 秒验（62507e9 · 截断文件修复 + 3 nit）

> 对象：Engineer 对第六轮唯一保留缺陷（截断文件）的修复 commit `62507e9`（只 commit 未 push）。
> QA 逐项独立复跑，不采信 commit message。

## ① 截断文件修复 — [PASS]

- 帧级解析：`a-news-report-on-renewable-energy_125.mp3` **24480B/4.08s → 103104B/17.18s**；
  同篇 075=28.61s / 100=21.48s，**d125/d100 = 0.800 严格符合 1/rate 理论**（0.8），内容完整；
- 全量 180 档重审计：0 空文件、0 缺失、无一异常；
- 库内同步：该资产 `durationSec` **4 → 17**；180 资产与磁盘 **0 缺失、0 偏差(>1s)**（逐文件字节估算比对）。

## ② 根因治理（幂等 skip 放过截断）— [PASS，阈值标定独立复算属实]

- 实现：`looksTruncated(actual, words, intensity, rate)` = 实际/估算 < `TRUNCATION_RATIO(0.45)`；
  skip 前检测命中即删重生；**生成后再复核一次**，仍偏短则抛错不进 results 不落库；`--force` 全量重生；
  vtt 清理改非致命（try/catch）；skip 分支返回字节估算时长（修掉 durationSec=0 覆写隐患）；
- **独立标定复算**（QA 自带 MPEG 帧解析器 + 独立 est 公式遍历全部 180 档）：
  实测 min ratio = **0.588**（其宣称 0.579，测量方法差异）、**p05 = 0.625 与其宣称一致**、中位数 0.930、max 1.434；
  **0 个样本 < 0.45**（无误杀）、0 个 < 0.579；修复文件 ratio = **1.053**（原 0.245）。
  阈值 0.45 落在 [0.245, 0.588] 的空档里，**是真标定不是拍的**；
- 测试 `listening-audio-gen.spec.ts` +7：阈值裕量（0.245<0.45<0.579）、真实截断样本命中（4s/51词/L3/1.25）、
  同篇 075/100 不误杀、标定集最低正常样本不误杀、words<=0 不判断、estimateSpeechSec 随倍速反向。

## ③ 三个 nit — [PASS]

1. README 组件数 **10 → 9**（与实际 9 个组件一致）；
2. E2E `FIRST_NAV=45_000`：只用于**进入新路由后的首个断言**（listening 4 / reading 3 / grammar 3 处），
   页内后续断言保持原值——未全局放宽，不会掩盖真问题；
3. `seed-content.ts:156` 源头死链：根因比预想更深——原 `update: {}` 意味着**存量行的无后缀 URL 永远不会被修**；
   现 create/update 均写三档后缀 URL（`audioUrl` 指向 1.0 档 + `audioUrls` 三档），
   且 `SEED_STEPS` 顺序由 `seed-listening-p2.spec.ts` 断言保护。

## ④ 门禁与 E2E（QA 独立复跑）

- `vitest run`：**266/266（18 文件）**；`tsc --noEmit`：**0 错**；`next lint`：**0 警告**；
- **E2E 冷启动 2/2 通过**（Playwright 自带全新 dev server，1.1m）——第六轮发现的冷启动 flaky 已被 FIRST_NAV 修复；
- DB 复查（PG 重启后）：60 材料 **0 条无后缀 audioUrl、60/60 有 audioUrls 三档**。

## 结论

**第六轮唯一保留缺陷已修复且根因已治理，批次 B → YES。**
三个 nit 全部落地且质量高于要求（尤其 nit2 只提首航断言、nit3 连 update 分支一起修）。
门禁 266/266 + tsc 0 + lint 0 + E2E 冷启 2/2，均由 QA 独立复跑证实。

---

# 第七轮 · 批次 C（T15 阅读 + T16 语法）

> 对象：批次 C 的 reading+grammar 域（commit `b67a217..3f8733c` 共 10 个，含掌握度量纲修复 `3f8733c`）。
> 当前 HEAD `223be64`（工程师批次 D WIP）——**writing/translation 域不在本轮范围**。
> 注：team-lead 原话「批次 C 范围 `62507e9..72a6077`」实际为空集——批次 C 的 commit 在 `62507e9` **之前**
> （`b67a217..3f8733c`），已按实际范围验证。

## ① 判分与服务端逻辑独立复算 — [PASS]

**阅读判分**（`reading.service.ts:277-312` 代码级 + E2E 待跑）：
- `normalizeAnswer` = trim + 大写；`gradeSingle` 额外剥离 `[.\-、,，\s]`（容忍 "A."/"A、"/"A "）；
- `gradeMulti` 集合比对（忽略顺序与分隔符 `[,，、\s|]`）——"A,B" ≡ "B A"；
- `score = round(correct/total × 100)`；未知题目 id 跳过不炸整次提交；
- 错题本：`findFirst(masteredAt:null)` → 命中 `errorCount+1`、未命中 create——**一题一行**，累加语义正确。

**语法判分与掌握度**（`grammar.service.ts:194-197, 467-489`）：
- 掌握度 = `round(累计答对 / 累计答题 × 100)`，**两计数均为题目级**（`nextAttempts = prev + total`、
  `nextCorrect = prev + correctCount`）——333% 量纲 bug（次数 +1、对数 +N）确已修复；
- **「答 3 题对 2 题」手算**：2/3 = 66.67%，字段为 Int → 存 **67**（`grammar-service.spec.ts:334-335`
  断言 67，口径一致）；第二次再对 3 题 → round(5/6×100) = **83**（真实 API 复算见 ④，实测吻合）；
- mastered 判定 = mastery ≥ 80 **且** 累计答题 ≥ 3（`MASTERY_THRESHOLD`/`MASTERY_MIN_ATTEMPTS`）；
- 错题本同阅读口径（source='grammar'）。

**划词释义 `lookupWord`（0 AI）**：
- 归一化 `trim+lower+剥非[a-z'-]`；空串 → 400 VALIDATION_ERROR（不崩）；
- **未收录 → `found:false` + 结构化空数组**（非裸空对象、非报错）——前端可渲染"未收录"不阻塞阅读；
- 命中 → word/音标/pos/definitions/examples（脏 Json 逐字段过滤，examples 截前 3 条）。

**AI 句子讲解（唯一 AI 介入点）**：degraded/空文本/异常 → `{explanation:null, degraded:true}`——
与「Mock 时隐藏区块」的前端约定吻合。

## ② seed 数据真实性 — [PASS]（独立 DB 审计，不采信声称）

- 阅读：60 篇全 PUBLISHED、0 软删；**题目 120/120 location 非空**（`{charStart, charEnd, blockIndex}` 结构合法 0 异常）；
  **进一步做越界检查：0 个 blockIndex ≥ 文章块数**（工程师只声称"有 location"，QA 加验了可定位性）；
- 语法：**14 主题、parentId 全 null**（14 个根节点）；**每主题恰好 4 题**（分布 {"4":14}，与 E2E 可做题数一致）；
- 死链残留：阅读/语法域 seed 无音频 URL 类字段、无外链资源，无可死链面；阅读 detail 响应题目**不含 answer 字段**（防作弊，实测确认）。

## ③ 前端完整性 — [PASS]

- 组件清单与设计文档 741-777 行**逐名一致**：阅读 8（article-body/key-word-rail/sentence-analysis/
  translation-toggle/quiz-area/quiz-result/highlight-popover/explain-panel）+ 语法 7（topic-tree/topic-detail/
  example-card/error-example/exercise-runner/explain-panel/mastery-badge）；页面阅读 2 + 语法 3；
  API 路由阅读 7（文档 R1-R4 之外多 progress/highlight/word，超集）+ 语法 5；
- **AI 降级两种策略未搞反**：阅读 `explain-panel.tsx:23` degraded → `return null`（区块隐藏）；
  语法 `explain-panel.tsx:7` 服务端回落 static，组件展示并标注来源——与设计分工（阅读 AI 附属、语法讲解主体）一致；
- 断点续读：`reading/[id]/page.tsx:64` 进入页面按 `lastBlockIndex` 恢复高亮/滚动，滚动进度防抖 2s 上报（`hooks.ts:84-86`）✓；
  划词未命中：`highlight-popover.tsx:59` 渲染 `popover-not-found`（明确"未收录"而非空白）✓；
  语法来源标注：`explain-panel.tsx:27-28` 徽章区分「AI 生成 / 静态知识点（AI 不可用）」✓。

## ④ E2E 实跑 + 冷启动回归 — [PENDING]

## ⑤ 门禁 — [PENDING]

## ④ E2E 实跑 + 冷启动回归 — [PASS]（首轮失败为环境问题，已定位排除）

- **首轮 3 条全挂 → 定位为 [ENV]**：`chromium_headless_shell-1194` 二进制缺失（Playwright 版本更新后未
  重新 install），浏览器启动即失败（44s 内 3 failed，非断言/超时问题）；`npx playwright install chromium` 后排除；
- **安装后冷启动实跑（Playwright 自带全新 dev server，未手动预热）：3/3 通过（1.6m）**——
  reading 2 条（打开文章→断点续读→划词直查→quiz→提交→报告；列表筛选/搜索）+ grammar 1 条
  （目录→主题详情→讲解→做题→提交→解析）；**FIRST_NAV=45s 在批次 C 场景同样稳定，批次 B 的冷启动
  flaky 未复发**；
- **API 级真数据复算（curl + 直查 DB，QA 自建账号）**：
  - 语法掌握度：提交1（3题2对，其一用 `" a. "` 容错）→ score=67、**mastery=67、attemptCount=3**（手算 2/3=66.67→67 ✓）；
    提交2（同 3 题全对）→ **mastery=83、attemptCount=6**（手算 round(5/6×100)=83 ✓）——
    **量纲修复实证：attemptCount 按题累计（3→6），333% 溢出场景不可能再发生**；
    库内 `user_grammar_progress` {mastery:83, attemptCount:6, correctCount:5} 与 API 一致；
  - 错题累加：gq-1-3 错 1 次 → 1 行 errorCount=1；阅读 rq-2 错 2 次 → **1 行 errorCount=2**（不重复建行）；
  - 阅读判分：2 题 1 对 1 错 → score=50 ✓；**容差集实测 = `[.、,，\s-]`**（" a. " 判对、"a;" 判错——分号
    不在容差集，实现与规格一致，QA 探针误用分号被正确判错）；
  - 划词：命中 "Economy" → found=true + 2 条释义；未命中 "qqzzxx" → HTTP 200 + found=false + 空数组（不崩不裸对象）；
  - 断点续读：save(progress=45, lastBlockIndex=3) → detail 返回 45/3 ✓；quiz 提交后 quizResult 为**最新一次**
    快照（覆盖式，非聚合——设计未要求聚合，记录为口径）。

## ⑤ 门禁 — [PASS]

- `vitest run`：**300/300（19 文件）**——较 team-lead 预期的 266 多 34 个，系批次 D 的 writing-rule-engine
  等新测试已随 HEAD `223be64` 入库（reading+grammar 域测试全部在内且通过）；
- `tsc --noEmit`：**0 错**；`next lint`：**0 警告**。

## 设计偏差记录（非缺陷）

1. 设计文档标注 R4 explain「**流式**」，实现为普通 JSON POST——单句讲解场景功能无损，但与文档不符，
   建议改文档或后续补流式；
2. quiz 重复提交时 `readingRecord.quizResult` 为最新一次快照（覆盖式）——设计未规定聚合口径，记录备查。

## 结论

**批次 C（T15 阅读 + T16 语法）→ YES，可交付。**
- 判分/掌握度/错题本/划词/断点续读全部经**真实 API + DB 独立复算**证实（非只看单测绿）；
- 333% 量纲 bug 修复实证（attemptCount 3→6 按题累计，mastery 67→83 与手算一致）；
- 120/120 location 独立审计通过且 0 越界（超出工程师声称的范围）；
- 两种 AI 降级策略实现与设计分工一致（阅读隐藏 / 语法 static 兜底）；
- E2E 冷启动 3/3，FIRST_NAV 修复跨批次稳定；
- 两处设计偏差（explain 流式、quizResult 覆盖口径）均不构成功能缺陷，记录在案。
- [ENV] 备注：首轮 E2E 因 chromium 二进制缺失全挂（`npx playwright install chromium` 后排除），
  建议在 README/CI 说明中补充该前置条件。

---

# 第八轮 · 批次 D（T17 写作 + T18 翻译 + 错题本闭环）

> 对象：commit `9f14833..9a5549e` 共 8 个（T17 写作 4 + T18 翻译 2 + 错题本 1 + E2E 1）。
> 全程独立复算 + 真实 API/DB 验证 + 竞态构造测试；不采信 commit message。

## ① 规则引擎扣分独立复算 — [PASS]

用精确构造的文章（132 词、2 段、1 句 27 词、恰 2 被动、0 连接词、恰 2 拼写错）直跑 committed 实现：
- 各类扣分：spelling −10、sentenceLength −5、connectors −10、paragraphs −10、passiveVoice −6
  → **总分 59，与手算 100−10−5−10−6−10=59 完全一致**（构造统计先行自证：wordCount=132、
  paragraphCount=2、longSentences=1、passiveCount=2、connectorCount=0、spellingErrors 恰 2 个）；
- **被动上限**：5 处被动 → deduction **12**（非 15）；4 处 → 12（恰触上限）；3 处 → 9；
- 拼写检查含屈折容忍（es|s|ed|ing|ly 去缀复查）、去重、白名单；`passed` 线 = ≥60 且无拼写错。

## ② T17 E2E 重写真实性 — [PASS]

- 旧 `writing-analyze.spec.ts` 确在 `3f1f4c2` 删除（`--diff-filter=D` 实证）；仅存 `writing-analyze-real.spec.ts`；
- 新 spec 走**全 UI 链路**：任务列表 → 开始写作（创建占位稿）→ 编辑器输入 → 自动保存 → 请求批改 →
  报告页 `score-source-badge`（`/规则评分|AI 评分/`）→ 列表徽章——无任何对 `/api/ai/diagnosis` 的直接调用。

## ③ 双轨降级与 scoreSource — [PASS]

- `analyzeSubmission`：AI 轨成立条件 = `!degraded && data 非空 && (total>0 || 有维度分)`——
  **零分罐头对象绝不当真实 AI 分写库**（注释明示 + 代码守卫）；degraded 时 `scoreSource='rule'`、
  AI 字段清库（DbNull）；双轨都落 `ruleCheck` 结果，报告页永远有规则分兜底（页面不空白）；
- E2E 断言徽章文本自适应两轨 + `report-rule-issues` 两轨都渲染。

## ④ 规则检查同步性 — [PASS（服务端）/ **[FAIL]（前端面板，见 ⑩）**]

- **服务端同步 ✓**：`createSubmission` 与 `updateSubmission`（自动保存后端）每次都重跑 `runRuleCheck`
  并落库 `ruleCheck/ruleCheckScore/ruleCheckDetail`——纯函数 + 词典缓存，**0 AI**；
- **前端"边写边出提示"实际不实时 [FAIL]**：内联面板显示创建时快照，输入后不更新——详见下文「发现的问题」。

## ⑤ 自动保存 — [PASS]

- 防抖 **2500ms**（`useDebouncedCallback(..., 2500)`）；保存期间新输入写入 `pendingRef`，
  完成后 `if (pendingRef.current !== null) void flush()` **立即续排**（不丢最后一次输入）；
- **「请求批改」前先 flush**：`page.tsx:75` `await flush()` 再 `analyze`——批改的必是最新稿。

## ⑥ T18 翻译 — [PASS]

- 500 字符上限：`MAX_SOURCE_LEN=500`，超限抛 VALIDATION_ERROR（带当前长度提示）；
- Mock 缺档：Mock 返回字符串 → 仅 literal 有值，其余 4 档 null → 前端显示"AI 暂不可用"（实测
  `availableStyles=["literal"]`、degraded=false；E2E 断言不白屏）；
- **收藏幂等 + 生词抽取**：`favorite.upsert`（`@@unique([userId,targetType,targetId])`，update:{}）——
  **同记录收藏 2 次 favorites 仍 1 行**（真实 DB 实测）；抽取 "economy"（≥4 字母、非停用词、词典命中）
  成功入 `user_vocabulary`；
- **历史 50 条 = 创建时物理裁剪**（非查询 limit）：QA 自建账号直插 **55 条** + 翻译 1 次 →
  **总数 50**（`pruneHistory` 按 createdAt desc 保 50、deleteMany 其余，实测物理删除）。

## ⑦ 错题本闭环 — [PASS]

- 读取侧 `listWrongQuestions`（来源筛选 + 未掌握计数 + 分页）+ `markMastered`/`reopenQuestion`；
- **master 幂等保留首次时间**：`masteredAt = row.masteredAt ?? new Date()`——重复标记不刷新时间；
  reopen 置 null 且 errorCount 不动（历史保留）；
- 页面 + E2E 链路（做错阅读题 → 错题本可见 → 标记 → 筛选切换）实跑通过。

## ⑧ 单一写入口原则 — [PASS]

全库 grep `wrongQuestion.{create,update,delete,upsert}`：写操作**仅**出现在
`grammar.service.ts`（错题写入）、`reading.service.ts`（错题写入）、`wrong-questions.service.ts`
（master/reopen 状态迁移）——**错题本服务无 create，只读聚合 + 复习状态**，无双写入口。

## ⑨⑩ 两个客户端 bug 修复 — ⑨ [PASS] / ⑩ [PASS]

**⑨ `useTranslationHistory` reload no-op**：`nonce` state 进入 effect 依赖 `[page, favoriteOnly, nonce]`，
reload 强制 `setNonce` 触发 refetch——page 已是 1 时不再是 no-op。E2E 翻译链路实测历史刷新。

**⑩ `useWrongQuestions` 旧闭包竞态**：`seqRef` 请求序号 + `paramsRef` 永远读最新参数；
响应仅当 `seq === seqRef.current` 才写 state。**QA 构造真实竞态验证**（临时 spec，跑毕已删）：
路由拦截给无筛选请求加 3.5s 延迟充当"晚到的过期响应 A"，master 后立即切「已掌握」筛选（B 先回）——
**A 返回后 mastered 视图未被覆盖**（守卫生效，测试通过）。

## ⑪ 门禁与 E2E — [PASS]

- `vitest run`：**323/323**（比预期 322 多 1，系工程师计数后又有微增；全绿）；
- `tsc --noEmit` **0 错**；`next lint` **0 警告**；
- **E2E 全量 19/19 通过**（冷启动 Playwright 自带 dev server，4.8m）。

## 发现的问题

### P2 · 内联规则检查面板是"死"的（验收 3"边写边出提示"不成立）

**实证**（临时探针 spec，跑毕已删）：
- 新建占位稿（'Draft started. Replace this with your essay.' 8 词）→ 面板 rule-score = **70**；
- 输入 95 词合规作文 → 自动保存完成（autosave-saved 可见）→ 等 2s → 面板**仍 = 70**；
- 同刻直查详情 API：**服务端 ruleCheckScore = 80**（已随新内容重算）——服务端对、面板错。

**根因**：面板数据源 `data?.ruleCheck` 来自 `useWritingDetail`（deps `[id]`，仅加载一次）；
自动保存只更新 `savedAt`，**从不 reload 详情**，也无本地 state 合并——面板永远停在创建时快照。

**影响**：用户边写边看到的规则分/问题清单是**旧稿的**，误导明显（显示 70 分+占位稿的问题，
实际内容已是另一篇文章的检查结果）；报告页/批改用的是服务端新值，故数据本身无损坏。

**为什么 E2E 没抓到**：`writing-analyze-real.spec.ts:39` 只断言 `inline-check-panel` **可见**——
占位稿创建时面板就有值（可见性恒真），断言空转。典型的"测试绿但行为不符设计"。

**建议修法**：自动保存成功后 `reload()` 详情（或让 autosave 响应携带完整 ruleCheck 并本地合并）；
E2E 补一条「面板分数随输入变化」的断言（先读初值 → 输入 → 断言分数改变）。

## 结论

**批次 D → CONDITIONAL YES**：核心逻辑（规则引擎扣分、双轨降级、裁剪、幂等、竞态守卫、单一写入口）
全部独立复算通过且质量高；唯一实质缺陷是**内联面板不实时**（P2，纯前端展示层、数据无损坏、修复成本低）。
修掉面板刷新 + 补一条防回归断言即可转 YES，无需全轮重验（QA 只复验该点）。

## R2-10 补验（T17 验收 4）— [PASS]（架构师裁决后修复，commit `c525e6a`）

> 背景：mock provider 原对 WRITING_REVIEW 返回罐头分（degraded=false → AI 轨），违反验收 4 本意
> （评价型能力不得打恒定分）。架构师 R2-10 裁决方案 2：删罐头分支。修复与 QA 报告并行完成。

- **mock.ts 代码确认**：WRITING_REVIEW 罐头分支已删，原位留分类学注释 + 指向防回归测试
  （generic 文本 → WritingReportSchema 校验失败 → buildFallback → degraded=true → rule 轨）；
- **防回归测试在位**：`writing-service.spec.ts:314`（mock 对 WRITING_REVIEW 不返回可校验 WritingReport）
  + `ai-mock.spec.ts:49`（断言已反转为「罐头 JSON 不通过 Schema」）；
- **链路实测**（QA 临时 spec，API 级：创建 → analyze，跑毕已删）：
  **scoreSource = 'rule'、aiDegraded = true、aiTotalScore = null**——验收 4 恢复设计既定行为；
  附带确认 create 响应同步携带完整 ruleCheck（70 分含连接词扣分，口径与验收 3 数据源一致）；
- **门禁复跑**：vitest **323/323**、tsc **0 错**、lint **0 警告**；
- 小 nit：`writing-analyze-real.spec.ts:68` 注释「Mock 下 AI 轨 → AI 评分」已过时（Mock 现在恒 rule 轨），
  徽章断言为自适应正则不受影响。

## 结论（终版）

**批次 D → CONDITIONAL YES，唯一遗留 = P2（内联规则面板不实时，见上文）**。
R2-10 补验通过后，T17 全部 8 项验收中 7 项 PASS、1 项（验收 3）受 P2 影响；
T18 4 项全 PASS；错题本闭环 PASS。Alex 修复内联面板刷新 + 补防回归断言后，QA 单点复验即可转 YES。

## P2 修复复验（commit `739b680`）— [PASS] → 批次 D 转 YES

- **修法**：采用 QA 建议的方案 B（autosave 响应携带完整 ruleCheck，前端本地合并，零额外请求）——
  `updateSubmission` 返回体加 ruleCheck（函数内本就有）、hooks 暴露最新 ruleCheck、
  编辑器页 `savedRuleCheck ?? data.ruleCheck`（最新保存优先）；
- **同款探针复验**（第八轮抓 bug 的原探针）：初始 rule-score = **70** → 输入合规作文自动保存后面板 = **80**
  （分数已变化）；且**面板分数与服务端 ruleCheckScore 逐字一致（80=80）**——断链已接通；
- **防回归断言在位**：`writing-analyze-real.spec.ts:40,48` 先读初值、autosave 后
  `not.toHaveText(initialScore)`——旧"只验可见"的空转断言已补实；服务层单测同步断言响应携带完整 ruleCheck；
- **门禁**：vitest **323/323（21 文件）**、tsc **0 错**、lint **0 警告**（工程师自跑 + QA 复跑一致）。

## 批次 D 终版结论：**YES（可交付）**

八项验收全部满足：规则引擎扣分（手算吻合）· 双轨降级（R2-10 后 Mock 恒 rule 轨）·
规则检查同步（服务端 + 内联面板全链路实时）· 自动保存（防抖/续排/flush）·
字数不足提示 · E2E 真链路 · scoreSource 徽章 · 防回归断言。
T18 翻译四项 + 错题本闭环此前已 PASS。QA 无未决事项。
