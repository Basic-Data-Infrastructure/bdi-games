import { describe, expect, it } from 'vitest'
import {
  createSession, dispatch, GameError, playerView, trainingView,
  type Command, type Ctx, type SessionState,
} from '../../index.js'
import { PREDICT_MS } from './reduce.js'
import type { Lookup, Outcome, RequestCardId } from './scenario.js'
import type { AccessPlayerView, AccessTrainingView } from './view.js'

const orgs = ['admin', 'owner', 'registry', 'provider', 'consumer'] as const
const predictors = ['admin', 'owner', 'registry', 'consumer'] as const
const fullDossier = ['identity', 'mandate', 'terms'] as const

function ctx(now = '2026-01-01T10:00:00.000Z'): Ctx {
  return { now, language: 'nl', presentationMs: 3000, pipelineMs: 1000, animationMs: 4000, graceMs: 30000, idleMs: 30 * 60_000 }
}

function later(now: string, ms: number): string {
  return new Date(new Date(now).getTime() + ms).toISOString()
}

function accessSession(id = 'access-1'): SessionState {
  const invites = Object.fromEntries(orgs.map((org) => [org, `invite-${org}`]))
  let current = createSession({
    id, code: 'ACC123', hostUserId: 'host', name: 'Access', language: 'nl',
    startMode: 'story', now: ctx().now, expiresAt: '2026-01-02T10:00:00.000Z', invites, gameId: 'access',
  })
  for (const org of orgs) {
    current = dispatch(current, { type: 'claimRole', userId: org, organizationId: org, inviteToken: `invite-${org}` }, ctx()).state
    current = dispatch(current, { type: 'markReady', userId: org }, ctx()).state
  }
  return dispatch(current, {
    type: 'startRound', userId: 'host', roundId: 'run-1', seed: 'seed', orderId: 'o', transportId: 't',
  }, ctx()).state
}

type Play = { state: SessionState; now: string }

function heartbeat(state: SessionState, now: string): SessionState {
  let next = state
  for (const org of orgs) next = dispatch(next, { type: 'heartbeat', userId: org }, ctx(now)).state
  return next
}

/** Dispatches as a player, then lets the presentation hold pass. */
function act(play: Play, command: Command): Play & { output: Record<string, unknown> } {
  const state = heartbeat(play.state, play.now)
  const result = dispatch(state, command, ctx(play.now))
  const now = later(play.now, 3000)
  const ticked = dispatch(heartbeat(result.state, now), { type: 'tick' }, ctx(now)).state
  return { state: heartbeat(ticked, now), now, output: result.output }
}

let seq = 0
const id = () => `a-${++seq}`
const v = (play: Play) => play.state.access!.version

function submit(play: Play, items: readonly string[]): Play {
  return act(play, { type: 'accessSubmitDossier', userId: 'consumer', expectedVersion: v(play), actionId: id(), items: [...items] as never })
}

function review(play: Play, decision: 'admit' | 'return'): Play & { output: Record<string, unknown> } {
  return act(play, { type: 'accessReviewDossier', userId: 'admin', expectedVersion: v(play), actionId: id(), decision })
}

function answer(play: Play, userId: string, optionId: string): Play & { output: Record<string, unknown> } {
  return act(play, { type: 'accessAnswer', userId, expectedVersion: v(play), actionId: id(), optionId })
}

function policy(play: Play, shareLoading: boolean, shareFinance: boolean): Play {
  return act(play, { type: 'accessSetPolicy', userId: 'owner', expectedVersion: v(play), actionId: id(), shareLoading, shareFinance })
}

function send(play: Play, cardId: RequestCardId): Play {
  return act(play, { type: 'accessSendRequest', userId: 'consumer', expectedVersion: v(play), actionId: id(), cardId })
}

function predictAll(play: Play, outcome: Outcome): Play {
  let state = play.state
  const requestId = state.access!.requests.at(-1)!.id
  for (const role of predictors) {
    state = dispatch(state, { type: 'accessPredict', userId: role, actionId: id(), requestId, outcome }, ctx(play.now)).state
  }
  return { state, now: play.now }
}

function lookup(play: Play, source: Lookup): Play & { output: Record<string, unknown> } {
  return act(play, { type: 'accessLookup', userId: 'provider', expectedVersion: v(play), actionId: id(), source })
}

