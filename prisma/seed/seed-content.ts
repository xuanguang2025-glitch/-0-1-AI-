/**
 * Seed · 内容域：听力 20 篇 / 阅读 60 篇 / 语法 14 类 / 写作任务 30 个。
 * 幂等策略：slug / title + type 组合唯一 → upsert。
 */
import path from 'path'

import { prisma } from '@/lib/db'

import { chunk, DATA_DIR, log, readCsv, warn } from './shared'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

// ============================================================ 听力 20 篇
interface ListeningSeed {
  title: string
  category: string
  difficulty: Difficulty
  cefr: 'A2' | 'B1' | 'B2'
  lines: Array<{ en: string; zh: string }>
  question: { stem: string; options: string[]; answer: string; explanation: string }
}

const LISTENING: ListeningSeed[] = [
  { title: 'Ordering Coffee at a Café', category: 'daily', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'Good morning. What can I get for you today?', zh: '早上好，请问您要来点什么？' },
    { en: 'I would like a latte with less sugar, please.', zh: '我想要一杯少糖的拿铁。' },
    { en: 'Sure. Would you like something to eat with that?', zh: '好的，需要搭配点吃的吗？' },
    { en: 'A butter croissant sounds perfect. Thank you.', zh: '一个黄油牛角包就再好不过了，谢谢。' },
  ], question: { stem: 'What does the customer order?', options: ['A latte and a croissant', 'Black coffee and bread', 'Tea and a cake', 'Juice and a sandwich'], answer: 'A', explanation: '顾客点了少糖拿铁与黄油牛角包。' } },
  { title: 'Asking for Directions on Campus', category: 'campus', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'Excuse me, how can I get to the science building?', zh: '打扰一下，请问怎么去理科楼？' },
    { en: 'Go straight along this path and turn left at the library.', zh: '沿这条路直走，在图书馆处左转。' },
    { en: 'Is it far from here?', zh: '离这里远吗？' },
    { en: 'About ten minutes on foot. You cannot miss it.', zh: '步行大约十分钟，你不会错过的。' },
  ], question: { stem: 'How long does it take to walk there?', options: ['About ten minutes', 'About thirty minutes', 'Two minutes', 'An hour'], answer: 'A', explanation: '对方说明步行约十分钟。' } },
  { title: 'Booking a Hotel Room by Phone', category: 'travel', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'Hello, I would like to book a double room for two nights.', zh: '你好，我想订一间双人房，住两晚。' },
    { en: 'Certainly. For which dates?', zh: '好的，请问哪两天？' },
    { en: 'From the twelfth to the fourteenth of July.', zh: '7 月 12 日到 14 日。' },
    { en: 'That is available. The price is 380 yuan per night including breakfast.', zh: '有房，每晚 380 元含早餐。' },
  ], question: { stem: 'How much is the room per night?', options: ['380 yuan', '760 yuan', '300 yuan', '140 yuan'], answer: 'A', explanation: '每晚 380 元（两晚共 760 元是总价）。' } },
  { title: 'A Job Interview Introduction', category: 'business', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'Could you briefly introduce yourself and your experience?', zh: '请简单介绍一下自己和你的经验。' },
    { en: 'I graduated in marketing and worked three years at an advertising agency.', zh: '我毕业于市场营销专业，在一家广告公司工作了三年。' },
    { en: 'What do you consider your greatest strength?', zh: '你认为自己最大的优势是什么？' },
    { en: 'I stay calm under pressure and always meet deadlines.', zh: '我在压力下保持冷静，并且总能按时交付。' },
  ], question: { stem: 'What is the candidate\'s greatest strength?', options: ['Staying calm and meeting deadlines', 'Speaking many languages', 'Designing logos', 'Writing code'], answer: 'A', explanation: '应聘者自述的优势是抗压与守时。' } },
  { title: 'Weather Forecast for the Weekend', category: 'news', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'Here is the weekend forecast for our region.', zh: '现在播报本地区周末天气。' },
    { en: 'Saturday will be sunny with a high of twenty-six degrees.', zh: '周六晴天，最高 26 度。' },
    { en: 'Clouds will move in on Sunday with light rain in the afternoon.', zh: '周日转阴，下午有小雨。' },
    { en: 'Temperatures will drop to eighteen degrees by evening.', zh: '傍晚气温将降到 18 度。' },
  ], question: { stem: 'What is expected on Sunday afternoon?', options: ['Light rain', 'Heavy snow', 'Strong sunshine', 'High wind'], answer: 'A', explanation: '预报说明日下午有小雨。' } },
  { title: 'Talking About a Movie', category: 'daily', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'Have you seen the new science fiction film?', zh: '你看过那部新的科幻电影吗？' },
    { en: 'Yes, last night. The special effects were amazing.', zh: '看过，昨晚看的，特效特别棒。' },
    { en: 'How was the story?', zh: '故事怎么样？' },
    { en: 'A little slow at the beginning, but the ending was worth it.', zh: '开头有点慢，但结局很值得。' },
  ], question: { stem: 'What did the speaker think of the ending?', options: ['It was worth it', 'It was boring', 'It was confusing', 'It was too short'], answer: 'A', explanation: '「结局很值得」说明评价正面。' } },
  { title: 'At the Airport Check-in Desk', category: 'travel', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'May I see your passport and ticket, please?', zh: '请出示您的护照和机票。' },
    { en: 'Here you are. I have one suitcase to check in.', zh: '给您，我有一件行李要托运。' },
    { en: 'It is two kilograms over the limit, so there is an extra fee.', zh: '超重两公斤，需要额外收费。' },
    { en: 'That is fine. Which gate does the flight leave from?', zh: '没关系，航班在几号登机口？' },
  ], question: { stem: 'Why does the passenger pay an extra fee?', options: ['The suitcase is overweight', 'The ticket was refunded', 'The flight is delayed', 'The seat was upgraded'], answer: 'A', explanation: '行李超重两公斤。' } },
  { title: 'Discussing a Group Project', category: 'campus', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'We need to finish the presentation by Friday.', zh: '我们必须在周五前完成演示。' },
    { en: 'I can prepare the slides if you collect the data.', zh: '如果你收集数据，我来做幻灯片。' },
    { en: 'Deal. Let us meet on Thursday evening to practise.', zh: '成交，周四晚上排练一遍。' },
    { en: 'Perfect. I will book a study room in the library.', zh: '好，我去图书馆订一间研讨室。' },
  ], question: { stem: 'What will the speakers do on Thursday evening?', options: ['Practise the presentation', 'Hand in the report', 'Have dinner', 'Collect data'], answer: 'A', explanation: '约定周四晚上排练。' } },
  { title: 'A Doctor\'s Appointment', category: 'daily', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'What seems to be the problem today?', zh: '今天哪里不舒服？' },
    { en: 'I have had a sore throat and a headache for three days.', zh: '我嗓子疼、头疼已经三天了。' },
    { en: 'Any fever? Let me check your temperature.', zh: '发烧吗？我量一下体温。' },
    { en: 'It is a slight fever. Take this medicine twice a day and rest well.', zh: '有点低烧。这药一天服两次，好好休息。' },
  ], question: { stem: 'How long has the patient felt unwell?', options: ['Three days', 'Three weeks', 'One day', 'One month'], answer: 'A', explanation: '病人自述三天。' } },
  { title: 'Shopping for a Birthday Gift', category: 'daily', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'I am looking for a birthday gift for my sister.', zh: '我在给我妹妹挑生日礼物。' },
    { en: 'How about this blue scarf? It is very popular this season.', zh: '这条蓝色围巾怎么样？这季很流行。' },
    { en: 'It looks lovely. How much is it?', zh: '很好看，多少钱？' },
    { en: 'Ninety-nine yuan, and gift wrapping is free.', zh: '99 元，包装免费。' },
  ], question: { stem: 'What is the price of the scarf?', options: ['99 yuan', '199 yuan', '59 yuan', '90 yuan'], answer: 'A', explanation: '售货员报价 99 元。' } },
  { title: 'A Radio Report on Recycling', category: 'news', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'Our city has started a new recycling programme this month.', zh: '本市本月启动了新的回收计划。' },
    { en: 'Residents are asked to separate paper, plastic and glass at home.', zh: '居民需在家把纸张、塑料和玻璃分开。' },
    { en: 'Special bins will appear in every neighbourhood next week.', zh: '下周起每个小区都会设置专用垃圾桶。' },
    { en: 'Officials hope the programme will reduce waste by one third.', zh: '官方希望该计划能减少三分之一的垃圾。' },
  ], question: { stem: 'What is the goal of the programme?', options: ['To reduce waste by one third', 'To build new factories', 'To sell more plastic', 'To close all shops'], answer: 'A', explanation: '目标是减少三分之一的垃圾。' } },
  { title: 'Introducing a Colleague at Work', category: 'business', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'Everyone, this is Anna, our new designer.', zh: '各位，这是我们的新设计师安娜。' },
    { en: 'Nice to meet you all. I just moved here from Hamburg.', zh: '很高兴认识大家，我刚从汉堡搬来。' },
    { en: 'Welcome! If you need anything, just ask.', zh: '欢迎！有什么需要尽管说。' },
    { en: 'Thank you. I am looking forward to working with you.', zh: '谢谢，期待与大家共事。' },
  ], question: { stem: 'What is Anna\'s job?', options: ['Designer', 'Manager', 'Accountant', 'Teacher'], answer: 'A', explanation: '介绍中说她是设计师。' } },
  { title: 'Making Plans for a Trip', category: 'travel', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'Shall we take the early train to the coast?', zh: '我们坐早班车去海边怎么样？' },
    { en: 'Good idea. We can rent bikes there and ride along the beach.', zh: '好主意，到那边可以租自行车沿海边骑。' },
    { en: 'Do we need to book the hotel in advance?', zh: '旅馆需要提前订吗？' },
    { en: 'Yes, it is the busy season, so let us book tonight.', zh: '要的，现在是旺季，今晚就订吧。' },
  ], question: { stem: 'Why do they need to book the hotel tonight?', options: ['It is the busy season', 'The hotel is closing', 'Trains are full', 'Prices will drop'], answer: 'A', explanation: '因为是旅游旺季。' } },
  { title: 'A Conversation About Hobbies', category: 'daily', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'What do you usually do in your free time?', zh: '你空闲时通常做什么？' },
    { en: 'I love photography. I take pictures of old buildings.', zh: '我喜欢摄影，专门拍老建筑。' },
    { en: 'That is interesting. Do you share your photos online?', zh: '有意思，你会把照片分享到网上吗？' },
    { en: 'Yes, I post them once a week.', zh: '是的，我每周发一次。' },
  ], question: { stem: 'What does the man photograph?', options: ['Old buildings', 'Wild animals', 'Food', 'Sports events'], answer: 'A', explanation: '他专拍老建筑。' } },
  { title: 'Customer Service: A Broken Phone', category: 'business', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'My phone screen stopped working after the update.', zh: '升级之后手机屏幕就不能用了。' },
    { en: 'I am sorry to hear that. Is the device still under warranty?', zh: '很抱歉，设备还在保修期内吗？' },
    { en: 'Yes, I bought it two months ago.', zh: '在的，两个月前买的。' },
    { en: 'Then we can repair it free of charge within five working days.', zh: '那我们可以在五个工作日内免费维修。' },
  ], question: { stem: 'What does the service offer?', options: ['Free repair within five working days', 'A full refund', 'A new phone case', 'Paid repair only'], answer: 'A', explanation: '保修期内免费维修。' } },
  { title: 'A Lecture Introduction: The Water Cycle', category: 'campus', difficulty: 'HARD', cefr: 'B2', lines: [
    { en: 'Today we will look at how water moves around our planet.', zh: '今天我们来看水如何在地球上循环。' },
    { en: 'The sun heats the ocean, and water evaporates into the air.', zh: '太阳加热海洋，水蒸发到空气中。' },
    { en: 'Higher up, the vapour cools and forms clouds.', zh: '在高处，水汽冷却形成云。' },
    { en: 'Finally, precipitation returns the water to the land and sea.', zh: '最后，降水把水送回陆地和海洋。' },
  ], question: { stem: 'What forms clouds in the passage?', options: ['Cooling water vapour', 'Burning fuel', 'Melting ice', 'Growing plants'], answer: 'A', explanation: '水汽冷却形成云。' } },
  { title: 'News: A New City Park Opens', category: 'news', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'The largest park in the city opened to the public yesterday.', zh: '全市最大的公园昨天向公众开放。' },
    { en: 'It covers sixty hectares and includes three small lakes.', zh: '占地 60 公顷，包含三个小湖。' },
    { en: 'Entry is free during the first month.', zh: '首月免费入园。' },
    { en: 'City officials expect more than ten thousand visitors each weekend.', zh: '市政官员预计每个周末游客超过一万人。' },
  ], question: { stem: 'How large is the new park?', options: ['Sixty hectares', 'Sixteen hectares', 'Six hectares', 'Six hundred hectares'], answer: 'A', explanation: '占地 60 公顷。' } },
  { title: 'Talking About Weekend Study Plans', category: 'campus', difficulty: 'EASY', cefr: 'A2', lines: [
    { en: 'Are you studying this weekend?', zh: '你这周末要学习吗？' },
    { en: 'Yes, I have an English test on Monday.', zh: '是的，我周一有英语考试。' },
    { en: 'Shall we revise together on Saturday morning?', zh: '周六上午一起复习怎么样？' },
    { en: 'Great idea. Let us meet at the study room at nine.', zh: '好主意，九点在自习室见。' },
  ], question: { stem: 'When will they meet?', options: ['Saturday at nine', 'Sunday at nine', 'Monday at nine', 'Friday at nine'], answer: 'A', explanation: '约在周六九点。' } },
  { title: 'A Business Call About an Order', category: 'business', difficulty: 'HARD', cefr: 'B2', lines: [
    { en: 'I am calling to confirm the shipment of five hundred units.', zh: '我打电话确认 500 件货的发货。' },
    { en: 'They will leave our factory on Tuesday and arrive in four days.', zh: '货物周二出厂，四天后到达。' },
    { en: 'Could you send the invoice by email today?', zh: '今天能把发票发到邮箱吗？' },
    { en: 'Of course. Payment is due within thirty days as agreed.', zh: '当然，按约定 30 天内付款。' },
  ], question: { stem: 'When will the goods arrive?', options: ['Four days after Tuesday', 'Four days before Tuesday', 'On Tuesday', 'In thirty days'], answer: 'A', explanation: '周二出厂，四天后到达。' } },
  { title: 'At the Train Station Information Desk', category: 'travel', difficulty: 'MEDIUM', cefr: 'B1', lines: [
    { en: 'Excuse me, is this the right platform for the fast train?', zh: '请问这是快车的站台吗？' },
    { en: 'No, the fast train leaves from Platform 6 in fifteen minutes.', zh: '不是，快车 15 分钟后在 6 号站台发车。' },
    { en: 'Do I need to change trains on the way?', zh: '中途需要换乘吗？' },
    { en: 'No, it is a direct service, but you should reserve a seat.', zh: '不用，是直达车，但建议订座。' },
  ], question: { stem: 'Which platform does the fast train leave from?', options: ['Platform 6', 'Platform 3', 'Platform 9', 'Platform 15'], answer: 'A', explanation: '6 号站台。' } },
]

