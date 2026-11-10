import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { MemoryStore } from './service.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

async function client(app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> }) {
  const anon = await (await app.request('/api/dev/anonymous', { method: 'POST' })).json() as { userId: string; token: string }
  const headers = { authorization: `Bearer ${anon.token}`, 'content-type': 'application/json' }
  return { userId: anon.userId, token: anon.token, headers }
}

describe('session isolation', () => {
  it('gives one role to one simultaneous claim and hides training from players', async () => {
    const { app } = createApp(new MemoryStore())
    const host = await client(app)
    const createResponse = await app.request('/api/sessions', { method: 'POST', headers: host.headers, body: JSON.stringify({ name: 'Zaal A' }) })
    const created = await createResponse.json() as { sessionId: string; roles: { organizationId: string; inviteToken: string }[]; message?: string }
    if (!created.roles) throw new Error(`${createResponse.status} ${JSON.stringify(created)}`)
    const buyers = await Promise.all([client(app), client(app)])
    const token = created.roles.find((r) => r.organizationId === 'buyer')!.inviteToken
    const claims = await Promise.all(buyers.map((player) => app.request(`/api/sessions/${created.sessionId}/claim`, {
      method: 'POST', headers: player.headers, body: JSON.stringify({ organizationId: 'buyer', inviteToken: token, displayName: 'A' }),
    })))
    const statuses = claims.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409])
    const training = await app.request(`/api/sessions/${created.sessionId}/training`, { headers: buyers[0].headers })
    expect(training.status).toBe(403)
    const hostView = await (await app.request(`/api/sessions/${created.sessionId}/training`, { headers: host.headers })).json() as { roles: { organizationId: string; claimed: boolean; inviteToken: string | null }[] }
    expect(hostView.roles.find((r) => r.organizationId === 'buyer')?.inviteToken).toBeNull()
  })

  it('ignores command type and user id sent in an action body', async () => {
    const { app } = createApp(new MemoryStore())
    const host = await client(app)
    const created = await (await app.request('/api/sessions', { method: 'POST', headers: host.headers, body: JSON.stringify({ name: 'Zaal B' }) })).json() as { sessionId: string }
    const intruder = await client(app)
    const spoof = await app.request(`/api/sessions/${created.sessionId}/actions`, {
      method: 'POST', headers: intruder.headers, body: JSON.stringify({ type: 'finishSession', userId: host.userId }),
    })
    expect(spoof.status).toBeGreaterThanOrEqual(400)
    const hostView = await (await app.request(`/api/sessions/${created.sessionId}/training`, { headers: host.headers })).json() as { status: string }
    expect(hostView.status).not.toBe('closed')
  })

  it('allows at most ten open sessions per client IP in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_DEV_AUTH', 'true')
    vi.stubEnv('AUTH_SECRET', 'test-secret')
    const { app } = createApp(new MemoryStore())
    const host = await client(app)
    const ipHeaders = { ...host.headers, 'x-forwarded-for': '203.0.113.10' }
    for (let i = 0; i < 10; i += 1) {
      const response = await app.request('/api/sessions', { method: 'POST', headers: ipHeaders, body: JSON.stringify({ name: `Zaal ${i}` }) })
      expect(response.status).toBe(200)
    }
    const blocked = await app.request('/api/sessions', { method: 'POST', headers: ipHeaders, body: JSON.stringify({ name: 'Te veel' }) })
    expect(blocked.status).toBe(429)
    const otherIp = await client(app)
    const other = await app.request('/api/sessions', {
      method: 'POST',
      headers: { ...otherIp.headers, 'x-forwarded-for': '203.0.113.99' },
      body: JSON.stringify({ name: 'Ander netwerk' }),
    })
    expect(other.status).toBe(200)
  })

  it('has no open-session cap on a local server unless one is configured', async () => {
    const { app } = createApp(new MemoryStore())
    const host = await client(app)
    for (let i = 0; i < 12; i += 1) {
      const response = await app.request('/api/sessions', { method: 'POST', headers: host.headers, body: JSON.stringify({ name: `Lokaal ${i}` }) })
      expect(response.status).toBe(200)
    }
    vi.stubEnv('MAX_OPEN_SESSIONS_PER_IP', '12')
    const capped = await app.request('/api/sessions', { method: 'POST', headers: host.headers, body: JSON.stringify({ name: 'Te veel' }) })
    expect(capped.status).toBe(429)
  })

  it('lists catalog games and creates a session for a gameId', async () => {
    const { app } = createApp(new MemoryStore())
    const catalog = await (await app.request('/api/games')).json() as { games: { id: string }[] }
    expect(catalog.games.some((game) => game.id === 'logistics')).toBe(true)
    expect(catalog.games.some((game) => game.id === 'access')).toBe(true)
    const host = await client(app)
    const created = await app.request('/api/sessions', {
      method: 'POST',
      headers: host.headers,
      body: JSON.stringify({ name: 'Catalog', gameId: 'logistics' }),
    })
    expect(created.status).toBe(200)
    const body = await created.json() as { gameId: string; gameTitle: string }
    expect(body.gameId).toBe('logistics')
    expect(body.gameTitle).toBeTruthy()
  })

  it('creates an access session and rejects spoofed policy from a non-owner', async () => {
    const { app } = createApp(new MemoryStore())
    const host = await client(app)
    const created = await (await app.request('/api/sessions', {
      method: 'POST',
      headers: host.headers,
      body: JSON.stringify({ name: 'Access', gameId: 'access', startMode: 'story' }),
    })).json() as { sessionId: string; roles: { organizationId: string; inviteToken: string }[]; gameId: string }
    expect(created.gameId).toBe('access')
    const players: Record<string, Awaited<ReturnType<typeof client>>> = {}
    for (const role of created.roles) {
      players[role.organizationId] = await client(app)
      await app.request(`/api/sessions/${created.sessionId}/claim`, {
        method: 'POST',
        headers: players[role.organizationId].headers,
        body: JSON.stringify({ organizationId: role.organizationId, inviteToken: role.inviteToken }),
      })
      await app.request(`/api/sessions/${created.sessionId}/ready`, { method: 'POST', headers: players[role.organizationId].headers })
    }
    await app.request(`/api/sessions/${created.sessionId}/start`, { method: 'POST', headers: host.headers })
    const spoof = await app.request(`/api/sessions/${created.sessionId}/access`, {
      method: 'POST',
      headers: players.consumer.headers,
      body: JSON.stringify({
        type: 'setPolicy', expectedVersion: 1, actionId: crypto.randomUUID(),
        shareLoading: true, shareFinance: true,
      }),
    })
    expect(spoof.status).toBeGreaterThanOrEqual(400)

    const providerPredicts = await app.request(`/api/sessions/${created.sessionId}/access`, {
      method: 'POST',
      headers: players.provider.headers,
      body: JSON.stringify({ type: 'predict', requestId: 'req-1', outcome: 'delivered', actionId: crypto.randomUUID() }),
    })
    expect(providerPredicts.status).toBe(403)

    const unknown = await app.request(`/api/sessions/${created.sessionId}/access`, {
      method: 'POST',
      headers: players.consumer.headers,
      body: JSON.stringify({ type: 'askCard', expectedVersion: 1, actionId: crypto.randomUUID() }),
    })
    expect(unknown.status).toBe(400)

    const other = await (await app.request('/api/sessions', {
      method: 'POST',
      headers: host.headers,
      body: JSON.stringify({ name: 'Access 2', gameId: 'access', startMode: 'story' }),
    })).json() as { sessionId: string }
    expect(other.sessionId).not.toBe(created.sessionId)
  })
})