function decide(play: Play, decision: 'deliver' | 'refuse'): Play & { output: Record<string, unknown> } {
  return act(play, { type: 'accessDecide', userId: 'provider', expectedVersion: v(play), actionId: id(), decision })
}

/** Plays one request the way a careful provider would: every source, then the matching decision. */
function judge(play: Play, cardId: RequestCardId, prediction: Outcome = 'delivered'): Play & { output: Record<string, unknown> } {
  let next: Play = predictAll(send(play, cardId), prediction)
  for (const source of ['association', 'orchestration', 'policy'] as const) next = lookup(next, source)
  const request = next.state.access!.requests.at(-1)!
  const failed = request.lookups.some((item) => Object.values(item.layers).includes('failed'))
  return decide(next, failed ? 'refuse' : 'deliver')
}

function onboard(play: Play = { state: accessSession(), now: ctx().now }): Play {
  return review(submit(play, fullDossier), 'admit')
}

function toRequests(loading = true, finance = false): Play {
  let play = onboard()
  play = answer(play, 'owner', 'register')
  play = answer(play, 'registry', 'record')
  return policy(play, loading, finance)
}

function playStage1(play: Play): Play {
  for (const card of ['r-load-101', 'r-fin-101', 'r-load-102', 'r-old-101'] as const) play = judge(play, card)
  return play
}

function playAll(loading = true, finance = false): Play {
  let play = playStage1(toRequests(loading, finance))
  play = answer(play, 'owner', 'update')
  play = answer(play, 'registry', 'record')
  if (play.state.access!.scene === 'policy') play = policy(play, true, false)
  play = judge(play, 'r-again-101')
  play = judge(play, 'r-load-103')
  play = answer(play, 'admin', 'suspend')
  return judge(play, 'r-update-103')
}

