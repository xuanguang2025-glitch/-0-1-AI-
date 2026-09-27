#!/usr/bin/env node
/**
 * EnglishAI · 优雅停止 Tier A 内嵌 PostgreSQL（架构 §2.6.1）
 *
 * 策略：
 *  1. 优先 `pg_ctl -D .data/pg stop -m fast -w`（真实 PG 二进制，优雅关库）
 *  2. 兜底：向守护进程 pid 发 SIGTERM（触发其 shutdown → pg.stop()）
 *  3. 清理 pid 文件；幂等 —— 未在跑时直接 exit 0
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = process.env.PG_DATA_DIR
  ? path.resolve(ROOT, process.env.PG_DATA_DIR)
  : path.join(ROOT, '.data', 'pg')
const PID_FILE = path.join(ROOT, '.data', 'pg.pid')
const PG_CTL_CANDIDATES = [
  path.join(ROOT, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'pg_ctl.exe'),
  path.join(ROOT, 'node_modules', '@embedded-postgres', 'darwin-x64', 'native', 'bin', 'pg_ctl'),
  path.join(ROOT, 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin', 'pg_ctl'),
]

const log = (msg) => process.stdout.write(`[db] ${msg}\n`)
const pgCtl = PG_CTL_CANDIDATES.find((p) => fs.existsSync(p))

const readPid = () => {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim())
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const pid = readPid()
const isInitialised = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))

if (!pid && !isInitialised) {
  log('postgres is not running and no cluster found → nothing to do')
  process.exit(0)
}

// 1) pg_ctl 优雅停止（fast = 不等长事务，但走 checkpoint，不损数据）
if (pgCtl && isInitialised) {
  const res = spawnSync(pgCtl, ['-D', DATA_DIR, 'stop', '-m', 'fast', '-w'], {
    encoding: 'utf8',
    timeout: 30_000,
  })
  if (res.status === 0) {
    log(`pg_ctl stop ok (${path.basename(path.dirname(path.dirname(path.dirname(pgCtl))))})`)
  } else {
    log(`pg_ctl stop returned ${res.status} (likely not running): ${String(res.stderr ?? '').trim()}`)
  }
} else if (!pgCtl) {
  log('pg_ctl binary not found → falling back to daemon SIGTERM')
}

// 2) 兜底：终止守护进程（其 SIGTERM 处理器会调用 pg.stop()）
if (pid) {
  if (pidAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM')
      log(`sent SIGTERM to daemon pid ${pid}`)
    } catch (err) {
      log(`failed to signal daemon pid ${pid}: ${err?.message ?? err}`)
    }
  } else {
    log(`daemon pid ${pid} is not alive (stale pid file)`)
  }
}

// 3) 等待端口释放 + 清理 pid 文件
const waitForExit = async (timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!pid || !pidAlive(pid)) return true
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}
const exited = await waitForExit()
if (!exited && pid) {
  log('daemon still alive after SIGTERM → forcing taskkill /T /F')
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    /* 已退出则忽略 */
  }
}

fs.rmSync(PID_FILE, { force: true })
log('postgres stopped')
process.exit(0)
