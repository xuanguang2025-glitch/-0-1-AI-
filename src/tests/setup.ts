/**
 * Vitest setup（T10）：纯函数层单测无需 DB/AI，
 * 仅补齐测试环境的确定性（时区固定为 Asia/Shanghai 与生产默认一致）。
 */
process.env.TZ = 'Asia/Shanghai'
// NODE_ENV 在 vitest 中由运行时锁定，用赋值绕过只读类型声明
const env = process.env as { NODE_ENV?: string }
env.NODE_ENV = 'test'
