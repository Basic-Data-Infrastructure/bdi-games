import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  createSession, dispatch, ensureSessionGame, GameError, getGame, listGames, orgIds, playerView, previewJoin, readSource, trainingView,
  type Command, type Ctx, type Language, type OrgId, type SessionState, type StartMode,
} from '@bdi/domain'

type Db = {
  get: (id: string) => SessionState | null
  byCode: (code: string) => SessionState | null
  save: (s: SessionState) => void
  remove: (id: string) => void
  list: () => SessionState[]
}

export interface Store {
  run<T>(fn: (db: Db) => T): Promise<T>
}

export class MemoryStore implements Store {
  private sessions = new Map<string, SessionState>()
  private chain: Promise<unknown> = Promise.resolve()
  private file = process.env.GAME_FILE
  /** Pending sessions for the remote (Postgres) writer; local file flush stays immediate. */
  private pendingRemote = new Map<string, SessionState>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private flushChain: Promise<void> = Promise.resolve()
  private persistIntervalMs = Math.max(1000, Number(process.env.PERSIST_INTERVAL_MS) || 15_000)
  onFlush: ((sessions: SessionState[]) => Promise<void>) | null = null
  onDelete: ((ids: string[]) => Promise<void>) | null = null
  replaceAll(sessions: SessionState[]) {
    this.sessions = new Map(sessions.map((session) => {
      const next = ensureSessionGame(session)
      return [next.id, next]
    }))
  }
  constructor() {
    if (!this.file) return
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as SessionState[]
      for (const session of parsed) {
        const next = ensureSessionGame(session)
        this.sessions.set(next.id, next)
      }
    } catch {
      /* first run */
    }
  }
  private flushFile() {
    if (!this.file) return
    mkdirSync(this.file.replace(/[\\/][^\\/]+$/, ''), { recursive: true })
    writeFileSync(this.file, JSON.stringify([...this.sessions.values()]))
  }
  private scheduleRemoteFlush() {
    if (!this.onFlush || this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flushNow()
    }, this.persistIntervalMs)
  }
  /** Push pending sessions through onFlush now (new/closed sessions, shutdown, tests). */
  async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.flushChain = this.flushChain.then(async () => {
      if (!this.onFlush || this.pendingRemote.size === 0) return
      const batch = [...this.pendingRemote.values()]
      this.pendingRemote.clear()
      await this.onFlush(batch)
    })
    return this.flushChain
  }
  async run<T>(fn: (db: Db) => T): Promise<T> {
    const run = this.chain.then(async () => {
      const dirty = new Map<string, SessionState>()
      const removed = new Set<string>()
      const db: Db = {
        get: (id: string) => {
          if (removed.has(id)) return null
          return dirty.get(id) ?? (this.sessions.get(id) ? structuredClone(this.sessions.get(id)!) : null)
        },
        byCode: (code: string) => {
          const found = [...dirty.values(), ...this.sessions.values()].find((s) => !removed.has(s.id) && s.code === code.toUpperCase())
          return found ? structuredClone(dirty.get(found.id) ?? found) : null
        },
        save: (s: SessionState) => { removed.delete(s.id); dirty.set(s.id, s) },
        remove: (id: string) => { dirty.delete(id); removed.add(id) },
        list: () => [...this.sessions.values()].filter((s) => !removed.has(s.id)).map((s) => structuredClone(s)),
      }
      const result = await fn(db)
      for (const id of removed) {
        this.sessions.delete(id)
        this.pendingRemote.delete(id)
      }
      let urgent = false
      for (const [id, session] of dirty) {
        if (!this.sessions.has(id) || session.status === 'closed') urgent = true
        this.sessions.set(id, session)
        if (this.onFlush) this.pendingRemote.set(id, session)
      }
      const changed = dirty.size > 0 || removed.size > 0
      // Skip the disk write when nothing changed (idle ticks must stay cheap).
      if (changed) this.flushFile()
      if (this.onDelete && removed.size > 0) await this.onDelete([...removed])
      if (this.onFlush && dirty.size > 0) {
        if (urgent) await this.flushNow()
        else this.scheduleRemoteFlush()
      }
      return result
    })
    this.chain = run.then(() => undefined, () => undefined)
    return run
  }
}

export function devAuthAllowed(): boolean {
  if (process.env.ALLOW_DEV_AUTH === 'true') return true
  if (process.env.ALLOW_DEV_AUTH === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

/** Open sessions allowed per client IP; null means no cap. The cap protects the hosted API, not a local one. */
export function openSessionLimit(): number | null {
  const configured = process.env.MAX_OPEN_SESSIONS_PER_IP
  if (configured) {
    const limit = Number(configured)
    return Number.isFinite(limit) && limit > 0 ? limit : null
  }
  return process.env.NODE_ENV === 'production' ? 10 : null
}

const secret = () => {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_AUTH === 'true') {
    throw new GameError('server', 'AUTH_SECRET ontbreekt.', 500)
  }
  return 'dev-only-secret-change-me'
}

export function signDev(userId: string): string {
  const mac = createHmac('sha256', secret()).update(userId).digest('base64url')
  return `dev.${userId}.${mac}`
}

export async function userFromAuth(header: string | undefined): Promise<string> {
  if (!header?.startsWith('Bearer ')) throw new GameError('unauthorized', 'Log in om mee te doen.', 401)
  const token = header.slice(7)
  if (!token.startsWith('dev.')) throw new GameError('unauthorized', 'Ongeldige identiteit.', 401)
  if (!devAuthAllowed()) throw new GameError('unauthorized', 'Dev-login is uit.', 401)
  const [, userId, mac] = token.split('.')
  const expected = createHmac('sha256', secret()).update(userId).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new GameError('unauthorized', 'Ongeldige identiteit.', 401)
  return userId
}

function runtime(language: Language, now = new Date().toISOString()): Ctx {
  return {
    now,
    language,
    presentationMs: Number(process.env.PRESENTATION_MS ?? 3000),
    pipelineMs: Number(process.env.PIPELINE_MS ?? 1000),
    animationMs: Number(process.env.ANIMATION_MS ?? 4000),
    graceMs: Number(process.env.GRACE_MS ?? 30000),
    idleMs: Number(process.env.SESSION_IDLE_MS ?? 30 * 60_000),
  }
}

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('')
}

