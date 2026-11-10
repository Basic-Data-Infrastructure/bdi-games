import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pruneOldLogs } from './log.js'

describe('pruneOldLogs', () => {
  const previous = process.env.LOG_FILE
  let dir = ''

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bdi-log-'))
    process.env.LOG_FILE = join(dir, 'api-events.jsonl')
  })

  afterEach(() => {
    if (previous === undefined) delete process.env.LOG_FILE
    else process.env.LOG_FILE = previous
  })

  it('keeps only lines from the last 24 hours', async () => {
    const path = process.env.LOG_FILE!
    const old = new Date(Date.now() - 48 * 3600_000).toISOString()
    const recent = new Date().toISOString()
    await writeFile(
      path,
      [
        JSON.stringify({ t: old, event: 'old' }),
        JSON.stringify({ t: recent, event: 'recent' }),
        '{broken',
        '',
      ].join('\n'),
      'utf8',
    )
    await pruneOldLogs()
    const body = await readFile(path, 'utf8')
    expect(body).toContain('"event":"recent"')
    expect(body).not.toContain('"event":"old"')
    expect(body).not.toContain('{broken')
  })
})