async function seedListening(): Promise<number> {
  let count = 0
  for (const [index, item] of LISTENING.entries()) {
    let start = 0
    const transcript = item.lines.map((line) => {
      const entry = { startSec: Number(start.toFixed(1)), endSec: Number((start + 7).toFixed(1)), en: line.en, zh: line.zh }
      start += 7
      return entry
    })
    const slugSafeTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const audioUrl = `/audio/listening/${slugSafeTitle}.mp3`
    const material = await prisma.listeningMaterial.upsert({
      where: { id: await resolveListeningId(`lm-${index + 1}`) },
      update: {},
      create: {
        id: `lm-${index + 1}`,
        title: item.title,
        description: `${item.category} 主题听力材料，含时间轴字幕与 AI 分析。`,
        category: item.category,
        difficulty: item.difficulty,
        cefrLevel: item.cefr,
        audioUrl,
        durationSec: Math.round(start),
        transcript,
        sourceName: 'EnglishAI Seed',
        wordCount: item.lines.reduce((n, l) => n + l.en.split(/\s+/).length, 0),
        tags: [item.category, item.difficulty.toLowerCase()],
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdBy: 'seed',
      },
    })
    await prisma.listeningQuestion.upsert({
      where: { id: `lq-${index + 1}` },
      update: {},
      create: {
        id: `lq-${index + 1}`,
        materialId: material.id,
        type: 'SINGLE_CHOICE',
        stem: item.question.stem,
        options: item.question.options,
        answer: item.question.answer,
        explanation: item.question.explanation,
        difficulty: item.difficulty,
        knowledgePoints: [item.category],
        sortOrder: 0,
      },
    })
    count += 1
  }
  log(`listening: ${count} materials (+${count} questions)`)
  return count
}

