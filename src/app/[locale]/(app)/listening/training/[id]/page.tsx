'use client'

/**
 * /listening/training/[id] — 训练页（L3 取题 + L4 提交，T14）。
 *
 * 组成：ModeSwitcher（6 种模式，RETELL Phase 3）+ AudioPlayer（同一套变速/A-B）
 *       + 作答区（AnswerArea / KeywordBlank / DictationEditor）。
 *
 * 关键约束（§5.2）：**前端永远不拿答案**——L3 只回题目不回答案，判分全在服务端
 * L4 完成；提交后跳转报告页（L5）。
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { AnswerArea } from '@/features/listening/components/answer-area'
import { AudioPlayer, type AudioPlayerHandle } from '@/features/listening/components/audio-player'
import { DictationEditor } from '@/features/listening/components/dictation-editor'
import { FocusPointRail } from '@/features/listening/components/focus-point-rail'
import { KeywordBlank } from '@/features/listening/components/keyword-blank'
import { ModeSwitcher } from '@/features/listening/components/mode-switcher'
import { useListeningDetail, useListeningQuestions, useSaveProgress, useSubmitAttempt } from '@/features/listening/hooks'
import { MODE_META, type ListeningModeKey } from '@/features/listening/types'
import { ROUTES } from '@/lib/constants/routes'

/** 有客观题作答区的模式 */
const OBJECTIVE_MODES: ListeningModeKey[] = ['EXTENSIVE', 'CHOICE', 'CLOZE']

