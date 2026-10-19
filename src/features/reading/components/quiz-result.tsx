'use client'

/**
 * QuizResult：阅读报告（T15 验收 3/4）。
 *
 * 展示：总分 / 正确率 / 逐题对错与解析 / 错题定位跳转（点击 → 原文段落高亮）。
 * 「错题自动写入错题本」的数量在此明示，让用户知道错题不会丢。
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { ReadingQuizResult } from '../types'

export interface QuizResultProps {
  result: ReadingQuizResult
  /** 点击定位 → 跳转原文段落 */
  onLocate?: (blockIndex: number) => void
  onRetry?: () => void
  className?: string
}

function accuracyVariant(accuracy: number): 'success' | 'warning' | 'destructive' {
  if (accuracy >= 85) return 'success'
  if (accuracy >= 60) return 'warning'
  return 'destructive'
}

export function QuizResult({ result, onLocate, onRetry, className }: QuizResultProps): React.JSX.Element {
  const wrong = result.answers.filter((a) => !a.isCorrect)

  return (
    <div className={cn('space-y-4', className)} data-testid="quiz-result">
      {/* 概览 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-xs text-muted-foreground">正确率</p>
          <p className="text-2xl font-semibold tabular-nums" data-testid="quiz-accuracy">
            {result.accuracy}%
          </p>
        </div>
        <Badge variant={accuracyVariant(result.accuracy)}>
          {result.accuracy >= 85 ? '优秀' : result.accuracy >= 60 ? '良好' : '待加强'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          答对 {result.correctCount} / {result.total}
        </span>
        <span className="ml-auto text-xs text-muted-foreground" data-testid="quiz-wrong-count">
          错题本 +{result.wrongCount}
        </span>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry} data-testid="quiz-retry">
            再测一次
          </Button>
        ) : null}
      </div>

      {/* 逐题解析 */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold">逐题解析</h3>
        <ul className="space-y-2">
          {result.answers.map((a, i) => (
            <li key={a.questionId} className="rounded-lg bg-surface-muted p-3" data-testid={`quiz-answer-${i}`}>
              <div className="flex items-center gap-2 text-sm">
                <span className={a.isCorrect ? 'text-success' : 'text-destructive'}>{a.isCorrect ? '✓' : '✗'}</span>
                <span className="text-muted-foreground">你的答案：</span>
                <span className="font-medium">{a.userAnswer || '（空）'}</span>
                {!a.isCorrect ? (
                  <>
                    <span className="text-muted-foreground">正确答案：</span>
                    <span className="font-medium text-success">{a.correctAnswer}</span>
                  </>
                ) : null}
                {a.location && onLocate ? (
                  <button
                    type="button"
                    onClick={() => onLocate(a.location!.blockIndex)}
                    className="ml-auto text-xs text-primary underline-offset-4 hover:underline"
                    data-testid={`quiz-locate-${i}`}
                  >
                    定位到第 {a.location.blockIndex + 1} 段
                  </button>
                ) : null}
              </div>
              {a.explanation ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{a.explanation}</p> : null}
            </li>
          ))}
        </ul>
        {wrong.length === 0 ? (
          <p className="mt-2 text-xs text-success">全部答对，错题本无新增。</p>
        ) : null}
      </section>
    </div>
  )
}