/** listening_materials 无业务唯一键 → 以固定 id 幂等 */
async function resolveListeningId(id: string): Promise<string> {
  const existing = await prisma.listeningMaterial.findUnique({ where: { id }, select: { id: true } })
  return existing ? id : id
}

// ============================================================ 阅读 60 篇
interface Paragraph {
  en: string
  zh: string
}

const PARAGRAPH_POOL: Paragraph[] = [
  { en: 'In recent years, more young people have started to learn practical skills outside school. Short online courses, weekend workshops and community clubs make it possible to study at almost any time. Many learners say the chance to choose what to study is the biggest advantage.', zh: '近年来，越来越多年轻人开始在课堂之外学习实用技能。短线上课、周末工作坊和社区俱乐部让学习几乎随时可行。许多学习者说，能够自主选择学习内容是最大优势。' },
  { en: 'Experts believe that regular reading is one of the strongest habits a student can build. Reading every day improves vocabulary, deepens understanding of grammar and trains the brain to focus for longer periods.', zh: '专家认为，规律阅读是学生能养成的最有力的习惯之一。每天阅读能扩大词汇量、加深对语法的理解，并训练大脑长时间保持专注。' },
  { en: 'Cities around the world are testing new ways to reduce traffic. Some limit cars in the centre, while others build more bicycle lanes. Early results show that travel times drop when people can choose between several transport options.', zh: '世界各地的城市正在试验减少交通拥堵的新方法。有的限制中心区车辆，有的增建自行车道。早期结果显示，当人们可以在多种交通方式之间选择时，出行时间会下降。' },
  { en: 'A healthy diet does not need to be expensive. Simple foods such as eggs, beans, seasonal vegetables and whole grains provide most nutrients the body needs. Planning meals ahead also helps families waste less food.', zh: '健康饮食并不需要花很多钱。鸡蛋、豆类、应季蔬菜和全谷物等简单食物就能提供身体所需的大部分营养。提前规划餐食也能帮助家庭减少浪费。' },
  { en: 'Technology has changed the way people work together. Teams in different countries now share documents in real time and hold video meetings in seconds. However, many managers say clear writing has become more important than ever.', zh: '科技改变了协作方式。不同国家的团队可以实时共享文档，几秒钟内开启视频会议。不过许多管理者表示，清晰的书面表达比以往更加重要。' },
  { en: 'Learning a second language takes patience. Researchers suggest short daily practice is more effective than one long session each week. Speaking with real people, even with mistakes, speeds up progress greatly.', zh: '学习第二语言需要耐心。研究者建议每天短时练习比每周一次长时间练习更有效。与真人对话，即使出错，也能大大加快进步。' },
  { en: 'Museums are no longer quiet halls full of glass boxes. Many now use touch screens, audio guides and interactive rooms to explain their collections. Visitor numbers have grown, especially among young people.', zh: '博物馆不再只是摆满玻璃展柜的安静大厅。如今许多馆引入触屏、语音导览和互动展厅来讲解藏品。参观人数上升，年轻人尤其明显。' },
  { en: 'Small businesses often struggle to find customers in their first year. Owners who succeed usually talk to their customers often, adjust quickly and keep costs low. Local markets can be a good place to test new ideas.', zh: '小企业在第一年常常难以找到顾客。成功者通常频繁与顾客交流、快速调整并控制成本。本地市场是检验新想法的好地方。' },
  { en: 'Sleep affects almost every part of our life. Students who sleep well remember more and react faster. Doctors advise keeping a regular bedtime and avoiding bright screens for an hour before sleep.', zh: '睡眠几乎影响生活的每一部分。睡得好的学生记得更多、反应更快。医生建议保持规律就寝，睡前一小时避免亮屏。' },
  { en: 'Volunteering gives people a chance to help others and learn new skills at the same time. Many volunteers say the experience taught them how to communicate with strangers and manage their time better.', zh: '志愿服务让人在帮助他人的同时学习新技能。许多志愿者说，这段经历教会他们如何与陌生人沟通、更好地管理时间。' },
  { en: 'The sea covers most of our planet, yet scientists have explored only a small part of it. New underwater robots now send back pictures from deep places, helping researchers discover unknown species every year.', zh: '海洋覆盖地球大部分，但科学家只探索了很小一部分。新型水下机器人不断从深海传回影像，帮助研究者每年发现未知物种。' },
  { en: 'Public libraries are changing with the times. Besides lending books, many now offer free classes, workspaces and even equipment for recording music. This helps them stay useful in a digital world.', zh: '公共图书馆正随时代变化。除了借书，许多馆还提供免费课程、办公空间，甚至音乐录制设备。这让他们在数字时代依然有用。' },
  { en: 'Travelling by train is becoming popular again in many countries. Modern trains are fast, comfortable and produce far less pollution than planes for short distances. Governments are investing in new lines.', zh: '在许多国家，火车旅行正重新流行。现代火车快速舒适，短途出行的污染远低于飞机。各国政府正在投资新线路。' },
  { en: 'Good communication in a team starts with listening. When people feel heard, they share ideas more openly. Teams that meet briefly every day often solve problems earlier than those that wait for weekly reports.', zh: '团队中的良好沟通始于倾听。当人们感到被倾听时，会更开放地分享想法。每天简短站会的团队，往往比等待周报的团队更早解决问题。' },
  { en: 'Farmers in dry regions are learning to use water more wisely. Drip systems send water directly to the roots of plants, cutting waste by more than half. Some farms also collect rainwater in the wet season.', zh: '干旱地区的农民正在学习更明智地用水。滴灌系统把水直接送到植物根部，减少一半以上浪费。一些农场还会在雨季收集雨水。' },
  { en: 'Writing by hand may seem old-fashioned, but studies suggest it helps memory. Students who take notes by hand often understand ideas better because they must summarise, not copy.', zh: '手写看似过时，但研究表明它有助于记忆。用手记笔记的学生往往理解更深，因为他们必须归纳而非照抄。' },
  { en: 'Many families now keep pets for company. Taking a dog for a daily walk gives owners regular exercise and a chance to meet neighbours. Doctors note that caring for an animal can reduce stress.', zh: '如今许多家庭养宠物作伴。每天遛狗让主人获得规律运动，也有机会认识邻居。医生指出，照顾动物能减轻压力。' },
  { en: 'Online shopping is convenient, but it creates a large amount of packaging. Some companies now use returnable boxes, while customers are encouraged to combine orders. Small changes can reduce waste significantly.', zh: '网购方便，但产生大量包装。一些公司开始使用可回收包装箱，并鼓励顾客合并订单。小小的改变就能显著减少浪费。' },
  { en: 'Music education may improve more than musical skill. In several studies, children who learned an instrument showed better attention and language ability. Researchers are still exploring the reasons.', zh: '音乐教育带来的好处可能不止于音乐技能。多项研究中，学过乐器的孩子表现出更好的注意力与语言能力。研究者仍在探索原因。' },
  { en: 'Working from home has become normal for many office jobs. It saves travel time and gives people flexibility, but some workers miss the energy of an office. A mix of both seems to suit most teams.', zh: '对许多办公室工作而言，远程办公已成常态。它节省通勤时间、带来灵活性，但一些员工怀念办公室的氛围。两者结合似乎最适合大多数团队。' },
  { en: 'Local food markets connect people with the farmers who grow their meals. Besides fresher vegetables, these markets often cost less and create fewer transport emissions than supermarkets.', zh: '本地菜市场把人们与种植者联系起来。除了更新鲜的蔬菜，这些市场通常比超市便宜，运输排放也更少。' },
  { en: 'Learning to manage money is a skill schools rarely teach. Young adults who track their spending for even one month often discover surprising habits. Simple budgeting apps can make the process easier.', zh: '理财是学校很少教授的技能。哪怕只记录一个月的支出，年轻人也常常发现自己的消费习惯出人意料。简单的记账应用能让这一过程更轻松。' },
  { en: 'Sports bring people together across languages and cultures. International competitions teach young players discipline and respect. Coaches say the friendships formed on the field often last a lifetime.', zh: '体育跨越语言与文化，把人们联结在一起。国际赛事教会年轻选手纪律与尊重。教练们说，赛场上结下的友谊往往持续一生。' },
  { en: 'City birds have adapted to noisy streets by singing at higher pitches. Scientists recorded thousands of songs to reach this conclusion. Such studies help planners design quieter, greener neighbourhoods.', zh: '城市鸟类通过提高音调适应嘈杂街道。科学家录制了数千段鸟鸣才得出这一结论。这类研究有助于规划者设计更安静、更绿色的街区。' },
]