export default function ListeningTrainingPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const materialId = params.id
  const router = useRouter()

  const [mode, setMode] = useState<ListeningModeKey>('EXTENSIVE')
  const [rate, setRate] = useState<number | null>(null)
  const [unknownWords, setUnknownWords] = useState<Array<{ word: string; meaning: string }>>([])

  const detail = useListeningDetail(materialId)
  const questions = useListeningQuestions(materialId, mode)
  const { submit, submitting, error: submitError } = useSubmitAttempt()
  const { save } = useSaveProgress(materialId)
  const playerRef = useRef<AudioPlayerHandle | null>(null)

  const activeRate = rate ?? detail.data?.recommendedRate ?? 1
  const timebase = detail.data?.timebases[String(activeRate)]
  const startedAtRef = useRef<number>(Date.now())

  const elapsedSec = useCallback(
    () => Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
    [],
  )

  const toggleUnknown = useCallback((point: { word: string; meaning: string }) => {
    setUnknownWords((prev) =>
      prev.some((w) => w.word === point.word)
        ? prev.filter((w) => w.word !== point.word)
        : [...prev, { word: point.word, meaning: point.meaning }],
    )
  }, [])

  const gotoReport = useCallback(
    (recordId: string) => {
      router.push(`${ROUTES.listening}/report/${recordId}`)
    },
    [router],
  )

  const onAnswers = useCallback(
    async (answers: Array<{ questionId: string; userAnswer: string }>) => {
      const r = await submit(materialId, {
        mode,
        answers,
        durationSec: elapsedSec(),
        playbackRate: activeRate,
        unknownWords,
      })
      if (r) gotoReport(r.recordId)
    },
    [submit, materialId, mode, elapsedSec, activeRate, unknownWords, gotoReport],
  )

  const onDictation = useCallback(
    async (dictationText: string) => {
      const r = await submit(materialId, {
        mode: 'DICTATION',
        dictationText,
        durationSec: elapsedSec(),
        playbackRate: activeRate,
        unknownWords,
      })
      if (r) gotoReport(r.recordId)
    },
    [submit, materialId, elapsedSec, activeRate, unknownWords, gotoReport],
  )

  /** INTENSIVE 无客观题：听完即记一次完成（accuracy 0），用于累计训练次数 */
  const onIntensiveDone = useCallback(async () => {
    const r = await submit(materialId, { mode: 'INTENSIVE', durationSec: elapsedSec(), playbackRate: activeRate })
    if (r) gotoReport(r.recordId)
  }, [submit, materialId, elapsedSec, activeRate, gotoReport])

  const onTime = useCallback(
    (sec: number) => {
      save(sec, activeRate, false)
    },
    [save, activeRate],
  )

  const onRateChange = useCallback((next: number) => setRate(next), [])

  const dictationOriginal = useMemo(
    () => (timebase?.transcript ?? []).map((l) => l.en).join(' '),
    [timebase],
  )

  // ---- 三态 ----
  if (detail.loading) {
    return (
      <AppShell>
        <PageContainer>
          <SkeletonCard className="h-20" />
          <SkeletonCard className="mt-4 h-64" />
        </PageContainer>
      </AppShell>
    )
  }

  if (detail.error || !detail.data) {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState
            title="材料加载失败"
            message={detail.error ?? '该听力材料可能已下架。'}
            onRetry={detail.reload}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const meta = MODE_META[mode]
  const levelOk = meta.levels.includes(detail.data.intensityLevel)
  const qs = questions.data

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={`训练 · ${detail.data.title}`}
          description="判分在服务端完成，提交后查看报告"
          actions={<Badge variant="outline">{meta.nameZh}</Badge>}
        />

        <ModeSwitcher value={mode} onChange={setMode} intensityLevel={detail.data.intensityLevel} />

        {detail.data.audioUrls.length > 0 ? (
          <div className="mt-4">
            <AudioPlayer
              ref={playerRef}
              src={detail.data.audioUrl}
              rates={detail.data.audioUrls}
              defaultRate={detail.data.recommendedRate}
              onRateChange={onRateChange}
              onTimeUpdate={onTime}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            音频尚未生成（Edge TTS 受限），无法进行听音训练；可先到精听页阅读字幕。
          </p>
        )}

        {submitError ? <p className="mt-3 text-xs text-destructive">{submitError}</p> : null}

        {/* 作答区 */}
        <div className="mt-4">
          {questions.loading ? (
            <SkeletonCard className="h-48" />
          ) : questions.error ? (
            <ErrorState title="题目加载失败" message={questions.error} onRetry={questions.reload} />
          ) : !levelOk ? (
            <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
              {meta.nameZh}模式适用于强度档 {meta.levels.join(' / ')}，当前材料为 {detail.data.intensityLevel} 档。
            </p>
          ) : qs && !qs.available ? (
            <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
              {meta.nameZh}模式需要录音评分，Phase 3 上线。
            </p>
          ) : mode === 'DICTATION' ? (
            <DictationEditor
              original={dictationOriginal}
              submitting={submitting}
              onSubmit={(text) => void onDictation(text)}
            />
          ) : mode === 'KEYWORD' ? (
            <KeywordBlank questions={qs?.questions ?? []} submitting={submitting} onSubmit={(a) => void onAnswers(a)} />
          ) : mode === 'INTENSIVE' ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-muted-foreground">
                精听模式无客观题：用 A-B 循环逐句听清即可，完成后点击右侧按钮记录一次训练。
              </p>
              <Button type="button" onClick={() => void onIntensiveDone()} disabled={submitting} data-testid="intensive-done">
                {submitting ? '提交中…' : '完成本次精听'}
              </Button>
            </div>
          ) : OBJECTIVE_MODES.includes(mode) ? (
            <AnswerArea questions={qs?.questions ?? []} submitting={submitting} onSubmit={(a) => void onAnswers(a)} />
          ) : null}
        </div>

        {/* 生词收集：随 L4 提交一起上报 */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">标记生词（{unknownWords.length}）</h2>
          <FocusPointRail
            points={timebase?.focusPoints ?? []}
            onToggleUnknown={toggleUnknown}
            unknownWords={unknownWords.map((w) => w.word)}
          />
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href={`${ROUTES.listening}/player/${materialId}`} className="text-primary underline-offset-4 hover:underline">
            返回精听页
          </Link>
        </p>
      </PageContainer>
    </AppShell>
  )
}
