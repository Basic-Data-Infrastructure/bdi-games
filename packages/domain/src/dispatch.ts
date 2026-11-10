import { catchUp, highlightFor, processOutbox, publishResource, stageFetch } from './project.js'
import { etaLabel, orgName, parseTime, revisedEtas, roleLabel, scenario } from './games/logistics/scenario.js'
import {
  COARSE, expectedValue, isChoose, isConfirm, mismatchText, narrative, nextStepId, optionsFor, promptFor, shuffledOptions, STEP_ACTOR,
} from './games/logistics/steps.js'
import { authorize, minimalPayload, subscriptionsFor } from './games/logistics/policy.js'
import type { Ctx } from './runtime.js'
import {
  GameError, type Language, type OrgId, type RoundState, type SessionState, type SourceResource, type StepId, type TrainingFrame,
} from './types.js'
import { buildFrame } from './project.js'
import { DEFAULT_GAME_ID, getGame } from './catalog.js'
import { orgIds } from './game-definition.js'
import {
  pauseAccess, reduceAccess, releasePausesAccess, restartAccessGame, resumeAccess, startAccessGame, tickAccess,
  type AccessCommand,
} from './games/access/reduce.js'

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function plus(now: string, ms: number): string {
  return iso(new Date(now).getTime() + ms)
}

function resource(round: RoundState, partial: Omit<SourceResource, 'sessionId' | 'roundId' | 'createdAt' | 'stale'> & { stale?: boolean }, now: string): SourceResource {
  return {
    stale: false,
    ...partial,
    sessionId: round.sessionId,
    roundId: round.id,
    createdAt: now,
  }
}

function pushEvent(round: RoundState, language: Language, input: {
  type: 'choice' | 'feedback' | 'engine' | 'notification' | 'fetch' | 'intro' | 'help' | 'system'
  text: string
  choiceLabel?: string | null
  result?: string | null
  organizationId?: string | null
  version?: number | null
  at: string
  route?: { from: OrgId; to: OrgId } | null
}): void {
  const frame: TrainingFrame = buildFrame(round, language)
  round.projectionSeq += 1
  round.trainingEvents.push({
    sequence: round.projectionSeq,
    stepId: round.stepId,
    actorRole: String(STEP_ACTOR[round.stepId]),
    displayType: input.type,
    text: input.text,
    choiceLabel: input.choiceLabel ?? null,
    result: input.result ?? null,
    organizationId: input.organizationId ?? null,
    version: input.version ?? null,
    at: input.at,
    frame,
    route: input.route ?? null,
  })
}

function armPresentation(round: RoundState, ctx: Ctx, advance: boolean): void {
  round.presentationUntil = plus(ctx.now, ctx.presentationMs)
  round.actionEnabledAt = round.presentationUntil
  round.pendingAdvance = advance
  if (round.metrics.decisionStartedAt) {
    round.metrics.activeDecisionMs += Math.max(0, new Date(ctx.now).getTime() - new Date(round.metrics.decisionStartedAt).getTime())
    round.metrics.decisionStartedAt = null
  }
}

function enterStep(round: RoundState, step: StepId, ctx: Ctx): void {
  round.stepId = step
  round.state = COARSE[step]
  round.stateVersion += 1
  round.pendingAdvance = false
  round.presentationUntil = null
  round.lastSubmission = null
  round.question = null
  const actor = STEP_ACTOR[step]
  if (actor === 'engine') {
    round.actionEnabledAt = null
    round.logistics.phaseEnteredAt = ctx.now
    round.logistics.dueAt = plus(ctx.now, ctx.animationMs)
    if (step === 'S10') round.logistics.phase = 'to_seller'
    if (step === 'S12') round.logistics.phase = 'linehaul'
    if (step === 'S14') {
      round.logistics.phase = 'transfer'
      round.logistics.night = true
    }
    if (step === 'S15') round.logistics.phase = 'last_mile'
    if (step === 'S18') round.logistics.phase = 'to_buyer'
    pushEvent(round, ctx.language, { type: 'engine', text: narrative(step, ctx.language), at: ctx.now })
    return
  }
  round.actionEnabledAt = ctx.now
  round.metrics.decisionStartedAt = ctx.now
  if (step === 'S11') round.logistics.phase = 'at_seller_gate'
  if (step === 'S13') round.logistics.phase = 'at_delivery_dc'
  if (step === 'S16' || step === 'S17') round.logistics = { ...round.logistics, phase: 'traffic', traffic: true }
  if (step === 'S19') round.logistics.phase = 'at_buyer_gate'
  if (isChoose(step) || isConfirm(step)) {
    round.question = { stepId: step, instanceId: `${round.id}:${step}`, options: shuffledOptions(round, step, ctx.language) }
  }
  if (step === 'S20') {
    round.metrics.endedAt = ctx.now
    round.actionEnabledAt = null
    closeSubscriptions(round)
    pushEvent(round, ctx.language, {
      type: 'system',
      text: ctx.language === 'nl' ? 'Afgeleverd' : 'Delivered',
      result: ctx.language === 'nl' ? 'Afgeleverd' : 'Delivered',
      at: ctx.now,
    })
  }
}