const READING_TOPICS: ReadonlyArray<{ title: string; category: string; difficulty: Difficulty; cefr: 'B1' | 'B2' }> = [
  ...Array.from({ length: 60 }, (_, i) => {
    const categories = ['news', 'tech', 'campus', 'culture', 'travel', 'society', 'business', 'health', 'education', 'environment']
    const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']
    const category = categories[i % categories.length] ?? 'society'
    const difficulty = difficulties[i % 3] ?? 'MEDIUM'
    const baseTitles = [
      'Skills Beyond the Classroom', 'The Habit of Daily Reading', 'Fixing City Traffic', 'Eating Well on a Budget',
      'Teamwork in the Digital Age', 'Learning Languages the Smart Way', 'Museums Come Alive', 'Small Business, Big Lessons',
      'Why Sleep Matters', 'The Value of Volunteering', 'Secrets of the Deep Sea', 'Libraries for Everyone',
      'The Return of Train Travel', 'Listening: A Team Superpower', 'Smarter Water on Farms', 'The Case for Handwriting',
      'Pets and Wellbeing', 'The Cost of Convenience', 'Music and the Mind', 'Working from Anywhere',
      'Meet Your Local Farmer', 'Money Skills for Young Adults', 'More Than a Game', 'Birdsong in the City',
    ]
    const baseTitle = baseTitles[i % baseTitles.length] ?? 'Reading'
    const round = Math.floor(i / baseTitles.length)
    const title = round === 0 ? baseTitle : `${baseTitle} (Part ${round + 1})`
    return { title, category, difficulty, cefr: (difficulty === 'HARD' ? 'B2' : 'B1') as 'B1' | 'B2' }
  }),
]

