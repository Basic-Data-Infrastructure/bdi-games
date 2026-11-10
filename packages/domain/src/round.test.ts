import { describe, expect, it } from 'vitest'
import {
  blankRound, createSession, dispatch, GameError, playerView, readSource, revisedEtas, trainingView,
  type Ctx, type OrgId, type PlayerView, type SessionState,
} from './index.js'

const orgs: OrgId[] = ['buyer', 'seller', 'carrier', 'delivery']

function ctx(now = '2026-01-01T10:00:00.000Z', language: Ctx['language'] = 'nl'): Ctx {
  return { now, language, presentationMs: 3000, pipelineMs: 1000, animationMs: 4000, graceMs: 30000, idleMs: 30 * 60_000 }
}

function later(now: string, ms: number): string {
  return new Date(new Date(now).getTime() + ms).toISOString()
}

function session(): SessionState {
  const invites = Object.fromEntries(orgs.map((org) => [org, `invite-${org}`])) as Record<OrgId, string>
  let current = createSession({
    id: 'sess-1', code: 'ABC123', hostUserId: 'host', name: 'Test', language: 'nl',
    startMode: 'without_bdi', now: ctx().now, expiresAt: '2026-01-02T10:00:00.000Z', invites,
  })
  for (const org of orgs) {
    current = dispatch(current, { type: 'claimRole', userId: org, organizationId: org, inviteToken: `invite-${org}`, displayName: org }, ctx()).state
    current = dispatch(current, { type: 'markReady', userId: org }, ctx()).state
  }
  return current
}

function start(state: SessionState, mode: SessionState['startMode'] = 'without_bdi'): SessionState {
  state.startMode = mode
  return dispatch(state, {
    type: 'startRound', userId: 'host', roundId: 'round-1', seed: 'SEED-DO-NOT-LEAK-9f3a', orderId: 'order-1', transportId: 'transport-1',
  }, ctx()).state
}

function act(state: SessionState, user: string, value: string, now = ctx().now): SessionState {
  const round = state.rounds.find((item) => item.id === state.currentRoundId)!
  const next = dispatch(state, {
    type: 'submitAction', userId: user, roundId: round.id, stepId: round.stepId,
    expectedStateVersion: round.stateVersion, actionId: `${round.stepId}-${value}-${round.attempts.length}`, value,
  }, ctx(now)).state
  return dispatch(next, { type: 'tick' }, ctx(later(now, 3000))).state
}

