/**
 * Seed · 超级管理员：admin@englishai.dev / EnglishAI@2026（幂等 upsert by email）。
 * 密码哈希：@node-rs/argon2（OWASP 默认参数 m=19456 t=2 p=1）。
 */
import { hash } from '@node-rs/argon2'

import { prisma } from '@/lib/db'

import { log } from './shared'

const ADMIN_EMAIL = 'admin@englishai.dev'
const ADMIN_PASSWORD = 'EnglishAI@2026'
const ADMIN_NICKNAME = 'EnglishAI Admin'

export async function seedAdmin(): Promise<{ email: string }> {
  const passwordHash = await hash(ADMIN_PASSWORD)

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      nickname: ADMIN_NICKNAME,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      lastLoginAt: null,
    },
  })

  await prisma.profile.upsert({
    where: { userId: admin.id },
    update: { onboardingCompletedAt: new Date() },
    create: {
      userId: admin.id,
      cefrLevel: 'C1',
      cetEstimatedScore: 650,
      onboardingData: { source: 'seed', skipped: true },
      onboardingCompletedAt: new Date(),
    },
  })

  await prisma.userStats.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, level: 1 },
  })

  await prisma.userSettings.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      theme: 'system',
      language: 'zh-CN',
      dailyGoalMinutes: 30,
      weeklyGoalDays: 5,
    },
  })

  await prisma.subscription.upsert({
    where: { orderNo: 'seed-admin-free' },
    update: {},
    create: {
      userId: admin.id,
      plan: 'FREE',
      status: 'ACTIVE',
      orderNo: 'seed-admin-free',
      source: 'seed',
    },
  })

  // 角色关系：users.role 冗余列 + user_roles 矩阵
  const adminRole = await prisma.roleModel.findUnique({ where: { code: 'ADMIN' } })
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id, grantedBy: 'seed' },
    })
  }
  await prisma.adminUser.upsert({
    where: { id: `seed-admin-${admin.id}` },
    update: {},
    create: { id: `seed-admin-${admin.id}`, userId: admin.id, role: 'ADMIN', grantedBy: 'seed', note: 'seed super admin' },
  })

  log(`admin: ${ADMIN_EMAIL} (role=ADMIN, argon2 hashed)`)
  return { email: ADMIN_EMAIL }
}
