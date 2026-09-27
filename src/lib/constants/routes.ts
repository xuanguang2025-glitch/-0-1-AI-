/**
 * 路由常量（架构 §7.5）：导航与跳转唯一来源，禁止散落字符串。
 */

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  vocabulary: {
    root: '/vocabulary',
    library: '/vocabulary/library',
    review: '/vocabulary/review',
    learn: '/vocabulary/learn',
    notebook: '/vocabulary/notebook',
    records: '/vocabulary/records',
  },
  listening: '/listening',
  speaking: '/speaking',
  reading: '/reading',
  writing: '/writing',
  grammar: '/grammar',
  translation: '/translation',
  exam: '/exam',
  placement: '/placement',
  tutor: '/tutor',
  profile: '/profile',
  settings: '/settings',
  achievements: '/achievements',
  analytics: '/analytics',
  subscription: '/subscription',
  devUiKit: '/dev/ui-kit',
  admin: '/admin',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** 底部导航（≤768 显示，PRD §5.2） */
export const BOTTOM_NAV_ITEMS = [
  { href: ROUTES.dashboard, labelKey: 'nav.dashboard', icon: 'home' },
  { href: ROUTES.vocabulary.root, labelKey: 'nav.vocabulary', icon: 'book' },
  { href: ROUTES.tutor, labelKey: 'nav.tutor', icon: 'message' },
  { href: ROUTES.exam, labelKey: 'nav.exam', icon: 'clipboard' },
  { href: ROUTES.profile, labelKey: 'nav.profile', icon: 'user' },
] as const

/** 侧边栏主分组 */
export const SIDEBAR_GROUPS = [
  {
    labelKey: 'nav.group.learn',
    items: [
      { href: ROUTES.dashboard, labelKey: 'nav.dashboard', icon: 'home' },
      { href: ROUTES.vocabulary.root, labelKey: 'nav.vocabulary', icon: 'book' },
      { href: ROUTES.listening, labelKey: 'nav.listening', icon: 'headphones' },
      { href: ROUTES.speaking, labelKey: 'nav.speaking', icon: 'mic' },
      { href: ROUTES.reading, labelKey: 'nav.reading', icon: 'bookOpen' },
      { href: ROUTES.writing, labelKey: 'nav.writing', icon: 'penLine' },
      { href: ROUTES.grammar, labelKey: 'nav.grammar', icon: 'spellCheck' },
      { href: ROUTES.translation, labelKey: 'nav.translation', icon: 'languages' },
    ],
  },
  {
    labelKey: 'nav.group.exam',
    items: [
      { href: ROUTES.exam, labelKey: 'nav.exam', icon: 'clipboard' },
      { href: ROUTES.placement, labelKey: 'nav.placement', icon: 'target' },
    ],
  },
  {
    labelKey: 'nav.group.me',
    items: [
      { href: ROUTES.profile, labelKey: 'nav.profile', icon: 'user' },
      { href: ROUTES.achievements, labelKey: 'nav.achievements', icon: 'trophy' },
      { href: ROUTES.analytics, labelKey: 'nav.analytics', icon: 'chart' },
      { href: ROUTES.settings, labelKey: 'nav.settings', icon: 'settings' },
    ],
  },
] as const