export class GameService {
  constructor(private store: Store) {}
  private async apply(sessionId: string, userId: string, command: Command, language?: Language) {
    return this.store.run((db) => {
      const session = db.get(sessionId)
      if (!session) throw new GameError('not_found', 'Sessie niet gevonden.', 404)
      const result = dispatch(session, command, runtime(language ?? session.language))
      db.save(result.state)
      return result
    })
  }
  async anonymous() {
    if (!devAuthAllowed()) throw new GameError('not_found', 'Dev-login is uit.', 404)
    const userId = randomUUID()
    return { userId, token: signDev(userId) }
  }
  async create(userId: string, input: { name?: string; language?: Language; startMode?: StartMode; gameId?: string }, creatorIp: string) {
    const now = new Date()
    const maxOpen = openSessionLimit()
    const game = getGame(input.gameId)
    const startMode = input.startMode ?? game.defaultStartMode
    if (!game.startModes.includes(startMode)) {
      throw new GameError('bad_start', `Startmodus ${startMode} past niet bij dit spel.`, 400)
    }
    const invites = Object.fromEntries(orgIds(game).map((org) => [org, randomUUID()]))
    const state = createSession({
      id: randomUUID(),
      code: code(),
      hostUserId: userId,
      name: input.name?.slice(0, 40) || game.titles.nl,
      language: input.language ?? 'nl',
      startMode,
      now: now.toISOString(),
      expiresAt: new Date(now.getTime() + Number(process.env.SESSION_TTL_HOURS ?? 24) * 3600_000).toISOString(),
      invites,
      creatorIp,
      gameId: game.id,
    })
    await this.store.run((db) => {
      if (maxOpen !== null) {
        const openFromIp = db.list().filter((session) => session.status !== 'closed' && session.creatorIp === creatorIp)
        if (openFromIp.length >= maxOpen) {
          throw new GameError(
            'limit',
            `Je hebt al ${maxOpen} open spellen vanaf dit netwerk. Beëindig er een of wacht tot een verlaten spel wordt opgeruimd.`,
            429,
          )
        }
      }
      db.save(state)
      return state
    })
    return trainingView(state)
  }

  listGames() {
    return listGames()
  }
  async command(sessionId: string, userId: string, command: Command) {
    const result = await this.apply(sessionId, userId, command)
    return { output: result.output, training: result.state.hostUserId === userId ? trainingView(result.state) : undefined, player: playerView(result.state, userId, new Date().toISOString()) }
  }
  async training(sessionId: string, userId: string) {
    return this.store.run((db) => {
      const session = db.get(sessionId)
      if (!session) throw new GameError('not_found', 'Sessie niet gevonden.', 404)
      if (session.hostUserId !== userId) throw new GameError('forbidden', 'Geen toegang tot het trainingsoverzicht.', 403)
      return trainingView(session)
    })
  }
  async player(sessionId: string, userId: string) {
    return this.store.run((db) => {
      const session = db.get(sessionId)
      if (!session) throw new GameError('not_found', 'Sessie niet gevonden.', 404)
      const view = playerView(session, userId, new Date().toISOString())
      if (!view) throw new GameError('forbidden', 'Geen rol in deze sessie.', 403)
      return view
    })
  }
  async joinPreview(codeValue: string) {
    return this.store.run((db) => {
      const session = db.byCode(codeValue)
      if (!session || session.status === 'closed') throw new GameError('not_found', 'Sessie niet gevonden.', 404)
      return { sessionId: session.id, ...previewJoin(session) }
    })
  }
  async read(sessionId: string, userId: string, ref: string) {
    return this.store.run((db) => {
      const session = db.get(sessionId)
      if (!session) throw new GameError('not_found', 'Sessie niet gevonden.', 404)
      const role = session.roles.find((item) => item.playerUserId === userId)
      if (!role) throw new GameError('forbidden', 'Geen rol.', 403)
      const round = session.rounds.find((item) => item.id === session.currentRoundId)
      if (!round) throw new GameError('not_found', 'Geen ronde.', 404)
      const payload = readSource(round, role.organizationId, ref)
      if (!payload) throw new GameError('forbidden', 'Geen leesrecht op deze bron.', 403)
      return payload
    })
  }
  async tickAll() {
    await this.store.run((db) => {
      for (const session of db.list()) {
        if (session.status === 'closed') {
          db.remove(session.id)
          continue
        }
        try {
          const before = JSON.stringify(session)
          const result = dispatch(session, { type: 'tick' }, runtime(session.language))
          if (JSON.stringify(result.state) !== before) db.save(result.state)
        } catch {
          /* ignore corrupt sessions; idle/expiry close inside tick */
        }
      }
      return null
    })
  }
}
