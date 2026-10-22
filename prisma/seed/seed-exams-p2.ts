/**
 * 专项训练卷 seed（T20）：8 套卷 × 20 题 = 160 题，仅客观题（听力/阅读/语法/词汇）。
 *
 * **设计约束（验收 1）**：不含写作/翻译主观题（needsAiGrading=false 恒定）；
 * 报告页显式标注「专项训练卷，非 CET 全真模考」；**不写 cetEstimate**
 * （710 分制缺标定样本，架构师裁决 Phase 2 禁用）。
 *
 * 幂等：paper 用固定 id（pe-1..pe-8）upsert；题目 cascade 于 paper——
 * 为让题目在题量调整后也能更新，先删后插该 paper 的旧题（paper 本体 upsert）。
 */
import { prisma } from '@/lib/db'
import { log } from './shared'
import type { ExamSection, ExamType, QuestionType, Difficulty } from '@prisma/client'

interface SeedQuestion {
  section: ExamSection
  type: QuestionType
  stem: string
  options: string[]
  answer: string
  explanation: string
  score: number
}

interface SeedPaper {
  id: string
  title: string
  examType: ExamType
  section: ExamSection
  difficulty: Difficulty
  description: string
  durationMin: number
  questions: SeedQuestion[]
}

// ---------------------------------------------------------------------------
// 题目生成器：按主题生成 20 道单选（客观题，answer 恒定可判分）
// ---------------------------------------------------------------------------

const GRAMMAR_ITEMS: ReadonlyArray<{ stem: string; options: [string, string, string, string]; answer: string; explanation: string }> = [
  { stem: 'She ___ in this company since 2019.', options: ['works', 'has worked', 'worked', 'is working'], answer: 'B', explanation: 'since 搭配现在完成时。' },
  { stem: 'If it ___ tomorrow, we will cancel the trip.', options: ['rains', 'will rain', 'rained', 'is raining'], answer: 'A', explanation: '条件句主将从现。' },
  { stem: 'The report ___ by the manager yesterday.', options: ['was reviewed', 'reviewed', 'has reviewed', 'is reviewing'], answer: 'A', explanation: '被动语态：be + 过去分词。' },
  { stem: 'He suggested ___ a meeting next week.', options: ['to hold', 'holding', 'hold', 'held'], answer: 'B', explanation: 'suggest 后接动名词。' },
  { stem: 'This is the book ___ I told you about.', options: ['what', 'who', 'that', 'whom'], answer: 'C', explanation: '先行词为物用 that/which。' },
  { stem: 'Neither of the answers ___ correct.', options: ['are', 'is', 'were', 'be'], answer: 'B', explanation: 'neither 作主语谓语用单数。' },
  { stem: 'I would rather ___ at home tonight.', options: ['to stay', 'staying', 'stay', 'stayed'], answer: 'C', explanation: 'would rather 后接动词原形。' },
  { stem: 'By the time we arrived, the film ___.', options: ['started', 'had started', 'has started', 'starts'], answer: 'B', explanation: '过去完成时表示过去的过去。' },
  { stem: 'She is the ___ of the two sisters.', options: ['taller', 'tallest', 'more tall', 'most tall'], answer: 'A', explanation: '两者比较用比较级。' },
  { stem: 'Hardly ___ sat down when the phone rang.', options: ['I had', 'had I', 'I have', 'did I'], answer: 'B', explanation: 'Hardly 置句首用倒装。' },
  { stem: 'The room needs ___ before the guests arrive.', options: ['to clean', 'cleaning', 'clean', 'cleaned'], answer: 'B', explanation: 'need doing = need to be done。' },
  { stem: 'It was not until midnight ___ he finished the essay.', options: ['when', 'that', 'which', 'then'], answer: 'B', explanation: 'It was not until...that 强调句。' },
  { stem: 'You ___ have seen her — she left for London yesterday.', options: ['must not', 'cannot', 'should not', 'need not'], answer: 'B', explanation: 'cannot have done 表示对过去的否定推测。' },
  { stem: 'Not only the students but also the teacher ___ invited.', options: ['were', 'was', 'have been', 'are'], answer: 'B', explanation: '就近原则：谓语与 the teacher 一致。' },
  { stem: 'I remember ___ the door before leaving.', options: ['to lock', 'locking', 'lock', 'locked'], answer: 'B', explanation: 'remember doing 表示记得做过。' },
  { stem: 'The harder you work, ___ you will get.', options: ['the more', 'more', 'the most', 'much more'], answer: 'A', explanation: 'the + 比较级, the + 比较级。' },
  { stem: 'He denied ___ the window.', options: ['to break', 'breaking', 'break', 'broken'], answer: 'B', explanation: 'deny 后接动名词。' },
  { stem: 'This time tomorrow we ___ the exam.', options: ['take', 'will be taking', 'took', 'have taken'], answer: 'B', explanation: '将来进行时。' },
  { stem: 'The city ___ we visited last year has changed a lot.', options: ['what', 'which', 'who', 'whose'], answer: 'B', explanation: '先行词为城市（物）用 which/that。' },
  { stem: 'She speaks English ___ than I do.', options: ['more fluent', 'more fluently', 'fluenter', 'most fluently'], answer: 'B', explanation: '修饰动词用副词比较级。' },
]