describe('access game', () => {
  it('returns a dossier that asks for data access and admits a complete one once', () => {
    let play = submit({ state: accessSession(), now: ctx().now }, [...fullDossier, 'access'])
    expect(play.state.access!.scene).toBe('review')
    const wrong = review(play, 'admit')
    expect(wrong.output.ok).toBe(false)
    expect(wrong.state.access!.scene).toBe('review')
    expect(wrong.state.access!.feedback?.text).toMatch(/geen leesrecht/)
    expect(wrong.state.access!.mistakes).toHaveLength(1)

    play = review(wrong, 'return')
    expect(play.state.access!.scene).toBe('dossier')
    expect(play.state.access!.deltaStatus).toBe('none')

    play = submit(play, ['identity', 'terms'])
    play = review(play, 'return')
    expect(play.state.access!.feedback?.text).toMatch(/mandaat/)

    play = review(submit(play, fullDossier), 'admit')
    expect(play.state.access!.scene).toBe('involve')
    expect(play.state.access!.deltaStatus).toBe('active')
    expect(play.state.access!.keyRegistered).toBe(true)
    expect(play.state.access!.dossiers.map((d) => d.decision)).toEqual(['returned', 'returned', 'admitted'])
  })

  it('keeps wrong answers as learning moments and only records involvement through the registry', () => {
    let play = onboard()
    const wrong = answer(play, 'owner', 'association')
    expect(wrong.output.ok).toBe(false)
    expect(wrong.state.access!.scene).toBe('involve')
    expect(wrong.state.access!.wrongOptions.involve).toEqual(['association'])
    expect(() => dispatch(wrong.state, {
      type: 'accessAnswer', userId: 'registry', expectedVersion: v(wrong), actionId: 'x', optionId: 'record',
    }, ctx(wrong.now))).toThrow(GameError)

    play = answer(wrong, 'owner', 'register')
    expect(play.state.access!.scene).toBe('record')
    expect(play.state.access!.orchestration.some((e) => e.transportId === 'T-101' && e.carrierOrgId === 'org-delta')).toBe(false)

    play = answer(play, 'registry', 'grant')
    expect(play.state.access!.feedback?.text).toMatch(/feit/)
    play = answer(play, 'registry', 'record')
    expect(play.state.access!.scene).toBe('policy')
    expect(play.state.access!.orchestration).toContainEqual({ transportId: 'T-101', carrierOrgId: 'org-delta', role: 'carrier', status: 'active' })
    expect(play.state.access!.registrations).toBe(1)
  })

  it('lets the provider decide per request from three independent sources', () => {
    let play = toRequests()
    play = send(play, 'r-load-102')
    const access = play.state.access!
    expect(access.scene).toBe('check')

    const early = heartbeat(play.state, play.now)
    expect(() => dispatch(early, {
      type: 'accessLookup', userId: 'provider', expectedVersion: v(play), actionId: 'early', source: 'association',
    }, ctx(play.now))).toThrow(/voorspellen/)

    play = predictAll(play, 'involvement')
    play = lookup(play, 'association')
    expect(() => dispatch(heartbeat(play.state, play.now), {
      type: 'accessPredict', userId: 'owner', actionId: 'late', requestId: access.requests.at(-1)!.id, outcome: 'delivered',
    }, ctx(play.now))).toThrow(/gesloten/)
    expect(play.state.access!.requests.at(-1)!.predictions.owner).toBe('involvement')

    const tooSoon = decide(play, 'deliver')
    expect(tooSoon.output.ok).toBe(false)
    expect(tooSoon.state.access!.requests.at(-1)!.wrongDecisions[0].feedback).toMatch(/Zero trust/)

    play = lookup(tooSoon, 'orchestration')
    const leak = decide(play, 'deliver')
    expect(leak.output.ok).toBe(false)
    expect(leak.state.access!.received).toHaveLength(0)

    play = decide(leak, 'refuse')
    const resolved = play.state.access!.requests.at(-1)!
    expect(resolved.outcome).toBe('involvement')
    expect(resolved.finalLayers).toEqual({ identity: 'ok', membership: 'ok', involvement: 'failed', policy: 'ok' })
    expect(play.state.access!.scene).toBe('request')

    const view = trainingView(play.state, play.now) as AccessTrainingView
    expect(view.access!.scores.every((s) => s.points === 1 && s.of === 1)).toBe(true)
  })

  it('lets predictions time out and shifts the window when paused', () => {
    let play = send(toRequests(), 'r-load-101')
    const request = play.state.access!.requests.at(-1)!
    expect(request.predictUntil).toBe(later(request.sentAt, 3000 + PREDICT_MS))
    let state = dispatch(heartbeat(play.state, play.now), { type: 'pause', userId: 'host' }, ctx(play.now)).state
    state = dispatch(state, { type: 'resume', userId: 'host' }, ctx(later(play.now, 60_000))).state
    const shifted = state.access!.requests.at(-1)!.predictUntil
    expect(shifted).toBe(later(request.predictUntil, 60_000))
    expect(() => dispatch(heartbeat(state, later(request.predictUntil, 1)), {
      type: 'accessLookup', userId: 'provider', expectedVersion: state.access!.version, actionId: 'wait', source: 'association',
    }, ctx(later(request.predictUntil, 1)))).toThrow(/voorspellen/)
    play = lookup({ state, now: later(shifted, 1) }, 'association')
    expect(play.state.access!.requests.at(-1)!.predictionsClosed).toBe(true)
  })

  it('separates membership, authentication, involvement and policy across the request deck', () => {
    const play = playStage1(toRequests())
    const outcomes = Object.fromEntries(play.state.access!.requests.map((r) => [r.cardId, r.outcome]))
    expect(outcomes).toEqual({
      'r-load-101': 'delivered',
      'r-fin-101': 'policy',
      'r-load-102': 'involvement',
      'r-old-101': 'identity',
    })
    expect(play.state.access!.deltaStatus).toBe('active')
    expect(play.state.access!.received.map((r) => r.cardId)).toEqual(['r-load-101'])
    expect(play.state.access!.scene).toBe('change')
    expect(play.state.access!.policyReview).toBe(false)
  })

  it('reacts to changes without new onboarding and ends with a suspension that blocks everything', () => {
    const play = playAll()
    const access = play.state.access!
    expect(access.scene).toBe('debrief')
    expect(access.dossiers).toHaveLength(1)
    const outcomes = Object.fromEntries(access.requests.map((r) => [r.cardId, r.outcome]))
    expect(outcomes['r-again-101']).toBe('involvement')
    expect(outcomes['r-load-103']).toBe('delivered')
    expect(outcomes['r-update-103']).toBe('membership')
    expect(access.registrations).toBe(3)

    const consumer = playerView(play.state, 'consumer', play.now) as AccessPlayerView
    const earlier = consumer.access!.received.find((item) => item.cardId === 'r-load-101')
    expect(earlier?.stale).toBe(true)
    expect(earlier?.label).toMatch(/Eerder ontvangen/)

    const debrief = (trainingView(play.state, play.now) as AccessTrainingView).access!.debrief!
    expect(debrief.missions.every((m) => m.ok)).toBe(true)
    expect(debrief.rules.every((r) => r.seen)).toBe(true)
    expect(debrief.counts.find((c) => c.label.startsWith('Verzoeken'))?.value).toBe(7)
  })

  it('lets a strict or generous policy show its consequences and offers a review', () => {
    const strict = playStage1(toRequests(false, false))
    expect(strict.state.access!.requests.find((r) => r.cardId === 'r-load-101')!.outcome).toBe('policy')
    expect(strict.state.access!.policyReview).toBe(true)

    const generous = playStage1(toRequests(true, true))
    expect(generous.state.access!.received.map((r) => r.cardId)).toContain('r-fin-101')
    let play = answer(generous, 'owner', 'update')
    play = answer(play, 'registry', 'record')
    expect(play.state.access!.scene).toBe('policy')
    const owner = playerView(play.state, 'owner', play.now) as AccessPlayerView
    expect(owner.access!.task?.kind).toBe('policy')
    expect(owner.access!.task && 'news' in owner.access!.task ? owner.access!.task.news : '').toMatch(/tarief en marge/)
  })

  it('never shows players the outcome before the provider decides', () => {
    let play = predictAll(send(toRequests(), 'r-fin-101'), 'policy')
    play = lookup(play, 'association')
    for (const org of orgs) {
      const view = JSON.stringify(playerView(play.state, org, play.now))
      expect(view).not.toContain('finalLayers')
      expect(view).not.toContain('Geweigerd: Delta is betrokken')
    }
    const training = trainingView(play.state, play.now) as AccessTrainingView
    expect(training.access!.card.request?.decision).toBeNull()
    expect(training.access!.card.request?.checks.find((c) => c.id === 'policy')?.status).toBe('pending')
  })

  it('dedupes actionId, rejects wrong roles and isolates sessions', () => {
    const play = { state: accessSession('a'), now: ctx().now }
    const command = { type: 'accessSubmitDossier' as const, userId: 'consumer', expectedVersion: v(play), actionId: 'same', items: [...fullDossier] }
    const first = act(play, command)
    const second = dispatch(heartbeat(first.state, first.now), { ...command, expectedVersion: v(first) }, ctx(first.now))
    expect(second.output.duplicate).toBe(true)
    expect(second.state.access!.dossiers).toHaveLength(1)

    const requests = toRequests()
    expect(() => dispatch(heartbeat(requests.state, requests.now), {
      type: 'accessSendRequest', userId: 'owner', expectedVersion: v(requests), actionId: 'x', cardId: 'r-load-101',
    }, ctx(requests.now))).toThrow(GameError)
    expect(() => dispatch(heartbeat(requests.state, requests.now), {
      type: 'accessSendRequest', userId: 'consumer', expectedVersion: v(requests), actionId: 'y', cardId: 'r-load-103',
    }, ctx(requests.now))).toThrow(/niet \(meer\) beschikbaar/)

    const other = accessSession('b')
    expect(other.access!.dossiers).toHaveLength(0)

    const logistics = createSession({
      id: 'log', code: 'LOG123', hostUserId: 'host', name: 'Log', language: 'nl',
      startMode: 'without_bdi', now: ctx().now, expiresAt: '2026-01-02T10:00:00.000Z',
      invites: { buyer: 'b', seller: 's', carrier: 'c', delivery: 'd' }, gameId: 'logistics',
    })
    expect(() => dispatch(logistics, {
      type: 'accessSendRequest', userId: 'buyer', expectedVersion: 1, actionId: 'z', cardId: 'r-load-101',
    }, ctx())).toThrow(GameError)
  })

  it('training view shows phases, history frames and no invite tokens on claimed roles', () => {
    const play = playAll()
    const view = trainingView(play.state, play.now) as AccessTrainingView
    expect(view.access!.history.length).toBeGreaterThan(20)
    expect(view.access!.phases.bands.map((b) => b.countLabel)).toEqual([
      '1× toegetreden · 1× geschorst',
      '3× vastgelegd',
      '7× gecontroleerd',
    ])
    expect(view.access!.history.every((event) => event.frame.card && event.frame.network)).toBe(true)
    expect(view.roles.every((r) => r.claimed ? r.inviteToken === null : true)).toBe(true)
    const consumer = playerView(play.state, 'consumer', play.now) as AccessPlayerView
    expect(JSON.stringify(consumer)).not.toContain('invite-')
  })
})
