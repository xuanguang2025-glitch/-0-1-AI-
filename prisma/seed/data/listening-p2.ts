/**
 * Seed 数据 · 听力 60 篇（架构 §5.2 难度阶梯）。
 *
 * 为什么单独抽成纯数据模块（不直接在 seed 里写）：
 *   1) `scripts/gen-listening-audio.ts` 需要**离线**（不连 DB）枚举全部 60 篇来生成音频；
 *   2) seed 与音频脚本共用同一份内容，杜绝「字幕/音频」两条数据源漂移。
 *
 * 难度阶梯（§5.2）：intensityLevel 1 泛听入门 / 2 CET-4 标准 / 3 CET-6 强化 / 4 高阶话题（架构师裁决改名）。
 * **共 4 档 60 篇，分布 20 / 15 / 14 / 11（不是均匀的 15×4）**，可用 `countByIntensity()` 复核。
 * ⚠️ 不要为了「凑成 15×4」去改动篇数分布——高档位篇数递减是内容难度设计的自然结果。
 *
 * ⚠️ 已知内容缺口（需产品/架构裁决，**未在代码里掩盖**）：
 *   §5.2 的目标词数为 L1 90-120 / L2 160-220 / L3 260-340 / L4 340-450 词，
 *   而当前 60 篇实测**平均仅 36-39 词/篇**（L1 avg 36、L2 39、L3 38、L4 37），
 *   即时长约为设计目标的 1/4~1/10，且**词数未随强度档单调递增**。
 *   这不影响已交付的功能闭环（播放/字幕/判分/报告均可用），但「难度阶梯」目前
 *   只体现在题材与语速推荐上，未体现在篇幅上。补篇幅属于内容生产决策，见交付说明。
 */

export type ListeningDifficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type ListeningCefr = 'A2' | 'B1' | 'B2' | 'C1'
export type IntensityLevel = 1 | 2 | 3 | 4
export type FocusPointKind = 'new' | 'key' | 'phrase' | 'grammar'

export interface ListeningLineData {
  en: string
  zh: string
}

export interface FocusPointData {
  word: string
  meaning: string
  type: FocusPointKind
}

export interface ListeningQuestionData {
  /** 服务于哪种训练模式（choice/cloze/keyword/extensive） */
  mode: 'extensive' | 'choice' | 'cloze' | 'keyword'
  type: 'SINGLE_CHOICE' | 'FILL_BLANK' | 'CLOZE' | 'TRUE_FALSE'
  stem: string
  options?: string[]
  answer: string
  answerAliases?: string[]
  explanation?: string
}

export interface ListeningMaterialData {
  id: string
  title: string
  category: string
  difficulty: ListeningDifficulty
  cefr: ListeningCefr
  intensityLevel: IntensityLevel
  tags: string[]
  lines: ListeningLineData[]
  focusPoints: FocusPointData[]
  questions: ListeningQuestionData[]
}

/** 各档推荐时长/词速（§5.2），用于字幕时间轴估算与自检 */
export const INTENSITY_PROFILE: Record<IntensityLevel, { name: string; wpm: number; minSec: number; maxSec: number }> = {
  1: { name: '泛听入门', wpm: 100, minSec: 60, maxSec: 90 },
  2: { name: 'CET-4 标准', wpm: 130, minSec: 120, maxSec: 180 },
  3: { name: 'CET-6 强化', wpm: 150, minSec: 180, maxSec: 260 },
  4: { name: '高阶话题', wpm: 160, minSec: 240, maxSec: 360 },
}

/** 快捷构造：4 行对话/短文 */
function m(
  id: string,
  title: string,
  category: string,
  difficulty: ListeningDifficulty,
  cefr: ListeningCefr,
  intensityLevel: IntensityLevel,
  tags: string[],
  lines: Array<[string, string]>,
  focusPoints: FocusPointData[],
  questions: ListeningQuestionData[],
): ListeningMaterialData {
  return {
    id,
    title,
    category,
    difficulty,
    cefr,
    intensityLevel,
    tags,
    lines: lines.map(([en, zh]) => ({ en, zh })),
    focusPoints,
    questions,
  }
}

/** 单选题快捷构造 */
function choice(stem: string, options: string[], answer: string, explanation: string): ListeningQuestionData {
  return { mode: 'choice', type: 'SINGLE_CHOICE', stem, options, answer, explanation }
}

/** 填空/关键词快捷构造（模糊匹配允许 1 字符容错） */
function blank(stem: string, answer: string, aliases: string[] = []): ListeningQuestionData {
  return { mode: 'cloze', type: 'FILL_BLANK', stem, answer, answerAliases: aliases }
}

