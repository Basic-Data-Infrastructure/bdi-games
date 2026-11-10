/** Compact operational logs. Console for the container log stream; JSONL file pruned on session start. */

import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

let openStreams = 0
let writeChain: Promise<void> = Promise.resolve()

const LOG_RETENTION_MS = 24 * 60 * 60 * 1000

export function shortId(id: string | undefined | null): string {
  if (!id) return '-'
  return id.length <= 8 ? id : id.slice(0, 8)
}

type Fields = Record<string, string | number | boolean | undefined | null>

function line(event: string, fields: Fields = {}): string {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
  return parts.length ? `[bdi] ${event} ${parts.join(' ')}` : `[bdi] ${event}`
}

function logPath(): string {
  if (process.env.LOG_FILE) return process.env.LOG_FILE
  const gameFile = process.env.GAME_FILE ?? 'data/game.json'
  return join(dirname(gameFile), 'api-events.jsonl')
}

function persist(level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}) {
  const record = {
    t: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ),
  }
  const path = logPath()
  writeChain = writeChain
    .then(async () => {
      await mkdir(dirname(path), { recursive: true })
      await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
    })
    .catch(() => undefined)
}

/** Drop file lines older than retention. Called when a session is created or started — no cron. */
export function pruneOldLogs(maxAgeMs = LOG_RETENTION_MS): Promise<void> {
  const path = logPath()
  const cutoff = Date.now() - maxAgeMs
  writeChain = writeChain
    .then(async () => {
      let raw: string
      try {
        raw = await readFile(path, 'utf8')
      } catch {
        return
      }
      if (!raw) return
      const kept: string[] = []
      let dropped = 0
      for (const row of raw.split('\n')) {
        if (!row) continue
        try {
          const parsed = JSON.parse(row) as { t?: string }
          const at = parsed.t ? Date.parse(parsed.t) : NaN
          if (Number.isFinite(at) && at >= cutoff) kept.push(row)
          else dropped += 1
        } catch {
          dropped += 1
        }
      }
      if (dropped === 0) return
      const temp = `${path}.tmp`
      await writeFile(temp, kept.length ? `${kept.join('\n')}\n` : '', 'utf8')
      await rename(temp, path)
      console.log(line('log.prune', { kept: kept.length, dropped, maxAgeHours: Math.round(maxAgeMs / 3_600_000) }))
    })
    .catch(() => undefined)
  return writeChain
}

export function logInfo(event: string, fields?: Fields) {
  console.log(line(event, fields))
  persist('info', event, fields)
}

export function logWarn(event: string, fields?: Fields) {
  console.warn(line(event, fields))
  persist('warn', event, fields)
}

export function logError(event: string, fields?: Fields) {
  console.error(line(event, fields))
  persist('error', event, fields)
}

export function streamOpened(): number {
  openStreams += 1
  return openStreams
}

export function streamClosed(): number {
  openStreams = Math.max(0, openStreams - 1)
  return openStreams
}

export function streamCount(): number {
  return openStreams
}