async function seedReading(): Promise<number> {
  const paragraphs = PARAGRAPH_POOL
  const articles: Array<{
    id: string
    title: string
    slug: string
    category: string
    difficulty: Difficulty
    cefrLevel: 'B1' | 'B2'
    contentBlocks: Array<{ index: number; en: string; zh: string }>
    contentZh: string
    wordCount: number
    readingMinutes: number
    keyWords: Array<{ word: string; pos: string; meaning: string }>
    tags: string[]
  }> = READING_TOPICS.map((topic, index) => {
    const picks = [index % paragraphs.length, (index + 7) % paragraphs.length, (index + 13) % paragraphs.length]
    const blocks = picks.map((pick, blockIndex) => ({ index: blockIndex, ...(paragraphs[pick] ?? paragraphs[0]!) }))
    const en = blocks.map((b) => b.en).join(' ')
    return {
      id: `ra-${index + 1}`,
      title: topic.title,
      slug: `reading-${index + 1}`,
      category: topic.category,
      difficulty: topic.difficulty,
      cefrLevel: topic.cefr,
      contentBlocks: blocks,
      contentZh: blocks.map((b) => b.zh).join(''),
      wordCount: en.split(/\s+/).length,
      readingMinutes: Math.max(2, Math.round(en.split(/\s+/).length / 120)),
      keyWords: [
        { word: blocks[0]?.en.split(/\s+/)[0] ?? 'study', pos: 'n.', meaning: '见文内释义' },
      ],
      tags: [topic.category, topic.difficulty],
    }
  })

  for (const batch of chunk(articles, 60)) {
    await prisma.readingArticle.createMany({ data: batch, skipDuplicates: true })
  }

  // 每篇文章 2 道题（主题 + 细节），幂等：固定 id
  const questions = articles.flatMap((article, index) => {
    const firstBlock = article.contentBlocks[0]
    return [
      {
        id: `rq-${index * 2 + 1}`,
        articleId: article.id,
        type: 'MAIN_IDEA' in {} ? ('SINGLE_CHOICE' as const) : ('SINGLE_CHOICE' as const),
        stem: `Which statement best summarises the first paragraph of "${article.title}"?`,
        options: [
          firstBlock?.en.slice(0, 60) ?? '',
          'The writer argues against the idea.',
          'The passage lists unrelated facts.',
          'The passage is a personal diary entry.',
        ],
        answer: 'A',
        explanation: '首段主旨即选项 A 的概括。',
        difficulty: article.difficulty,
        sortOrder: 0,
      },
      {
        id: `rq-${index * 2 + 2}`,
        articleId: article.id,
        type: 'SINGLE_CHOICE' as const,
        stem: 'According to the passage, which of the following is TRUE?',
        options: [
          'The passage supports the main idea with reasons.',
          'The passage offers no evidence at all.',
          'The passage only gives numbers.',
          'The passage contradicts itself.',
        ],
        answer: 'A',
        explanation: '文章以理由支撑主旨。',
        difficulty: article.difficulty,
        sortOrder: 1,
      },
    ]
  })
  for (const batch of chunk(questions, 60)) {
    await prisma.readingQuestion.createMany({ data: batch, skipDuplicates: true })
  }
  log(`reading: ${articles.length} articles (+${questions.length} questions)`)
  return articles.length
}

// ============================================================ 语法 14 类
interface GrammarSeed {
  name: string
  slug: string
  category: string
  description: string
  content: Array<{ title: string; content: string }>
  examples: Array<{ en: string; zh: string; structure: string }>
  errorExamples: Array<{ wrong: string; right: string; reason: string }>
  questions: Array<{ stem: string; options: string[]; answer: string; explanation: string }>
}

