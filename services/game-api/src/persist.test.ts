import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSession, type SessionState } from '@bdi/domain'
import { GameService, MemoryStore } from './service.js'

function blankSession(id = '11111111-1111-1111-1111-111111111111'): SessionState {
  const now = Date.now()
  return createSession({
    id,
    code: 'ABCDEF',
    hostUserId: 'host',
    name: 'Test',
    language: 'nl',
    startMode: 'without_bdi',
    now: new Date(now).toISOString(),
    expiresAt: new Date(now + 24 * 3600_000).toISOString(),
    invites: {
      buyer: 'b',
      seller: 's',
      carrier: 'c',
      delivery: 'd',
    },
  })
}

describe('remote persist debounce', () => {
  afterEach(() => {
    delete process.env.PERSIST_INTERVAL_MS
    vi.useRealTimers()
  })

  it('flushes a new session immediately and batches later updates', async () => {
    process.env.PERSIST_INTERVAL_MS = '10000'
    vi.useFakeTimers()
    const store = new MemoryStore()
    const flushes: SessionState[][] = []
    store.onFlush = async (sessions) => { flushes.push(sessions.map((s) => structuredClone(s))) }

    const created = blankSession()
    await store.run((db) => { db.save(created); return null })
    expect(flushes).toHaveLength(1)
    expect(flushes[0][0].name).toBe('Test')

    await store.run((db) => {
      const session = db.get(created.id)!
      session.name = 'Renamed'
      db.save(session)
      return null
    })
    expect(flushes).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(10000)
    expect(flushes).toHaveLength(2)
    expect(flushes[1][0].name).toBe('Renamed')
  })

  it('flushes immediately when a session is closed', async () => {
    process.env.PERSIST_INTERVAL_MS = '60000'
    const store = new MemoryStore()
    const flushes: string[] = []
    store.onFlush = async (sessions) => {
      for (const session of sessions) flushes.push(`${session.id}:${session.status}`)
    }

    const created = blankSession()
    await store.run((db) => { db.save(created); return null })
    expect(flushes).toEqual(['11111111-1111-1111-1111-111111111111:lobby'])

    await store.run((db) => {
      const session = db.get(created.id)!
      session.name = 'Still open'
      db.save(session)
      return null
    })
    expect(flushes).toHaveLength(1)

    await store.run((db) => {
      const session = db.get(created.id)!
      session.status = 'closed'
      db.save(session)
      return null
    })
    expect(flushes).toEqual([
      '11111111-1111-1111-1111-111111111111:lobby',
      '11111111-1111-1111-1111-111111111111:closed',
    ])
    await store.flushNow()
  })

  it('does not mark idle lobby ticks as dirty for remote flush', async () => {
    process.env.PERSIST_INTERVAL_MS = '60000'
    const store = new MemoryStore()
    let flushCount = 0
    store.onFlush = async () => { flushCount += 1 }
    const game = new GameService(store)

    await store.run((db) => { db.save(blankSession()); return null })
    expect(flushCount).toBe(1)

    await game.tickAll()
    await game.tickAll()
    await store.flushNow()
    expect(flushCount).toBe(1)
  })

  it('removes closed sessions from the store and calls onDelete', async () => {
    const store = new MemoryStore()
    const deleted: string[] = []
    store.onDelete = async (ids) => { deleted.push(...ids) }
    const game = new GameService(store)
    const id = '11111111-1111-1111-1111-111111111111'

    await store.run((db) => {
      const session = blankSession(id)
      session.status = 'closed'
      db.save(session)
      return null
    })
    await game.tickAll()
    const left = await store.run((db) => db.list().map((s) => s.id))
    expect(left).toEqual([])
    expect(deleted).toEqual([id])
  })
})
