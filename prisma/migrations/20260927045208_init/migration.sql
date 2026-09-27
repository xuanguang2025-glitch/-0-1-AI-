-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "CEFRLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "MasteryStage" AS ENUM ('NEW', 'STRANGER', 'LEARNING', 'FAMILIAR', 'PROFICIENT', 'MASTERED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL', 'DAILY', 'BUSINESS', 'INTEREST', 'ABROAD');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL', 'MOCK', 'CUSTOM', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'CLOZE', 'MATCHING', 'SHORT_ANSWER', 'ESSAY', 'TRANSLATION', 'DICTATION', 'RETELL', 'SUMMARY');

-- CreateEnum
CREATE TYPE "ExamSection" AS ENUM ('LISTENING', 'READING', 'WRITING', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'GRADED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'OFFLINE', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlanSource" AS ENUM ('AI', 'RULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('VOCAB', 'REVIEW', 'LISTENING', 'READING', 'WRITING', 'SPEAKING', 'GRAMMAR', 'TRANSLATION', 'EXAM');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('LEARN', 'REVIEW', 'QUIZ', 'EXAM', 'NOTEBOOK', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "AiCapability" AS ENUM ('WORD_EXPLAIN', 'WRITING_REVIEW', 'SPEAKING_SCORE', 'PRONUNCIATION_ANALYZE', 'READING_EXPLAIN', 'GRAMMAR_EXPLAIN', 'PLAN_GENERATE', 'PLAN_ADJUST', 'DAILY_DIAGNOSIS', 'TUTOR_CHAT', 'TRANSLATE', 'LISTENING_ANALYZE', 'MISTAKE_CLASSIFY', 'READING_QUIZ_GENERATE', 'WORD_SCENARIO', 'RECOMMEND', 'EXAM_ESSAY_SCORE', 'CET_ADVICE');

-- CreateEnum
CREATE TYPE "AiCallStatus" AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT', 'DEGRADED', 'RATE_LIMITED', 'CONTENT_BLOCKED');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('TUTOR', 'SPEAKING_PARTNER', 'WORD_EXPLAINER', 'GRAMMAR_EXPLAINER', 'READING_EXPLAINER');

-- CreateEnum
CREATE TYPE "SpeakingStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADING', 'SCORED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('STUDY_REMINDER', 'REVIEW_REMINDER', 'PLAN_REMINDER', 'EXAM_REMINDER', 'STREAK_REMINDER', 'ACHIEVEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('STREAK', 'VOCABULARY', 'STUDY_TIME', 'EXAM', 'WRITING', 'SPEAKING', 'LISTENING', 'READING', 'SPECIAL');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realName" TEXT,
    "bio" TEXT,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "country" TEXT DEFAULT 'CN',
    "cefrLevel" "CEFRLevel",
    "cetEstimatedScore" INTEGER,
    "currentScore" INTEGER,
    "targetScore" INTEGER,
    "abilityVector" JSONB,
    "onboardingData" JSONB,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalStudySeconds" INTEGER NOT NULL DEFAULT 0,
    "wordsLearned" INTEGER NOT NULL DEFAULT 0,
    "wordsReviewed" INTEGER NOT NULL DEFAULT 0,
    "wordsMastered" INTEGER NOT NULL DEFAULT 0,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "listeningSeconds" INTEGER NOT NULL DEFAULT 0,
    "readingCount" INTEGER NOT NULL DEFAULT 0,
    "writingCount" INTEGER NOT NULL DEFAULT 0,
    "speakingSeconds" INTEGER NOT NULL DEFAULT 0,
    "examCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastStudyDate" TEXT,
    "challengeCompleted" INTEGER NOT NULL DEFAULT 0,
    "aiCallCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 30,
    "weeklyGoalDays" INTEGER NOT NULL DEFAULT 5,
    "notificationPrefs" JSONB,
    "aiPrefs" JSONB,
    "privacyPrefs" JSONB,
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "soundEffects" BOOLEAN NOT NULL DEFAULT false,
    "autoPlayAudio" BOOLEAN NOT NULL DEFAULT true,
    "defaultPlaybackRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetExam" "ExamType",
    "targetScore" INTEGER,
    "targetDate" TIMESTAMP(3),
    "dailyMinutes" INTEGER NOT NULL DEFAULT 30,
    "weeklyDays" INTEGER NOT NULL DEFAULT 5,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotateCount" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TEACHER',
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_books" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "examType" "ExamType",
    "cefrLevel" "CEFRLevel",
    "description" TEXT,
    "coverUrl" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "phoneticUk" TEXT,
    "phoneticUs" TEXT,
    "audioUrl" TEXT,
    "pos" JSONB,
    "definitions" JSONB NOT NULL,
    "examples" JSONB,
    "synonyms" JSONB,
    "antonyms" JSONB,
    "collocations" JSONB,
    "derivatives" JSONB,
    "rootAffix" TEXT,
    "mnemonic" TEXT,
    "cefrLevel" "CEFRLevel",
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "frequencyRank" INTEGER,
    "tags" JSONB,
    "source" TEXT DEFAULT 'seed',
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_book_items" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vocabulary_book_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_materials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "cefrLevel" "CEFRLevel",
    "audioUrl" TEXT NOT NULL,
    "audioSize" INTEGER,
    "durationSec" INTEGER NOT NULL,
    "transcript" JSONB NOT NULL,
    "translation" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "coverUrl" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listening_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_questions" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" TEXT NOT NULL,
    "answerAliases" JSONB,
    "explanation" TEXT,
    "startSec" DOUBLE PRECISION,
    "endSec" DOUBLE PRECISION,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "knowledgePoints" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listening_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "cefrLevel" "CEFRLevel",
    "coverUrl" TEXT,
    "contentBlocks" JSONB NOT NULL,
    "contentZh" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "readingMinutes" INTEGER NOT NULL DEFAULT 5,
    "keyWords" JSONB,
    "sentences" JSONB,
    "tags" JSONB,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "audioUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_questions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" TEXT NOT NULL,
    "explanation" TEXT,
    "location" JSONB,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reading_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "content" JSONB,
    "examples" JSONB,
    "errorExamples" JSONB,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',

    CONSTRAINT "grammar_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_questions" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" TEXT NOT NULL,
    "explanation" TEXT,
    "knowledgePoints" JSONB,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grammar_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "examType" "ExamType",
    "prompt" TEXT NOT NULL,
    "requirements" JSONB,
    "wordMin" INTEGER,
    "wordMax" INTEGER,
    "rubric" JSONB,
    "sampleAnswer" TEXT,
    "totalScore" INTEGER NOT NULL DEFAULT 15,
    "tags" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "examType" "ExamType",
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" TEXT NOT NULL,
    "answerAliases" JSONB,
    "explanation" TEXT,
    "knowledgePoints" JSONB,
    "material" JSONB,
    "discrimination" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "irtDifficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tags" JSONB,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goalType" "GoalType",
    "targetExam" "ExamType",
    "targetScore" INTEGER,
    "targetDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "weekTargets" JSONB,
    "source" "PlanSource" NOT NULL DEFAULT 'RULE',
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "inputTags" JSONB,
    "lastAdjustReason" TEXT,
    "lastAdjustedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_tasks" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'count',
    "completedValue" INTEGER NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vocabulary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL DEFAULT 0,
    "masteryStage" "MasteryStage" NOT NULL DEFAULT 'NEW',
    "learnCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "learnedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "avgResponseMs" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "inNotebook" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userVocabId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL DEFAULT 0,
    "prevMastery" INTEGER NOT NULL,
    "newMastery" INTEGER NOT NULL,
    "prevStage" "MasteryStage" NOT NULL,
    "newStage" "MasteryStage" NOT NULL,
    "prevIntervalDays" INTEGER NOT NULL,
    "newIntervalDays" INTEGER NOT NULL,
    "prevEaseFactor" DOUBLE PRECISION NOT NULL,
    "newEaseFactor" DOUBLE PRECISION NOT NULL,
    "source" "ReviewSource" NOT NULL DEFAULT 'REVIEW',
    "idempotencyKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "roleKey" TEXT NOT NULL,
    "sceneKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'partner',
    "status" "SpeakingStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "fullTranscript" TEXT,
    "aiScores" JSONB,
    "aiTotalScore" INTEGER,
    "aiSummary" TEXT,
    "aiCorrections" JSONB,
    "aiDegraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "textContent" TEXT,
    "audioUrl" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "sttConfidence" DOUBLE PRECISION,
    "hints" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "unknownWords" JSONB,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "playbackRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "answers" JSONB,
    "aiAnalysis" JSONB,
    "aiDegraded" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listening_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "readSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastBlockIndex" INTEGER NOT NULL DEFAULT 0,
    "quizResult" JSONB,
    "highlights" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "paragraphCount" INTEGER NOT NULL DEFAULT 0,
    "selfScore" INTEGER,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "aiScores" JSONB,
    "aiTotalScore" INTEGER,
    "aiCorrections" JSONB,
    "aiRewrites" JSONB,
    "aiSummary" TEXT,
    "ruleCheck" JSONB,
    "aiDegraded" BOOLEAN NOT NULL DEFAULT false,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "scoredAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "aiResult" JSONB,
    "aiNotes" TEXT,
    "aiDegraded" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "value" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_learning_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "studySeconds" INTEGER NOT NULL DEFAULT 0,
    "wordsLearned" INTEGER NOT NULL DEFAULT 0,
    "wordsReviewed" INTEGER NOT NULL DEFAULT 0,
    "listeningSeconds" INTEGER NOT NULL DEFAULT 0,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "readingCount" INTEGER NOT NULL DEFAULT 0,
    "speakingSeconds" INTEGER NOT NULL DEFAULT 0,
    "writingCount" INTEGER NOT NULL DEFAULT 0,
    "examCount" INTEGER NOT NULL DEFAULT 0,
    "translationCount" INTEGER NOT NULL DEFAULT 0,
    "grammarCount" INTEGER NOT NULL DEFAULT 0,
    "tasksTotal" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "aiCallCount" INTEGER NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_learning_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_tests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionCount" INTEGER NOT NULL DEFAULT 30,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "answers" JSONB,
    "scores" JSONB,
    "cefrLevel" "CEFRLevel",
    "cetEstimate" JSONB,
    "aiReport" JSONB,
    "aiDegraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_papers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "year" INTEGER,
    "totalScore" INTEGER NOT NULL DEFAULT 710,
    "durationMin" INTEGER NOT NULL DEFAULT 125,
    "structure" JSONB,
    "description" TEXT,
    "isRealPast" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "questionId" TEXT,
    "section" "ExamSection" NOT NULL,
    "type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" TEXT,
    "answerAliases" JSONB,
    "explanation" TEXT,
    "material" JSONB,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "knowledgePoints" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "needsAiGrading" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "timeUsedSec" INTEGER NOT NULL DEFAULT 0,
    "objectiveScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subjectiveScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sectionScores" JSONB,
    "cetEstimate" JSONB,
    "aiDegraded" BOOLEAN NOT NULL DEFAULT false,
    "saveVersion" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "examQuestionId" TEXT NOT NULL,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiScore" JSONB,
    "aiFeedback" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wrong_questions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "attemptId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "userAnswer" TEXT,
    "correctAnswer" TEXT,
    "explanation" TEXT,
    "knowledgePoints" JSONB,
    "aiCategory" TEXT,
    "aiReason" TEXT,
    "aiExplanation" TEXT,
    "aiClassified" BOOLEAN NOT NULL DEFAULT false,
    "errorCount" INTEGER NOT NULL DEFAULT 1,
    "lastWrongAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteredAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wrong_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "category" "AchievementCategory" NOT NULL,
    "condition" JSONB NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" JSONB,
    "isNotified" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "deepLink" JSONB,
    "channel" "Channel" NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'TUTOR',
    "title" TEXT,
    "context" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structured" JSONB,
    "tokensPrompt" INTEGER NOT NULL DEFAULT 0,
    "tokensCompletion" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "provider" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "firstTokenMs" INTEGER NOT NULL DEFAULT 0,
    "isStreamed" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "variables" JSONB,
    "modelOverrides" JSONB,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "trafficRatio" INTEGER NOT NULL DEFAULT 100,
    "outputSchema" TEXT,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_capability_config" (
    "id" TEXT NOT NULL,
    "capability" "AiCapability" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "firstTokenTimeoutMs" INTEGER NOT NULL DEFAULT 3000,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "dailyQuotaUser" INTEGER,
    "dailyQuotaGlobal" INTEGER,
    "isStreaming" BOOLEAN NOT NULL DEFAULT false,
    "cacheEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_capability_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "capability" "AiCapability" NOT NULL,
    "status" "AiCallStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "firstTokenMs" INTEGER,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "requestHash" TEXT,
    "traceId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promptId" TEXT,
    "promptKey" TEXT,
    "promptVersion" INTEGER,
    "configId" TEXT,
    "provider" TEXT,
    "model" TEXT,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "orderNo" TEXT,
    "aiDailyQuota" INTEGER,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_createdAt_idx" ON "users"("status", "createdAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_userId_key" ON "user_stats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "learning_goals_userId_status_idx" ON "learning_goals"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "auth_sessions_familyId_idx" ON "auth_sessions"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "admin_users_userId_revokedAt_idx" ON "admin_users"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_books_slug_key" ON "vocabulary_books"("slug");

-- CreateIndex
CREATE INDEX "vocabulary_books_examType_status_idx" ON "vocabulary_books"("examType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_lemma_key" ON "vocabulary"("lemma");

-- CreateIndex
CREATE INDEX "vocabulary_difficulty_cefrLevel_status_idx" ON "vocabulary"("difficulty", "cefrLevel", "status");

-- CreateIndex
CREATE INDEX "vocabulary_frequencyRank_idx" ON "vocabulary"("frequencyRank");

-- CreateIndex
CREATE INDEX "vocabulary_book_items_bookId_orderIndex_idx" ON "vocabulary_book_items"("bookId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_book_items_bookId_vocabularyId_key" ON "vocabulary_book_items"("bookId", "vocabularyId");

-- CreateIndex
CREATE INDEX "listening_materials_category_difficulty_status_idx" ON "listening_materials"("category", "difficulty", "status");

-- CreateIndex
CREATE INDEX "listening_materials_status_publishedAt_idx" ON "listening_materials"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "listening_questions_materialId_sortOrder_idx" ON "listening_questions"("materialId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "reading_articles_slug_key" ON "reading_articles"("slug");

-- CreateIndex
CREATE INDEX "reading_articles_category_difficulty_status_idx" ON "reading_articles"("category", "difficulty", "status");

-- CreateIndex
CREATE INDEX "reading_articles_status_publishedAt_idx" ON "reading_articles"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "reading_questions_articleId_sortOrder_idx" ON "reading_questions"("articleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_topics_slug_key" ON "grammar_topics"("slug");

-- CreateIndex
CREATE INDEX "grammar_topics_category_orderIndex_idx" ON "grammar_topics"("category", "orderIndex");

-- CreateIndex
CREATE INDEX "grammar_questions_topicId_sortOrder_idx" ON "grammar_questions"("topicId", "sortOrder");

-- CreateIndex
CREATE INDEX "writing_tasks_taskType_difficulty_status_idx" ON "writing_tasks"("taskType", "difficulty", "status");

-- CreateIndex
CREATE INDEX "questions_category_difficulty_status_idx" ON "questions"("category", "difficulty", "status");

-- CreateIndex
CREATE INDEX "questions_examType_type_status_idx" ON "questions"("examType", "type", "status");

-- CreateIndex
CREATE INDEX "study_plans_userId_status_idx" ON "study_plans"("userId", "status");

-- CreateIndex
CREATE INDEX "study_plans_userId_version_idx" ON "study_plans"("userId", "version");

-- CreateIndex
CREATE INDEX "study_tasks_userId_date_status_idx" ON "study_tasks"("userId", "date", "status");

-- CreateIndex
CREATE INDEX "study_tasks_userId_date_taskType_idx" ON "study_tasks"("userId", "date", "taskType");

-- CreateIndex
CREATE INDEX "study_tasks_planId_date_idx" ON "study_tasks"("planId", "date");

-- CreateIndex
CREATE INDEX "user_vocabulary_userId_nextReviewAt_idx" ON "user_vocabulary"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "user_vocabulary_userId_masteryStage_idx" ON "user_vocabulary"("userId", "masteryStage");

-- CreateIndex
CREATE INDEX "user_vocabulary_userId_inNotebook_idx" ON "user_vocabulary"("userId", "inNotebook");

-- CreateIndex
CREATE INDEX "user_vocabulary_userId_isFavorite_idx" ON "user_vocabulary"("userId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "user_vocabulary_userId_vocabularyId_key" ON "user_vocabulary"("userId", "vocabularyId");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_reviews_idempotencyKey_key" ON "vocabulary_reviews"("idempotencyKey");

-- CreateIndex
CREATE INDEX "vocabulary_reviews_userVocabId_occurredAt_idx" ON "vocabulary_reviews"("userVocabId", "occurredAt");

-- CreateIndex
CREATE INDEX "vocabulary_reviews_userId_occurredAt_idx" ON "vocabulary_reviews"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_sessions_conversationId_key" ON "speaking_sessions"("conversationId");

-- CreateIndex
CREATE INDEX "speaking_sessions_userId_status_startedAt_idx" ON "speaking_sessions"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "speaking_messages_sessionId_createdAt_idx" ON "speaking_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "listening_records_userId_completedAt_idx" ON "listening_records"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "listening_records_userId_materialId_idx" ON "listening_records"("userId", "materialId");

-- CreateIndex
CREATE INDEX "reading_records_userId_updatedAt_idx" ON "reading_records"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reading_records_userId_articleId_key" ON "reading_records"("userId", "articleId");

-- CreateIndex
CREATE INDEX "writing_submissions_userId_status_createdAt_idx" ON "writing_submissions"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "writing_submissions_userId_deletedAt_updatedAt_idx" ON "writing_submissions"("userId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "translation_records_userId_createdAt_idx" ON "translation_records"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "learning_records_userId_occurredAt_idx" ON "learning_records"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "learning_records_userId_activityType_occurredAt_idx" ON "learning_records"("userId", "activityType", "occurredAt");

-- CreateIndex
CREATE INDEX "daily_learning_stats_date_idx" ON "daily_learning_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_learning_stats_userId_date_key" ON "daily_learning_stats"("userId", "date");

-- CreateIndex
CREATE INDEX "placement_tests_userId_status_idx" ON "placement_tests"("userId", "status");

-- CreateIndex
CREATE INDEX "placement_tests_userId_completedAt_idx" ON "placement_tests"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "exam_papers_examType_status_idx" ON "exam_papers"("examType", "status");

-- CreateIndex
CREATE INDEX "exam_questions_paperId_section_sortOrder_idx" ON "exam_questions"("paperId", "section", "sortOrder");

-- CreateIndex
CREATE INDEX "exam_attempts_userId_status_startedAt_idx" ON "exam_attempts"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "exam_attempts_userId_paperId_idx" ON "exam_attempts"("userId", "paperId");

-- CreateIndex
CREATE INDEX "exam_answers_attemptId_flagged_idx" ON "exam_answers"("attemptId", "flagged");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_attemptId_examQuestionId_key" ON "exam_answers"("attemptId", "examQuestionId");

-- CreateIndex
CREATE INDEX "wrong_questions_userId_masteredAt_lastWrongAt_idx" ON "wrong_questions"("userId", "masteredAt", "lastWrongAt");

-- CreateIndex
CREATE INDEX "wrong_questions_userId_source_masteredAt_idx" ON "wrong_questions"("userId", "source", "masteredAt");

-- CreateIndex
CREATE INDEX "wrong_questions_userId_aiCategory_idx" ON "wrong_questions"("userId", "aiCategory");

-- CreateIndex
CREATE INDEX "favorites_userId_targetType_createdAt_idx" ON "favorites"("userId", "targetType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_targetType_targetId_key" ON "favorites"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

-- CreateIndex
CREATE INDEX "achievements_category_sortOrder_idx" ON "achievements"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "user_achievements_userId_unlockedAt_idx" ON "user_achievements"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_type_idx" ON "notifications"("userId", "type");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_type_lastMessageAt_idx" ON "ai_conversations"("userId", "type", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_deletedAt_updatedAt_idx" ON "ai_conversations"("userId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_prompts_key_status_idx" ON "ai_prompts"("key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompts_key_version_key" ON "ai_prompts"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ai_capability_config_capability_key" ON "ai_capability_config"("capability");

-- CreateIndex
CREATE INDEX "ai_call_logs_userId_createdAt_idx" ON "ai_call_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_call_logs_capability_createdAt_idx" ON "ai_call_logs"("capability", "createdAt");

-- CreateIndex
CREATE INDEX "ai_call_logs_createdAt_idx" ON "ai_call_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_call_logs_status_createdAt_idx" ON "ai_call_logs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_orderNo_key" ON "subscriptions"("orderNo");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_book_items" ADD CONSTRAINT "vocabulary_book_items_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "vocabulary_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_book_items" ADD CONSTRAINT "vocabulary_book_items_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_questions" ADD CONSTRAINT "listening_questions_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "listening_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_questions" ADD CONSTRAINT "reading_questions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "reading_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_topics" ADD CONSTRAINT "grammar_topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "grammar_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_questions" ADD CONSTRAINT "grammar_questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "grammar_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary" ADD CONSTRAINT "user_vocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary" ADD CONSTRAINT "user_vocabulary_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_reviews" ADD CONSTRAINT "vocabulary_reviews_userVocabId_fkey" FOREIGN KEY ("userVocabId") REFERENCES "user_vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_messages" ADD CONSTRAINT "speaking_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "speaking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_records" ADD CONSTRAINT "listening_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_records" ADD CONSTRAINT "listening_records_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "listening_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_records" ADD CONSTRAINT "reading_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_records" ADD CONSTRAINT "reading_records_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "reading_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "writing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_records" ADD CONSTRAINT "translation_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_learning_stats" ADD CONSTRAINT "daily_learning_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "exam_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "exam_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wrong_questions" ADD CONSTRAINT "wrong_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wrong_questions" ADD CONSTRAINT "wrong_questions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ai_capability_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