const GRAMMAR: GrammarSeed[] = [
  { name: '词性与句子成分', slug: 'parts-of-speech', category: '词性', description: '名词、动词、形容词、副词等词性及其句子成分。', content: [{ title: '词性决定成分', content: '名词多作主语或宾语，形容词修饰名词，副词修饰动词或形容词。' }], examples: [{ en: 'She sings beautifully.', zh: '她唱歌很好听。', structure: '主语 + 动词 + 副词' }], errorExamples: [{ wrong: 'She sings beautiful.', right: 'She sings beautifully.', reason: '修饰动词须用副词。' }], questions: [
    { stem: 'Choose the correct word: The exam was ______ difficult.', options: ['extremely', 'extreme', 'extremity', 'extremer'], answer: 'A', explanation: '修饰形容词 difficult 用副词 extremely。' },
    { stem: 'Which word is a noun?', options: ['decision', 'decide', 'decisive', 'decidedly'], answer: 'A', explanation: 'decision 是名词。' },
    { stem: 'He speaks English ______.', options: ['well', 'good', 'best', 'goodly'], answer: 'A', explanation: '修饰动词 speak 用副词 well。' },
    { stem: 'The ______ of the company attended the meeting.', options: ['manager', 'manage', 'management', 'managing'], answer: 'A', explanation: '主语位置需要名词 manager。' },
  ] },
  { name: '一般现在时与现在进行时', slug: 'present-tenses', category: '时态', description: '习惯性动作与正在进行的动作。', content: [{ title: '基本用法', content: '一般现在时表习惯或事实；现在进行时表此刻正在发生。' }], examples: [{ en: 'She works in a bank. / She is working now.', zh: '她在银行工作。/ 她正在工作。', structure: 'do/does vs am/is/are doing' }], errorExamples: [{ wrong: 'I am knowing the answer.', right: 'I know the answer.', reason: 'know 是状态动词，不用进行时。' }], questions: [
    { stem: 'Listen! Someone ______ the piano.', options: ['is playing', 'plays', 'played', 'has played'], answer: 'A', explanation: 'Listen! 提示此刻正在进行。' },
    { stem: 'The sun ______ in the east.', options: ['rises', 'is rising', 'rose', 'has risen'], answer: 'A', explanation: '客观事实用一般现在时。' },
    { stem: 'She usually ______ to work by bus.', options: ['goes', 'is going', 'went', 'has gone'], answer: 'A', explanation: 'usually 表习惯。' },
    { stem: 'Look! The children ______ in the park.', options: ['are playing', 'play', 'played', 'will play'], answer: 'A', explanation: 'Look! 提示正在进行。' },
  ] },
  { name: '过去时与现在完成时', slug: 'past-and-perfect', category: '时态', description: '过去时间点与对现在的影响。', content: [{ title: '区别要点', content: '一般过去时有明确过去时间；现在完成时强调对现在的影响，不与具体过去时间连用。' }], examples: [{ en: 'I saw him yesterday. / I have seen this film twice.', zh: '我昨天见过他。/ 这部电影我看过两次。', structure: 'did vs have done' }], errorExamples: [{ wrong: 'I have seen him yesterday.', right: 'I saw him yesterday.', reason: 'yesterday 是具体过去时间。' }], questions: [
    { stem: 'I ______ my keys. I cannot open the door.', options: ['have lost', 'lost', 'lose', 'was losing'], answer: 'A', explanation: '对现在造成影响用现在完成时。' },
    { stem: 'She ______ to Japan in 2019.', options: ['went', 'has gone', 'goes', 'had gone'], answer: 'A', explanation: 'in 2019 是具体过去时间。' },
    { stem: 'How long ______ you lived here?', options: ['have', 'did', 'do', 'were'], answer: 'A', explanation: '与 lived 连用用现在完成时 have。' },
    { stem: 'He ______ his homework an hour ago.', options: ['finished', 'has finished', 'finishes', 'had finished'], answer: 'A', explanation: 'an hour ago 表过去时间。' },
  ] },
  { name: '被动语态', slug: 'passive-voice', category: '语态', description: 'be + 过去分词，突出动作承受者。', content: [{ title: '构成', content: '被动语态由 be 的相应形式 + 过去分词构成，可带情态动词。' }], examples: [{ en: 'The bridge was built in 1990.', zh: '这座桥建于 1990 年。', structure: 'be + done' }], errorExamples: [{ wrong: 'The window was broke.', right: 'The window was broken.', reason: '应用过去分词 broken。' }], questions: [
    { stem: 'English ______ in many countries.', options: ['is spoken', 'speaks', 'is speaking', 'spoke'], answer: 'A', explanation: '英语是被说，用被动。' },
    { stem: 'The letter ______ tomorrow.', options: ['will be sent', 'will send', 'sends', 'sent'], answer: 'A', explanation: '明天将被寄出。' },
    { stem: 'This song ______ by young people.', options: ['is loved', 'loves', 'loving', 'loved'], answer: 'A', explanation: '歌被喜爱。' },
    { stem: 'The problem must ______ at once.', options: ['be solved', 'solve', 'solved', 'solving'], answer: 'A', explanation: '情态动词后 be + 过去分词。' },
  ] },
  { name: '定语从句', slug: 'relative-clauses', category: '从句', description: 'who/which/that/whose 引导定语从句。', content: [{ title: '关系词选择', content: '人用 who/that，物用 which/that，所有格用 whose。' }], examples: [{ en: 'The man who called you is my uncle.', zh: '给你打电话的人是我叔叔。', structure: '先行词 + 关系词 + 从句' }], errorExamples: [{ wrong: 'The book which I bought it is good.', right: 'The book which I bought is good.', reason: 'which 已作宾语，不能重复 it。' }], questions: [
    { stem: 'The girl ______ won the prize is my classmate.', options: ['who', 'which', 'whose', 'whom'], answer: 'A', explanation: '先行词是人且作主语。' },
    { stem: 'This is the house ______ windows are broken.', options: ['whose', 'which', 'that', 'who'], answer: 'A', explanation: 'whose + 名词表所属。' },
    { stem: 'I like stories ______ have happy endings.', options: ['which', 'who', 'whose', 'what'], answer: 'A', explanation: '先行词是物。' },
    { stem: 'The teacher ______ we respect is retiring.', options: ['whom', 'which', 'whose', 'what'], answer: 'A', explanation: '先行词是人且作宾语可用 whom。' },
  ] },
  { name: '状语从句', slug: 'adverbial-clauses', category: '从句', description: '时间、原因、条件、目的等状语从句。', content: [{ title: '连词辨析', content: 'because 表原因，although 表让步，so that 表目的，unless 表条件。' }], examples: [{ en: 'I stayed at home because it rained.', zh: '因为下雨我待在家里。', structure: '主句 + 连词 + 从句' }], errorExamples: [{ wrong: 'Although he was tired, but he worked on.', right: 'Although he was tired, he worked on.', reason: 'although 与 but 不能连用。' }], questions: [
    { stem: 'We will go out ______ it stops raining.', options: ['when', 'because', 'although', 'so'], answer: 'A', explanation: '时间状语从句。' },
    { stem: 'He passed the exam ______ he had prepared well.', options: ['because', 'so that', 'unless', 'until'], answer: 'A', explanation: '原因状语从句。' },
    { stem: '______ you hurry, you will miss the bus.', options: ['Unless', 'If', 'Because', 'Though'], answer: 'A', explanation: 'unless = 如果不。' },
    { stem: 'She saved money ______ she could travel.', options: ['so that', 'because', 'although', 'while'], answer: 'A', explanation: '目的状语从句。' },
  ] },
  { name: '虚拟语气', slug: 'subjunctive', category: '虚拟语气', description: '与现在、过去、将来事实相反的假设。', content: [{ title: '三大虚拟句', content: '与现在相反：if + did, would do；与过去相反：if + had done, would have done。' }], examples: [{ en: 'If I were rich, I would travel more.', zh: '如果我有钱，我会多旅行。', structure: 'if + 过去式, would + 动词原形' }], errorExamples: [{ wrong: 'If I was you, I will go.', right: 'If I were you, I would go.', reason: '虚拟语气用 were 和 would。' }], questions: [
    { stem: 'If he ______ earlier, he would not have missed the train.', options: ['had left', 'left', 'leaves', 'would leave'], answer: 'A', explanation: '与过去事实相反。' },
    { stem: 'If I ______ more time, I would finish the work.', options: ['had', 'have', 'will have', 'had had'], answer: 'A', explanation: '与现在事实相反。' },
    { stem: 'The teacher suggested that everyone ______ the report.', options: ['read', 'reads', 'reading', 'would read'], answer: 'A', explanation: 'suggest 后接 (should) + 动词原形。' },
    { stem: 'I wish I ______ taller.', options: ['were', 'am', 'will be', 'have been'], answer: 'A', explanation: 'wish 后用过去式表愿望。' },
  ] },
  { name: '非谓语动词', slug: 'non-finite-verbs', category: '非谓语', description: '不定式、动名词与分词作状语或补语。', content: [{ title: '选择要点', content: '表目的用不定式；作主语宾语常用动名词；主动进行用现在分词。' }], examples: [{ en: 'To pass the exam, he studied hard.', zh: '为了通过考试，他努力学习。', structure: 'to do 表目的' }], errorExamples: [{ wrong: 'I enjoy to swim.', right: 'I enjoy swimming.', reason: 'enjoy 后接动名词。' }], questions: [
    { stem: 'He ran fast ______ the bus.', options: ['to catch', 'catching', 'caught', 'catches'], answer: 'A', explanation: '不定式表目的。' },
    { stem: '______ from the hill, the city looks small.', options: ['Seen', 'Seeing', 'To see', 'See'], answer: 'A', explanation: '城市被看，用过去分词。' },
    { stem: 'She avoided ______ the question.', options: ['answering', 'to answer', 'answer', 'answered'], answer: 'A', explanation: 'avoid 后接动名词。' },
    { stem: 'The ______ man sat by the road.', options: ['wounded', 'wounding', 'wound', 'wounds'], answer: 'A', explanation: '受伤的人，过去分词作定语。' },
  ] },
  { name: '倒装句', slug: 'inversion', category: '倒装', description: '否定词前置与 only/so/such 引导的倒装。', content: [{ title: '部分倒装', content: '否定副词（hardly, never, no sooner）置于句首时，主谓部分倒装。' }], examples: [{ en: 'Never have I seen such a sight.', zh: '我从未见过这样的景象。', structure: '否定词 + 助动词 + 主语' }], errorExamples: [{ wrong: 'Never I have seen it.', right: 'Never have I seen it.', reason: '否定词前置需倒装。' }], questions: [
    { stem: 'Only then ______ the truth.', options: ['did I know', 'I knew', 'I did know', 'do I knew'], answer: 'A', explanation: 'only then 引导部分倒装。' },
    { stem: 'Hardly ______ when it started to rain.', options: ['had we left', 'we had left', 'did we left', 'we left'], answer: 'A', explanation: 'hardly…when 结构。' },
    { stem: 'Not only ______ the exam, but he also got full marks.', options: ['did he pass', 'he passed', 'he did pass', 'does he passed'], answer: 'A', explanation: 'not only 置句首倒装。' },
    { stem: 'So loud ______ that everyone looked up.', options: ['was the noise', 'the noise was', 'the noise is', 'is the noise'], answer: 'A', explanation: 'so + 形容词前置倒装。' },
  ] },
  { name: '强调句型', slug: 'emphasis', category: '强调', description: 'It is/was + 强调部分 + that/who。', content: [{ title: '强调结构', content: '强调人可用 who，其余用 that；去掉框架后句子仍完整。' }], examples: [{ en: 'It was Tom who broke the window.', zh: '是汤姆打破了窗户。', structure: 'It is/was + X + that…' }], errorExamples: [{ wrong: 'It was in 2010 when we met.', right: 'It was in 2010 that we met.', reason: '强调时间用 that。' }], questions: [
    { stem: 'It was the noise ______ woke me up.', options: ['that', 'who', 'which one', 'what'], answer: 'A', explanation: '强调句用 that。' },
    { stem: 'It was my mother ______ cooked the meal.', options: ['who', 'which', 'whom', 'whose'], answer: 'A', explanation: '强调人可用 who。' },
    { stem: 'It is because of you ______ we succeeded.', options: ['that', 'who', 'what', 'which'], answer: 'A', explanation: '强调原因状语用 that。' },
    { stem: '______ was in Paris that they first met.', options: ['It', 'This', 'That', 'There'], answer: 'A', explanation: '强调句固定以 It 开头。' },
  ] },
  { name: '主谓一致', slug: 'subject-verb-agreement', category: '主谓一致', description: '单复数、就近原则与不可数名词。', content: [{ title: '三原则', content: '语法一致、意义一致、就近一致。' }], examples: [{ en: 'The team is winning. / The team are arguing.', zh: '球队在赢球（整体）/ 队员们在争吵（成员）。', structure: '意义一致' }], errorExamples: [{ wrong: 'The number of students are large.', right: 'The number of students is large.', reason: 'the number of + 复数名词作单数。' }], questions: [
    { stem: 'Each of the students ______ a book.', options: ['has', 'have', 'having', 'are having'], answer: 'A', explanation: 'each of + 复数名词作单数。' },
    { stem: 'Either you or he ______ to do it.', options: ['is', 'are', 'were', 'be'], answer: 'A', explanation: '就近原则，随 he。' },
    { stem: 'Ten years ______ a long time.', options: ['is', 'are', 'were', 'have been'], answer: 'A', explanation: '时间段作单数。' },
    { stem: 'There ______ a book and two pens on the desk.', options: ['is', 'are', 'were', 'be'], answer: 'A', explanation: 'there be 就近，a book 单数。' },
  ] },
  { name: '介词与固定搭配', slug: 'prepositions', category: '介词', description: '常见介词搭配与易混辨析。', content: [{ title: '高频搭配', content: 'in the morning / on Monday / at night；depend on; look forward to doing。' }], examples: [{ en: 'I am looking forward to meeting you.', zh: '我期待见到你。', structure: 'look forward to + doing' }], errorExamples: [{ wrong: 'I am good in maths.', right: 'I am good at maths.', reason: 'good at 为固定搭配。' }], questions: [
    { stem: 'She is good ______ singing.', options: ['at', 'in', 'on', 'for'], answer: 'A', explanation: 'good at 固定搭配。' },
    { stem: 'We will meet ______ Monday morning.', options: ['on', 'in', 'at', 'by'], answer: 'A', explanation: '具体某天上午用 on。' },
    { stem: 'He is interested ______ history.', options: ['in', 'on', 'at', 'with'], answer: 'A', explanation: 'interested in 固定搭配。' },
    { stem: 'It depends ______ the weather.', options: ['on', 'in', 'at', 'of'], answer: 'A', explanation: 'depend on 固定搭配。' },
  ] },
  { name: '情态动词', slug: 'modal-verbs', category: '情态动词', description: 'can/must/should/might 表能力、义务与推测。', content: [{ title: '推测层级', content: 'must > may/might > cannot（否定推测用 cannot）。' }], examples: [{ en: 'He must be at home; the light is on.', zh: '他一定在家，灯亮着。', structure: 'must + 动词原形' }], errorExamples: [{ wrong: 'He musts go now.', right: 'He must go now.', reason: '情态动词后接原形，无三单。' }], questions: [
    { stem: 'The light is on, so she ______ be at home.', options: ['must', 'can', 'should', 'need'], answer: 'A', explanation: '有依据的肯定推测用 must。' },
    { stem: 'You ______ not smoke here. It is forbidden.', options: ['must', 'may', 'could', 'would'], answer: 'A', explanation: 'must not 表禁止。' },
    { stem: '______ you please pass the salt?', options: ['Could', 'Must', 'Shall', 'Need'], answer: 'A', explanation: 'could 表委婉请求。' },
    { stem: 'He ______ be late; he left an hour ago.', options: ['cannot', 'must not', 'need not', 'should not'], answer: 'A', explanation: '否定推测用 cannot。' },
  ] },
  { name: '条件句与比较结构', slug: 'condition-and-comparison', category: '条件句/比较', description: '真实条件句与 as…as / the more… 比较。', content: [{ title: '真实条件', content: 'if 从句用一般现在时，主句用将来时；比较级注意 than。' }], examples: [{ en: 'The more you practise, the better you get.', zh: '练得越多，进步越大。', structure: 'the + 比较级, the + 比较级' }], errorExamples: [{ wrong: 'He is more taller than me.', right: 'He is much taller than me.', reason: '比较级不能叠加 more。' }], questions: [
    { stem: 'If it ______ tomorrow, we will stay home.', options: ['rains', 'will rain', 'rained', 'would rain'], answer: 'A', explanation: '真实条件句从句用现在时。' },
    { stem: 'She is ______ than her sister.', options: ['taller', 'more tall', 'tallest', 'as tall'], answer: 'A', explanation: '两者比较用比较级。' },
    { stem: '______ you study, ______ you learn.', options: ['The more; the more', 'More; more', 'The most; the most', 'Much; much'], answer: 'A', explanation: 'the + 比较级固定结构。' },
    { stem: 'This box is ______ heavy ______ that one.', options: ['as; as', 'so; as', 'more; than', 'such; as'], answer: 'A', explanation: 'as…as 表同级比较。' },
  ] },
]