function closeSubscriptions(round: RoundState): void {
  for (const sub of round.subscriptions) sub.status = 'closed'
}

function completeEngine(round: RoundState, ctx: Ctx): void {
  round.metrics.animationMs += ctx.animationMs
  if (round.stepId === 'S10') {
    round.simDay = 1
    round.simMinutes = 8 * 60 + 40
    round.logistics.phase = 'at_seller_gate'
  }
  if (round.stepId === 'S12') {
    const eta = round.resources.find((r) => r.owner === 'carrier' && r.type === 'eta')
    round.simDay = 1
    round.simMinutes = eta ? parseTime(String(eta.payload.time)) : 12 * 60
    round.logistics.phase = 'at_delivery_dc'
    round.logistics.cargo = 'linehaul_truck'
  }
  if (round.stepId === 'S14') {
    round.simDay = 2
    round.simMinutes = 2 * 60
    round.logistics.cargo = 'delivery_truck'
    round.logistics.night = false
    round.logistics.phase = 'at_delivery_dc'
  }
  if (round.stepId === 'S15') {
    round.simDay = scenario.disruption.day
    round.simMinutes = scenario.disruption.minutes
    round.logistics.phase = 'traffic'
    round.logistics.traffic = true
  }
  if (round.stepId === 'S18') {
    const eta = round.resources.find((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 2)
      ?? round.resources.find((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 1)
    if (eta) {
      round.simDay = Number(eta.payload.day)
      round.simMinutes = parseTime(String(eta.payload.time))
    }
    round.logistics.phase = 'at_buyer_gate'
    round.logistics.traffic = false
  }
  enterStep(round, nextStepId(round.stepId, round.mode), ctx)
}

function acceptChoice(round: RoundState, step: StepId, value: string, ctx: Ctx): void {
  const now = ctx.now
  if (step === 'S01') {
    publishResource(round, resource(round, {
      id: round.orderId,
      owner: 'buyer',
      type: 'order',
      version: 1,
      legId: null,
      payload: { orderId: round.orderId, productId: value, quantity: scenario.quantity, transportId: round.transportId },
    }, now), now, ctx.pipelineMs)
  }
  if (step === 'S04' || step === 'S05') {
    const owner: OrgId = step === 'S04' ? 'carrier' : 'delivery'
    const legId = step === 'S04' ? round.leg1Id : round.leg2Id
    publishResource(round, resource(round, {
      id: `${round.id}-${owner}-driver`,
      owner,
      type: 'driver',
      version: 1,
      legId,
      payload: { driverId: value, name: optionsFor(round, step, ctx.language).find((o) => o.id === value)?.label, organizationId: owner, legId, transportId: round.transportId },
    }, now), now, ctx.pipelineMs)
  }
  if (step === 'S06') {
    const eta = scenario.linehaulEtas.find((item) => item.id === value)!
    publishResource(round, resource(round, {
      id: `${round.id}-eta-dc`,
      owner: 'carrier',
      type: 'eta',
      version: 1,
      legId: round.leg1Id,
      payload: { etaId: eta.id, destination: scenario.locations.deliveryDc.nl, day: eta.day, time: eta.time, transportId: round.transportId },
    }, now), now, ctx.pipelineMs)
  }
  if (step === 'S08' || step === 'S16') {
    const version = step === 'S08' ? 1 : 2
    const base = round.resources.find((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 1)
    const eta = version === 1
      ? scenario.deliveryEtas.find((item) => item.id === value)!
      : revisedEtas({ day: Number(base?.payload.day ?? 2), time: String(base?.payload.time ?? '06:00') }).find((item) => item.id === value)!
    if (version === 2 && base) base.stale = true
    publishResource(round, resource(round, {
      id: `${round.id}-eta-buyer-v${version}`,
      owner: 'delivery',
      type: 'eta',
      version,
      legId: round.leg2Id,
      payload: {
        etaId: eta.id,
        destination: scenario.locations.buyer.nl,
        day: eta.day,
        time: eta.time,
        previousVersion: version === 2 ? 1 : null,
        reason: version === 2 ? 'vertraging' : null,
        transportId: round.transportId,
      },
    }, now), now, ctx.pipelineMs)
    if (version === 2) round.metrics.etaV2ChosenAt = now
  }
}

function acceptConfirm(round: RoundState, step: StepId, value: string, ctx: Ctx): void {
  const now = ctx.now
  if (step === 'S03') {
    publishResource(round, resource(round, {
      id: `${round.id}-acceptance`,
      owner: 'seller',
      type: 'acceptance',
      version: 1,
      legId: null,
      payload: { orderId: round.orderId, productId: value },
    }, now), now, ctx.pipelineMs)
  }
  if (step === 'S07') {
    publishResource(round, resource(round, {
      id: `${round.id}-eta-confirm-1`,
      owner: 'delivery',
      type: 'etaConfirmation',
      version: 1,
      legId: round.leg1Id,
      payload: { etaId: value, version: 1 },
    }, now), now, ctx.pipelineMs)
  }
  if (step === 'S09' || step === 'S17') {
    const version = step === 'S09' ? 1 : 2
    const eta = round.resources.find((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === version)!
    if (version === 2) {
      const previous = round.resources.find((r) => r.owner === 'seller' && r.type === 'promise' && r.version === 1)
      if (previous) previous.stale = true
      for (const received of round.received.filter((r) => r.resourceType === 'promise' && r.version === 1)) received.stale = true
      round.metrics.etaV2ConfirmedAt = now
    }
    publishResource(round, resource(round, {
      id: `${round.id}-promise-v${version}`,
      owner: 'seller',
      type: 'promise',
      version,
      legId: round.leg2Id,
      payload: {
        etaId: value,
        version,
        sourceRef: `${eta.owner}-data/eta/${eta.id}`,
        day: eta.payload.day,
        time: eta.payload.time,
        transportId: round.transportId,
      },
    }, now), now, ctx.pipelineMs)
  }
  if (step === 'S19') {
    round.logistics.phase = 'delivered'
    round.logistics.cargo = 'buyer'
    publishResource(round, resource(round, {
      id: `${round.id}-receipt`,
      owner: 'buyer',
      type: 'receipt',
      version: 1,
      legId: null,
      payload: { status: 'received', simTime: `day ${round.simDay} ${round.simMinutes}` },
    }, now), now, ctx.pipelineMs)
  }
}

function currentRound(session: SessionState): RoundState {
  const round = session.rounds.find((item) => item.id === session.currentRoundId)
  if (!round) throw new GameError('no_round', 'Er is geen actieve ronde.', 409)
  return round
}

function roleOf(session: SessionState, userId: string): OrgId | null {
  return session.roles.find((role) => role.playerUserId === userId)?.organizationId ?? null
}

export function createSession(input: {
  id: string
  code: string
  hostUserId: string
  name: string
  language: Language
  startMode: SessionState['startMode']
  now: string
  expiresAt: string
  invites: Record<string, string>
  creatorIp?: string | null
  gameId?: string
}): SessionState {
  const game = getGame(input.gameId)
  const orgs = orgIds(game)
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    gameId: game.id,
    hostUserId: input.hostUserId,
    status: 'lobby',
    language: input.language,
    startMode: input.startMode,
    createdAt: input.now,
    lastActivityAt: input.now,
    expiresAt: input.expiresAt,
    creatorIp: input.creatorIp ?? null,
    currentRoundId: null,
    comparison: false,
    creates: [],
    roles: orgs.map((org) => ({
      organizationId: org,
      playerUserId: null,
      displayName: null,
      assignmentVersion: 1,
      inviteToken: input.invites[org],
      connectionStatus: 'open',
      ready: false,
      lastSeenAt: null,
    })),
    rounds: [],
    access: null,
  }
}

/** Ensure loaded documents have gameId (older saves omitted it). */
export function ensureSessionGame(session: SessionState): SessionState {
  const withGame = session.gameId
    ? (getGame(session.gameId), session)
    : { ...session, gameId: DEFAULT_GAME_ID }
  if (withGame.access === undefined) {
    return { ...withGame, access: null }
  }
  return withGame
}

export function blankRound(input: {
  id: string
  session: SessionState
  number: number
  mode: RoundState['mode']
  seed: string
  now: string
  orderId: string
  transportId: string
}): RoundState {
  const round: RoundState = {
    id: input.id,
    sessionId: input.session.id,
    number: input.number,
    mode: input.mode,
    stepId: 'S00',
    state: 'INTRO',
    stateVersion: 1,
    scenarioSeed: input.seed,
    simDay: scenario.simStart.day,
    simMinutes: scenario.simStart.minutes,
    paused: false,
    pauseStartedAt: null,
    presentationUntil: null,
    actionEnabledAt: input.now,
    pendingAdvance: false,
    introPhase: 'goals',
    question: null,
    lastSubmission: null,
    resources: [],
    received: [],
    subscriptions: [],
    outbox: [],
    deliveries: [],
    attempts: [],
    trainingEvents: [],
    projectionSeq: 0,
    logistics: { phase: 'idle', cargo: 'seller', night: false, traffic: false, phaseEnteredAt: input.now, dueAt: null },
    metrics: {
      startedAt: input.now,
      endedAt: null,
      activeDecisionMs: 0,
      presentationMs: 0,
      animationMs: 0,
      pauseMs: 0,
      wrongAttempts: 0,
      notificationsReceived: 0,
      fetchesOk: 0,
      helpActions: 0,
      disconnects: 0,
      coordinationSteps: input.mode === 'without_bdi' ? ['S03', 'S07', 'S09', 'S11', 'S13', 'S17', 'S19'] : [],
      etaV2ChosenAt: null,
      etaV2ConfirmedAt: null,
      promiseAvailableAtBuyer: null,
      decisionStartedAt: input.now,
    },
    orderId: input.orderId,
    transportId: input.transportId,
    leg1Id: 'leg-1',
    leg2Id: 'leg-2',
    deliveryCursor: 0,
    notes: {},
    helpCount: 0,
  }
  publishResource(round, resource(round, {
    id: `${round.id}-execution`,
    owner: 'seller',
    type: 'execution',
    version: 1,
    legId: null,
    payload: {
      transportId: round.transportId,
      orderId: round.orderId,
      locations: scenario.locations,
      tasks: {
        carrier: 'Ophalen bij verkoper en rit naar DC bezorger',
        delivery: 'Ontvangen, overslag en afleveren bij koper',
        shared: 'Transportcontext',
      },
    },
  }, input.now), input.now, 0)
  round.outbox = []
  return round
}

function assertLive(session: SessionState, now: string): void {
  if (session.status === 'closed' || now > session.expiresAt) throw new GameError('expired', 'Deze sessie is beëindigd.', 410)
}

export function dispatch(session: SessionState, command: Command, ctx: Ctx): { state: SessionState; output: Record<string, unknown> } {
  const state = structuredClone(session)
  if (command.type === 'tick') {
    if (state.status === 'closed') return { state, output: { closed: true } }
    return { state, output: tick(state, ctx) }
  }
  assertLive(state, ctx.now)
  if (state.status === 'paused' && !['resume', 'heartbeat', 'releaseRole', 'finishSession', 'restartRound'].includes(command.type)) {
    throw new GameError('paused', 'Het spel is gepauzeerd.', 409)
  }
  state.lastActivityAt = ctx.now
  switch (command.type) {
    case 'claimRole':
      return { state, output: claimRole(state, command, ctx) }
    case 'releaseRole':
      return { state, output: releaseRole(state, command, ctx) }
    case 'markReady':
      return { state, output: markReady(state, command) }
    case 'startRound':
      return { state, output: startRound(state, command, ctx) }
    case 'submitAction':
      return { state, output: submitAction(state, command, ctx) }
    case 'pause':
      return { state, output: pause(state, command, ctx) }
    case 'resume':
      return { state, output: resume(state, command, ctx) }
    case 'finishSession':
      return { state, output: finish(state, command) }
    case 'restartRound':
      return { state, output: restart(state, command, ctx) }
    case 'markHelp':
      return { state, output: markHelp(state, command, ctx) }
    case 'saveNote':
      return { state, output: saveNote(state, command) }
    case 'heartbeat':
      return { state, output: heartbeat(state, command, ctx) }
    case 'retryFetch':
      return { state, output: retryFetch(state, command, ctx) }
    case 'updateLanguage':
      return { state, output: updateLanguage(state, command) }
    case 'accessSubmitDossier':
    case 'accessReviewDossier':
    case 'accessAnswer':
    case 'accessSetPolicy':
    case 'accessSendRequest':
    case 'accessPredict':
    case 'accessLookup':
    case 'accessDecide':
      return { state, output: reduceAccess(state, command, ctx) }
    default:
      throw new GameError('unknown', 'Onbekende actie.', 400)
  }
}

function claimRole(state: SessionState, command: Extract<Command, { type: 'claimRole' }>, ctx: Ctx): Record<string, unknown> {
  if (state.roles.some((role) => role.playerUserId === command.userId)) throw new GameError('already_seated', 'Je hebt in deze sessie al een rol.', 409)
  const role = state.roles.find((item) => item.organizationId === command.organizationId)
  if (!role) throw new GameError('unknown_role', 'Onbekende rol.', 404)
  if (command.inviteToken && command.inviteToken !== role.inviteToken) throw new GameError('invite_invalid', 'Deze uitnodiging is niet meer geldig.', 409)
  if (role.playerUserId) {
    throw new GameError('role_taken', ctx.language === 'nl' ? 'Deze rol is al bezet' : 'This role is already taken', 409)
  }
  role.playerUserId = command.userId
  role.displayName = command.displayName?.slice(0, 24) || null
  role.connectionStatus = 'connected'
  role.lastSeenAt = ctx.now
  role.ready = false
  return { organizationId: role.organizationId, assignmentVersion: role.assignmentVersion }
}

function releaseRole(state: SessionState, command: Extract<Command, { type: 'releaseRole' }>, ctx: Ctx): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider kan een rol vrijgeven.', 403)
  const role = state.roles.find((item) => item.organizationId === command.organizationId)
  if (!role) throw new GameError('unknown_role', 'Onbekende rol.', 404)
  role.playerUserId = null
  role.displayName = null
  role.ready = false
  role.assignmentVersion += 1
  role.inviteToken = command.nextInvite
  role.connectionStatus = 'open'
  if (state.currentRoundId) {
    state.status = 'paused'
    const round = currentRound(state)
    round.paused = true
    round.pauseStartedAt = ctx.now
  } else if (state.access) {
    state.status = 'paused'
    releasePausesAccess(state, ctx)
  }
  return { assignmentVersion: role.assignmentVersion, inviteToken: role.inviteToken }
}

function markReady(state: SessionState, command: Extract<Command, { type: 'markReady' }>): Record<string, unknown> {
  const role = state.roles.find((item) => item.playerUserId === command.userId)
  if (!role) throw new GameError('forbidden', 'Geen rol in deze sessie.', 403)
  role.ready = true
  return { ready: true }
}

function startRound(state: SessionState, command: Extract<Command, { type: 'startRound' }>, ctx: Ctx): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider start de ronde.', 403)
  if (state.gameId === 'access') {
    return startAccessGame(state, command.roundId, ctx)
  }
  const active = state.rounds.find((round) => round.id === state.currentRoundId)
  if (active && active.stepId !== 'S20') throw new GameError('bad_step', 'De ronde loopt nog.', 409)
  if (active?.stepId === 'S20' && state.startMode === 'only_bdi') throw new GameError('bad_step', 'Er is geen tweede ronde.', 409)
  if (active?.stepId === 'S20' && active.number >= 2) throw new GameError('bad_step', 'Beide rondes zijn gespeeld.', 409)
  if (!active) {
    const ready = state.roles.filter((role) => role.playerUserId && role.ready)
    const needed = orgIds(getGame(state.gameId)).length
    if (new Set(ready.map((role) => role.organizationId)).size !== needed) {
      throw new GameError('not_ready', 'Alle rollen moeten gereed zijn.', 409)
    }
  }
  const mode = !active ? (state.startMode === 'only_bdi' ? 'with_bdi' : 'without_bdi') : 'with_bdi'
  const round = blankRound({
    id: command.roundId,
    session: state,
    number: active ? 2 : 1,
    mode,
    seed: command.seed,
    now: ctx.now,
    orderId: command.orderId,
    transportId: command.transportId,
  })
  state.rounds.push(round)
  state.currentRoundId = round.id
  state.status = 'running'
  state.comparison = false
  pushEvent(round, ctx.language, { type: 'intro', text: ctx.language === 'nl' ? 'De ronde start.' : 'The round starts.', at: ctx.now })
  return { roundId: round.id, mode }
}

function submitAction(state: SessionState, command: Extract<Command, { type: 'submitAction' }>, ctx: Ctx): Record<string, unknown> {
  const round = currentRound(state)
  if (round.id !== command.roundId) throw new GameError('conflict', 'Verkeerde ronde.', 409)
  if (round.stepId !== command.stepId) throw new GameError('bad_step', 'Deze stap is niet actief.', 409)
  if (round.stateVersion !== command.expectedStateVersion) throw new GameError('conflict', 'De stand is intussen veranderd.', 409)
  const previous = round.attempts.find((attempt) => attempt.actionId === command.actionId)
  if (previous) return { duplicate: true, outcome: previous.outcome, stateVersion: round.stateVersion }
  if (round.presentationUntil && ctx.now < round.presentationUntil) throw new GameError('presentation', 'De zaal bekijkt nog de vorige keuze.', 409)
  const actor = STEP_ACTOR[round.stepId]
  const org = roleOf(state, command.userId)
  if (actor === 'engine') throw new GameError('bad_step', 'Deze stap gaat vanzelf verder.', 409)
  if (actor === 'host' && command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider doet deze stap.', 403)
  if (actor !== 'host' && actor !== 'all' && actor !== org) throw new GameError('forbidden', 'Deze rol is niet aan zet.', 403)
  if (actor === 'all' && !org) throw new GameError('forbidden', 'Geen rol in deze sessie.', 403)

  if (round.stepId === 'S00') {
    if (command.value === 'skip' && round.mode === 'with_bdi') {
      enterStep(round, 'S01', ctx)
      return { outcome: 'accepted', stateVersion: round.stateVersion }
    }
    if (round.mode === 'without_bdi' || round.introPhase === 'bdi-flow') {
      enterStep(round, 'S01', ctx)
      return { outcome: 'accepted', stateVersion: round.stateVersion }
    }
    round.introPhase = round.introPhase === 'goals' ? 'bdi-agreements' : round.introPhase === 'bdi-agreements' ? 'bdi-roles' : 'bdi-flow'
    round.stateVersion += 1
    return { outcome: 'accepted', stateVersion: round.stateVersion }
  }

  if (round.stepId === 'S02') {
    if (!org) throw new GameError('forbidden', 'Geen rol.', 403)
    if (round.subscriptions.some((sub) => sub.subscriber === org)) return { outcome: 'accepted', stateVersion: round.stateVersion }
    for (const spec of subscriptionsFor(org)) {
      round.subscriptions.push({
        id: `${round.id}-sub-${org}-${spec.publisher}`,
        subscriber: org,
        publisher: spec.publisher,
        eventTypes: spec.eventTypes,
        status: 'active',
        cursor: 0,
      })
    }
    catchUp(round, org, ctx.now)
    round.attempts.push({ actionId: command.actionId, stepId: 'S02', userId: command.userId, value: 'subscribe', outcome: 'accepted', at: ctx.now })
    const done = orgIds(getGame(state.gameId)).every((item) => round.subscriptions.some((sub) => sub.subscriber === item))
    if (done) armPresentation(round, ctx, true)
    else round.stateVersion += 1
    pushEvent(round, ctx.language, { type: 'choice', text: ctx.language === 'nl' ? `${roleLabel(org, ctx.language)} abonneert op relevante orderinformatie` : `${roleLabel(org, ctx.language)} subscribes`, organizationId: org, at: ctx.now })
    return { outcome: 'accepted', stateVersion: round.stateVersion }
  }

  const options = round.question?.options ?? shuffledOptions(round, round.stepId, ctx.language)
  if (!options.some((option) => option.id === command.value)) throw new GameError('bad_option', 'Deze optie hoort niet bij de vraag.', 400)
  if (isConfirm(round.stepId) && expectedValue(round, round.stepId) !== command.value) {
    round.attempts.push({ actionId: command.actionId, stepId: round.stepId, userId: command.userId, value: command.value, outcome: 'mismatch', at: ctx.now })
    round.metrics.wrongAttempts += 1
    round.lastSubmission = { stepId: round.stepId, optionId: command.value, ok: false, text: mismatchText(ctx.language) }
    round.stateVersion += 1
    armPresentation(round, ctx, false)
    pushEvent(round, ctx.language, { type: 'feedback', text: ctx.language === 'nl' ? 'Komt niet overeen' : 'Does not match', choiceLabel: options.find((o) => o.id === command.value)?.label, result: mismatchText(ctx.language), at: ctx.now })
    return { outcome: 'mismatch', stateVersion: round.stateVersion }
  }
  if (isChoose(round.stepId)) acceptChoice(round, round.stepId, command.value, ctx)
  if (isConfirm(round.stepId)) acceptConfirm(round, round.stepId, command.value, ctx)
  round.attempts.push({ actionId: command.actionId, stepId: round.stepId, userId: command.userId, value: command.value, outcome: 'accepted', at: ctx.now })
  const label = options.find((option) => option.id === command.value)?.label ?? command.value
  round.lastSubmission = {
    stepId: round.stepId,
    optionId: command.value,
    ok: true,
    text: ctx.language === 'nl' ? 'Bevestigd' : 'Confirmed',
  }
  pushEvent(round, ctx.language, {
    type: 'choice',
    text: choiceText(round.stepId, label, ctx.language),
    choiceLabel: label,
    result: ctx.language === 'nl' ? 'Bevestigd' : 'Confirmed',
    organizationId: org,
    at: ctx.now,
  })
  armPresentation(round, ctx, true)
  round.stateVersion += 1
  return { outcome: 'accepted', stateVersion: round.stateVersion }
}

function choiceText(step: StepId, label: string, language: Language): string {
  if (language === 'en') return `${step} ${label}`
  if (step === 'S01') return `Koper bestelt een ${label.toLowerCase()}`
  if (step === 'S04' || step === 'S05') return `Chauffeur ${label} is gekozen`
  if (step === 'S16') return `Bezorger kiest ${label}`
  return `${promptFor(step, language)}: ${label}`
}

function advanceIfDue(round: RoundState, ctx: Ctx): void {
  if (!round.presentationUntil || ctx.now < round.presentationUntil) return
  const elapsed = ctx.presentationMs
  round.metrics.presentationMs += elapsed
  round.presentationUntil = null
  if (round.pendingAdvance && round.stepId !== 'S20') {
    round.pendingAdvance = false
    processOutbox(round, ctx.now, ctx.language, (type, text, route) => pushEvent(round, ctx.language, { type, text, at: ctx.now, route }))
    enterStep(round, nextStepId(round.stepId, round.mode), ctx)
    return
  }
  round.actionEnabledAt = ctx.now
  round.metrics.decisionStartedAt = ctx.now
}

function closeSession(state: SessionState): Record<string, unknown> {
  state.status = 'closed'
  state.expiresAt = new Date(0).toISOString()
  return { closed: true }
}

function tick(state: SessionState, ctx: Ctx): Record<string, unknown> {
  const nowMs = new Date(ctx.now).getTime()
  if (nowMs > new Date(state.expiresAt).getTime()) return closeSession(state)
  const activityAt = state.lastActivityAt ?? state.createdAt
  if (nowMs - new Date(activityAt).getTime() > ctx.idleMs) return closeSession(state)
  for (const role of state.roles) {
    if (!role.playerUserId || !role.lastSeenAt) continue
    const age = nowMs - new Date(role.lastSeenAt).getTime()
    if (age > 10000) role.connectionStatus = 'disconnected'
    if (age > ctx.graceMs && state.status === 'running') {
      state.status = 'paused'
      const round = state.rounds.find((item) => item.id === state.currentRoundId)
      if (round && !round.paused) {
        round.paused = true
        round.pauseStartedAt = ctx.now
        round.metrics.disconnects += 1
      }
      if (state.access && !state.access.paused) {
        pauseAccess(state, ctx)
        state.access.metrics.disconnects += 1
      }
    }
  }
  if (state.gameId === 'access') {
    return tickAccess(state, ctx)
  }
  const round = state.rounds.find((item) => item.id === state.currentRoundId)
  if (!round || round.paused || state.status === 'paused') return { paused: state.status === 'paused' }
  processOutbox(round, ctx.now, ctx.language, (type, text, route) => pushEvent(round, ctx.language, { type, text, at: ctx.now, route }))
  advanceIfDue(round, ctx)
  if (STEP_ACTOR[round.stepId] === 'engine' && round.logistics.dueAt && ctx.now >= round.logistics.dueAt) completeEngine(round, ctx)
  if (round.number === 2 && round.stepId === 'S20') state.comparison = true
  return { stepId: round.stepId }
}

function pause(state: SessionState, command: Extract<Command, { type: 'pause' }>, ctx: Ctx): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider pauzeert.', 403)
  state.status = 'paused'
  if (state.gameId === 'access' && state.access) {
    pauseAccess(state, ctx)
    return { paused: true }
  }
  const round = state.rounds.find((item) => item.id === state.currentRoundId)
  if (round && !round.paused) {
    round.paused = true
    round.pauseStartedAt = ctx.now
  }
  return { paused: true }
}

function resume(state: SessionState, command: Extract<Command, { type: 'resume' }>, ctx: Ctx): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider hervat.', 403)
  if (state.gameId === 'access' && state.access) {
    resumeAccess(state, ctx)
    state.status = 'running'
    return { paused: false }
  }
  const round = state.rounds.find((item) => item.id === state.currentRoundId)
  if (round?.pauseStartedAt) {
    const delta = new Date(ctx.now).getTime() - new Date(round.pauseStartedAt).getTime()
    round.metrics.pauseMs += Math.max(0, delta)
    if (round.presentationUntil) round.presentationUntil = plus(round.presentationUntil, delta)
    if (round.actionEnabledAt) round.actionEnabledAt = plus(round.actionEnabledAt, delta)
    if (round.logistics.dueAt) round.logistics.dueAt = plus(round.logistics.dueAt, delta)
    if (round.logistics.phaseEnteredAt) round.logistics.phaseEnteredAt = plus(round.logistics.phaseEnteredAt, delta)
    if (round.metrics.decisionStartedAt) round.metrics.decisionStartedAt = plus(round.metrics.decisionStartedAt, delta)
    for (const event of round.outbox) {
      event.notifyAt = plus(event.notifyAt, delta)
      event.fetchAt = plus(event.fetchAt, delta)
    }
    round.pauseStartedAt = null
    round.paused = false
  }
  state.status = round ? 'running' : 'lobby'
  return { paused: false }
}

