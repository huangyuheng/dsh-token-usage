/**
 * dsh-token-usage host half: an always-live, in-memory fold of every model
 * call's token usage plus a read-only loopback JSON endpoint.
 *
 * Cost model: O(1) arithmetic per `session/event` — no polling, no file
 * watches, no periodic writes. History is rebuilt once at boot by streaming
 * the zstd session logs with cooperative yields; from then on the fold only
 * moves forward through the live event bus. A per-session seq watermark makes
 * the boot scan and the live fold overlap-safe in either order.
 *
 * Queries: `GET /dsh-token-usage` returns all-time buckets;
 * `?day=YYYY-MM-DD` and `?month=YYYY-MM` return the matching window,
 * aggregated in memory from per-day buckets (no rescan, no disk).
 *
 * @module dsh-token-usage
 */
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { scheduler } from 'node:timers/promises'

export const name = 'dsh-token-usage'

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

/** usage field -> fold key, in display order. */
const USAGE_FIELDS = [
  ['inputTokens', 'input'],
  ['outputTokens', 'output'],
  ['cacheReadTokens', 'cacheRead'],
  ['cacheWriteTokens', 'cacheWrite'],
  ['reasoningTokens', 'reasoning'],
]

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const ZSTD_MAGIC = 4247762216
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function resolveDshHome(env = process.env) {
  const explicit = env.DSH_HOME
  if (explicit !== undefined && explicit.trim().length > 0) return explicit
  return join(homedir(), '.dsh')
}

function localDay(timestamp) {
  const d = new Date(timestamp)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function emptyBucket() {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }
}

function addUsage(bucket, usage) {
  bucket.calls += 1
  for (const [field, key] of USAGE_FIELDS) {
    const value = usage[field]
    if (typeof value === 'number' && Number.isFinite(value)) bucket[key] += value
  }
}

function mergeInto(target, source) {
  target.calls += source.calls
  for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning']) target[key] += source[key]
}

/**
 * Split a concatenated-frame zstd container into complete frame ranges.
 * Session artifacts append one frame per flush; the single-frame Node
 * decompressor stops at the first frame, so the container is walked frame by
 * frame with the same header math as the harness's own persistence backend.
 */
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    let complete = false
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = blockHeader >>> 1 & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) break
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) {
        if (checksum) {
          if (buffer.length - offset < 4) break
          offset += 4
        }
        complete = true
        break
      }
    }
    if (complete) frames.push([start, offset])
  }
  return frames
}

/** Decode a multi-frame zstd session artifact to utf-8 text. */
async function decompressSessionLog(path) {
  const buffer = await readFile(path)
  let text = ''
  for (const [start, end] of scanZstdFrames(buffer)) {
    text += zstdDecompressSync(buffer.subarray(start, end)).toString('utf8')
  }
  return text
}

async function listSessionLogs(sessionsDir) {
  const logs = []
  let projects
  try {
    projects = await readdir(sessionsDir, { withFileTypes: true })
  } catch {
    return logs
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const projectDir = join(sessionsDir, project.name)
    let sessions
    try {
      sessions = await readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      logs.push(join(projectDir, session.name, 'session.jsonl.zstd'))
    }
    await scheduler.yield()
  }
  return logs
}

/**
 * In-memory token ledger. Both sources — the live `session/event` bus and the
 * boot-time log scan — funnel through {@link UsageTracker#fold}; the seq
 * watermark in {@link UsageTracker#seen} deduplicates the overlap.
 */
export class UsageTracker {
  constructor(dshHome = resolveDshHome()) {
    this.dshHome = dshHome
    this.startedAt = Date.now()
    this.totals = emptyBucket()
    this.byModel = new Map()
    this.byProject = new Map()
    this.byDay = new Map()
    this.dayModel = new Map()
    this.dayProject = new Map()
    this.lastModel = new Map()
    this.seen = new Map()
    this.scan = { startedAt: 0, done: false, files: 0, sessions: 0, bytes: 0, ms: 0, error: null }
  }

  bucket(map, key) {
    let bucket = map.get(key)
    if (bucket === undefined) {
      bucket = emptyBucket()
      map.set(key, bucket)
    }
    return bucket
  }

  nestedBucket(map, outerKey, innerKey) {
    let inner = map.get(outerKey)
    if (inner === undefined) {
      inner = new Map()
      map.set(outerKey, inner)
    }
    return this.bucket(inner, innerKey)
  }

  /**
   * Fold one decoded session event. `request/header` only updates the
   * per-session model attribution; `assistant/message` with a usage record is
   * counted once. @returns true when the event was counted.
   */
  fold(session, event) {
    if (event === null || typeof event !== 'object' || session === null || typeof session !== 'object') return false
    if (event.type === 'request/header') {
      const model = event.data?.header?.config?.model
      if (typeof model === 'string' && model.length > 0) this.lastModel.set(session.id, model)
      return false
    }
    if (event.type !== 'assistant/message') return false
    const usage = event.data?.usage
    if (usage === null || typeof usage !== 'object') return false
    const seq = event.seq
    const seen = this.seen.get(session.id)
    if (typeof seen === 'number' && typeof seq === 'number' && seq <= seen) return false
    if (typeof seq === 'number') this.seen.set(session.id, Math.max(seen ?? 0, seq))
    addUsage(this.totals, usage)
    const model = this.lastModel.get(session.id) ?? 'unknown'
    addUsage(this.bucket(this.byModel, model), usage)
    const project = typeof session.cwd === 'string' ? session.cwd : '(no cwd)'
    addUsage(this.bucket(this.byProject, project), usage)
    if (typeof event.time === 'number') {
      const day = localDay(event.time)
      addUsage(this.bucket(this.byDay, day), usage)
      addUsage(this.nestedBucket(this.dayModel, day, model), usage)
      addUsage(this.nestedBucket(this.dayProject, day, project), usage)
    }
    return true
  }

