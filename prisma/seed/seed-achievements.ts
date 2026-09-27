/**
 * Seed: 24 achievements across 9 categories.
 * Idempotent: upsert by unique `code`.
 */
import { Prisma, type AchievementCategory } from '@prisma/client'
import { prisma } from '@/lib/db'
import { log } from './shared'

/** [code, name, description, category, condition, xpReward, isHidden] */
type AchievementSpec = [string, string, string, AchievementCategory, Record<string, unknown>, number, boolean?]

const ACHIEVEMENTS: AchievementSpec[] = [
  // STREAK (4)
  ['streak_3', '初出茅庐', '连续学习 3 天', 'STREAK', { metric: 'streakDays', operator: '>=', value: 3 }, 50],
  ['streak_7', '持之以恒', '连续学习 7 天', 'STREAK', { metric: 'streakDays', operator: '>=', value: 7 }, 120],
  ['streak_21', '习惯成自然', '连续学习 21 天', 'STREAK', { metric: 'streakDays', operator: '>=', value: 21 }, 300],
  ['streak_100', '百日筑基', '连续学习 100 天', 'STREAK', { metric: 'streakDays', operator: '>=', value: 100 }, 1000],
  // VOCABULARY (4)
  ['vocab_100', '百词斩', '累计掌握 100 个单词', 'VOCABULARY', { metric: 'masteredWords', operator: '>=', value: 100 }, 80],
  ['vocab_500', '词汇小达人', '累计掌握 500 个单词', 'VOCABULARY', { metric: 'masteredWords', operator: '>=', value: 500 }, 200],
  ['vocab_2000', '六级词汇通关', '累计掌握 2000 个单词', 'VOCABULARY', { metric: 'masteredWords', operator: '>=', value: 2000 }, 600],
  ['vocab_5000', '行走的词典', '累计掌握 5000 个单词', 'VOCABULARY', { metric: 'masteredWords', operator: '>=', value: 5000 }, 1500],
  // STUDY_TIME (3)
  ['time_10h', '十小时俱乐部', '累计学习满 10 小时', 'STUDY_TIME', { metric: 'totalMinutes', operator: '>=', value: 600 }, 60],
  ['time_50h', '半百征程', '累计学习满 50 小时', 'STUDY_TIME', { metric: 'totalMinutes', operator: '>=', value: 3000 }, 250],
  ['time_200h', '时间的朋友', '累计学习满 200 小时', 'STUDY_TIME', { metric: 'totalMinutes', operator: '>=', value: 12000 }, 800],
  // EXAM (3)
  ['exam_first', '首战告捷', '完成第一次模考', 'EXAM', { metric: 'examCount', operator: '>=', value: 1 }, 40],
  ['exam_pass', '过线时刻', '模考总分达到 425 分', 'EXAM', { metric: 'bestScore', operator: '>=', value: 425 }, 400],
  ['exam_high', '高分传说', '模考总分达到 550 分', 'EXAM', { metric: 'bestScore', operator: '>=', value: 550 }, 900],
  // WRITING (2)
  ['writing_10', '笔耕不辍', '累计提交 10 篇作文', 'WRITING', { metric: 'writingCount', operator: '>=', value: 10 }, 100],
  ['writing_good', '妙笔生花', '单篇作文获得 80 分以上', 'WRITING', { metric: 'bestWritingScore', operator: '>=', value: 80 }, 200],
  // SPEAKING (2)
  ['speaking_20', '开口达人', '累计完成 20 次口语练习', 'SPEAKING', { metric: 'speakingCount', operator: '>=', value: 20 }, 100],
  ['speaking_85', '金话筒', '单次口语练习获得 85 分以上', 'SPEAKING', { metric: 'bestSpeakingScore', operator: '>=', value: 85 }, 200],
  // LISTENING (2)
  ['listening_50', '耳朵醒了', '累计完成 50 段听力精听', 'LISTENING', { metric: 'listeningCount', operator: '>=', value: 50 }, 100],
  ['listening_90', '顺风耳', '听力正确率达到 90%（至少 30 题）', 'LISTENING', { metric: 'listeningAccuracy', operator: '>=', value: 0.9 }, 200],
  // READING (2)
  ['reading_30', '阅读狂人', '累计精读 30 篇文章', 'READING', { metric: 'readingCount', operator: '>=', value: 30 }, 100],
  ['reading_speed', '一目十行', '单篇阅读平均用时低于 6 分钟且正确率 80%', 'READING', { metric: 'readingSpeedScore', operator: '>=', value: 80 }, 200],
  // SPECIAL (2)
  ['night_owl', '夜猫子', '在凌晨 0-5 点之间完成学习任务', 'SPECIAL', { metric: 'nightStudy', operator: '>=', value: 1 }, 30, true],
  ['ai_friend', 'AI 挚友', '与 AI 学伴完成 100 轮对话', 'SPECIAL', { metric: 'chatRounds', operator: '>=', value: 100 }, 150],
]

export async function seedAchievements(): Promise<void> {
  let count = 0
  for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
    const [code, name, description, category, condition, xpReward, isHidden] = ACHIEVEMENTS[i]!
    const data = {
      name,
      description,
      iconUrl: `/icons/achievements/${code}.svg`,
      category,
      condition: condition as Prisma.InputJsonValue,
      xpReward,
      isHidden: isHidden ?? false,
      sortOrder: i + 1,
    }
    await prisma.achievement.upsert({ where: { code }, update: data, create: { code, ...data } })
    count += 1
  }
  log(`achievements: ${count} rows`)
}

if (process.argv[1] && process.argv[1].includes('seed-achievements')) {
  seedAchievements()
    .catch((e) => {
      process.stderr.write(`[seed-warn] ${e instanceof Error ? e.message : String(e)}\n`)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