async function seedGrammar(): Promise<number> {
  for (const [index, topic] of GRAMMAR.entries()) {
    const id = `gt-${index + 1}`
    const existing = await prisma.grammarTopic.findUnique({ where: { id } })
    const data = {
      name: topic.name,
      slug: topic.slug,
      category: topic.category,
      description: topic.description,
      content: topic.content,
      examples: topic.examples,
      errorExamples: topic.errorExamples,
      difficulty: 'MEDIUM' as Difficulty,
      orderIndex: index,
      status: 'PUBLISHED' as const,
    }
    const row = existing
      ? await prisma.grammarTopic.update({ where: { id }, data })
      : await prisma.grammarTopic.create({ data: { id, ...data } })

    for (const [qIndex, question] of topic.questions.entries()) {
      const qid = `gq-${index + 1}-${qIndex + 1}`
      const exists = await prisma.grammarQuestion.findUnique({ where: { id: qid } })
      const qData = {
        topicId: row.id,
        type: 'SINGLE_CHOICE' as const,
        stem: question.stem,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        knowledgePoints: [topic.slug],
        difficulty: 'MEDIUM' as Difficulty,
        sortOrder: qIndex,
      }
      if (exists) await prisma.grammarQuestion.update({ where: { id: qid }, data: qData })
      else await prisma.grammarQuestion.create({ data: { id: qid, ...qData } })
    }
  }
  const questionCount = GRAMMAR.reduce((n, t) => n + t.questions.length, 0)
  log(`grammar: ${GRAMMAR.length} topics (+${questionCount} questions)`)
  return GRAMMAR.length
}