export const LISTENING_P2: ListeningMaterialData[] = [
  // ======================= intensity 1 · 泛听入门（campus/daily） =======================
  m('lm-1', 'Ordering Coffee at a Café', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['Good morning. What can I get for you today?', '早上好，请问您要来点什么？'],
    ['I would like a latte with less sugar, please.', '我想要一杯少糖的拿铁。'],
    ['Sure. Would you like something to eat with that?', '好的，需要搭配点吃的吗？'],
    ['A butter croissant sounds perfect. Thank you.', '一个黄油牛角包就再好不过了，谢谢。'],
  ], [
    { word: 'latte', meaning: '拿铁咖啡', type: 'new' },
    { word: 'croissant', meaning: '牛角包', type: 'new' },
    { word: 'less sugar', meaning: '少糖', type: 'phrase' },
  ], [
    choice('What does the customer order?', ['A latte and a croissant', 'Black coffee and bread', 'Tea and a cake', 'Juice and a sandwich'], 'A', '顾客点了少糖拿铁与黄油牛角包。'),
    blank('The customer wants a latte with ____ sugar.', 'less'),
  ]),
  m('lm-2', 'Asking for Directions on Campus', 'campus', 'EASY', 'A2', 1, ['campus'], [
    ['Excuse me, how can I get to the science building?', '打扰一下，请问怎么去理科楼？'],
    ['Go straight along this path and turn left at the library.', '沿这条路直走，在图书馆处左转。'],
    ['Is it far from here?', '离这里远吗？'],
    ['About ten minutes on foot. You cannot miss it.', '步行大约十分钟，你不会错过的。'],
  ], [
    { word: 'go straight', meaning: '一直走', type: 'phrase' },
    { word: 'turn left', meaning: '左转', type: 'key' },
    { word: 'on foot', meaning: '步行', type: 'phrase' },
  ], [
    choice('How long does it take to walk there?', ['About ten minutes', 'About thirty minutes', 'Two minutes', 'An hour'], 'A', '对方说明步行约十分钟。'),
    blank('Turn ____ at the library.', 'left'),
  ]),
  m('lm-3', 'Booking a Hotel Room by Phone', 'travel', 'EASY', 'A2', 1, ['travel'], [
    ['Hello, I would like to book a double room for two nights.', '你好，我想订一间双人房，住两晚。'],
    ['Certainly. For which dates?', '好的，请问哪两天？'],
    ['From the twelfth to the fourteenth of July.', '7 月 12 日到 14 日。'],
    ['That is available. The price is 380 yuan per night including breakfast.', '有房，每晚 380 元含早餐。'],
  ], [
    { word: 'double room', meaning: '双人房', type: 'new' },
    { word: 'available', meaning: '可预订的', type: 'key' },
    { word: 'per night', meaning: '每晚', type: 'phrase' },
  ], [
    choice('How much is the room per night?', ['380 yuan', '760 yuan', '300 yuan', '140 yuan'], 'A', '每晚 380 元（两晚共 760 元是总价）。'),
    blank('The price is 380 yuan ____ night.', 'per'),
  ]),
  m('lm-4', 'Talking About a Movie', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['Have you seen the new science fiction film?', '你看过那部新的科幻电影吗？'],
    ['Yes, last night. The special effects were amazing.', '看过，昨晚看的，特效特别棒。'],
    ['How was the story?', '故事怎么样？'],
    ['A little slow at the beginning, but the ending was worth it.', '开头有点慢，但结局很值得。'],
  ], [
    { word: 'science fiction', meaning: '科幻', type: 'new' },
    { word: 'special effects', meaning: '特效', type: 'phrase' },
    { word: 'worth it', meaning: '值得', type: 'phrase' },
  ], [
    choice('What did the speaker think of the ending?', ['It was worth it', 'It was boring', 'It was confusing', 'It was too short'], 'A', '「结局很值得」说明评价正面。'),
    blank('The special ____ were amazing.', 'effects'),
  ]),
  m('lm-5', 'Shopping for a Birthday Gift', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['I am looking for a birthday gift for my sister.', '我在给我妹妹挑生日礼物。'],
    ['How about this blue scarf? It is very popular this season.', '这条蓝色围巾怎么样？这季很流行。'],
    ['It looks lovely. How much is it?', '很好看，多少钱？'],
    ['Ninety-nine yuan, and gift wrapping is free.', '99 元，包装免费。'],
  ], [
    { word: 'scarf', meaning: '围巾', type: 'new' },
    { word: 'gift wrapping', meaning: '礼品包装', type: 'phrase' },
    { word: 'popular', meaning: '流行的', type: 'key' },
  ], [
    choice('What is the price of the scarf?', ['99 yuan', '199 yuan', '59 yuan', '90 yuan'], 'A', '售货员报价 99 元。'),
    blank('Gift ____ is free.', 'wrapping'),
  ]),
  m('lm-6', 'A Conversation About Hobbies', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['What do you usually do in your free time?', '你空闲时通常做什么？'],
    ['I love photography. I take pictures of old buildings.', '我喜欢摄影，专门拍老建筑。'],
    ['That is interesting. Do you share your photos online?', '有意思，你会把照片分享到网上吗？'],
    ['Yes, I post them once a week.', '是的，我每周发一次。'],
  ], [
    { word: 'photography', meaning: '摄影', type: 'new' },
    { word: 'in your free time', meaning: '在空闲时间', type: 'phrase' },
    { word: 'once a week', meaning: '每周一次', type: 'key' },
  ], [
    choice('What does the man photograph?', ['Old buildings', 'Wild animals', 'Food', 'Sports events'], 'A', '他专拍老建筑。'),
    blank('He posts his photos once a ____.', 'week'),
  ]),
  m('lm-7', 'Introducing a Colleague at Work', 'business', 'EASY', 'A2', 1, ['business'], [
    ['Everyone, this is Anna, our new designer.', '各位，这是我们的新设计师安娜。'],
    ['Nice to meet you all. I just moved here from Hamburg.', '很高兴认识大家，我刚从汉堡搬来。'],
    ['Welcome! If you need anything, just ask.', '欢迎！有什么需要尽管说。'],
    ['Thank you. I am looking forward to working with you.', '谢谢，期待与大家共事。'],
  ], [
    { word: 'colleague', meaning: '同事', type: 'new' },
    { word: 'look forward to', meaning: '期待', type: 'phrase' },
    { word: 'designer', meaning: '设计师', type: 'key' },
  ], [
    choice('What is Anna\'s job?', ['Designer', 'Manager', 'Accountant', 'Teacher'], 'A', '介绍中说她是设计师。'),
    blank('Anna moved here from ____.', 'Hamburg', ['hamburg']),
  ]),
  m('lm-8', 'Talking About Weekend Study Plans', 'campus', 'EASY', 'A2', 1, ['campus'], [
    ['Are you studying this weekend?', '你这周末要学习吗？'],
    ['Yes, I have an English test on Monday.', '是的，我周一有英语考试。'],
    ['Shall we revise together on Saturday morning?', '周六上午一起复习怎么样？'],
    ['Great idea. Let us meet at the study room at nine.', '好主意，九点在自习室见。'],
  ], [
    { word: 'revise', meaning: '复习', type: 'new' },
    { word: 'study room', meaning: '自习室', type: 'phrase' },
    { word: 'weekend', meaning: '周末', type: 'key' },
  ], [
    choice('When will they meet?', ['Saturday at nine', 'Sunday at nine', 'Monday at nine', 'Friday at nine'], 'A', '约在周六九点。'),
    blank('They will meet at the ____ room at nine.', 'study'),
  ]),
  m('lm-9', 'A Doctor\'s Appointment', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['What seems to be the problem today?', '今天哪里不舒服？'],
    ['I have had a sore throat and a headache for three days.', '我嗓子疼、头疼已经三天了。'],
    ['Any fever? Let me check your temperature.', '发烧吗？我量一下体温。'],
    ['It is a slight fever. Take this medicine twice a day and rest well.', '有点低烧。这药一天服两次，好好休息。'],
  ], [
    { word: 'sore throat', meaning: '嗓子疼', type: 'new' },
    { word: 'fever', meaning: '发烧', type: 'key' },
    { word: 'twice a day', meaning: '一天两次', type: 'phrase' },
  ], [
    choice('How long has the patient felt unwell?', ['Three days', 'Three weeks', 'One day', 'One month'], 'A', '病人自述三天。'),
    blank('Take the medicine twice a ____.', 'day'),
  ]),
  m('lm-10', 'Weather Forecast for the Weekend', 'news', 'EASY', 'A2', 1, ['news'], [
    ['Here is the weekend forecast for our region.', '现在播报本地区周末天气。'],
    ['Saturday will be sunny with a high of twenty-six degrees.', '周六晴天，最高 26 度。'],
    ['Clouds will move in on Sunday with light rain in the afternoon.', '周日转阴，下午有小雨。'],
    ['Temperatures will drop to eighteen degrees by evening.', '傍晚气温将降到 18 度。'],
  ], [
    { word: 'forecast', meaning: '预报', type: 'new' },
    { word: 'light rain', meaning: '小雨', type: 'phrase' },
    { word: 'temperature', meaning: '气温', type: 'key' },
  ], [
    choice('What is expected on Sunday afternoon?', ['Light rain', 'Heavy snow', 'Strong sunshine', 'High wind'], 'A', '预报说明日下午有小雨。'),
    blank('Saturday will be ____ with a high of twenty-six degrees.', 'sunny'),
  ]),
  m('lm-11', 'A Radio Report on Recycling', 'news', 'EASY', 'A2', 1, ['news', 'daily'], [
    ['Our city has started a new recycling programme this month.', '本市本月启动了新的回收计划。'],
    ['Residents are asked to separate paper, plastic and glass at home.', '居民需在家把纸张、塑料和玻璃分开。'],
    ['Special bins will appear in every neighbourhood next week.', '下周起每个小区都会设置专用垃圾桶。'],
    ['Officials hope the programme will reduce waste by one third.', '官方希望该计划能减少三分之一的垃圾。'],
  ], [
    { word: 'recycling', meaning: '回收', type: 'new' },
    { word: 'separate', meaning: '分开', type: 'key' },
    { word: 'neighbourhood', meaning: '社区', type: 'new' },
  ], [
    choice('What is the goal of the programme?', ['To reduce waste by one third', 'To build new factories', 'To sell more plastic', 'To close all shops'], 'A', '目标是减少三分之一的垃圾。'),
    blank('Residents should separate paper, plastic and ____.', 'glass'),
  ]),
  m('lm-12', 'At the Train Station Information Desk', 'travel', 'EASY', 'A2', 1, ['travel'], [
    ['Excuse me, is this the right platform for the fast train?', '请问这是快车的站台吗？'],
    ['No, the fast train leaves from Platform 6 in fifteen minutes.', '不是，快车 15 分钟后在 6 号站台发车。'],
    ['Do I need to change trains on the way?', '中途需要换乘吗？'],
    ['No, it is a direct service, but you should reserve a seat.', '不用，是直达车，但建议订座。'],
  ], [
    { word: 'platform', meaning: '站台', type: 'new' },
    { word: 'direct service', meaning: '直达车', type: 'phrase' },
    { word: 'reserve', meaning: '预订', type: 'key' },
  ], [
    choice('Which platform does the fast train leave from?', ['Platform 6', 'Platform 3', 'Platform 9', 'Platform 15'], 'A', '6 号站台。'),
    blank('Is this the right ____ for the fast train?', 'platform'),
  ]),
  m('lm-13', 'Making Plans for a Trip', 'travel', 'EASY', 'A2', 1, ['travel'], [
    ['Shall we take the early train to the coast?', '我们坐早班车去海边怎么样？'],
    ['Good idea. We can rent bikes there and ride along the beach.', '好主意，到那边可以租自行车沿海边骑。'],
    ['Do we need to book the hotel in advance?', '旅馆需要提前订吗？'],
    ['Yes, it is the busy season, so let us book tonight.', '要的，现在是旺季，今晚就订吧。'],
  ], [
    { word: 'in advance', meaning: '提前', type: 'phrase' },
    { word: 'busy season', meaning: '旺季', type: 'phrase' },
    { word: 'rent', meaning: '租', type: 'key' },
  ], [
    choice('Why do they need to book the hotel tonight?', ['It is the busy season', 'The hotel is closing', 'Trains are full', 'Prices will drop'], 'A', '因为是旅游旺季。'),
    blank('They can rent ____ and ride along the beach.', 'bikes'),
  ]),
  m('lm-14', 'A Lecture Introduction: The Water Cycle', 'campus', 'EASY', 'A2', 1, ['campus'], [
    ['Today we will look at how water moves around our planet.', '今天我们来看水如何在地球上循环。'],
    ['The sun heats the ocean, and water evaporates into the air.', '太阳加热海洋，水蒸发到空气中。'],
    ['Higher up, the vapour cools and forms clouds.', '在高处，水汽冷却形成云。'],
    ['Finally, precipitation returns the water to the land and sea.', '最后，降水把水送回陆地和海洋。'],
  ], [
    { word: 'evaporate', meaning: '蒸发', type: 'new' },
    { word: 'precipitation', meaning: '降水', type: 'new' },
    { word: 'vapour', meaning: '水汽', type: 'key' },
  ], [
    choice('What forms clouds in the passage?', ['Cooling water vapour', 'Burning fuel', 'Melting ice', 'Growing plants'], 'A', '水汽冷却形成云。'),
    blank('The sun heats the ocean and water ____ into the air.', 'evaporates'),
  ]),
  m('lm-15', 'New Student Orientation Talk', 'campus', 'EASY', 'A2', 1, ['campus'], [
    ['Welcome to the university. Let me explain your first week.', '欢迎来到大学，我来介绍一下第一周安排。'],
    ['Classes begin on Wednesday, and the library opens at eight.', '周三开始上课，图书馆八点开门。'],
    ['You can collect your student card from the main office.', '在主办公室领取学生卡。'],
    ['If you get lost, ask anyone in a blue shirt.', '如果迷路，找穿蓝衬衫的人问路。'],
  ], [
    { word: 'orientation', meaning: '迎新', type: 'new' },
    { word: 'collect', meaning: '领取', type: 'key' },
    { word: 'main office', meaning: '主办公室', type: 'phrase' },
  ], [
    choice('When do classes begin?', ['Wednesday', 'Monday', 'Friday', 'Sunday'], 'A', '周三开始上课。'),
    blank('Collect your student card from the main ____.', 'office'),
  ]),
  m('lm-16', 'A Short Talk About Healthy Eating', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['Eating well does not have to be expensive.', '吃得健康不一定很贵。'],
    ['Start with vegetables, beans and whole grains.', '从蔬菜、豆类和全谷物开始。'],
    ['Drink water instead of sweet drinks.', '用白水代替含糖饮料。'],
    ['Small changes every day make a real difference.', '每天小小的改变都会带来实实在在的不同。'],
  ], [
    { word: 'whole grains', meaning: '全谷物', type: 'phrase' },
    { word: 'instead of', meaning: '代替', type: 'phrase' },
    { word: 'expensive', meaning: '昂贵的', type: 'key' },
  ], [
    choice('What should you drink instead of sweet drinks?', ['Water', 'Coffee', 'Juice', 'Milk tea'], 'A', '建议用白水代替含糖饮料。'),
    blank('Start with vegetables, beans and whole ____.', 'grains'),
  ]),
  m('lm-17', 'Renting a Bicycle in the City', 'travel', 'EASY', 'A2', 1, ['travel', 'daily'], [
    ['How much does it cost to rent a bike for a day?', '租一天自行车多少钱？'],
    ['Twenty yuan, and you need to leave a deposit.', '二十元，需要付押金。'],
    ['Where can I return it?', '在哪里还车？'],
    ['Any station in the city centre before nine at night.', '市区任何站点，晚上九点前。'],
  ], [
    { word: 'deposit', meaning: '押金', type: 'new' },
    { word: 'city centre', meaning: '市中心', type: 'phrase' },
    { word: 'return', meaning: '归还', type: 'key' },
  ], [
    choice('How much does a day rental cost?', ['Twenty yuan', 'Twelve yuan', 'Fifty yuan', 'Two hundred yuan'], 'A', '一天二十元。'),
    blank('You need to leave a ____.', 'deposit'),
  ]),
  m('lm-18', 'A Phone Call to the Dentist', 'daily', 'EASY', 'A2', 1, ['daily'], [
    ['Good afternoon, this is the city dental clinic.', '下午好，这里是市口腔诊所。'],
    ['I would like to make an appointment for a check-up.', '我想预约一次检查。'],
    ['We have a free slot on Thursday at three.', '周四下午三点有空档。'],
    ['That works. See you then.', '可以，到时候见。'],
  ], [
    { word: 'appointment', meaning: '预约', type: 'new' },
    { word: 'check-up', meaning: '检查', type: 'key' },
    { word: 'slot', meaning: '时间段', type: 'new' },
  ], [
    choice('When is the free slot?', ['Thursday at three', 'Tuesday at three', 'Thursday at two', 'Friday at four'], 'A', '周四下午三点。'),
    blank('I would like to make an ____ for a check-up.', 'appointment'),
  ]),
  m('lm-19', 'Asking About a Part-time Job', 'business', 'EASY', 'A2', 1, ['business', 'campus'], [
    ['Are you still hiring for the weekend shift?', '你们还在招周末班吗？'],
    ['Yes, we need two more people at the café.', '是的，咖啡店还缺两个人。'],
    ['What are the working hours?', '工作时间是怎样的？'],
    ['From ten in the morning to four in the afternoon.', '上午十点到下午四点。'],
  ], [
    { word: 'part-time', meaning: '兼职', type: 'new' },
    { word: 'shift', meaning: '班次', type: 'key' },
    { word: 'hiring', meaning: '招聘', type: 'new' },
  ], [
    choice('How many more people does the café need?', ['Two', 'Four', 'Ten', 'One'], 'A', '咖啡店还缺两个人。'),
    blank('The shift runs from ten to ____ in the afternoon.', 'four'),
  ]),
  m('lm-20', 'A Brief Weather and Traffic Report', 'news', 'EASY', 'A2', 1, ['news'], [
    ['Good morning. Here is your city update.', '早上好，下面是本市资讯。'],
    ['Light rain is expected before noon, so take an umbrella.', '中午前预计有小雨，记得带伞。'],
    ['Traffic is slow on the river bridge.', '河桥路段车流缓慢。'],
    ['The metro is running normally.', '地铁运行正常。'],
  ], [
    { word: 'traffic', meaning: '交通', type: 'new' },
    { word: 'umbrella', meaning: '雨伞', type: 'new' },
    { word: 'normally', meaning: '正常地', type: 'key' },
  ], [
    choice('What is the advice about the weather?', ['Take an umbrella', 'Wear a coat', 'Stay at home', 'Drink more water'], 'A', '中午前有小雨，建议带伞。'),
    blank('Traffic is slow on the river ____.', 'bridge'),
  ]),

  // ======================= intensity 2 · CET-4 标准（cet4） =======================
  m('lm-21', 'A Campus Library Tour', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['The main library holds over two million books on five floors.', '主图书馆五层藏有超过两百万册图书。'],
    ['The quiet study zone is on the third floor, next to the windows.', '安静自习区在三楼靠窗一侧。'],
    ['Group discussion rooms can be booked online two days ahead.', '小组讨论室可提前两天在线预约。'],
    ['Most databases are available off campus with your student account.', '多数数据库可用学生账号在校外访问。'],
    ['Remember to keep your voice down in the reading areas.', '记得在阅览区保持低声。'],
  ], [
    { word: 'database', meaning: '数据库', type: 'new' },
    { word: 'keep your voice down', meaning: '压低声音', type: 'phrase' },
    { word: 'in advance', meaning: '提前', type: 'phrase' },
  ], [
    choice('Where is the quiet study zone?', ['On the third floor', 'On the first floor', 'In the basement', 'On the fifth floor'], 'A', '安静自习区在三楼。'),
    blank('Group rooms can be booked two days ____.', 'ahead'),
  ]),
  m('lm-22', 'Choosing a University Major', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['Choosing a major is really about matching your interests with your strengths.', '选专业本质上是在兴趣与长处之间找到匹配。'],
    ['Some students follow market trends, but the market changes quickly.', '有的学生追逐市场热点，但市场变化很快。'],
    ['Talk to graduates who already work in the field you are considering.', '和已经在你考虑的领域工作的毕业生聊聊。'],
    ['A degree is a starting point, not a life sentence.', '学位是起点，不是终身定论。'],
  ], [
    { word: 'major', meaning: '专业', type: 'new' },
    { word: 'market trends', meaning: '市场趋势', type: 'phrase' },
    { word: 'graduate', meaning: '毕业生', type: 'key' },
  ], [
    choice('What does the speaker advise students to do?', ['Talk to graduates in the field', 'Follow market trends', 'Choose the easiest major', 'Ask their parents'], 'A', '建议与从业毕业生交流。'),
    blank('A degree is a starting point, not a life ____.', 'sentence'),
  ]),
  m('lm-23', 'A Job Interview Introduction', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'business'], [
    ['Could you briefly introduce yourself and your experience?', '请简单介绍一下自己和你的经验。'],
    ['I graduated in marketing and worked three years at an advertising agency.', '我毕业于市场营销专业，在一家广告公司工作了三年。'],
    ['What do you consider your greatest strength?', '你认为自己最大的优势是什么？'],
    ['I stay calm under pressure and always meet deadlines.', '我在压力下保持冷静，并且总能按时交付。'],
  ], [
    { word: 'agency', meaning: '代理商', type: 'new' },
    { word: 'under pressure', meaning: '在压力下', type: 'phrase' },
    { word: 'meet deadlines', meaning: '按时完成', type: 'phrase' },
  ], [
    choice('What is the candidate\'s greatest strength?', ['Staying calm and meeting deadlines', 'Speaking many languages', 'Designing logos', 'Writing code'], 'A', '应聘者自述的优势是抗压与守时。'),
    blank('The candidate worked three years at an advertising ____.', 'agency'),
  ]),
  m('lm-24', 'Discussing a Group Project', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['We need to finish the presentation by Friday.', '我们必须在周五前完成演示。'],
    ['I can prepare the slides if you collect the data.', '如果你收集数据，我来做幻灯片。'],
    ['Deal. Let us meet on Thursday evening to practise.', '成交，周四晚上排练一遍。'],
    ['Perfect. I will book a study room in the library.', '好，我去图书馆订一间研讨室。'],
  ], [
    { word: 'presentation', meaning: '演示', type: 'new' },
    { word: 'collect the data', meaning: '收集数据', type: 'phrase' },
    { word: 'practise', meaning: '排练', type: 'key' },
  ], [
    choice('What will the speakers do on Thursday evening?', ['Practise the presentation', 'Hand in the report', 'Have dinner', 'Collect data'], 'A', '约定周四晚上排练。'),
    blank('They must finish the presentation by ____.', 'Friday', ['friday']),
  ]),
  m('lm-25', 'A Talk on Study Habits', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['Effective students do not study longer; they study with clear goals.', '高效的学习者不是学得更久，而是带着明确目标学。'],
    ['Break a big task into small steps and set a timer for each one.', '把大任务拆成小步骤，为每一步设一个计时器。'],
    ['Reviewing a little every day beats cramming the night before.', '每天复习一点胜过考前突击。'],
    ['Finally, sleep is part of learning, not a waste of time.', '最后，睡眠是学习的一部分，不是浪费时间。'],
  ], [
    { word: 'cramming', meaning: '突击学习', type: 'new' },
    { word: 'break into', meaning: '拆分成', type: 'phrase' },
    { word: 'with clear goals', meaning: '有明确目标', type: 'phrase' },
  ], [
    choice('According to the talk, what is a waste of time?', ['None of these options', 'Sleep', 'Reviewing daily', 'Setting goals'], 'A', '文中说睡眠不是浪费时间。'),
    blank('Reviewing a little every day beats____the night before.', 'cramming'),
  ]),
  m('lm-26', 'An Interview About Volunteering', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['Why did you start volunteering at the animal shelter?', '你为什么开始在动物收容所做志愿者？'],
    ['I wanted to do something useful with my weekends.', '我想让周末做点有意义的事。'],
    ['What have you learned from it?', '你从中学到了什么？'],
    ['Patience, and how to work with a team under pressure.', '耐心，以及如何在压力下与团队协作。'],
  ], [
    { word: 'volunteer', meaning: '做志愿者', type: 'new' },
    { word: 'shelter', meaning: '收容所', type: 'key' },
    { word: 'patience', meaning: '耐心', type: 'new' },
  ], [
    choice('Why did the speaker begin volunteering?', ['To do something useful at weekends', 'To earn money', 'To meet famous people', 'To travel abroad'], 'A', '想让周末更有意义。'),
    blank('The speaker learned ____ and teamwork.', 'patience'),
  ]),
  m('lm-27', 'A Customer Complaint Call', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'business'], [
    ['I am calling about an order that arrived damaged.', '我打电话反映一个到货损坏的订单。'],
    ['I am sorry to hear that. Could you give me the order number?', '很抱歉，请提供订单号。'],
    ['It is 58214. Two of the six glasses were broken.', '订单号 58214，六个杯子碎了两只。'],
    ['We will send replacements today at no extra cost.', '我们今天免费补寄替换品。'],
  ], [
    { word: 'damaged', meaning: '损坏的', type: 'new' },
    { word: 'replacement', meaning: '替换品', type: 'new' },
    { word: 'at no extra cost', meaning: '不额外收费', type: 'phrase' },
  ], [
    choice('What will the company do?', ['Send replacements today', 'Refuse the request', 'Close the account', 'Raise the price'], 'A', '公司当天免费补寄。'),
    blank('Two of the six ____ were broken.', 'glasses'),
  ]),
  m('lm-28', 'A Guide to Using the Metro', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'travel'], [
    ['The metro is the fastest way to cross the city during rush hour.', '高峰时段地铁是穿越城市最快的方式。'],
    ['Buy a stored-value card to avoid queuing at the machines.', '买张储值卡，省得在售票机前排队。'],
    ['Trains run every three minutes until midnight.', '列车每三分钟一班，运行至午夜。'],
    ['Please stand behind the yellow line while waiting.', '候车时请站在黄线后。'],
  ], [
    { word: 'stored-value card', meaning: '储值卡', type: 'phrase' },
    { word: 'rush hour', meaning: '高峰时段', type: 'phrase' },
    { word: 'queue', meaning: '排队', type: 'new' },
  ], [
    choice('How often do the trains run?', ['Every three minutes', 'Every ten minutes', 'Every hour', 'Every thirty minutes'], 'A', '每三分钟一班。'),
    blank('Trains run until ____.', 'midnight'),
  ]),
  m('lm-29', 'A Podcast About Time Management', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'business'], [
    ['Many people confuse being busy with being productive.', '很多人把忙碌误当成高效。'],
    ['Start each day by choosing the three tasks that matter most.', '每天先选三件最重要的事。'],
    ['Protect one hour of deep work without messages or calls.', '保护一小时不被打扰的深度工作时间。'],
    ['At the end of the day, review what actually moved forward.', '一天结束时，回顾真正推进了什么。'],
  ], [
    { word: 'productive', meaning: '高效的', type: 'new' },
    { word: 'deep work', meaning: '深度工作', type: 'phrase' },
    { word: 'matter most', meaning: '最重要', type: 'phrase' },
  ], [
    choice('How many key tasks should you choose each day?', ['Three', 'Five', 'Ten', 'One'], 'A', '每天选三件最重要的事。'),
    blank('Protect one hour of ____ work.', 'deep'),
  ]),
  m('lm-30', 'A Conversation About Weekend Travel', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'travel'], [
    ['Have you decided where to go for the long weekend?', '长假你想好去哪儿了吗？'],
    ['I am thinking of a small town near the mountains.', '我想去山边的一个小镇。'],
    ['You had better book the train tickets early.', '你最好早点订火车票。'],
    ['Right, I will book them tonight after dinner.', '对，我晚饭后就订。'],
  ], [
    { word: 'had better', meaning: '最好', type: 'grammar' },
    { word: 'long weekend', meaning: '长假', type: 'phrase' },
    { word: 'near the mountains', meaning: '山附近', type: 'phrase' },
  ], [
    choice('What should the person do early?', ['Book train tickets', 'Pack a coat', 'Call a hotel', 'Rent a car'], 'A', '建议早点订火车票。'),
    blank('I will book the tickets ____ after dinner.', 'tonight'),
  ]),
  m('lm-31', 'A Lecture on Note-taking', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['Good notes are not a copy of the lecture; they are a record of your thinking.', '好的笔记不是讲座的复制，而是你思考的记录。'],
    ['Use short symbols and leave space to add ideas later.', '用简短符号，并留出空间后续补充。'],
    ['Write questions in the margin when something is unclear.', '有疑问时在页边写下问题。'],
    ['Review your notes within twenty-four hours to keep them useful.', '24 小时内复习笔记，才能保持其价值。'],
  ], [
    { word: 'margin', meaning: '页边空白', type: 'new' },
    { word: 'symbol', meaning: '符号', type: 'new' },
    { word: 'within twenty-four hours', meaning: '24 小时内', type: 'phrase' },
  ], [
    choice('When should you review your notes?', ['Within twenty-four hours', 'After a week', 'Before the exam', 'Never'], 'A', '建议 24 小时内复习。'),
    blank('Write questions in the ____ when something is unclear.', 'margin'),
  ]),
  m('lm-32', 'A Talk About Learning English', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'campus'], [
    ['Learning English is a marathon, not a sprint.', '学英语是马拉松，不是短跑。'],
    ['Listen to something you enjoy every single day.', '每天听一点你喜欢的内容。'],
    ['Do not be afraid of making mistakes when you speak.', '开口时别怕犯错。'],
    ['Consistency matters far more than talent.', '坚持远比天赋重要。'],
  ], [
    { word: 'marathon', meaning: '马拉松', type: 'new' },
    { word: 'consistency', meaning: '坚持一致', type: 'new' },
    { word: 'be afraid of', meaning: '害怕', type: 'phrase' },
  ], [
    choice('What matters more than talent?', ['Consistency', 'Luck', 'Money', 'Age'], 'A', '文中说坚持比天赋更重要。'),
    blank('Learning English is a marathon, not a ____.', 'sprint'),
  ]),
  m('lm-33', 'A News Story About a Green Roof', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'news'], [
    ['A new office building has covered its roof with grass and wild flowers.', '一栋新写字楼在屋顶种上了草和野花。'],
    ['Green roofs help keep buildings cool in summer.', '绿色屋顶有助于夏季降温。'],
    ['They also absorb rainwater and reduce flooding.', '它们还能吸收雨水、减少内涝。'],
    ['The city plans to support fifty such projects this year.', '本市计划今年支持五十个此类项目。'],
  ], [
    { word: 'green roof', meaning: '绿色屋顶', type: 'phrase' },
    { word: 'absorb', meaning: '吸收', type: 'new' },
    { word: 'flooding', meaning: '内涝', type: 'new' },
  ], [
    choice('What do green roofs help do in summer?', ['Keep buildings cool', 'Raise the rent', 'Attract birds', 'Save water'], 'A', '绿色屋顶有助于夏季降温。'),
    blank('They can also ____ rainwater.', 'absorb'),
  ]),
  m('lm-34', 'A Discussion About Music', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'daily'], [
    ['What kind of music do you listen to while studying?', '你学习时听什么音乐？'],
    ['Mostly instrumental, because lyrics distract me.', '多是纯音乐，因为歌词让我分心。'],
    ['I cannot concentrate with any sound at all.', '我有一点声音都无法集中。'],
    ['Everyone is different; try a few options.', '因人而异，多试试几种。'],
  ], [
    { word: 'instrumental', meaning: '纯音乐的', type: 'new' },
    { word: 'distract', meaning: '使分心', type: 'new' },
    { word: 'concentrate', meaning: '集中注意力', type: 'key' },
  ], [
    choice('What kind of music does the first speaker prefer?', ['Instrumental music', 'Pop songs', 'Rock music', 'No music'], 'A', '喜欢纯音乐，歌词会分心。'),
    blank('Lyrics ____ me, so I choose instrumental music.', 'distract'),
  ]),
  m('lm-35', 'A Short Talk About Public Speaking', 'cet4', 'MEDIUM', 'B1', 2, ['cet4', 'business'], [
    ['Most people fear public speaking more than almost anything else.', '多数人对公开演讲的恐惧超过几乎所有事。'],
    ['Preparation is the best cure for nerves.', '准备是克服紧张的最佳良药。'],
    ['Practise out loud and time yourself before the real talk.', '正式演讲前大声练习并计时。'],
    ['Look at friendly faces in the audience to feel calm.', '看向观众中友善的面孔会让你平静。'],
  ], [
    { word: 'nerves', meaning: '紧张', type: 'new' },
    { word: 'out loud', meaning: '大声地', type: 'phrase' },
    { word: 'audience', meaning: '观众', type: 'new' },
  ], [
    choice('What is the best cure for nerves?', ['Preparation', 'Coffee', 'Silence', 'Deep breathing only'], 'A', '准备是克服紧张的最佳良药。'),
    blank('Look at friendly ____ in the audience.', 'faces'),
  ]),

  // ======================= intensity 3 · CET-6 强化（cet6/news） =======================
  m('lm-36', 'A News Report on Renewable Energy', 'news', 'HARD', 'B2', 3, ['cet6', 'news'], [
    ['Renewable sources now supply nearly a third of the country\'s electricity.', '可再生能源目前供应全国近三分之一的电力。'],
    ['Wind farms on the coast generated record output last month.', '沿海风电场上月发电量创下纪录。'],
    ['Engineers are testing batteries that can store power for several days.', '工程师正在测试可储电数日的电池。'],
    ['Analysts warn that grid upgrades are still needed.', '分析人士警告，电网升级仍然必要。'],
    ['Supporters say the shift will lower prices in the long run.', '支持者认为这一转变长期会降低电价。'],
  ], [
    { word: 'renewable', meaning: '可再生的', type: 'new' },
    { word: 'grid', meaning: '电网', type: 'new' },
    { word: 'in the long run', meaning: '从长远看', type: 'phrase' },
  ], [
    choice('What fraction of electricity comes from renewables?', ['About one third', 'About one half', 'About one tenth', 'None'], 'A', '约占三分之一。'),
    blank('Engineers are testing batteries that can store power for several ____.', 'days'),
  ]),
  m('lm-37', 'A Business Podcast on Remote Work', 'news', 'HARD', 'B2', 3, ['cet6', 'business'], [
    ['Remote work has changed how companies measure productivity.', '远程办公改变了公司衡量生产力的方式。'],
    ['Managers now focus on results rather than hours at a desk.', '管理者现在关注结果而非在岗时长。'],
    ['However, some teams struggle to build trust without meeting in person.', '然而，有些团队不面对面就难以建立信任。'],
    ['Many firms are adopting a hybrid model as a compromise.', '许多公司采用混合办公作为折中。'],
  ], [
    { word: 'productivity', meaning: '生产力', type: 'new' },
    { word: 'hybrid model', meaning: '混合模式', type: 'phrase' },
    { word: 'rather than', meaning: '而不是', type: 'grammar' },
  ], [
    choice('What do managers focus on now?', ['Results', 'Hours at a desk', 'Office size', 'Dress code'], 'A', '关注结果而非时长。'),
    blank('Many firms adopt a ____ model as a compromise.', 'hybrid'),
  ]),
  m('lm-38', 'A Science Short: Sleep and Memory', 'news', 'HARD', 'B2', 3, ['cet6', 'news'], [
    ['Scientists believe sleep plays a central role in forming memories.', '科学家认为睡眠在记忆形成中起核心作用。'],
    ['During deep sleep, the brain replays the day\'s experiences.', '深度睡眠时，大脑会回放当天的经历。'],
    ['This process helps move information into long-term storage.', '这一过程把信息转入长期存储。'],
    ['Skipping sleep can weaken what you learned the day before.', '缺少睡眠会削弱你前一天所学。'],
  ], [
    { word: 'replay', meaning: '回放', type: 'new' },
    { word: 'long-term storage', meaning: '长期存储', type: 'phrase' },
    { word: 'play a role in', meaning: '在……中起作用', type: 'grammar' },
  ], [
    choice('What does the brain do during deep sleep?', ['Replays the day\'s experiences', 'Stops all activity', 'Grows taller', 'Burns fat'], 'A', '深度睡眠时回放当天经历。'),
    blank('Sleep helps move information into ____ storage.', 'long-term', ['long term']),
  ]),
  m('lm-39', 'A Lecture on Urban Design', 'news', 'HARD', 'B2', 3, ['cet6', 'academic'], [
    ['Cities that prioritise pedestrians tend to be healthier and more social.', '以人为本的城市往往更健康、更有社交活力。'],
    ['Widening roads often increases traffic rather than reducing it.', '拓宽道路往往增加而非减少车流。'],
    ['Plazas and parks give residents a place to gather.', '广场与公园为居民提供聚集空间。'],
    ['Good design is not only about appearance but about daily life.', '好的设计不仅关乎外观，更关乎日常生活。'],
  ], [
    { word: 'pedestrian', meaning: '行人', type: 'new' },
    { word: 'plaza', meaning: '广场', type: 'new' },
    { word: 'prioritise', meaning: '优先考虑', type: 'new' },
  ], [
    choice('What does widening roads often do?', ['Increase traffic', 'Reduce traffic a lot', 'Lower the population', 'Save money'], 'A', '往往增加车流。'),
    blank('Plazas and parks give residents a place to ____.', 'gather'),
  ]),
  m('lm-40', 'An Interview With a Startup Founder', 'news', 'HARD', 'B2', 3, ['cet6', 'business'], [
    ['Why did you leave a stable job to start a company?', '你为什么放弃稳定的工作去创业？'],
    ['I wanted to solve a problem I cared about.', '我想解决一个我在意的问题。'],
    ['What was the hardest part?', '最难的部分是什么？'],
    ['Building the team, because trust takes time.', '搭建团队，因为信任需要时间。'],
    ['Revenue came later, but it gave us freedom.', '收入来得更晚，但给了我们自由。'],
  ], [
    { word: 'startup', meaning: '初创公司', type: 'new' },
    { word: 'revenue', meaning: '收入', type: 'new' },
    { word: 'take time', meaning: '需要时间', type: 'phrase' },
  ], [
    choice('What was the hardest part for the founder?', ['Building the team', 'Finding an idea', 'Raising prices', 'Moving offices'], 'A', '最难的是搭建团队。'),
    blank('____ came later but gave the team freedom.', 'Revenue', ['revenue']),
  ]),
  m('lm-41', 'A Report on Ocean Plastic', 'news', 'HARD', 'B2', 3, ['cet6', 'news'], [
    ['Millions of tonnes of plastic enter the ocean every year.', '每年有数百万吨塑料进入海洋。'],
    ['Sunlight and waves break it into tiny pieces called microplastics.', '阳光和海浪把它分解成微塑料。'],
    ['These particles are now found in fish, salt and drinking water.', '这些颗粒如今出现在鱼类、盐和饮用水中。'],
    ['Researchers argue that reducing production is the real solution.', '研究人员认为减少生产才是根本之道。'],
  ], [
    { word: 'microplastics', meaning: '微塑料', type: 'new' },
    { word: 'particle', meaning: '颗粒', type: 'new' },
    { word: 'break into', meaning: '分解成', type: 'phrase' },
  ], [
    choice('What breaks plastic into microplastics?', ['Sunlight and waves', 'Fish and birds', 'Rain only', 'Cold water'], 'A', '阳光与海浪使其分解。'),
    blank('Researchers argue that reducing ____ is the real solution.', 'production'),
  ]),
  m('lm-42', 'A Talk on Digital Privacy', 'news', 'HARD', 'B2', 3, ['cet6', 'academic'], [
    ['Every app you install may collect more data than you realise.', '你安装的每个应用可能收集的数据超乎想象。'],
    ['Read the privacy settings and turn off what you do not need.', '查看隐私设置，关掉不需要的选项。'],
    ['Use different passwords for important accounts.', '为重要账户使用不同的密码。'],
    ['Convenience and privacy are often in tension.', '便利与隐私常常相互紧张。'],
  ], [
    { word: 'privacy', meaning: '隐私', type: 'new' },
    { word: 'in tension', meaning: '存在张力', type: 'phrase' },
    { word: 'account', meaning: '账户', type: 'key' },
  ], [
    choice('What should you do with privacy settings?', ['Turn off what you do not need', 'Ignore them', 'Share them online', 'Delete the phone'], 'A', '关掉不需要的隐私选项。'),
    blank('Use different ____ for important accounts.', 'passwords'),
  ]),
  m('lm-43', 'A Campus Radio Interview About Research', 'news', 'HARD', 'B2', 3, ['cet6', 'campus'], [
    ['Tell us about your research on city noise.', '谈谈你关于城市噪音的研究吧。'],
    ['We measured sound levels in twelve neighbourhoods.', '我们测量了十二个社区的声级。'],
    ['We found that green spaces reduce perceived noise significantly.', '我们发现绿地能显著降低主观噪音感。'],
    ['The findings may guide future planning rules.', '这些发现或可指导未来的规划规则。'],
  ], [
    { word: 'significantly', meaning: '显著地', type: 'new' },
    { word: 'perceived', meaning: '感知到的', type: 'new' },
    { word: 'guide', meaning: '指导', type: 'key' },
  ], [
    choice('What reduces perceived noise?', ['Green spaces', 'Taller buildings', 'More cars', 'Bright lights'], 'A', '绿地能降低主观噪音感。'),
    blank('The team measured sound levels in ____ neighbourhoods.', 'twelve'),
  ]),
  m('lm-44', 'A Short Talk on Museums', 'news', 'HARD', 'B2', 3, ['cet6', 'academic'], [
    ['Modern museums are shifting from showing objects to telling stories.', '现代博物馆正从陈列物件转向讲述故事。'],
    ['Visitors are invited to touch, listen and even debate.', '参观者被邀请去触摸、聆听甚至辩论。'],
    ['Digital guides let people explore at their own pace.', '数字导览让人们按自己的节奏探索。'],
    ['The goal is to make history feel alive.', '目标是让历史鲜活起来。'],
  ], [
    { word: 'shift from', meaning: '从……转变', type: 'grammar' },
    { word: 'at their own pace', meaning: '按自己的节奏', type: 'phrase' },
    { word: 'debate', meaning: '辩论', type: 'new' },
  ], [
    choice('What are modern museums shifting towards?', ['Telling stories', 'Storing objects', 'Closing halls', 'Selling more tickets'], 'A', '转向讲述故事。'),
    blank('Digital guides let people explore at their own ____.', 'pace'),
  ]),
  m('lm-45', 'A Report on Food Waste', 'news', 'HARD', 'B2', 3, ['cet6', 'news'], [
    ['Roughly a third of all food produced is never eaten.', '大约三分之一的食物从未被食用。'],
    ['Much of it is thrown away by households and supermarkets.', '其中很多被家庭和超市丢弃。'],
    ['Simple changes, such as planning meals, cut waste sharply.', '诸如规划餐食这样的简单改变能大幅减少浪费。'],
    ['Some cities now collect food waste for composting.', '一些城市已开始收集厨余用于堆肥。'],
  ], [
    { word: 'composting', meaning: '堆肥', type: 'new' },
    { word: 'throw away', meaning: '丢弃', type: 'phrase' },
    { word: 'sharply', meaning: '大幅地', type: 'key' },
  ], [
    choice('How much food is never eaten?', ['About a third', 'About a half', 'Almost none', 'About a tenth'], 'A', '约三分之一。'),
    blank('Some cities collect food waste for ____.', 'composting'),
  ]),
  m('lm-46', 'A Discussion About Language Learning in Adults', 'news', 'HARD', 'B2', 3, ['cet6', 'academic'], [
    ['Adults can absolutely learn a new language well.', '成年人完全可以学好一门新语言。'],
    ['Children may imitate sounds more easily, but adults understand grammar faster.', '孩子模仿发音更容易，但成人理解语法更快。'],
    ['Motivation and daily practice matter most.', '动机与每日练习最为关键。'],
    ['Setting a real goal, like a trip, keeps learners going.', '设定一个真实目标（如一次旅行）能让学习者坚持。'],
  ], [
    { word: 'imitate', meaning: '模仿', type: 'new' },
    { word: 'motivation', meaning: '动机', type: 'new' },
    { word: 'keep going', meaning: '坚持下去', type: 'phrase' },
  ], [
    choice('What do adults do faster than children, according to the talk?', ['Understand grammar', 'Imitate sounds', 'Sing songs', 'Learn slang'], 'A', '成人理解语法更快。'),
    blank('____ and daily practice matter most.', 'Motivation', ['motivation']),
  ]),
  m('lm-47', 'A News Feature on Small Businesses', 'news', 'HARD', 'B2', 3, ['cet6', 'business'], [
    ['Small shops are finding new ways to compete with large chains.', '小商店正在寻找与大连锁竞争的新方式。'],
    ['Many now sell online and offer same-day local delivery.', '许多开始线上销售并提供当日本地配送。'],
    ['Others focus on personal service that big stores cannot match.', '另一些专注大店无法提供的个性化服务。'],
    ['Community support has been vital for their survival.', '社区支持对其生存至关重要。'],
  ], [
    { word: 'compete with', meaning: '与……竞争', type: 'phrase' },
    { word: 'vital', meaning: '至关重要的', type: 'new' },
    { word: 'delivery', meaning: '配送', type: 'new' },
  ], [
    choice('What kind of service do some small shops focus on?', ['Personal service', 'Lower wages', 'Larger stores', 'Free cars'], 'A', '专注个性化服务。'),
    blank('Community support has been ____ for their survival.', 'vital'),
  ]),
  m('lm-48', 'A Lecture on Space Exploration', 'news', 'HARD', 'B2', 3, ['cet6', 'academic'], [
    ['Space exploration is often criticised as a waste of money.', '太空探索常被批评为浪费金钱。'],
    ['Supporters point to spin-off technologies we use every day.', '支持者指出我们每天使用的衍生技术。'],
    ['Weather satellites and GPS came from space programmes.', '气象卫星与 GPS 都源于太空项目。'],
    ['The debate is really about priorities, not science.', '这场争论实质关乎优先级，而非科学。'],
  ], [
    { word: 'spin-off', meaning: '衍生的', type: 'new' },
    { word: 'criticise', meaning: '批评', type: 'new' },
    { word: 'point to', meaning: '指出', type: 'phrase' },
  ], [
    choice('What came from space programmes?', ['Weather satellites and GPS', 'Only telescopes', 'New languages', 'Farm tools'], 'A', '气象卫星与 GPS。'),
    blank('The debate is really about ____, not science.', 'priorities'),
  ]),
  m('lm-49', 'A Short Documentary on Bees', 'news', 'HARD', 'B2', 3, ['cet6', 'news'], [
    ['Bees pollinate a large share of the food we eat.', '蜜蜂为我们食用的很大一部分作物授粉。'],
    ['Their numbers have fallen because of disease and chemicals.', '由于疾病和化学药剂，它们的数量下降了。'],
    ['Farmers are planting wild flowers to help them.', '农民正在种植野花帮助它们。'],
    ['Protecting bees is protecting our food supply.', '保护蜜蜂就是保护我们的食物供给。'],
  ], [
    { word: 'pollinate', meaning: '授粉', type: 'new' },
    { word: 'food supply', meaning: '食物供给', type: 'phrase' },
    { word: 'chemicals', meaning: '化学药剂', type: 'new' },
  ], [
    choice('Why have bee numbers fallen?', ['Disease and chemicals', 'Cold summers', 'Too many flowers', 'Fewer farms'], 'A', '因疾病与化学药剂。'),
    blank('Farmers are planting wild ____ to help bees.', 'flowers'),
  ]),

  // ======================= intensity 4 · 高阶话题（news/academic） =======================
  m('lm-50', 'A Lecture on Behavioural Economics', 'news', 'HARD', 'C1', 4, ['academic', 'business'], [
    ['Traditional economics assumes people always act rationally.', '传统经济学假设人总是理性行事。'],
    ['Behavioural economics shows that small nudges can change decisions.', '行为经济学表明，小小的助推就能改变决策。'],
    ['Defaults, for example, strongly influence what people choose.', '例如，默认选项会强烈影响人们的选择。'],
    ['Policymakers now use these insights to design better programmes.', '政策制定者如今用这些洞见设计更好的方案。'],
    ['Critics warn against using nudges to manipulate the public.', '批评者警告不要用助推操纵公众。'],
  ], [
    { word: 'nudge', meaning: '助推', type: 'new' },
    { word: 'rational', meaning: '理性的', type: 'new' },
    { word: 'default', meaning: '默认选项', type: 'key' },
  ], [
    choice('What strongly influences people\'s choices?', ['Defaults', 'Weather', 'Age', 'Traffic'], 'A', '默认选项影响强烈。'),
    blank('Behavioural economics shows that small ____ can change decisions.', 'nudges'),
  ]),
  m('lm-51', 'A Panel on Artificial Intelligence and Work', 'news', 'HARD', 'C1', 4, ['academic', 'business'], [
    ['Artificial intelligence is reshaping many kinds of work.', '人工智能正在重塑许多类型的工作。'],
    ['Some tasks will be automated, while new roles will appear.', '有些任务将被自动化，同时新岗位会出现。'],
    ['The key question is how quickly workers can retrain.', '关键问题是劳动者能多快再培训。'],
    ['Education systems must adapt to keep pace.', '教育体系必须适应以跟上步伐。'],
  ], [
    { word: 'automate', meaning: '自动化', type: 'new' },
    { word: 'retrain', meaning: '再培训', type: 'new' },
    { word: 'keep pace', meaning: '跟上', type: 'phrase' },
  ], [
    choice('What is the key question according to the panel?', ['How quickly workers can retrain', 'Who owns the robots', 'When AI will end', 'Which country wins'], 'A', '关键是再培训的速度。'),
    blank('Education systems must adapt to keep ____.', 'pace'),
  ]),
  m('lm-52', 'A Feature on Climate Migration', 'news', 'HARD', 'C1', 4, ['news', 'academic'], [
    ['Rising seas are forcing some coastal communities to move inland.', '海平面上升正迫使部分沿海社区向内陆迁移。'],
    ['Such migration is often gradual rather than sudden.', '这类迁移往往是渐进的而非突发的。'],
    ['Governments face hard choices about funding new settlements.', '政府在为新定居点拨款上面临艰难抉择。'],
    ['Early planning can reduce the human cost.', '提前规划能降低人道代价。'],
  ], [
    { word: 'migration', meaning: '迁移', type: 'new' },
    { word: 'inland', meaning: '向内陆', type: 'new' },
    { word: 'gradual', meaning: '渐进的', type: 'key' },
  ], [
    choice('How does the migration usually happen?', ['Gradually', 'Suddenly overnight', 'By plane', 'In one year'], 'A', '通常是渐进的。'),
    blank('Early ____ can reduce the human cost.', 'planning'),
  ]),
  m('lm-53', 'A Science Feature on Gene Editing', 'news', 'HARD', 'C1', 4, ['academic', 'news'], [
    ['Gene editing tools allow scientists to change DNA precisely.', '基因编辑工具让科学家能精确改变 DNA。'],
    ['They could treat inherited diseases that were once incurable.', '它们或可治疗曾经无法治愈的遗传病。'],
    ['Yet editing human embryos raises serious ethical questions.', '然而编辑人类胚胎引发严重伦理问题。'],
    ['Most countries have strict rules on such research.', '多数国家对此类研究有严格规定。'],
  ], [
    { word: 'gene editing', meaning: '基因编辑', type: 'phrase' },
    { word: 'inherited', meaning: '遗传的', type: 'new' },
    { word: 'ethical', meaning: '伦理的', type: 'new' },
  ], [
    choice('What concern does the feature raise?', ['Ethical questions', 'Cost of paper', 'Weather', 'Sports rules'], 'A', '引发伦理问题。'),
    blank('Gene editing could treat ____ diseases.', 'inherited'),
  ]),
  m('lm-54', 'A Lecture on the History of Writing', 'news', 'HARD', 'C1', 4, ['academic', 'history'], [
    ['Writing was invented independently in several ancient societies.', '书写在多个古代社会被独立发明。'],
    ['The earliest records were mainly lists of goods and taxes.', '最早的记录主要是货物与税收清单。'],
    ['Over time, writing became a tool for stories and law.', '随着时间推移，书写成为故事与法律的工具。'],
    ['Each writing system shaped how people thought.', '每种书写体系都塑造了人们的思维方式。'],
  ], [
    { word: 'independently', meaning: '独立地', type: 'new' },
    { word: 'ancient', meaning: '古代的', type: 'key' },
    { word: 'shaped', meaning: '塑造', type: 'key' },
  ], [
    choice('What were the earliest records mainly about?', ['Goods and taxes', 'Poems', 'Maps', 'Recipes'], 'A', '货物与税收清单。'),
    blank('Each writing system ____ how people thought.', 'shaped'),
  ]),
  m('lm-55', 'A Panel on Sustainable Cities', 'news', 'HARD', 'C1', 4, ['academic', 'news'], [
    ['More than half of the world\'s people now live in cities.', '全球超过一半的人口如今居住在城市。'],
    ['Sustainable cities need efficient transport and clean power.', '可持续城市需要高效交通与清洁能源。'],
    ['Dense neighbourhoods can actually use less energy per person.', '高密度社区人均能耗反而更低。'],
    ['Citizens must be involved in planning decisions.', '市民必须参与规划决策。'],
  ], [
    { word: 'sustainable', meaning: '可持续的', type: 'new' },
    { word: 'dense', meaning: '高密度的', type: 'new' },
    { word: 'be involved in', meaning: '参与', type: 'phrase' },
  ], [
    choice('Dense neighbourhoods tend to use…', ['Less energy per person', 'More energy per person', 'The same energy', 'No energy'], 'A', '人均能耗更低。'),
    blank('Sustainable cities need efficient transport and clean ____.', 'power'),
  ]),
  m('lm-56', 'A News Analysis on the Global Chip Supply', 'news', 'HARD', 'C1', 4, ['news', 'business'], [
    ['A shortage of computer chips disrupted many industries.', '芯片短缺扰乱了众多行业。'],
    ['Car makers were among the hardest hit.', '汽车制造商受冲击最大。'],
    ['Firms are now building new factories closer to home.', '企业正把新工厂建在更靠近本土的地方。'],
    ['Analysts say the supply chain will remain fragile for years.', '分析人士称供应链数年内仍将脆弱。'],
  ], [
    { word: 'shortage', meaning: '短缺', type: 'new' },
    { word: 'disrupt', meaning: '扰乱', type: 'new' },
    { word: 'fragile', meaning: '脆弱的', type: 'new' },
  ], [
    choice('Which industry was hit hardest?', ['Car makers', 'Bookshops', 'Hotels', 'Farms'], 'A', '汽车制造业受冲击最大。'),
    blank('Firms are building new factories closer to ____.', 'home'),
  ]),
  m('lm-57', 'A Lecture on Memory and Forgetting', 'news', 'HARD', 'C1', 4, ['academic'], [
    ['Forgetting is not a failure of memory; it is part of how it works.', '遗忘不是记忆的失败，而是其运作的一部分。'],
    ['Our brains keep what seems useful and let the rest fade.', '大脑保留有用的，让其余淡去。'],
    ['Context at the time of learning improves later recall.', '学习时的情境能提升后续回忆。'],
    ['Testing yourself is more effective than rereading.', '自我测试比反复阅读更有效。'],
  ], [
    { word: 'fade', meaning: '淡去', type: 'new' },
    { word: 'recall', meaning: '回忆', type: 'new' },
    { word: 'by heart', meaning: '凭记忆', type: 'phrase' },
  ], [
    choice('What improves later recall?', ['Context at learning', 'Sleeping less', 'Reading once', 'Loud music'], 'A', '学习时的情境有助回忆。'),
    blank('Testing yourself is more effective than ____.', 'rereading'),
  ]),
  m('lm-58', 'A Documentary on Deep-Sea Exploration', 'news', 'HARD', 'C1', 4, ['academic', 'news'], [
    ['The deep ocean remains one of the least explored places on Earth.', '深海仍是地球上探索最少的地方之一。'],
    ['New vehicles can survive crushing pressure and total darkness.', '新型载具能承受巨大压力与彻底黑暗。'],
    ['Scientists have discovered species that produce their own light.', '科学家发现了能自行发光的物种。'],
    ['Each dive adds to our understanding of life.', '每次下潜都增进我们对生命的理解。'],
  ], [
    { word: 'crushing pressure', meaning: '巨大压力', type: 'phrase' },
    { word: 'species', meaning: '物种', type: 'new' },
    { word: 'explored', meaning: '被探索的', type: 'key' },
  ], [
    choice('What have scientists discovered?', ['Species that produce their own light', 'New planets', 'Ancient cities', 'Flying fish'], 'A', '发现了能自行发光的物种。'),
    blank('The deep ocean is one of the least ____ places on Earth.', 'explored'),
  ]),
  m('lm-59', 'A Panel on Mental Health at Work', 'news', 'HARD', 'C1', 4, ['business', 'academic'], [
    ['Mental health is now recognised as central to workplace performance.', '心理健康如今被视为工作表现的核心。'],
    ['Long hours and unclear goals raise the risk of burnout.', '长时间工作和目标不清会提高倦怠风险。'],
    ['Managers can help by setting realistic expectations.', '管理者可通过设定现实期望来提供帮助。'],
    ['Support should be normal, not a sign of weakness.', '寻求支持应属常态，而非软弱的表现。'],
  ], [
    { word: 'burnout', meaning: '职业倦怠', type: 'new' },
    { word: 'realistic', meaning: '现实的', type: 'key' },
    { word: 'a sign of', meaning: '……的标志', type: 'phrase' },
  ], [
    choice('What raises the risk of burnout?', ['Long hours and unclear goals', 'Short meetings', 'Clear targets', 'Regular breaks'], 'A', '长工时与目标不清。'),
    blank('Support should be normal, not a sign of ____.', 'weakness'),
  ]),
  m('lm-60', 'A Closing Address on Lifelong Learning', 'news', 'HARD', 'C1', 4, ['academic'], [
    ['The skills we learn today may be outdated in a decade.', '我们今天学的技能十年后可能过时。'],
    ['That is why learning how to learn matters more than any single subject.', '因此，学会如何学习比任何单一学科都重要。'],
    ['Curiosity keeps the mind flexible and open.', '好奇心让思维灵活开放。'],
    ['Every day is a chance to know a little more.', '每天都是多懂一点的机会。'],
  ], [
    { word: 'outdated', meaning: '过时的', type: 'new' },
    { word: 'curiosity', meaning: '好奇心', type: 'new' },
    { word: 'how to learn', meaning: '如何学习', type: 'phrase' },
  ], [
    choice('What matters more than any single subject?', ['Learning how to learn', 'Memorising facts', 'Getting high grades', 'Working alone'], 'A', '学会如何学习更重要。'),
    blank('____ keeps the mind flexible and open.', 'Curiosity', ['curiosity']),
  ]),
]

/** 按 intensityLevel 分档计数（自检用） */
export function countByIntensity(): Record<IntensityLevel, number> {
  return LISTENING_P2.reduce(
    (acc, m2) => {
      acc[m2.intensityLevel] += 1
      return acc
    },
    { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<IntensityLevel, number>,
  )
}
