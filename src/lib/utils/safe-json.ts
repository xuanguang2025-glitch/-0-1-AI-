/**
 * Prisma `Json` 字段适配层（架构 §10.6 —— SQLite 逃生通道的唯一前提）。
 *
 * 铁律：**任何 Prisma `Json` 字段的读写必须经此适配层**，禁止直接 `JSON.parse(model.column)`。
 * - PostgreSQL：JSONB 原生返回对象 → `parseJson` 原样透传；写入原样传对象；
 * - SQLite（DB_DRIVER=sqlite）：Json 列实际为 String → `stringifyJson` 序列化写入，
 *   `parseJson` 反序列化读取。
 */

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

export function stringifyJson(value: unknown): unknown {
  if (process.env.DB_DRIVER === 'sqlite') {
    return value == null ? value : JSON.stringify(value)
  }
  return value
}

/**
 * 安全读取 JSONB 中某个数组字段（如 `definitions` / `contentBlocks`）。
 * 非数组一律返回空数组，保证下游 `.map` 不炸。
 */
export function parseJsonArray<T>(value: unknown): T[] {
  const parsed = parseJson<unknown>(value, null)
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

/** 安全读取 JSONB 对象字段；非对象返回 `fallback`。 */
export function parseJsonObject<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T,
): T {
  const parsed = parseJson<unknown>(value, null)
  return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as T)
    : fallback
}