const VOCAB_ITEMS: ReadonlyArray<{ stem: string; options: [string, string, string, string]; answer: string; explanation: string }> = [
  { stem: 'The word "abandon" most nearly means ___.', options: ['to leave completely', 'to support strongly', 'to repair', 'to purchase'], answer: 'A', explanation: 'abandon = 放弃、抛弃。' },
  { stem: 'A "deadline" refers to ___.', options: ['a finish time', 'a starting line', 'a telephone line', 'a clothes line'], answer: 'A', explanation: 'deadline = 截止期限。' },
  { stem: 'Choose the synonym of "significant".', options: ['important', 'tiny', 'silent', 'foreign'], answer: 'A', explanation: 'significant = 重要的。' },
  { stem: 'Choose the antonym of "temporary".', options: ['permanent', 'brief', 'short', 'passing'], answer: 'A', explanation: 'temporary 暂时的 ↔ permanent 永久的。' },
  { stem: 'The word "reliable" describes someone you can ___.', options: ['depend on', 'laugh at', 'run from', 'look into'], answer: 'A', explanation: 'reliable = 可靠的。' },
  { stem: '"Efficient" means achieving results ___.', options: ['without wasting time or energy', 'with great difficulty', 'by accident', 'after long delays'], answer: 'A', explanation: 'efficient = 高效的。' },
  { stem: 'A "colleague" is a person who ___.', options: ['works with you', 'teaches you', 'lives near you', 'opposes you'], answer: 'A', explanation: 'colleague = 同事。' },
  { stem: 'The word "postpone" most nearly means ___.', options: ['delay', 'cancel', 'finish', 'prepare'], answer: 'A', explanation: 'postpone = 推迟。' },
  { stem: '"Convenient" describes something that ___.', options: ['saves effort', 'costs a lot', 'rarely happens', 'causes trouble'], answer: 'A', explanation: 'convenient = 方便的。' },
  { stem: 'Choose the synonym of "obtain".', options: ['get', 'lose', 'hide', 'refuse'], answer: 'A', explanation: 'obtain = 获得。' },
  { stem: 'An "appointment" is an arrangement to ___.', options: ['meet at a set time', 'travel together', 'share a meal', 'split a bill'], answer: 'A', explanation: 'appointment = 预约、约定。' },
  { stem: 'The word "frequent" most nearly means ___.', options: ['happening often', 'happening once', 'very slow', 'very loud'], answer: 'A', explanation: 'frequent = 频繁的。' },
  { stem: '"Accurate" information is information that is ___.', options: ['correct', 'long', 'recent', 'secret'], answer: 'A', explanation: 'accurate = 准确的。' },
  { stem: 'To "recommend" something is to ___.', options: ['suggest it positively', 'reject it', 'repair it', 'repeat it'], answer: 'A', explanation: 'recommend = 推荐。' },
  { stem: 'A "vacancy" means a room or job that is ___.', options: ['available', 'occupied', 'damaged', 'expensive'], answer: 'A', explanation: 'vacancy = 空缺。' },
  { stem: 'The word "diligent" describes a person who ___.', options: ['works carefully', 'talks loudly', 'arrives late', 'spends freely'], answer: 'A', explanation: 'diligent = 勤奋的。' },
  { stem: '"Sufficient" means ___.', options: ['enough', 'too much', 'scarce', 'extra'], answer: 'A', explanation: 'sufficient = 足够的。' },
  { stem: 'To "estimate" is to make a careful ___.', options: ['guess based on information', 'final decision', 'loud complaint', 'written promise'], answer: 'A', explanation: 'estimate = 估计。' },
  { stem: 'The word "resolve" most nearly means ___.', options: ['settle or find a solution', 'create a problem', 'avoid completely', 'write down'], answer: 'A', explanation: 'resolve = 解决。' },
  { stem: '"Attractive" describes something that ___.', options: ['draws interest', 'causes fear', 'needs repair', 'is far away'], answer: 'A', explanation: 'attractive = 有吸引力的。' },
]