function finish(state: SessionState, command: Extract<Command, { type: 'finishSession' }>): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider beëindigt de sessie.', 403)
  state.status = 'closed'
  state.expiresAt = new Date(0).toISOString()
  return { closed: true }
}

function restart(state: SessionState, command: Extract<Command, { type: 'restartRound' }>, ctx: Ctx): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider begint de ronde opnieuw.', 403)
  if (state.gameId === 'access') {
    return restartAccessGame(state, command.roundId, ctx)
  }
  const active = currentRound(state)
  state.rounds = state.rounds.filter((round) => round.id !== active.id)
  const round = blankRound({
    id: command.roundId,
    session: state,
    number: active.number,
    mode: active.mode,
    seed: command.seed,
    now: ctx.now,
    orderId: command.orderId,
    transportId: command.transportId,
  })
  state.rounds.push(round)
  state.currentRoundId = round.id
  state.comparison = false
  state.status = 'running'
  return { roundId: round.id }
}

function markHelp(state: SessionState, command: Extract<Command, { type: 'markHelp' }>, ctx: Ctx): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider markeert hulp.', 403)
  if (state.access) {
    state.access.helpCount += 1
    return { help: state.access.helpCount }
  }
  const round = currentRound(state)
  round.helpCount += 1
  round.metrics.helpActions += 1
  pushEvent(round, ctx.language, { type: 'help', text: ctx.language === 'nl' ? 'Spelleider markeert hulp' : 'Host marks help', at: ctx.now })
  return { help: round.helpCount }
}

