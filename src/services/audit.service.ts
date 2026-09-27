/**
 * 审计服务（架构 §1.4.8）：ADMIN 写操作与安全事件落 audit_logs。
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger/logger'
import { currentTraceId, currentUserId } from '@/lib/logger/request-context'

const log = createLogger('audit.service')

export interface AuditInput {
  /** 如 user.disable | content.publish | ai.config.update | role.grant | auth.reset_password */
  action: string
  targetType: string
  targetId?: string
  /** 变更后快照（可选） */
  after?: Record<string, unknown>
  /** 变更前快照（可选） */
  before?: Record<string, unknown>
  reason?: string
  ip?: string
  userAgent?: string
}

/** 写审计日志（异步尽力而为，不阻塞主流程，失败仅记日志） */
export async function writeAudit(input: AuditInput): Promise<void> {
  const actorId = currentUserId()
  if (!actorId) {
    log.warn({ msg: 'audit skipped: no actor in context', action: input.action })
    return
  }
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: input.reason,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    })
    log.info({ msg: 'audit', traceId: currentTraceId(), action: input.action })
  } catch (e) {
    log.error({ msg: 'audit write failed', err: e instanceof Error ? e.message : String(e) })
  }
}

/** 显式指定操作者（后台任务/系统事件使用） */
export async function writeAuditAs(
  actorId: string,
  input: Omit<AuditInput, 'ip' | 'userAgent'>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: input.reason,
      },
    })
  } catch (e) {
    log.error({ msg: 'audit write failed', err: e instanceof Error ? e.message : String(e) })
  }
}