const READING_ITEMS: ReadonlyArray<{ stem: string; options: [string, string, string, string]; answer: string; explanation: string }> = [
  { stem: 'The passage says regular reading helps students mainly by ___.', options: ['improving vocabulary and focus', 'saving money', 'replacing sleep', 'avoiding homework'], answer: 'A', explanation: '细节题：扩大词汇、加深理解、训练专注。' },
  { stem: 'According to the passage, city traffic drops when people ___.', options: ['can choose among transport options', 'stay at home all day', 'buy more cars', 'avoid buses'], answer: 'A', explanation: '细节题：多种出行选择使出行时间下降。' },
  { stem: 'The passage suggests a healthy diet is ___.', options: ['possible on a small budget', 'only for the rich', 'always expensive', 'impossible to plan'], answer: 'A', explanation: '细节题：简单食物即可满足营养。' },
  { stem: 'Teams that meet briefly every day often ___.', options: ['solve problems earlier', 'avoid all conflicts', 'skip reports', 'work fewer hours'], answer: 'A', explanation: '细节题：短站会让问题更早解决。' },
  { stem: 'Handwriting helps memory because students must ___.', options: ['summarise rather than copy', 'write faster', 'use new pens', 'type twice'], answer: 'A', explanation: '细节题：归纳而非照抄。' },
  { stem: 'Museums have attracted more young visitors by ___.', options: ['adding interactive exhibits', 'raising ticket prices', 'banning photography', 'closing early'], answer: 'A', explanation: '细节题：触屏/语音导览/互动展厅。' },
  { stem: 'Small businesses succeed when owners ___.', options: ['talk to customers and control costs', 'avoid all risks', 'hire many staff', 'spend heavily at once'], answer: 'A', explanation: '细节题：频繁交流、快速调整、控制成本。' },
  { stem: 'Doctors advise avoiding bright screens before sleep because screens ___.', options: ['harm sleep quality', 'improve dreams', 'cause hunger', 'save time'], answer: 'A', explanation: '细节题：睡前一小时避免亮屏。' },
  { stem: 'Volunteering teaches people to ___.', options: ['communicate and manage time', 'avoid strangers', 'spend more', 'work alone'], answer: 'A', explanation: '细节题：沟通与时间管理。' },
  { stem: 'Underwater robots help scientists by ___.', options: ['sending pictures from deep places', 'cleaning the ocean', 'predicting weather', 'feeding fish'], answer: 'A', explanation: '细节题：深海影像助发现新物种。' },
  { stem: 'The main idea of the train-travel passage is that trains are ___.', options: ['fast, comfortable and greener', 'slower but cheaper than walking', 'only for tourists', 'disappearing everywhere'], answer: 'A', explanation: '主旨题：现代火车快、舒适、污染少。' },
  { stem: 'Libraries stay useful in a digital world by ___.', options: ['offering classes and workspaces', 'selling old books', 'closing branches', 'removing equipment'], answer: 'A', explanation: '细节题：免费课程与办公空间。' },
  { stem: 'Drip systems help farmers by ___.', options: ['sending water to plant roots directly', 'collecting rain only', 'cooling the air', 'storing grain'], answer: 'A', explanation: '细节题：滴灌减少一半以上浪费。' },
  { stem: 'Online shopping creates a problem of ___.', options: ['large amounts of packaging', 'fewer choices', 'higher prices always', 'no delivery'], answer: 'A', explanation: '细节题：大量包装。' },
  { stem: 'Music education may improve children\'s ___.', options: ['attention and language ability', 'height', 'eyesight', 'appetite'], answer: 'A', explanation: '细节题：注意力与语言能力。' },
  { stem: 'Working from home mainly gives people ___.', options: ['flexibility and saved travel time', 'more meetings', 'higher rent', 'longer commutes'], answer: 'A', explanation: '细节题：省通勤、带来灵活性。' },
  { stem: 'Local food markets are attractive because they are ___.', options: ['fresher and often cheaper', 'only for tourists', 'open once a year', 'always far away'], answer: 'A', explanation: '细节题：更新鲜、常更便宜、排放更少。' },
  { stem: 'Budgeting apps make money management ___.', options: ['easier to track', 'harder to control', 'less important', 'more expensive'], answer: 'A', explanation: '细节题：记账应用让过程更轻松。' },
  { stem: 'International competitions teach young players ___.', options: ['discipline and respect', 'to avoid practice', 'to ignore coaches', 'spending habits'], answer: 'A', explanation: '细节题：纪律与尊重。' },
  { stem: 'City birds sing at higher pitches to ___.', options: ['adapt to noisy streets', 'attract scientists', 'scare visitors', 'find food'], answer: 'A', explanation: '细节题：适应嘈杂街道。' },
]

