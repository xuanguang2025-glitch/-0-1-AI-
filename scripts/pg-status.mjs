#!/usr/bin/env node
/**
 * EnglishAI · 内嵌 PostgreSQL 状态探针（架构 §2.6.1 / T02 验收 3）
 *
 * 输出：是否已初始化 / 是否在跑 / PG 版本 / 端口 / 数据目录大小 / 数据库大小。
 * **始终 exit 0**（供 `npm run dev` 前置调用，不阻塞开发服务器）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = process.env.PG_DATA_DIR
  ? path.resolve(ROOT, process.env.PG_DATA_DIR)
  : path.join(ROOT, '.data', 'pg')
const PID_FILE = path.join(ROOT, '.data', 'pg.pid')
const PORT = Number(process.env.PG_PORT ?? 5433)
const USER = process.env.PG_USER ?? 'englishai'
const PASSWORD = process.env.PG_PASSWORD ?? 'englishai'
const DB = 'englishai'

const portInUse = (port, host = '127.0.0.1', timeoutMs = 1200) =>
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

const dirSize = (dir) => {
  let total = 0
  const walk = (p) => {
    let entries = []
    try {
      entries = fs.readdirSync(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(p, entry.name)
      if (entry.isDirectory()) walk(full)
      else {
        try {
          total += fs.statSync(full).size
        } catch {
          /* race with pg vacuum */
        }
      }
    }
  }
  walk(dir)
  return total
}

const human = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const initialised = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))
const pidRaw = (() => {
  try {
    return Number(fs.readFileSync(PID_FILE, 'utf8').trim())
  } catch {
    return null
  }
})()
let pidAlive = false
if (pidRaw && Number.isFinite(pidRaw) && pidRaw > 0) {
  try {
    process.kill(pidRaw, 0)
    pidAlive = true
  } catch {
    pidAlive = false
  }
}
const listening = await portInUse(PORT)
const running = listening || pidAlive

console.log('=== EnglishAI · Tier A Embedded PostgreSQL Status ===')
console.log(`data dir        : ${path.relative(ROOT, DATA_DIR) || DATA_DIR}`)
console.log(`initialised     : ${initialised ? 'yes' : 'no'}`)
console.log(`port            : ${PORT}`)
console.log(`pid file        : ${pidRaw ? pidRaw : '-'} (alive: ${pidAlive ? 'yes' : 'no'})`)
console.log(`listening       : ${listening ? 'yes' : 'no'}`)
console.log(`running         : ${running ? 'YES' : 'NO'}`)

if (initialised && !running) {
  const pgCtl = [
    path.join(ROOT, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'pg_ctl.exe'),
    path.join(ROOT, 'node_modules', '@embedded-postgres', 'darwin-x64', 'native', 'bin', 'pg_ctl'),
    path.join(ROOT, 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin', 'pg_ctl'),
  ].find((p) => fs.existsSync(p))
  if (pgCtl) {
    try {
      const out = execFileSync(pgCtl, ['-D', DATA_DIR, 'status'], { encoding: 'utf8' })
      console.log(`pg_ctl status   : ${String(out).trim()}`)
    } catch {
      console.log('pg_ctl status   : no server running')
    }
  }
}

if (initialised) console.log(`data dir size   : ${human(dirSize(DATA_DIR))}`)

if (running) {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DB,
    connectionTimeoutMillis: 4000,
  })
  try {
    await client.connect()
    const { rows } = await client.query(
      `SELECT version() AS v,
              pg_size_pretty(pg_database_size(current_database())) AS db_size,
              current_database() AS db,
              (SELECT setting FROM pg_settings WHERE name = 'server_encoding') AS encoding`,
    )
    const row = rows?.[0] ?? {}
    console.log(`pg version      : ${row.v ?? 'unknown'}`)
    console.log(`database        : ${row.db ?? DB} (encoding=${row.encoding ?? '?'}, size=${row.db_size ?? '?'})`)
    console.log(
      `DATABASE_URL    : postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}?schema=public`,
    )
  } catch (err) {
    console.log(`connect failed  : ${err?.message ?? err}`)
  } finally {
    try {
      await client.end()
    } catch {
      /* ignore */
    }
  }
} else {
  console.log('hint            : run `npm run db:start` to boot the embedded cluster')
}

process.exit(0)