describe('round rules', () => {
  it('refuses a client skip and confirms products by id', () => {
    let state = start(session())
    state = act(state, 'host', 'continue')
    const round = state.rounds[0]
    expect(round.stepId).toBe('S01')
    expect(() => dispatch(state, {
      type: 'submitAction', userId: 'buyer', roundId: round.id, stepId: 'S03',
      expectedStateVersion: round.stateVersion, actionId: 'skip', value: 'camera',
    }, ctx())).toThrow(GameError)
    state = act(state, 'buyer', 'camera')
    const seller = playerView(state, 'seller', ctx().now)! as PlayerView
    expect(JSON.stringify(seller.round?.dossier)).not.toContain('camera')
    expect(seller.round?.task?.highlightOptionId).toBeNull()
    expect(JSON.stringify(seller)).not.toContain('SEED-DO-NOT-LEAK')
    const wrong = dispatch(state, {
      type: 'submitAction', userId: 'seller', roundId: state.currentRoundId!, stepId: 'S03',
      expectedStateVersion: state.rounds[0].stateVersion, actionId: 'bad', value: 'phone',
    }, ctx())
    expect(wrong.output.outcome).toBe('mismatch')
    expect(wrong.state.rounds[0].stepId).toBe('S03')
    expect(wrong.state.rounds[0].logistics.phase).toBe('idle')
    const again = dispatch(wrong.state, {
      type: 'submitAction', userId: 'seller', roundId: state.currentRoundId!, stepId: 'S03',
      expectedStateVersion: wrong.state.rounds[0].stateVersion, actionId: 'bad', value: 'camera',
    }, ctx())
    expect(again.output.duplicate).toBe(true)
    expect(again.state.rounds[0].metrics.wrongAttempts).toBe(1)
    state = dispatch(wrong.state, { type: 'tick' }, ctx(later(ctx().now, 3000))).state
    state = act(state, 'seller', 'camera')
    expect(state.rounds[0].resources.some((r) => r.type === 'acceptance' && r.payload.productId === 'camera')).toBe(true)
  })

  it('plays the file example without BDI', () => {
    let state = start(session())
    let now = ctx().now
    const play = (user: string, value: string) => {
      state = act(state, user, value, now)
      now = later(now, 3000)
    }
    play('host', 'continue')
    play('buyer', 'television')
    play('seller', 'television')
    play('carrier', 'carrier-noor')
    play('delivery', 'delivery-sara')
    play('carrier', 'eta-d1-0900')
    play('delivery', 'eta-d1-0900')
    play('delivery', 'eta-d2-0600')
    expect(state.rounds[0].stepId).toBe('S09')
    play('seller', 'eta-d2-0600')
    for (let guard = 0; guard < 12 && state.rounds[0].stepId !== 'S16'; guard++) {
      const step = state.rounds[0].stepId
      if (step === 'S11') play('seller', 'carrier-noor')
      else if (step === 'S13') play('delivery', 'carrier-noor')
      else {
        now = later(now, 4000)
        for (const org of orgs) state = dispatch(state, { type: 'heartbeat', userId: org }, ctx(now)).state
        state = dispatch(state, { type: 'tick' }, ctx(now)).state
      }
    }
    expect(state.rounds[0].stepId).toBe('S16')
    const options = revisedEtas({ day: 2, time: '06:00' })
    expect(options.map((item) => item.time)).toEqual(['06:30', '07:00', '07:30'])
    state = dispatch(state, {
      type: 'submitAction', userId: 'delivery', roundId: 'round-1', stepId: 'S16',
      expectedStateVersion: state.rounds[0].stateVersion, actionId: 'eta2', value: 'rev-30',
    }, ctx()).state
    const frame = trainingView(state).round!.frame
    const seller = frame.panels.find((panel) => panel.organizationId === 'seller')!
    const delivery = frame.panels.find((panel) => panel.organizationId === 'delivery')!
    expect(delivery.items.some((item) => item.value.includes('06:30'))).toBe(true)
    expect(seller.items.some((item) => item.value.includes('06:00') || item.label.includes('v2'))).toBe(true)
    expect(frame.comm.toLowerCase()).toContain('afstemming nodig')
    expect((playerView(state, 'seller', ctx().now)! as PlayerView).round!.dossier.some((item) => item.value.includes('06:30'))).toBe(false)
    state = dispatch(state, { type: 'tick' }, ctx(later(now, 3000))).state
    now = later(now, 3000)
    const finish = (user: string, value: string) => {
      state = act(state, user, value, now)
      now = later(now, 4000)
      for (const org of orgs) state = dispatch(state, { type: 'heartbeat', userId: org }, ctx(now)).state
    }
    finish('seller', 'rev-30')
    for (let guard = 0; guard < 8 && state.rounds[0].stepId !== 'S20'; guard++) {
      const step = state.rounds[0].stepId
      if (step === 'S19') finish('buyer', 'delivery-sara')
      else {
        now = later(now, 4000)
        for (const org of orgs) state = dispatch(state, { type: 'heartbeat', userId: org }, ctx(now)).state
        state = dispatch(state, { type: 'tick' }, ctx(now)).state
      }
    }
    expect(state.rounds[0].stepId).toBe('S20')
    expect(state.rounds[0].logistics.phase).toBe('delivered')
    expect(trainingView(state).round?.frame.prompt).toBeTruthy()
  })

  it('delivers the order to the seller only after a BDI subscription', () => {
    let state = start(session(), 'only_bdi')
    let now = ctx().now
    const play = (user: string, value: string) => {
      state = act(state, user, value, now)
      now = later(now, 4000)
    }
    play('host', 'skip')
    state = dispatch(state, {
      type: 'submitAction', userId: 'buyer', roundId: 'round-1', stepId: 'S01',
      expectedStateVersion: state.rounds[0].stateVersion, actionId: 'cam', value: 'camera',
    }, ctx(now)).state
    now = later(now, 4000)
    state = dispatch(state, { type: 'tick' }, ctx(now)).state
    expect(state.rounds[0].stepId).toBe('S02')
    expect((playerView(state, 'seller', now)! as PlayerView).round!.dossier.some((item) => item.value.includes('Camera'))).toBe(false)
    for (const org of orgs) {
      state = dispatch(state, {
        type: 'submitAction', userId: org, roundId: 'round-1', stepId: 'S02',
        expectedStateVersion: state.rounds[0].stateVersion, actionId: `sub-${org}`, value: 'subscribe',
      }, ctx(now)).state
    }
    now = later(now, 4000)
    state = dispatch(state, { type: 'tick' }, ctx(now)).state
    expect((playerView(state, 'seller', now)! as PlayerView).round!.dossier.some((item) => item.value.toLowerCase().includes('camera'))).toBe(true)
    expect((playerView(state, 'carrier', now)! as PlayerView).round!.dossier.some((item) => item.value.toLowerCase().includes('camera'))).toBe(false)
  })

  it('keeps pause time out of the active decision time', () => {
    let state = start(session())
    state = act(state, 'host', 'continue')
    const t0 = state.rounds[0].metrics.decisionStartedAt!
    state = dispatch(state, { type: 'pause', userId: 'host' }, ctx(later(t0, 2000))).state
    for (const org of orgs) state = dispatch(state, { type: 'heartbeat', userId: org }, ctx(later(t0, 61000))).state
    state = dispatch(state, { type: 'resume', userId: 'host' }, ctx(later(t0, 62000))).state
    const round = state.rounds[0]
    state = dispatch(state, {
      type: 'submitAction', userId: 'buyer', roundId: round.id, stepId: round.stepId,
      expectedStateVersion: round.stateVersion, actionId: 'pick', value: 'camera',
    }, ctx(later(t0, 63000))).state
    expect(state.rounds[0].metrics.pauseMs).toBe(60000)
    expect(state.rounds[0].metrics.activeDecisionMs).toBe(3000)
    expect(() => dispatch(state, { type: 'pause', userId: 'host' }, ctx(later(t0, 64000)))).not.toThrow()
  })

  it('closes a session after idleMs without activity', () => {
    let state = createSession({
      id: 'sess-idle', code: 'IDLE01', hostUserId: 'host', name: 'Idle', language: 'nl',
      startMode: 'without_bdi', now: ctx().now, expiresAt: '2026-01-02T10:00:00.000Z',
      invites: Object.fromEntries(orgs.map((org) => [org, `invite-${org}`])) as Record<OrgId, string>,
    })
    const idleAt = later(ctx().now, 30 * 60_000 + 1)
    state = dispatch(state, { type: 'tick' }, ctx(idleAt)).state
    expect(state.status).toBe('closed')
  })

  it('closes a session when expiresAt has passed', () => {
    let state = createSession({
      id: 'sess-exp', code: 'EXP001', hostUserId: 'host', name: 'Exp', language: 'nl',
      startMode: 'without_bdi', now: ctx().now, expiresAt: later(ctx().now, 60_000),
      invites: Object.fromEntries(orgs.map((org) => [org, `invite-${org}`])) as Record<OrgId, string>,
    })
    state = dispatch(state, { type: 'tick' }, ctx(later(ctx().now, 60_001))).state
    expect(state.status).toBe('closed')
  })

  it('denies cross-session and unauthorized reads', () => {
    let state = start(session())
    state = act(state, 'host', 'continue')
    state = act(state, 'buyer', 'camera')
    const order = state.rounds[0].resources.find((r) => r.type === 'order')!
    expect(readSource(state.rounds[0], 'seller', `buyer-data/order/${order.id}`)).toBeNull()
    expect(readSource(state.rounds[0], 'buyer', `buyer-data/order/${order.id}`)?.productId).toBe('camera')
  })

  it('restarts the current BDI round even while paused', () => {
    let state = start(session(), 'only_bdi')
    state = act(state, 'host', 'skip')
    const before = state.rounds[0]
    expect(before.mode).toBe('with_bdi')
    state = dispatch(state, { type: 'pause', userId: 'host' }, ctx()).state
    expect(state.status).toBe('paused')
    state = dispatch(state, {
      type: 'restartRound', userId: 'host', roundId: 'round-restart', seed: 'SEED-RESTART',
      orderId: 'order-r', transportId: 'transport-r',
    }, ctx()).state
    const round = state.rounds.find((item) => item.id === state.currentRoundId)!
    expect(state.status).toBe('running')
    expect(state.comparison).toBe(false)
    expect(round.id).toBe('round-restart')
    expect(round.number).toBe(before.number)
    expect(round.mode).toBe('with_bdi')
    expect(round.stepId).toBe('S00')
    expect(state.rounds.some((item) => item.id === before.id)).toBe(false)
  })
})
