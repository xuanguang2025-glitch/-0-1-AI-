/**
 * 分页 / 排序 / 筛选统一约定（架构 §3.3）。
 * page 从 1 开始，默认 pageSize=20，最大 100。
 */
import type { ApiMeta } from '@/types/api'

export interface PageParams {
  page: number
  pageSize: number
  skip: number
  take: number
}

export interface SortParam {
  field: string
  order: 'asc' | 'desc'
}

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

/** 解析 page/pageSize；非法值静默回退默认 */
export function parsePage(searchParams: URLSearchParams): PageParams {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const rawSize = Number.parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10)
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 1 ? Math.min(rawSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

/**
 * 解析 sort=field:asc|desc（多字段逗号分隔），仅允许白名单字段，防注入。
 * @param raw    原始 sort 参数
 * @param allowed 允许排序的字段集合
 */
export function parseSort(raw: string | null, allowed: readonly string[]): SortParam[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [field, order] = part.split(':')
      return { field: field ?? '', order: order === 'asc' ? ('asc' as const) : ('desc' as const) }
    })
    .filter((s) => allowed.includes(s.field))
}

/** 转 Prisma orderBy（字段已过白名单） */
export function toOrderBy<T extends string>(sorts: SortParam[], fallback: SortParam[] = []): Array<Record<string, 'asc' | 'desc'>> {
  const list = sorts.length > 0 ? sorts : fallback
  return list.map((s) => ({ [s.field]: s.order }) as Record<T, 'asc' | 'desc'>)
}

/** 由 page 结果构造 meta */
export function buildMeta(params: PageParams, total: number): ApiMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize))
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  }
}