const LISTENING_ITEMS: ReadonlyArray<{ stem: string; options: [string, string, string, string]; answer: string; explanation: string }> = [
  { stem: '[音频] What does the woman want to order?', options: ['A latte', 'Green tea', 'Orange juice', 'Water'], answer: 'A', explanation: '对话关键词：a latte, please。' },
  { stem: '[音频] Where does the conversation take place?', options: ['In a library', 'In a gym', 'At an airport', 'At a cinema'], answer: 'A', explanation: '关键词：borrow / return books。' },
  { stem: '[音频] When will the train leave?', options: ['At 9:15', 'At 9:50', 'At 8:15', 'At 10:15'], answer: 'A', explanation: '时间题：nine fifteen。' },
  { stem: '[音频] Why is the man late?', options: ['The bus broke down', 'He overslept', 'It rained heavily', 'He lost his keys'], answer: 'A', explanation: '因果题：bus broke down。' },
  { stem: '[音频] What does the man suggest doing?', options: ['Walking to the office', 'Taking a taxi', 'Calling a friend', 'Waiting an hour'], answer: 'A', explanation: '建议句型：Why not walk...。' },
  { stem: '[音频] How much will the woman pay?', options: ['Twenty dollars', 'Twelve dollars', 'Thirty dollars', 'Two dollars'], answer: 'A', explanation: '数字题：twenty dollars。' },
  { stem: '[音频] What is the weather like today?', options: ['Sunny', 'Snowy', 'Windy', 'Foggy'], answer: 'A', explanation: '场景题：clear sky。' },
  { stem: '[音频] What did the woman forget?', options: ['Her umbrella', 'Her ticket', 'Her bag', 'Her phone'], answer: 'A', explanation: '细节题：left my umbrella。' },
  { stem: '[音频] Who is the speaker probably talking to?', options: ['New students', 'Tour guides', 'Hotel staff', 'Bus drivers'], answer: 'A', explanation: '听众推断：orientation 相关表达。' },
  { stem: '[音频] What will the man do next?', options: ['Fill in a form', 'Leave the office', 'Make a call', 'Send an email'], answer: 'A', explanation: '行为推断：fill out this form。' },
  { stem: '[音频] Where are the speakers?', options: ['In a restaurant', 'In a bank', 'In a hospital', 'In a shop'], answer: 'A', explanation: '场景词：order / menu。' },
  { stem: '[音频] What problem does the woman have?', options: ['She missed the deadline', 'She lost her job', 'She failed the exam', 'She missed the bus'], answer: 'A', explanation: '问题题：missed the deadline。' },
  { stem: '[音频] What does the man think of the film?', options: ['It is exciting', 'It is boring', 'It is too long', 'It is scary'], answer: 'A', explanation: '态度题：really exciting。' },
  { stem: '[音频] How often does the woman exercise?', options: ['Twice a week', 'Every day', 'Once a month', 'Never'], answer: 'A', explanation: '频率题：twice a week。' },
  { stem: '[音频] What time does the store close?', options: ['At 8 pm', 'At 9 pm', 'At 7 pm', 'At 10 pm'], answer: 'A', explanation: '时间题：closes at eight。' },
  { stem: '[音频] Why does the woman call the man?', options: ['To reschedule a meeting', 'To book a ticket', 'To ask for leave', 'To return a call'], answer: 'A', explanation: '目的题：move our meeting。' },
  { stem: '[音频] What is the man\'s job?', options: ['A waiter', 'A teacher', 'A doctor', 'A driver'], answer: 'A', explanation: '职业推断：take your order。' },
  { stem: '[音频] What does the woman mean?', options: ['She agrees with the man', 'She disagrees strongly', 'She is unsure', 'She is angry'], answer: 'A', explanation: '语义题：Exactly / I couldn\'t agree more。' },
  { stem: '[音频] What are the speakers mainly discussing?', options: ['A weekend plan', 'A history exam', 'A new manager', 'A sports match'], answer: 'A', explanation: '主旨题：weekend / hiking。' },
  { stem: '[音频] What does the man offer to do?', options: ['Help carry the boxes', 'Lend money', 'Fix the car', 'Cook dinner'], answer: 'A', explanation: '提供帮助：Let me give you a hand。' },
]