// ============================================================ 写作任务 30 个
const WRITING_TYPES: Array<'essay' | 'email' | 'report' | 'plan' | 'cover_letter' | 'daily_expression'> = [
  'essay', 'email', 'report', 'plan', 'cover_letter', 'daily_expression',
]

const WRITING_TOPICS: ReadonlyArray<{ title: string; prompt: string }> = [
  { title: 'My Favourite Way to Relax', prompt: 'Describe your favourite way to relax after a busy week. Explain why it works for you and how often you do it.' },
  { title: 'A Letter to a Friend About Your City', prompt: 'Write an email to a foreign friend introducing your city. Include two places to visit and one local dish.' },
  { title: 'Monthly Study Report', prompt: 'Write a short report on your study progress this month. State your goal, what you did, and one problem you met.' },
  { title: 'My One-Week English Plan', prompt: 'Design a one-week study plan for improving listening. Explain the reason for each choice.' },
  { title: 'Applying for a Part-time Job', prompt: 'Write a cover letter for a part-time job in a bookshop. Mention your skills and available time.' },
  { title: 'Talking About the Weather', prompt: 'Describe the weather in your hometown in different seasons and how it changes daily life.' },
  { title: 'Should Students Use AI Tools?', prompt: 'Some people think students should use AI tools for homework; others disagree. Discuss both views and give your opinion.' },
  { title: 'An Email to Reschedule a Meeting', prompt: 'Write an email to your teacher to move a meeting to another time. Give a reason and suggest two options.' },
  { title: 'Report on a Class Survey', prompt: 'You surveyed 30 classmates about reading habits. Write a report presenting the main findings and one suggestion.' },
  { title: 'A Two-Week Holiday Plan', prompt: 'Plan a two-week trip for a friend who loves nature. Include transport, places and a rough budget.' },
  { title: 'Why I Want to Join the Club', prompt: 'Write a letter applying to join the school English club. Explain your interest and what you can offer.' },
  { title: 'Describing a Memorable Meal', prompt: 'Describe a meal you will never forget. Who was there, what did you eat, and why was it special?' },
  { title: 'Online Learning: Advantages and Problems', prompt: 'Discuss the advantages and disadvantages of online learning, and suggest one improvement.' },
  { title: 'An Email Asking for Information', prompt: 'You want to join a summer course. Write an email asking about the price, the timetable and the teachers.' },
  { title: 'Report: How Students Spend Weekends', prompt: 'Write a report on how students in your class spend weekends, based on your observations, and draw one conclusion.' },
  { title: 'My Plan to Read Ten Books', prompt: 'You plan to read ten books this year. Explain how you will choose them and keep the habit.' },
  { title: 'A Thank-you Letter', prompt: 'Write a letter to thank a person who helped you a lot this year. Give two examples of their help.' },
  { title: 'My Neighbourhood', prompt: 'Describe your neighbourhood: what is good about it, what could be improved, and why you like living there.' },
  { title: 'Should Exams Be the Only Measure?', prompt: 'Some say exams are the best way to measure learning; others prefer projects. Discuss both and give your view.' },
  { title: 'An Email to a Homestay Family', prompt: 'Write a short self-introduction email to the family you will stay with abroad. Mention your habits and hobbies.' },
  { title: 'Report on Saving Energy at School', prompt: 'Your class checked energy use at school. Write a report with findings and two practical suggestions.' },
  { title: 'Planning a Study Group', prompt: 'Describe how you would organise a four-person study group, including meeting times and rules.' },
  { title: 'A Letter of Complaint', prompt: 'You bought a broken online product. Write a polite complaint email asking for a solution.' },
  { title: 'My Experience of Learning English', prompt: 'Describe how you have learned English so far, one difficulty, and how you overcame it.' },
  { title: 'Is City Life Better Than Country Life?', prompt: 'Compare city life and country life, and explain which you prefer and why.' },
  { title: 'An Email Sharing Good News', prompt: 'Write an email to a friend sharing good news about your exam results and your next plan.' },
  { title: 'Report on a School Trip', prompt: 'Write a report about a school trip: where you went, what you learned, and whether it should be repeated.' },
  { title: 'My Plan for the Winter Holiday', prompt: 'Explain how you will balance rest, study and exercise during the winter holiday.' },
  { title: 'Applying to Be a Volunteer', prompt: 'Write an application letter to volunteer at a city library. Explain your motivation and availability.' },
  { title: 'Describing a Person You Admire', prompt: 'Describe a person you admire. Explain who they are, what they did, and what you learned from them.' },
]

async function seedWriting(): Promise<number> {
  let count = 0
  for (const [index, topic] of WRITING_TOPICS.entries()) {
    const taskType = WRITING_TYPES[index % WRITING_TYPES.length] ?? 'essay'
    const difficulty: Difficulty = index % 3 === 0 ? 'EASY' : index % 3 === 1 ? 'MEDIUM' : 'HARD'
    const examType: 'CET4' | 'CET6' | undefined = index % 5 === 0 ? 'CET4' : index % 5 === 1 ? 'CET6' : undefined
    const wordMin = difficulty === 'EASY' ? 80 : difficulty === 'MEDIUM' ? 120 : 150
    const wordMax = difficulty === 'EASY' ? 120 : difficulty === 'MEDIUM' ? 180 : 200
    const existing = await prisma.writingTask.findUnique({ where: { id: `wt-${index + 1}` } })
    const data = {
      title: topic.title,
      taskType,
      difficulty,
      prompt: topic.prompt,
      requirements: [
        { key: 'wordCount', value: `${wordMin}-${wordMax} words` },
        { key: 'paragraphs', value: 'at least 3 paragraphs' },
        { key: 'style', value: 'clear structure and examples' },
      ],
      wordMin,
      wordMax,
      rubric: { content: 5, organisation: 4, language: 4, accuracy: 2 },
      totalScore: 15,
      tags: [taskType, difficulty.toLowerCase()],
      status: 'PUBLISHED' as const,
      createdBy: 'seed',
      ...(examType ? { examType: examType as 'CET4' | 'CET6' } : {}),
    }
    if (existing) await prisma.writingTask.update({ where: { id: existing.id }, data })
    else await prisma.writingTask.create({ data: { id: `wt-${index + 1}`, ...data } })
    count += 1
  }
  log(`writing: ${count} tasks`)
  return count
}

export async function seedContent(): Promise<{ listening: number; reading: number; grammar: number; writing: number }> {
  const listening = await seedListening()
  const reading = await seedReading()
  const grammar = await seedGrammar()
  const writing = await seedWriting()
  // 校验 CSV 目录（若存在 placement CSV 但为空则提示）
  const placementRows = readCsv(path.join(DATA_DIR, 'placement-questions.csv'))
  if (placementRows.length === 0) warn('prisma/data/placement-questions.csv 为空，Placement 题未导入')
  return { listening, reading, grammar, writing }
}
