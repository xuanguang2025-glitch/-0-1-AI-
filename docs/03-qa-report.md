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
