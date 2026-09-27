/**
 * User DTO：profile / settings / goals。
 */

export interface UserProfileDto {
  userId: string
  nickname: string
  bio: string | null
  gradeBand: string | null
  targetExam: string | null
  dailyGoalMinutes: number
  createdAt: string
  updatedAt: string
}

export interface UserSettingsDto {
  userId: string
  locale: string
  timezone: string
  theme: string
  notificationPrefs: Record<string, unknown>
  updatedAt: string
}

export interface UserStatsDto {
  userId: string
  xp: number
  level: number
  streakDays: number
  totalStudyMinutes: number
  masteredWords: number
  updatedAt: string
}

export interface LearningGoalDto {
  id: string
  userId: string
  type: string
  targetExam: string | null
  targetDate: string | null
  dailyMinutes: number
  status: string
  createdAt: string
}

export interface AvatarResultDto {
  avatarUrl: string
}
