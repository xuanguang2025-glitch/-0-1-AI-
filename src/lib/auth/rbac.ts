/**
 * RBAC（架构 §1.4.2）：users.role 冗余快路径 + user_roles 矩阵双通道。
 * withAuth() 在服务端做真正的权限判决（middleware 只做粗筛）。
 */
import { prisma } from '@/lib/db'

export type Role = 'USER' | 'TEACHER' | 'ADMIN'

/** 角色层级：ADMIN ⊃ TEACHER ⊃ USER */
const ROLE_RANK: Record<Role, number> = { USER: 1, TEACHER: 2, ADMIN: 3 }

/** 判断用户角色是否满足要求（满足任一即可） */
export function hasRole(userRole: string, required: readonly string[]): boolean {
  if (required.length === 0) return true
  const rank = ROLE_RANK[userRole as Role] ?? 0
  return required.some((r) => rank >= (ROLE_RANK[r as Role] ?? 99))
}

/**
 * 权限编码检查（细粒度，走 role_permissions 矩阵）。
 * @param userId    用户 id
 * @param permission 权限码，如 'content:write'
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const grants = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { rolePermissions: { select: { permission: { select: { code: true } } } } } } },
  })
  return grants.some((g) => g.role.rolePermissions.some((p) => p.permission.code === permission))
}

/** 取用户全部角色码（含冗余 role 字段之外的矩阵角色） */
export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { code: true } } },
  })
  return rows.map((r) => r.role.code)
}