/** 8 套专项卷（4 类 × 2），每卷 20 题 = 160 题 */
function buildPapers(): SeedPaper[] {
  const defs: ReadonlyArray<{
    id: string
    title: string
    examType: ExamType
    section: ExamSection
    difficulty: Difficulty
    items: ReadonlyArray<{ stem: string; options: [string, string, string, string]; answer: string; explanation: string }>
  }> = [
    { id: 'pe-1', title: '听力专项 · 日常对话（基础）', examType: 'CET4', section: 'LISTENING', difficulty: 'EASY', items: LISTENING_ITEMS },
    { id: 'pe-2', title: '听力专项 · 短文理解（进阶）', examType: 'CET4', section: 'LISTENING', difficulty: 'MEDIUM', items: LISTENING_ITEMS },
    { id: 'pe-3', title: '阅读专项 · 细节理解（基础）', examType: 'CET4', section: 'READING', difficulty: 'EASY', items: READING_ITEMS },
    { id: 'pe-4', title: '阅读专项 · 主旨推断（进阶）', examType: 'CET6', section: 'READING', difficulty: 'HARD', items: READING_ITEMS },
    { id: 'pe-5', title: '语法专项 · 时态与语态', examType: 'CET4', section: 'GRAMMAR', difficulty: 'EASY', items: GRAMMAR_ITEMS },
    { id: 'pe-6', title: '语法专项 · 从句与倒装', examType: 'CET6', section: 'GRAMMAR', difficulty: 'HARD', items: GRAMMAR_ITEMS },
    { id: 'pe-7', title: '词汇专项 · 高频词义（基础）', examType: 'CET4', section: 'VOCAB', difficulty: 'EASY', items: VOCAB_ITEMS },
    { id: 'pe-8', title: '词汇专项 · 同义反义（进阶）', examType: 'CET6', section: 'VOCAB', difficulty: 'MEDIUM', items: VOCAB_ITEMS },
  ]

  return defs.map((d) => ({
    id: d.id,
    title: d.title,
    examType: d.examType,
    section: d.section,
    difficulty: d.difficulty,
    description: `专项训练卷（${d.section} 类，20 题）。**专项训练，非 CET 全真模考**：仅覆盖单类能力，成绩不代表 710 分制水平。`,
    durationMin: 30,
    questions: d.items.map((item, i) => ({
      section: d.section,
      type: 'SINGLE_CHOICE' as QuestionType,
      stem: item.stem,
      options: item.options,
      answer: item.answer,
      explanation: item.explanation,
      score: 5,
    })),
  }))
}

/** 专项卷 seed：paper upsert + 题目先删后插（题量/内容调整可重放） */
export async function seedExamsP2(): Promise<number> {
  const papers = buildPapers()
  let questionCount = 0

  for (const paper of papers) {
    await prisma.examPaper.upsert({
      where: { id: paper.id },
      update: {
        title: paper.title,
        examType: paper.examType,
        durationMin: paper.durationMin,
        description: paper.description,
        structure: {
          sections: [{ section: paper.section, title: paper.title, questionCount: paper.questions.length }],
        } as unknown as import('@prisma/client').Prisma.InputJsonValue,
        isRealPast: false, // 专项卷非真题
      },
      create: {
        id: paper.id,
        title: paper.title,
        examType: paper.examType,
        durationMin: paper.durationMin,
        description: paper.description,
        structure: {
          sections: [{ section: paper.section, title: paper.title, questionCount: paper.questions.length }],
        } as unknown as import('@prisma/client').Prisma.InputJsonValue,
        isRealPast: false,
        status: 'PUBLISHED',
        createdBy: 'seed',
      },
    })

    // 题目先删后插（paperId 外键 cascade）
    await prisma.examQuestion.deleteMany({ where: { paperId: paper.id } })
    await prisma.examQuestion.createMany({
      data: paper.questions.map((q, i) => ({
        paperId: paper.id,
        section: q.section,
        type: q.type,
        stem: q.stem,
        options: q.options as unknown as import('@prisma/client').Prisma.InputJsonValue,
        answer: q.answer,
        explanation: q.explanation,
        score: q.score,
        sortOrder: i,
        needsAiGrading: false, // 仅客观题（验收 1：不含写作翻译主观题）
      })),
    })
    questionCount += paper.questions.length
  }

  log(`exams-p2: ${papers.length} papers (+${questionCount} questions, objective only)`)
  return papers.length
}
