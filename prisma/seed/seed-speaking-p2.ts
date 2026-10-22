/**
 * 口语模块 seed（T19）：11 角色 + 9 场景，含 persona/setting Prompt 片段。
 *
 * 幂等策略：roleKey/sceneKey 均 @unique → upsert。
 * persona 直接拼入 TUTOR_CHAT 对话的上下文（角色性格/语气）；
 * setting 描述场景环境；targetWords 供 S6 规则评分的目标句覆盖度。
 */
import { prisma } from '@/lib/db'
import { chunk, log } from './shared'

/** 11 角色（roleKey 与 SpeakingSession.roleKey 注释一致） */
const ROLES: ReadonlyArray<{
  roleKey: string
  name: string
  persona: string
  description: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}> = [
  { roleKey: 'friend', name: '外国朋友', persona: 'You are the user\'s easygoing American friend. Casual tone, slang is fine, asks follow-up questions about the user\'s life.', description: '日常闲聊，语气随意', difficulty: 'EASY' },
  { roleKey: 'teacher', name: '英语老师', persona: 'You are a patient English teacher. Speak clearly, gently correct mistakes by rephrasing, and encourage the user to elaborate.', description: '耐心引导，适度纠错', difficulty: 'EASY' },
  { roleKey: 'interviewer', name: '面试官', persona: 'You are a professional hiring manager at a tech company. Ask structured behavioral questions (STAR), stay neutral and formal.', description: '结构化行为面试', difficulty: 'HARD' },
  { roleKey: 'tourist', name: '问路的外国游客', persona: 'You are a lost tourist in a Chinese city. Ask for directions and recommendations politely.', description: '旅行互助对话', difficulty: 'EASY' },
  { roleKey: 'classmate', name: '留学生同学', persona: 'You are the user\'s classmate studying abroad. Talk about assignments, campus life and group projects.', description: '校园生活话题', difficulty: 'MEDIUM' },
  { roleKey: 'boss', name: '外籍上司', persona: 'You are the user\'s manager. Give concise work instructions, ask for status updates, occasionally give feedback.', description: '职场汇报与反馈', difficulty: 'HARD' },
  { roleKey: 'colleague', name: '外国同事', persona: 'You are a friendly colleague. Small talk before meetings, discuss deadlines and collaboration.', description: '职场日常沟通', difficulty: 'MEDIUM' },
  { roleKey: 'client', name: '外国客户', persona: 'You are an overseas client. Ask about products, pricing and delivery politely but firmly.', description: '商务洽谈', difficulty: 'HARD' },
  { roleKey: 'waiter', name: '餐厅服务员', persona: 'You are a waiter at a busy restaurant. Take orders, recommend dishes, handle special requests.', description: '餐厅点餐全流程', difficulty: 'EASY' },
  { roleKey: 'airport', name: '机场地勤', persona: 'You are a check-in agent. Ask for passports, explain baggage rules and gate changes.', description: '机场值机场景', difficulty: 'MEDIUM' },
  { roleKey: 'hotel', name: '酒店前台', persona: 'You are a hotel receptionist. Handle check-in, room requests and complaints professionally.', description: '酒店入住与诉求', difficulty: 'MEDIUM' },
]

/** 9 场景（sceneKey 与 SpeakingSession.sceneKey 注释一致）；targetWords 供 S6 覆盖度 */
const SCENES: ReadonlyArray<{
  sceneKey: string
  name: string
  setting: string
  description: string
  targetWords: string[]
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}> = [
  { sceneKey: 'restaurant', name: '餐厅点餐', setting: 'A cozy bistro at dinner time. The user is ordering a meal and asking for recommendations.', description: '从点餐到买单', targetWords: ['book a table', 'order', 'menu', 'the bill'], difficulty: 'EASY' },
  { sceneKey: 'airport', name: '机场值机', setting: 'An airport check-in counter. The user is checking in for an international flight.', description: '值机与行李', targetWords: ['check in', 'boarding pass', 'luggage', 'gate'], difficulty: 'MEDIUM' },
  { sceneKey: 'hotel', name: '酒店入住', setting: 'A hotel front desk in the evening. The user is checking in and asking about facilities.', description: '入住与设施咨询', targetWords: ['reservation', 'check-in', 'breakfast', 'wifi'], difficulty: 'EASY' },
  { sceneKey: 'shopping', name: '逛街购物', setting: 'A shopping street on a weekend. The user is browsing and asking about prices and sizes.', description: '询价与退换', targetWords: ['try on', 'size', 'discount', 'refund'], difficulty: 'EASY' },
  { sceneKey: 'university', name: '校园生活', setting: 'A university campus at the start of a semester. The user is meeting classmates and joining clubs.', description: '选课与社团', targetWords: ['course', 'deadline', 'club', 'campus'], difficulty: 'MEDIUM' },
  { sceneKey: 'interview', name: '求职面试', setting: 'A video interview for a junior developer role. The user answers behavioral questions.', description: '自我介绍与 STAR', targetWords: ['experience', 'team', 'project', 'strength'], difficulty: 'HARD' },
  { sceneKey: 'business_meeting', name: '商务会议', setting: 'A weekly project sync call. The user reports progress and discusses next steps.', description: '进度同步', targetWords: ['progress', 'schedule', 'deliverable', 'follow up'], difficulty: 'HARD' },
  { sceneKey: 'travel', name: '旅行问路', setting: 'A train station in a foreign city. The user asks for directions and ticket information.', description: '问路与购票', targetWords: ['platform', 'ticket', 'directions', 'timetable'], difficulty: 'MEDIUM' },
  { sceneKey: 'daily', name: '日常寒暄', setting: 'A casual weekend meetup. The user chats about hobbies, weather and recent news.', description: '自由话题', targetWords: ['weekend', 'hobby', 'movie', 'weather'], difficulty: 'EASY' },
]

/** 口语 seed：幂等（roleKey/sceneKey 唯一 upsert） */
export async function seedSpeakingP2(): Promise<number> {
  for (const role of ROLES) {
    await prisma.speakingRole.upsert({
      where: { roleKey: role.roleKey },
      update: { name: role.name, persona: role.persona, description: role.description, difficulty: role.difficulty },
      create: { ...role, sortOrder: ROLES.indexOf(role) },
    })
  }

  for (const scene of SCENES) {
    await prisma.speakingScene.upsert({
      where: { sceneKey: scene.sceneKey },
      update: {
        name: scene.name,
        setting: scene.setting,
        description: scene.description,
        targetWords: scene.targetWords as unknown as import('@prisma/client').Prisma.InputJsonValue,
        difficulty: scene.difficulty,
      },
      create: {
        sceneKey: scene.sceneKey,
        name: scene.name,
        setting: scene.setting,
        description: scene.description,
        targetWords: scene.targetWords as unknown as import('@prisma/client').Prisma.InputJsonValue,
        difficulty: scene.difficulty,
        sortOrder: SCENES.indexOf(scene),
      },
    })
  }

  log(`speaking-p2: ${ROLES.length} roles + ${SCENES.length} scenes`)
  return ROLES.length + SCENES.length
}
