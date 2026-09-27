/**
 * 一次性生成 `prisma/data/placement-questions.csv`（60 题，CAT 分档数据源）。
 * 维度占比（架构 §11.1-Q9）：词汇 30% / 语法 30% / 阅读 25% / 听力 15%
 * → 18 词汇 + 18 语法 + 15 阅读 + 9 听力。
 * 重跑本脚本会覆盖 CSV：`npx tsx scripts/gen-placement-questions.ts`。
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'prisma', 'data', 'placement-questions.csv')

type Dimension = 'vocabulary' | 'grammar' | 'reading' | 'listening'
type QType =
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_BLANK'
  | 'CLOZE'
  | 'SHORT_ANSWER'

interface PlacementQuestion {
  type: QType
  dimension: Dimension
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  stem: string
  options: string[]
  answer: string
  explanation: string
  knowledgePoints: string[]
  passage?: string
}

const q = (
  type: QType,
  dimension: Dimension,
  difficulty: PlacementQuestion['difficulty'],
  stem: string,
  options: string[],
  answer: string,
  explanation: string,
  knowledgePoints: string[],
  passage?: string,
): PlacementQuestion => ({ type, dimension, difficulty, stem, options, answer, explanation, knowledgePoints, passage })

const QUESTIONS: PlacementQuestion[] = [
  // ---------------------------------------------------------------- 词汇 18
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'Choose the word closest in meaning to "abandon".', ['leave completely', 'keep safely', 'hide quickly', 'buy again'], 'A', 'abandon = to leave completely / give up.', ['synonym-verb']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The word "frequent" most nearly means ______.', ['common', 'expensive', 'foreign', 'quiet'], 'A', 'frequent 意为「频繁的」，与 common 最接近。', ['synonym-adj']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'He ______ his keys on the desk and left.', ['laid', 'lied', 'lain', 'laying'], 'A', 'lay(放)-laid-laid；lie(说谎)不合语义。', ['confusable-verb']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'Which word is a synonym of "sufficient"?', ['enough', 'empty', 'difficult', 'strange'], 'A', 'sufficient = enough（充足的）。', ['synonym-adj']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'She was ______ that she had passed the exam.', ['delighted', 'delighting', 'delight', 'delights'], 'A', '以 -ed 结尾的形容词表示「人感到…」。', ['participle-adj']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The opposite of "scarce" is ______.', ['abundant', 'rare', 'absent', 'little'], 'A', 'scarce(稀缺) ↔ abundant(丰富)。', ['antonym-adj']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'He ______ a cold last week and stayed in bed.', ['caught', 'took', 'received', 'accepted'], 'A', 'catch a cold 为固定搭配。', ['collocation']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The word "temporary" is closest in meaning to ______.', ['short-term', 'permanent', 'final', 'strong'], 'A', 'temporary = 短期的、暂时的。', ['synonym-adj']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'I cannot ______ why he refused such a good offer.', ['figure out', 'figure up', 'figure on', 'figure in'], 'A', 'figure out = 理解、想明白。', ['phrasal-verb']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The company decided to ______ its business to Asia.', ['expand', 'expend', 'expect', 'extend on'], 'A', 'expand business = 扩张业务；expend 意为花费。', ['confusable-verb']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'A person who studies the stars is called a(n) ______.', ['astronomer', 'geologist', 'biologist', 'economist'], 'A', 'astronomer = 天文学家。', ['word-meaning']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'Please ______ attention to the warning sign.', ['pay', 'give', 'make', 'take'], 'A', 'pay attention to 为固定搭配。', ['collocation']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The word "reliable" most nearly means ______.', ['dependable', 'beautiful', 'nervous', 'lazy'], 'A', 'reliable = 可靠的。', ['synonym-adj']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'He was so tired that he could hardly keep his eyes ______.', ['open', 'opened', 'opening', 'to open'], 'A', 'keep + 宾语 + 形容词，表状态。', ['verb-pattern']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The noun form of "decide" is ______.', ['decision', 'decisive', 'deciding', 'decidedly'], 'A', 'decide → decision（名词）。', ['word-formation']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'Which collocation is correct?', ['heavy rain', 'strong rain', 'big rain', 'great rain'], 'A', '英语中「大雨」用 heavy rain。', ['collocation']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'The word "postpone" means ______.', ['delay', 'cancel', 'finish', 'refuse'], 'A', 'postpone = 推迟。', ['synonym-verb']),
  q('SINGLE_CHOICE', 'vocabulary', 'EASY', 'She spoke in a ______ voice so that nobody else could hear.', ['low', 'slow', 'small', 'weak'], 'A', 'a low voice = 低声。', ['collocation']),

  // ---------------------------------------------------------------- 语法 18
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'She ______ to school every day before she got a bike.', ['walked', 'walks', 'is walking', 'has walked'], 'A', 'before 从句表过去习惯，用一般过去时。', ['tense-past-simple']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'By the time we arrived, the movie ______.', ['had already started', 'already started', 'has already started', 'was already start'], 'A', 'by the time + 过去时，主句用过去完成时。', ['tense-past-perfect']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'Neither the students nor the teacher ______ aware of the change.', ['was', 'were', 'are', 'have been'], 'A', 'neither…nor 就近原则，谓语随 the teacher（单数）。', ['subject-verb-agreement']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'If I ______ you, I would take the job.', ['were', 'was', 'am', 'be'], 'A', '与现在事实相反的虚拟语气：If I were you。', ['subjunctive']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'The book ______ I borrowed yesterday is very interesting.', ['that', 'who', 'whose', 'what'], 'A', '先行词为物，关系代词用 that/which。', ['relative-clause']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'He denied ______ the money.', ['taking', 'to take', 'take', 'taken'], 'A', 'deny 后接动名词：deny doing。', ['non-finite-gerund']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', '______ hard, you will pass the exam.', ['Working', 'Worked', 'If work', 'To working'], 'A', '现在分词作条件状语，逻辑主语与主句一致(you)。', ['non-finite-participle']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'Hardly ______ the station when the train left.', ['had we reached', 'we had reached', 'did we reached', 'we reached'], 'A', 'hardly…when 引导部分倒装，且用过去完成时。', ['inversion']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'It was in 2008 ______ the Olympic Games were held in Beijing.', ['that', 'which', 'when', 'then'], 'A', '强调句型 It is/was + 被强调部分 + that…。', ['cleft-sentence']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'The room needs ______ before the guests arrive.', ['cleaning', 'to cleaning', 'clean', 'cleaned'], 'A', 'need doing = need to be done（主动表被动）。', ['verb-pattern']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'She suggested that he ______ a doctor as soon as possible.', ['see', 'saw', 'sees', 'would see'], 'A', 'suggest 后的宾语从句用 (should) + 动词原形。', ['subjunctive-subjunctive-that']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'I would rather you ______ anything about it for the time being.', ['did not say', 'do not say', 'did not said', 'will not say'], 'A', 'would rather + 从句用过去式表虚拟。', ['subjunctive-would-rather']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'The number of students in this school ______ increasing.', ['is', 'are', 'has', 'were'], 'A', 'the number of + 复数名词作主语，谓语用单数。', ['subject-verb-agreement']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'This is the house ______ roof was damaged in the storm.', ['whose', 'which', 'that', 'what'], 'A', 'whose + 名词 = 关系词所有格。', ['relative-clause']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'No sooner ______ home than it began to rain.', ['had I got', 'I had got', 'did I got', 'I got'], 'A', 'no sooner…than 用部分倒装 + 过去完成时。', ['inversion']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'He is used to ______ up early in the morning.', ['getting', 'get', 'got', 'gets'], 'A', 'be used to + doing（习惯于）。', ['verb-pattern']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'The teacher spoke slowly ______ the students might understand her.', ['so that', 'in case', 'unless', 'as if'], 'A', 'so that 引导目的状语从句。', ['adverbial-clause']),
  q('SINGLE_CHOICE', 'grammar', 'EASY', 'If it ______ tomorrow, we will cancel the picnic.', ['rains', 'will rain', 'rained', 'would rain'], 'A', '真实条件句：主句将来时，if 从句用一般现在时。', ['conditional-real']),

  // ---------------------------------------------------------------- 阅读 15（短段落）
  q('SINGLE_CHOICE', 'reading', 'EASY', 'Why did Tom go to the library?', ['To return a book and borrow two others', 'To meet his teacher', 'To buy a dictionary', 'To attend a class'], 'A', '首句点明目的：还一本旧书、借两本小说。', ['detail'], 'Tom went to the library to return an old book and borrow two novels for the weekend. He also wanted to check when the reading club meets.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'What is the main idea of the passage?', ['Regular exercise improves both mood and sleep', 'Exercise is dangerous for health', 'Sleep has no effect on mood', 'Only running is useful'], 'A', '全段围绕「规律运动改善情绪与睡眠」展开。', ['main-idea'], 'Regular exercise is one of the best ways to stay healthy. It not only strengthens the heart but also improves mood and sleep quality. Even thirty minutes of walking a day can make a difference.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'The word "estimated" in the passage is closest in meaning to ______.', ['calculated roughly', 'proved exactly', 'denied', 'doubled'], 'A', 'estimated = 粗略估算。', ['vocabulary-in-context'], 'Scientists estimated that the new bridge will carry more than 50,000 vehicles every day once it opens next year.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'According to the passage, what is TRUE about the museum?', ['It is closed on Mondays', 'It is free every day', 'It opens at midnight', 'It has no guide service'], 'A', '原文明确说明周一闭馆。', ['detail'], 'The city museum is open from Tuesday to Sunday. It is closed on Mondays. Tickets cost ten yuan, but students pay half price. Free guides are available at the entrance.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'What can be inferred about the writer?', ['He thinks short trips are worth taking', 'He dislikes travelling', 'He never travels by train', 'He prefers to stay at home'], 'A', '从结尾「值得抽空一试」可推断作者认可短途旅行。', ['inference'], 'Last month I took a three-day trip to a small town by the sea. The food was simple but fresh, and the people were friendly. Although the town is small, I think short trips like this are worth taking whenever you have time.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'The passage mainly discusses ______.', ['how to manage study time', 'how to choose a school', 'why exams are useless', 'how to make friends'], 'A', '全段给出三个时间管理建议。', ['main-idea'], 'Many students find it hard to balance study and rest. One useful method is to make a daily plan and follow it strictly. Another is to study in short periods with short breaks. Finally, getting enough sleep helps the brain remember what you have learned.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'Which statement best describes the purpose of the notice?', ['To announce a change in office hours', 'To invite people to a party', 'To sell old furniture', 'To report a fire'], 'A', '通知的核心是营业时间调整。', ['detail'], 'NOTICE: Due to system maintenance, our service office will close at 4 p.m. this Friday instead of 6 p.m. We apologize for any inconvenience caused.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'The word "convenient" in the passage means ______.', ['easy to use', 'very expensive', 'hard to find', 'rather old'], 'A', 'convenient = 方便的。', ['vocabulary-in-context'], 'The new metro line makes travelling across the city much more convenient. It takes only twenty minutes to reach the airport, which used to take over an hour by bus.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'Why does the writer mention bees?', ['To show how important small creatures are to nature', 'To explain how honey is made', 'To describe a holiday', 'To sell bee products'], 'A', '举蜜蜂为例是论证「小生物对自然很重要」。', ['rhetorical-purpose'], 'Many people think small creatures are not important. However, bees pollinate a large part of the crops we eat every day. Without them, our food supply would be seriously affected.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'What does the writer suggest doing first when learning a language?', ['Learning common words by heart', 'Reading long novels', 'Travelling abroad', 'Watching films only'], 'A', '原文首句建议先掌握常用词。', ['detail'], 'Learning a new language takes time. Experts suggest starting with the most common words, because they appear in almost every conversation. Listening a little every day also helps the ear get used to new sounds.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'The tone of the passage is best described as ______.', ['informative and encouraging', 'angry', 'humorous', 'sad'], 'A', '作者客观介绍并提出鼓励性建议。', ['tone'], 'Volunteering is a good way to learn new skills and meet people. You do not need special training to start. Many organisations offer short courses for beginners, and most volunteers say the experience makes them feel useful and confident.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'Which of the following is NOT mentioned in the passage?', ['The price of the tickets', 'The opening date', 'The name of the theatre', 'The phone number'], 'A', '文中未提及电话号码。', ['detail'], 'The school theatre will reopen on 5 May after two months of repair. Tickets for the opening show cost twenty yuan. Students can buy them at the front desk.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'The word "reduce" in the passage is closest in meaning to ______.', ['cut down', 'increase', 'collect', 'replace'], 'A', 'reduce = cut down（减少）。', ['vocabulary-in-context'], 'Doctors advise people to reduce the amount of sugar in their diet. Eating less sugar can lower the risk of heart disease and help control weight.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'What is the relationship between the two speakers implied by the email?', ['Manager and employee', 'Mother and son', 'Strangers', 'Teacher and parent'], 'A', '邮件中提到「按您上次会议的要求」，可推断为经理与员工。', ['inference'], 'Dear Mr. Li, I have finished the report you asked for at our last meeting. Please let me know if any part needs changing. Best regards, Wang Fang.'),
  q('SINGLE_CHOICE', 'reading', 'EASY', 'The best title for the passage is ______.', ['Why Cities Need Trees', 'How to Plant a Tree', 'The History of Parks', 'Animals in the Forest'], 'A', '全段论述城市中树木的作用。', ['main-idea'], 'Trees make cities cooler and cleaner. They give shade in summer, absorb noise, and provide homes for birds. Many cities now plant more trees along streets to make life more comfortable for their people.'),

  // ---------------------------------------------------------------- 听力 9（transcript 由 TTS 生成音频）
  q('SINGLE_CHOICE', 'listening', 'EASY', 'What time does the train leave?', ['At a quarter past nine', 'At nine o\'clock', 'At half past eight', 'At ten o\'clock'], 'A', '对话中明确说 9:15。', ['detail'], 'W: Excuse me, could you tell me when the next train to London leaves? M: Sure. It leaves at a quarter past nine from Platform 3.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'Where does the conversation probably take place?', ['In a restaurant', 'In a library', 'At an airport', 'In a hospital'], 'A', '「点菜、牛排几分熟」指向餐厅。', ['scene-inference'], 'W: Good evening. Are you ready to order? M: Yes, I\'d like the steak, please. W: How would you like it cooked? M: Medium, please.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'What did the man forget to bring?', ['His umbrella', 'His wallet', 'His ticket', 'His phone'], 'A', '对话中说「又忘了带伞」。', ['detail'], 'M: Oh no, it\'s raining hard and I forgot my umbrella again. W: Don\'t worry. I have two. You can use one.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'How much should the woman pay?', ['Fifteen yuan', 'Fifty yuan', 'Five yuan', 'Forty-five yuan'], 'A', '两杯咖啡 10 元 + 一块蛋糕 5 元 = 15 元。', ['calculation'], 'M: Two cups of coffee and one piece of cake, please. W: That\'s ten yuan for the coffee and five yuan for the cake.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'What will the woman do next?', ['Visit the museum', 'Go home', 'Buy a ticket', 'Meet a friend'], 'A', '她打算「directly to the museum」。', ['detail'], 'M: The museum is free today. Would you like to go? W: Yes! Let\'s finish lunch quickly and go there directly.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'Why is the man late?', ['The bus was delayed', 'He overslept', 'He lost his keys', 'He missed the train'], 'A', '他解释「bus broke down / was delayed」。', ['cause-inference'], 'W: Why are you so late? M: I\'m sorry. The bus I took broke down halfway, so I had to wait for another one.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'What does the woman advise the man to do?', ['Take some rest', 'See a doctor at once', 'Drink more coffee', 'Go back to work'], 'A', '建议「have a good rest tonight」。', ['suggestion'], 'M: I feel tired these days because I work until midnight. W: You really should take some rest. Why not have a good sleep tonight?'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'Which subject does the man like best?', ['History', 'Maths', 'English', 'Physics'], 'A', '他明确说「History is my favourite」。', ['detail'], 'W: Which subject do you like best at school? M: History is my favourite, though I\'m also quite good at maths.'),
  q('SINGLE_CHOICE', 'listening', 'EASY', 'What are the speakers mainly talking about?', ['A weekend plan', 'A new job', 'A school exam', 'A broken car'], 'A', '两人围绕周末去爬山展开。', ['main-idea'], 'M: What are you doing this weekend? W: Nothing special. M: Let\'s go hiking in the mountains then. The weather report says it will be sunny.'),
]

const csvEscape = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const HEADER =
  'type,category,difficulty,examType,stem,options,answer,explanation,knowledgePoints,dimension,material'

const rows = QUESTIONS.map((item) => {
  const material = item.passage
    ? JSON.stringify({ passage: item.passage, tts: true })
    : ''
  return [
    item.type,
    'placement',
    item.difficulty,
    'PLACEMENT',
    csvEscape(item.stem),
    csvEscape(JSON.stringify(item.options)),
    item.answer,
    csvEscape(item.explanation),
    csvEscape(JSON.stringify(item.knowledgePoints)),
    item.dimension,
    material ? csvEscape(material) : '',
  ].join(',')
})

fs.mkdirSync(path.dirname(OUT), { recursive: true })
const content = `${HEADER}\n${rows.join('\n')}\n`
fs.writeFileSync(OUT, content, 'utf8')
const counts = QUESTIONS.reduce<Record<string, number>>((acc, item) => {
  acc[item.dimension] = (acc[item.dimension] ?? 0) + 1
  return acc
}, {})
process.stdout.write(
  `[gen-placement] wrote ${rows.length} questions → ${path.relative(ROOT, OUT)}\n` +
    `[gen-placement] ${JSON.stringify(counts)}\n`,
)