  /** Rebuild history from `$DSH_HOME/sessions/**\/session.jsonl.zstd` once. */
  async scanSessions() {
    if (this.scan.startedAt !== 0) return this.scan
    this.scan.startedAt = Date.now()
    const root = join(this.dshHome, 'sessions')
    const logs = await listSessionLogs(root)
    this.scan.files = logs.length
    const sessionDirs = new Set()
    for (const log of logs) {
      sessionDirs.add(log.slice(root.length + 1).split('/')[0])
      try {
        this.scan.bytes += (await stat(log)).size
        const decoded = await decompressSessionLog(log)
        let current = null
        for (const line of decoded.split('\n')) {
          if (line.length === 0) continue
          let event
          try {
            event = JSON.parse(line)
          } catch {
            continue
          }
          if (event.type === 'session') {
            current = { id: event.id, cwd: event.cwd }
            continue
          }
          if (current !== null) this.fold(current, event)
        }
      } catch (error) {
        this.scan.error = String(error?.message ?? error)
      }
      await scheduler.yield()
    }
    this.scan.sessions = sessionDirs.size
    this.scan.ms = Date.now() - this.scan.startedAt
    this.scan.done = true
    return this.scan
  }

  sorted(map) {
    return Object.fromEntries([...map.entries()].sort((a, b) => b[1].input - a[1].input))
  }

  /** Materialize totals/breakdowns for the optional day/month window. */
  view(filter = null) {
    if (filter === null) {
      return {
        totals: { ...this.totals },
        byModel: this.sorted(this.byModel),
        byProject: this.sorted(this.byProject),
        byDay: Object.fromEntries([...this.byDay.entries()].sort()),
      }
    }
    const days = [...this.byDay.keys()].filter((day) => (filter.kind === 'day' ? day === filter.value : day.startsWith(filter.value))).sort()
    const totals = emptyBucket()
    const models = new Map()
    const projects = new Map()
    const byDay = {}
    for (const day of days) {
      mergeInto(totals, this.byDay.get(day))
      byDay[day] = { ...this.byDay.get(day) }
      for (const [model, bucket] of this.dayModel.get(day) ?? []) mergeInto(this.bucket(models, model), bucket)
      for (const [project, bucket] of this.dayProject.get(day) ?? []) mergeInto(this.bucket(projects, project), bucket)
    }
    return { totals, byModel: this.sorted(models), byProject: this.sorted(projects), byDay }
  }

  snapshot(filter = null) {
    const view = this.view(filter)
    const withTotal = (bucket) => ({ ...bucket, total: bucket.input + bucket.output + bucket.cacheRead + bucket.cacheWrite })
    return {
      ok: true,
      name,
      version: VERSION,
      startedAt: this.startedAt,
      updatedAt: Date.now(),
      dshHome: this.dshHome,
      filter: filter === null ? null : { kind: filter.kind, value: filter.value },
      scan: { ...this.scan },
      totals: withTotal(view.totals),
      byModel: Object.fromEntries(Object.entries(view.byModel).map(([k, v]) => [k, withTotal(v)])),
      byProject: Object.fromEntries(Object.entries(view.byProject).map(([k, v]) => [k, withTotal(v)])),
      byDay: Object.fromEntries(Object.entries(view.byDay).map(([k, v]) => [k, withTotal(v)])),
    }
  }

  handle(req, res) {
    res.setHeader('cache-control', 'no-store')
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
      return
    }
    if (!LOOPBACK.has(req.socket?.remoteAddress)) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'loopback only' }))
      return
    }
    const params = new URL(req.url, 'http://localhost').searchParams
    const day = params.get('day')
    const month = params.get('month')
    let filter = null
    if (day !== null && month !== null) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'use exactly one of day or month' }))
      return
    }
    if (day !== null) {
      if (!DAY_RE.test(day)) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'day must be YYYY-MM-DD' }))
        return
      }
      filter = { kind: 'day', value: day }
    } else if (month !== null) {
      if (!MONTH_RE.test(month)) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'month must be YYYY-MM' }))
        return
      }
      filter = { kind: 'month', value: month }
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(this.snapshot(filter)))
  }
}

/**
 * Register the tracker once the profile's webServer service exists.
 * @param ctx - host context from the cordis loader.
 * @param config - loader config: `endpoint` and `scanAtBoot`.
 */
export function apply(ctx, config = {}) {
  const endpoint = typeof config.endpoint === 'string' && config.endpoint.length > 0 ? config.endpoint : '/dsh-token-usage'
  const scanAtBoot = config.scanAtBoot !== false
  ctx.inject(['webServer'], (host) => {
    const tracker = new UsageTracker(resolveDshHome())
    host.on('session/event', (session, event) => {
      tracker.fold(session, event)
    }, { global: true })
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: endpoint,
        handler: (req, res) => tracker.handle(req, res),
      })
      return () => dispose()
    }, 'dsh-token-usage: http route')
    if (scanAtBoot) {
      tracker.scanSessions().catch((error) => {
        tracker.scan.error = String(error?.stack ?? error)
      })
    }
  })
}
