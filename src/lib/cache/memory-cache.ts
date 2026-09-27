/**
 * 进程内 TTL 缓存（架构 §1.4.7）：词库列表/语法分类等低频变化数据，300s。
 * 单实例够用；接口与常见外部缓存库对齐，替换实现不影响调用方。
 */

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

const MAX_ENTRIES = 1000

/** 读缓存；过期或不存在返回 undefined */
export function memoryGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return undefined
  if (entry.expiresAt < Date.now()) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

/** 写缓存（超过容量时丢弃最早写入的条目） */
export function memorySet<T>(key: string, value: T, ttlMs: number): void {
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/** 读-或-回源：缓存命中直接返回，否则执行 fetcher 并写缓存 */
export async function memoryCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = memoryGet<T>(key)
  if (hit !== undefined) return hit
  const value = await fetcher()
  memorySet(key, value, ttlMs)
  return value
}

/** 失效单个 key */
export function memoryDelete(key: string): void {
  store.delete(key)
}

/** 按前缀批量失效（如 `vocab:book:*`） */
export function memoryDeletePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

/** 清空（测试用） */
export function memoryClear(): void {
  store.clear()
}
