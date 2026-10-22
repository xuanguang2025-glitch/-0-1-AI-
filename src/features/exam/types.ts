/**
 * 专项训练卷前端 DTO（T20）。
 */
export interface ExamPaperListItem {
  id: string
  title: string
  examType: string
  section: string
  description: string | null
  durationMin: number
  questionCount: number
  myAttemptCount: number
}

export interface ExamPaperListResult {
  papers: ExamPaperListItem[]
  total: number
}

export interface ExamStartResult {
  attemptId: string
  paperId: string
  title: string
  description: string | null
  durationMin: number
  deadlineAt: string
  /** **不含答案**（判分在服务端） */
  questions: Array<{ id: string; section: string; type: string; stem: string; options: string[] | null; score: number }>
}

export interface ExamSectionScore {
  correct: number
  total: number
  score: number
}

export interface ExamSubmitResult {
  attemptId: string
  status: string
  objectiveScore: number
  totalScore: number
  totalQuestions: number
  correctCount: number
  accuracy: number
  /** **非 CET 换算**——各 section 原始正确数/得分 */
  sectionScores: Record<string, ExamSectionScore>
  wrongCount: number
  idempotent: boolean
}

export interface ExamReportResult extends ExamSubmitResult {
  paperTitle: string
  paperDescription: string | null
  answers: Array<{
    examQuestionId: string
    stem: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
    explanation: string | null
  }>
}
