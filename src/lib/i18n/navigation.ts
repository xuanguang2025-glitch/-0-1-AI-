/**
 * next-intl 导航封装：与 routing 对齐的 Link/redirect/usePathname。
 */
import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
