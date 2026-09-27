/**
 * Seed · RBAC：3 个系统角色 + 权限矩阵（幂等，upsert by code）。
 */
import { prisma } from '@/lib/db'

import { log } from './shared'

const PERMISSIONS: ReadonlyArray<{ code: string; name: string; group: string; description?: string }> = [
  { code: 'content:read', name: '查看内容', group: 'content' },
  { code: 'content:write', name: '创建/编辑内容', group: 'content' },
  { code: 'content:publish', name: '发布/下架内容', group: 'content' },
  { code: 'user:read', name: '查看用户列表', group: 'user' },
  { code: 'user:disable', name: '禁用/解禁用户', group: 'user' },
  { code: 'user:export', name: '导出用户数据', group: 'user' },
  { code: 'ai:config', name: '配置 AI 能力与 Prompt', group: 'ai' },
  { code: 'ai:logs', name: '查看 AI 调用日志', group: 'ai' },
  { code: 'role:grant', name: '授予/回收角色', group: 'system' },
  { code: 'system:config', name: '修改系统配置', group: 'system' },
  { code: 'audit:read', name: '查看审计日志', group: 'system' },
  { code: 'analytics:read', name: '查看运营报表', group: 'system' },
]

const ROLES: ReadonlyArray<{
  code: string
  name: string
  description: string
  permissions: string[]
}> = [
  { code: 'USER', name: '普通用户', description: '学习与个人数据权限', permissions: ['analytics:read'] },
  {
    code: 'TEACHER',
    name: '教师',
    description: '内容审核与教学管理',
    permissions: [
      'content:read',
      'content:write',
      'content:publish',
      'user:read',
      'analytics:read',
      'ai:logs',
    ],
  },
  {
    code: 'ADMIN',
    name: '超级管理员',
    description: '全部权限',
    permissions: PERMISSIONS.map((p) => p.code),
  },
]

export async function seedRoles(): Promise<{ roles: number; permissions: number; grants: number }> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, group: permission.group, description: permission.description },
      create: permission,
    })
  }

  const permissionRows = await prisma.permission.findMany()
  const permissionByCode = new Map(permissionRows.map((p) => [p.code, p.id]))

  for (const role of ROLES) {
    await prisma.roleModel.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { code: role.code, name: role.name, description: role.description, isSystem: true },
    })
    const roleRow = await prisma.roleModel.findUnique({ where: { code: role.code } })
    if (!roleRow) continue
    for (const code of role.permissions) {
      const permissionId = permissionByCode.get(code)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleRow.id, permissionId } },
        update: {},
        create: { roleId: roleRow.id, permissionId, grantedBy: 'seed' },
      })
    }
  }

  log(`roles: ${ROLES.length} · permissions: ${PERMISSIONS.length} · grants: ${ROLES.reduce((n, r) => n + r.permissions.length, 0)}`)
  return {
    roles: ROLES.length,
    permissions: PERMISSIONS.length,
    grants: ROLES.reduce((n, r) => n + r.permissions.length, 0),
  }
}
