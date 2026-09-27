#!/usr/bin/env node
/**
 * EnglishAI · Tier A 内嵌 PostgreSQL 单例守护（架构 §2.6.1-④）
 *
 * 职责：
 *  1. 数据目录 `.data/pg` 已初始化（存在 PG_VERSION）→ 跳过 initdb（坑①：initialise() 非幂等）
 *  2. 已在跑（pid 文件存活 / 端口可连）→ 提示后 exit 0（可重复执行）
 *  3. 启动后建库 englishai / englishai_test（坑②：createDatabase() 非幂等 → try/catch）
 *  4. 打印 SELECT version() 与 DATABASE_URL，前台常驻直至 SIGINT/SIGTERM
 *
 * 端口 5433 · 认证 scram-sha-256 · initdb --encoding=UTF8 --locale=C
 * ⚠️ 永不设置 persistent: false —— stop() 会删库。
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = process.env.PG_DATA_DIR
  ? path.resolve(ROOT, process.env.PG_DATA_DIR)
  : path.join(ROOT, '.data', 'pg')
const PID_FILE = path.join(ROOT, '.data', 'pg.pid')
const PORT = Number(process.env.PG_PORT ?? 5433)
const USER = 'englishai'
const PASSWORD = process.env.PG_PASSWORD ?? 'englishai'
const DB = 'englishai'
const TEST_DB = 'englishai_test'

const log = (msg) => process.stdout.write(`[db] ${msg}\n`)
const warn = (msg) => process.stderr.write(`[db-warn] ${msg}\n`)

const isInitialised = () => fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))

const pidAlive = () => {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf8').trim()
    const pid = Number(raw)
    if (!Number.isFinite(pid) || pid <= 0) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** 端口探活（pid 文件丢失但仍有人在监听时，避免重复拉起第二个实例） */
const portInUse = (port, host = '127.0.0.1', timeoutMs = 1500) =>
  new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })

fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true })
fs.mkdirSync(path.dirname(PID_FILE), { recursive: true })

// ---- 单例控制 --------------------------------------------------------------
if (pidAlive()) {
  log(`already running (pid file ${path.relative(ROOT, PID_FILE)}) → skip`)
  process.exit(0)
}
fs.rmSync(PID_FILE, { force: true })

if (await portInUse(PORT)) {
  log(`port ${PORT} is already in use but pid file is stale → assuming an existing instance`)
  log(`DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}?schema=public`)
  process.exit(0)
}

// ---- 拉起集群 --------------------------------------------------------------
const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: USER,
  password: PASSWORD,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (m) => process.stdout.write(`[pg] ${String(m).trim()}\n`),
  onError: (m) => process.stderr.write(`[pg-err] ${String(m).trim()}\n`),
})

const startedAt = Date.now()
if (!isInitialised()) {
  log(`initialising cluster at ${path.relative(ROOT, DATA_DIR)} (first run, ~14-18s)`)
  await pg.initialise()
} else {
  log('existing cluster found → skip initdb')
}

await pg.start()
fs.writeFileSync(PID_FILE, String(process.pid), 'utf8')

for (const name of [DB, TEST_DB]) {
  try {
    await pg.createDatabase(name)
  } catch {
    /* 坑②：database already exists，忽略 */
  }
}

// ---- 探活与自检 ------------------------------------------------------------
let version = 'unknown'
try {
  const ping = pg.getPgClient(DB, 'localhost')
  await ping.connect()
  const { rows } = await ping.query('SELECT version() AS v, current_database() AS db')
  version = rows?.[0]?.v ?? version
  await ping.end()
} catch (err) {
  warn(`post-start ping failed: ${err?.message ?? err}`)
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
log(`READY ${DB} → ${version}`)
log(`startup took ${elapsed}s (initdb skipped: ${isInitialised() ? 'yes' : 'no'})`)
log(`DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}?schema=public`)

// ---- 优雅退出 --------------------------------------------------------------
let stopping = false
const shutdown = async (signal) => {
  if (stopping) return
  stopping = true
  log(`received ${signal}, stopping postgres…`)
  try {
    await pg.stop()
  } catch (err) {
    warn(`pg.stop() failed: ${err?.message ?? err}`)
  }
  fs.rmSync(PID_FILE, { force: true })
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

// 前台常驻
await new Promise(() => {})