function saveNote(state: SessionState, command: Extract<Command, { type: 'saveNote' }>): Record<string, unknown> {
  if (state.access) {
    const org = roleOf(state, command.userId)
    if (!org) throw new GameError('forbidden', 'Geen rol.', 403)
    state.access.notes[command.userId] = command.text.slice(0, 500)
    return { saved: true }
  }
  const round = currentRound(state)
  const org = roleOf(state, command.userId)
  if (!org) throw new GameError('forbidden', 'Geen rol.', 403)
  round.notes[command.userId] = command.text.slice(0, 500)
  return { saved: true }
}

function heartbeat(state: SessionState, command: Extract<Command, { type: 'heartbeat' }>, ctx: Ctx): Record<string, unknown> {
  const role = state.roles.find((item) => item.playerUserId === command.userId)
  if (role) {
    role.lastSeenAt = ctx.now
    role.connectionStatus = 'connected'
  }
  return { ok: true }
}

function retryFetch(state: SessionState, command: Extract<Command, { type: 'retryFetch' }>, ctx: Ctx): Record<string, unknown> {
  const round = currentRound(state)
  const org = roleOf(state, command.userId)
  if (!org) throw new GameError('forbidden', 'Geen rol.', 403)
  const found = findByRef(round, command.sourceRef)
  if (!found) throw new GameError('not_found', 'Bron niet gevonden.', 404)
  if (!canRead(round, org, found)) throw new GameError('forbidden', 'Geen leesrecht op deze bron.', 403)
  stageFetch(round, org, found, ctx.now)
  return { fetched: true }
}

