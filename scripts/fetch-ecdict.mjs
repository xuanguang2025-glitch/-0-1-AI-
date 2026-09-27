#!/usr/bin/env node
/**
 * `npm run db:fetch:vocab` —— 下载 ECDICT 全量词库到 `.data/ecdict/ecdict.csv`。
 *
 * 行为：
 *  1. 已存在（>50MB）→ 跳过（幂等）；
 *  2. 依次尝试数据源（支持断点续传 + 失败重试）：
 *     ① 官方 GitHub raw（首选）
 *     ② npmmirror 上的 `ecdict` 包 tarball（内含同版 ecdict.csv，国内可达兜底）
 *  3. 全部失败 → exit 1（`db:seed` 会自动回退到 200 词 fallback 词表）。
 *
 * 注意：本脚本只用 Node 内置模块，不依赖网络代理配置（fetch 直连；
 * 若需走代理，请自行设置 `HTTPS_PROXY` 并使用支持代理的 undici dispatcher）。
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import zlib from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.data', 'ecdict')
const OUT_FILE = path.join(OUT_DIR, 'ecdict.csv')
const PART_FILE = `${OUT_FILE}.part`
const MIN_BYTES = 50 * 1024 * 1024 // 完整文件约 62.9MB

const GITHUB_URL = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv'
const NPM_TARBALL_URL = 'https://registry.npmmirror.com/ecdict/-/ecdict-0.0.4.tgz'
const NPM_TARBALL_ENTRY = 'package/assets/ecdict.csv'

const log = (msg) => process.stdout.write(`[fetch] ${msg}\n`)
const warn = (msg) => process.stderr.write(`[fetch-warn] ${msg}\n`)

const sizeOf = (p) => {
  try {
    return fs.statSync(p).size
  } catch {
    return 0
  }
}

/** 断点续传下载（Range + 失败重试）；返回是否成功。 */
async function downloadWithResume(url, destFile, partFile, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const already = sizeOf(partFile)
    const headers = already > 0 ? { Range: `bytes=${already}-` } : {}
    try {
      log(`attempt ${attempt}/${maxRetries} → ${url}${already ? ` (resume from ${already})` : ''}`)
      const res = await fetch(url, { headers, redirect: 'follow' })
      if (!(res.status === 200 || res.status === 206)) {
        warn(`HTTP ${res.status}; ${res.status === 403 ? '（jsDelivr/npm 对大文件 403，换源）' : ''}`)
        throw new Error(`HTTP ${res.status}`)
      }
      const writable = fs.createWriteStream(partFile, { flags: res.status === 206 ? 'a' : 'w' })
      if (res.body === null) throw new Error('empty response body')
      // Web ReadableStream → Node stream 桥接
      const { Readable } = await import('node:stream')
      const nodeStream = Readable.fromWeb(res.body)
      await new Promise((resolve, reject) => {
        nodeStream.pipe(writable)
        writable.on('finish', resolve)
        writable.on('error', reject)
        nodeStream.on('error', reject)
      })
      const total = sizeOf(partFile)
      if (total < MIN_BYTES) throw new Error(`incomplete download (${total} bytes)`)
      fs.renameSync(partFile, destFile)
      log(`saved ${total} bytes → ${path.relative(ROOT, destFile)}`)
      return true
    } catch (err) {
      warn(`attempt ${attempt} failed: ${err?.message ?? err}`)
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  return false
}

/** 兜底：curl 子进程（自动尊重/剥离代理环境变量由调用方决定）。 */
function downloadWithCurl(url, destFile) {
  log('falling back to curl transport…')
  const env = { ...process.env }
  delete env.HTTP_PROXY
  delete env.HTTPS_PROXY
  delete env.http_proxy
  delete env.https_proxy
  const res = spawnSync(
    'curl',
    ['-sSL', '--http1.1', '--max-time', '600', '-o', destFile, url],
    { env, encoding: 'utf8', timeout: 620_000 },
  )
  if (res.status === 0 && sizeOf(destFile) >= MIN_BYTES) return true
  warn(`curl failed (exit ${res.status}, size ${sizeOf(destFile)})`)
  return false
}

/**
 * 从 npm tarball（gzip）中提取单个文件 —— 最小 tar 读取器（512B header），零依赖。
 */
function extractFromTarball(tgzPath, entryName, destFile) {
  log(`extracting ${entryName} from ${path.basename(tgzPath)} …`)
  const tar = zlib.gunzipSync(fs.readFileSync(tgzPath))
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeStr, 8) || 0
    const typeFlag = String.fromCharCode(header[156] ?? 48)
    const dataStart = offset + 512
    if ((typeFlag === '0' || typeFlag === '\0') && name === entryName) {
      fs.mkdirSync(path.dirname(destFile), { recursive: true })
      fs.writeFileSync(destFile, tar.subarray(dataStart, dataStart + size))
      log(`extracted ${size} bytes → ${path.relative(ROOT, destFile)}`)
      return true
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  warn(`entry ${entryName} not found in tarball`)
  return false
}

async function fetchViaNpmMirror() {
  const tgz = path.join(OUT_DIR, 'ecdict-npm.tgz')
  try {
    const res = await fetch(NPM_TARBALL_URL, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()))
    log(`tarball saved: ${sizeOf(tgz)} bytes`)
  } catch (err) {
    warn(`tarball fetch failed: ${err?.message ?? err}; trying curl…`)
    if (!downloadWithCurl(NPM_TARBALL_URL, tgz)) return false
  }
  return extractFromTarball(tgz, NPM_TARBALL_ENTRY, OUT_FILE)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  if (fs.existsSync(OUT_FILE) && sizeOf(OUT_FILE) >= MIN_BYTES) {
    log(`already exists → skip (${sizeOf(OUT_FILE)} bytes, ${path.relative(ROOT, OUT_FILE)})`)
    log('to re-download, delete the file first')
    process.exit(0)
  }

  if (fs.existsSync(PART_FILE) && sizeOf(PART_FILE) > 0) {
    log(`resumable partial found: ${sizeOf(PART_FILE)} bytes`)
  }

  // 数据源 ①：官方 GitHub raw
  let ok = await downloadWithResume(GITHUB_URL, OUT_FILE, PART_FILE)
  if (!ok) ok = downloadWithCurl(GITHUB_URL, OUT_FILE) && sizeOf(OUT_FILE) >= MIN_BYTES

  // 数据源 ②：npmmirror 上的 ecdict 包（国内可达）
  if (!ok) {
    warn('github raw unreachable → trying npmmirror ecdict tarball')
    ok = await fetchViaNpmMirror()
  }

  if (!ok) {
    warn('ALL SOURCES FAILED — 词库未下载。')
    warn('`npm run db:seed` 将使用内置 200 词 fallback 词表（prisma/data/fallback-words.csv）。')
    process.exit(1)
  }
  log('done ✔')
  process.exit(0)
}

await main()
