import { networkInterfaces } from 'node:os'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { GameError, type AccessCardId, type AccessDossierItem, type AccessLookup, type AccessOutcome, type OrgId } from '@bdi/domain'
import { logError, logInfo, logWarn, pruneOldLogs, shortId, streamClosed, streamCount, streamOpened } from './log.js'
import { GameService, userFromAuth, type Store } from './service.js'

export function createApp(store: Store) {
  const game = new GameService(store)
  const app = new Hono()
  const logAllHttp = process.env.LOG_HTTP === 'all'
  app.use('*', cors({
  origin: (origin) => {
    const allowed = process.env.CORS_ORIGIN
    if (!allowed || allowed === '*') return origin
    return allowed.split(',').map((item) => item.trim()).includes(origin) ? origin : null
  },
  allowHeaders: ['Authorization', 'Content-Type'],
}))
  app.onError((err, c) => {
    if (err instanceof GameError) {
      logWarn('http.error', {
        status: err.httpStatus,
        code: err.code,
        method: c.req.method,
        path: c.req.path,
        ip: clientIp(c),
      })
      return c.json({ error: err.code, message: err.message }, err.httpStatus as 400)
    }
    logError('http.crash', { method: c.req.method, path: c.req.path, message: err instanceof Error ? err.message : 'unknown' })
    console.error(err)
    return c.json({ error: 'server', message: 'Er ging iets mis.' }, 500)
  })
  const user = (c: { req: { header: (n: string) => string | undefined } }) => userFromAuth(c.req.header('authorization'))
  const clientIp = (c: { req: { header: (n: string) => string | undefined } }) => {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
    return c.req.header('x-real-ip')?.trim() || 'unknown'
  }
  app.use('/api/*', async (c, next) => {
    const started = Date.now()
    const method = c.req.method
    const path = c.req.path
    await next()
    if (method === 'OPTIONS') return
    // Heartbeats, poll GETs and SSE are frequent; open/close is logged separately.
    if (path.endsWith('/heartbeat') || path.endsWith('/stream')) return
    const status = c.res.status
    const pollGet = path.endsWith('/training') || path.endsWith('/player') || path.endsWith('/events') || path.endsWith('/history')
    // Default: only failures. LOG_HTTP=all also records successful traffic (still skips heartbeat/stream).
    if (status < 400 && !logAllHttp) return
    if (pollGet && !logAllHttp) return
    logInfo('http', {
      method,
      path,
      status,
      ms: Date.now() - started,
      ip: clientIp(c),
    })
  })
  app.get('/health', (c) => c.json({ ok: true, openStreams: streamCount() }))
  app.get('/api/network', (c) => {
    const addresses: string[] = []
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address)
      }
    }
    return c.json({ addresses })
  })
  app.post('/api/dev/anonymous', async (c) => {
    const body = await game.anonymous()
    logInfo('auth.anonymous', { user: shortId(body.userId), ip: clientIp(c) })
    return c.json(body)
  })
  app.get('/api/games', (c) => c.json({ games: game.listGames() }))
  app.post('/api/sessions', async (c) => {
    void pruneOldLogs()
    const created = await game.create(await user(c), await c.req.json(), clientIp(c))
    logInfo('session.create', {
      session: shortId(created.sessionId),
      code: created.code,
      game: created.gameId,
      ip: clientIp(c),
    })
    return c.json(created)
  })
  app.get('/api/join', async (c) => c.json(await game.joinPreview(c.req.query('code') ?? '')))
  app.get('/api/sessions/:id/training', async (c) => c.json(await game.training(c.req.param('id'), await user(c))))
  app.get('/api/sessions/:id/training/history', async (c) => {
    const view = await game.training(c.req.param('id'), await user(c))
    return c.json(view.round?.history ?? [])
  })
  app.get('/api/sessions/:id/player', async (c) => c.json(await game.player(c.req.param('id'), await user(c))))
  app.get('/api/sessions/:id/stream', async (c) => {
    const sessionId = c.req.param('id')
    const userId = await user(c)
    const kind = c.req.query('kind') === 'training' ? 'training' : 'player'
    const load = () => (kind === 'training' ? game.training(sessionId, userId) : game.player(sessionId, userId))
    const first = await load()
    const since = Number(c.req.query('cursor') ?? -1)
    const ip = clientIp(c)
    return streamSSE(c, async (stream) => {
      let last = ''
      let open = true
      let reason: 'abort' | 'gone' | 'end' = 'end'
      const started = Date.now()
      const openCount = streamOpened()
      logInfo('sse.open', {
        session: shortId(sessionId),
        kind,
        user: shortId(userId),
        cursor: since,
        open: openCount,
        ip,
      })
      stream.onAbort(() => {
        open = false
        reason = 'abort'
      })
      const send = async (view: unknown) => {
        const { serverNow: _ignored, ...stable } = view as Record<string, unknown>
        const body = JSON.stringify(stable)
        if (body === last) return
        last = body
        const cursor = typeof (view as { cursor?: number }).cursor === 'number' ? (view as { cursor: number }).cursor : 0
        await stream.writeSSE({ event: 'snapshot', id: String(cursor), data: JSON.stringify({ ...view as object, replayFrom: since }) })
      }
      try {
        await send(first)
        let beat = 0
        while (open) {
          await stream.sleep(400)
          try {
            await send(await load())
          } catch (err) {
            reason = 'gone'
            const message = err instanceof Error ? err.message : 'gone'
            logWarn('sse.gone', {
              session: shortId(sessionId),
              kind,
              user: shortId(userId),
              message,
              open: streamCount(),
            })
            await stream.writeSSE({ event: 'gone', data: JSON.stringify({ message }) })
            break
          }
          beat += 1
          if (beat % 25 === 0) await stream.writeSSE({ event: 'ping', data: '{}' })
        }
      } finally {
        const remaining = streamClosed()
        logInfo('sse.close', {
          session: shortId(sessionId),
          kind,
          user: shortId(userId),
          reason,
          ms: Date.now() - started,
          open: remaining,
          ip,
        })
      }
    })
  })
  app.get('/api/sessions/:id/recovery', async (c) => c.json(await game.player(c.req.param('id'), await user(c))))
  app.get('/api/sessions/:id/events', async (c) => c.json(await game.player(c.req.param('id'), await user(c))))
  app.post('/api/sessions/:id/claim', async (c) => {
    const body = await c.req.json()
    const userId = await user(c)
    const view = await game.command(c.req.param('id'), userId, {
      type: 'claimRole', userId, organizationId: body.organizationId, inviteToken: body.inviteToken ?? null, displayName: body.displayName,
    })
    logInfo('session.claim', {
      session: shortId(c.req.param('id')),
      org: body.organizationId,
      user: shortId(userId),
      ip: clientIp(c),
    })
    return c.json(view)
  })
  app.post('/api/sessions/:id/release', async (c) => {
    const body = await c.req.json()
    return c.json(await game.command(c.req.param('id'), await user(c), { type: 'releaseRole', userId: await user(c), organizationId: body.organizationId, nextInvite: crypto.randomUUID() }))
  })
  app.post('/api/sessions/:id/ready', async (c) => c.json(await game.command(c.req.param('id'), await user(c), { type: 'markReady', userId: await user(c) })))
  app.post('/api/sessions/:id/start', async (c) => {
    void pruneOldLogs()
    const userId = await user(c)
    const view = await game.command(c.req.param('id'), userId, {
      type: 'startRound', userId, roundId: crypto.randomUUID(), seed: crypto.randomUUID(), orderId: crypto.randomUUID(), transportId: crypto.randomUUID(),
    })
    logInfo('session.start', { session: shortId(c.req.param('id')), user: shortId(userId), ip: clientIp(c) })
    return c.json(view)
  })
  app.post('/api/sessions/:id/actions', async (c) => {
    const body = await c.req.json()
    return c.json(await game.command(c.req.param('id'), await user(c), {
      type: 'submitAction', userId: await user(c), roundId: body.roundId, stepId: body.stepId,
      expectedStateVersion: body.expectedStateVersion, actionId: body.actionId, value: body.value,
    }))
  })
  app.post('/api/sessions/:id/access', async (c) => {
    const body = await c.req.json() as Record<string, unknown>
    const userId = await user(c)
    const expectedVersion = Number(body.expectedVersion)
    const actionId = String(body.actionId ?? '')
    const kind = String(body.type ?? '')
    const base = { userId, expectedVersion, actionId }
    let command: import('@bdi/domain').Command
    switch (kind) {
      case 'submitDossier':
        command = {
          type: 'accessSubmitDossier',
          ...base,
          items: Array.isArray(body.items) ? body.items.map((item) => String(item) as AccessDossierItem) : [],
        }
        break
      case 'reviewDossier':
        command = { type: 'accessReviewDossier', ...base, decision: body.decision === 'return' ? 'return' : 'admit' }
        break
      case 'answer':
        command = { type: 'accessAnswer', ...base, optionId: String(body.optionId ?? '') }
        break
      case 'setPolicy':
        command = { type: 'accessSetPolicy', ...base, shareLoading: Boolean(body.shareLoading), shareFinance: Boolean(body.shareFinance) }
        break
      case 'sendRequest':
        command = { type: 'accessSendRequest', ...base, cardId: String(body.cardId ?? '') as AccessCardId }
        break
      case 'lookup':
        command = { type: 'accessLookup', ...base, source: String(body.source ?? '') as AccessLookup }
        break
      case 'decide':
        command = { type: 'accessDecide', ...base, decision: body.decision === 'deliver' ? 'deliver' : 'refuse' }
        break
      case 'predict':
        command = { type: 'accessPredict', userId, actionId, requestId: String(body.requestId ?? ''), outcome: String(body.outcome ?? '') as AccessOutcome }
        break
      default:
        return c.json({ error: 'unknown', message: 'Onbekende access-actie.' }, 400)
    }
    const view = await game.command(c.req.param('id'), userId, command)
    logInfo('access.action', {
      session: shortId(c.req.param('id')),
      type: kind,
      user: shortId(userId),
      version: expectedVersion,
      ip: clientIp(c),
    })
    return c.json(view)
  })
  app.post('/api/sessions/:id/pause', async (c) => c.json(await game.command(c.req.param('id'), await user(c), { type: 'pause', userId: await user(c) })))
  app.post('/api/sessions/:id/resume', async (c) => c.json(await game.command(c.req.param('id'), await user(c), { type: 'resume', userId: await user(c) })))
  app.post('/api/sessions/:id/finish', async (c) => c.json(await game.command(c.req.param('id'), await user(c), { type: 'finishSession', userId: await user(c) })))
  app.post('/api/sessions/:id/restart', async (c) => c.json(await game.command(c.req.param('id'), await user(c), {
    type: 'restartRound', userId: await user(c), roundId: crypto.randomUUID(), seed: crypto.randomUUID(), orderId: crypto.randomUUID(), transportId: crypto.randomUUID(),
  })))
  app.post('/api/sessions/:id/help', async (c) => c.json(await game.command(c.req.param('id'), await user(c), { type: 'markHelp', userId: await user(c) })))
  app.post('/api/sessions/:id/notes', async (c) => {
    const body = await c.req.json()
    return c.json(await game.command(c.req.param('id'), await user(c), { type: 'saveNote', userId: await user(c), text: body.text ?? '' }))
  })
  app.post('/api/sessions/:id/heartbeat', async (c) => c.json(await game.command(c.req.param('id'), await user(c), { type: 'heartbeat', userId: await user(c) })))
  app.post('/api/sessions/:id/language', async (c) => {
    const body = await c.req.json()
    return c.json(await game.command(c.req.param('id'), await user(c), { type: 'updateLanguage', userId: await user(c), language: body.language }))
  })
  app.get('/api/data/:org/:type/:resourceId', async (c) => {
    const org = c.req.param('org').replace('-data', '') as OrgId
    const ref = `${org}-data/${c.req.param('type')}/${c.req.param('resourceId')}`
    const sessionId = c.req.query('sessionId') ?? ''
    return c.json(await game.read(sessionId, await user(c), ref))
  })
  app.post('/internal/tick', async (c) => {
    if (c.req.header('x-tick-secret') !== (process.env.INTERNAL_TICK_SECRET ?? 'dev-tick-secret')) {
      return c.json({ error: 'forbidden' }, 403)
    }
    await game.tickAll()
    return c.json({ ok: true })
  })
  return { app, game }
}