function canRead(round: RoundState, org: OrgId, resource: SourceResource): boolean {
  return authorize({ actor: org, action: 'read', resource, sessionId: round.sessionId, roundId: round.id, participating: true })
}

function updateLanguage(state: SessionState, command: Extract<Command, { type: 'updateLanguage' }>): Record<string, unknown> {
  if (command.userId !== state.hostUserId) throw new GameError('forbidden', 'Alleen de spelleider kiest de taal.', 403)
  state.language = command.language
  return { language: state.language }
}

export type Command =
  | { type: 'claimRole'; userId: string; organizationId: OrgId; inviteToken: string | null; displayName?: string }
  | { type: 'releaseRole'; userId: string; organizationId: OrgId; nextInvite: string }
  | { type: 'markReady'; userId: string }
  | { type: 'startRound'; userId: string; roundId: string; seed: string; orderId: string; transportId: string }
  | { type: 'submitAction'; userId: string; roundId: string; stepId: StepId; expectedStateVersion: number; actionId: string; value: string }
  | { type: 'pause'; userId: string }
  | { type: 'resume'; userId: string }
  | { type: 'tick' }
  | { type: 'finishSession'; userId: string }
  | { type: 'restartRound'; userId: string; roundId: string; seed: string; orderId: string; transportId: string }
  | { type: 'markHelp'; userId: string }
  | { type: 'saveNote'; userId: string; text: string }
  | { type: 'heartbeat'; userId: string }
  | { type: 'retryFetch'; userId: string; sourceRef: string }
  | { type: 'updateLanguage'; userId: string; language: Language }
  | AccessCommand

function findByRef(round: RoundState, sourceRefValue: string): SourceResource | null {
  const [ownerRaw, type, id] = sourceRefValue.split('/')
  const owner = ownerRaw.replace('-data', '') as OrgId
  return round.resources.find((item) => item.id === id && item.owner === owner && item.type === type) ?? null
}

export function readSource(round: RoundState, actor: OrgId, sourceRefValue: string): Record<string, unknown> | null {
  const found = findByRef(round, sourceRefValue)
  if (!found || found.owner !== actor && round.mode !== 'with_bdi') return null
  if (!found || !canRead(round, actor, found)) return null
  return minimalPayload(found, actor)
}

export { etaLabel, roleLabel, orgName }
