import { readSource } from './dispatch.js'
import { buildFrame, commLine, highlightFor, knowledgePanels, ownDossier, simLabel } from './project.js'
import { orgName, roleLabel, scenario } from './games/logistics/scenario.js'
import { activeOrg, askRole, hintFor, isConfirm, narrative, promptFor, STEP_ACTOR, storyLine } from './games/logistics/steps.js'
import { getGame } from './catalog.js'
import { orgNameOf, roleLabelOf } from './game-definition.js'
import { ORGS, type Language, type OrgId, type RoundState, type SessionState, type StepId } from './types.js'
import { accessPlayerView, accessTrainingView, type AccessPlayerView, type AccessTrainingView } from './games/access/view.js'

export interface PlayerView {
  sessionId: string
  sessionName: string
  gameId: string
  code: string
  language: Language
  role: OrgId
  organizationName: string
  displayName: string | null
  connection: string
  expired: boolean
  paused: boolean
  ready: boolean
  cursor: number
  serverNow: string
  round: null | {
    id: string
    number: number
    mode: RoundState['mode']
    stepId: StepId
    stateVersion: number
    simLabel: string
    paused: boolean
    canAnswer: boolean
    waitingFor: string | null
    actorRole: OrgId | null
    task: null | {
      prompt: string
      hint: string | null
      options: { id: string; label: string }[]
      selectedOptionId: string | null
      feedback: string | null
      feedbackOk: boolean | null
      highlightOptionId: string | null
      highlightLabel: string | null
      fetching: boolean
    }
    dossier: { label: string; value: string; statusLabel: string }[]
    notifications: { id: string; text: string; status: string }[]
    notes: string
    delivered: boolean
  }
}

export interface TrainingView {
  sessionId: string
  sessionName: string
  gameId: string
  gameTitle: string
  code: string
  language: Language
  status: SessionState['status']
  paused: boolean
  comparison: boolean
  roles: {
    organizationId: OrgId
    name: string
    roleLabel: string
    blurb: string
    claimed: boolean
    displayName: string | null
    ready: boolean
    connection: string
    inviteToken: string | null
  }[]
  canStart: boolean
  startMode: SessionState['startMode']
  round: null | {
    id: string
    number: number
    mode: RoundState['mode']
    stepId: StepId
    state: string
    stateVersion: number
    simLabel: string
    label: string
    frame: ReturnType<typeof buildFrame>
    logistics: RoundState['logistics']
    events: { sequence: number; text: string; result: string | null }[]
    history: RoundState['trainingEvents']
    registries: {
      association: { organizationId: OrgId; name: string; status: string }[]
      orchestration: { organizationId: OrgId; roleLabel: string; issuedBy: string }[]
    } | null
    metrics: RoundState['metrics']
    helpCount: number
    introPhase: RoundState['introPhase']
    narrative: string
    caption: string
    actor: string
    activeOrg: OrgId | null
    askOrg: OrgId | null
    bdiChain: BdiChain | null
    flights: Flight[]
  }
  rounds: { number: number; mode: RoundState['mode']; metrics: RoundState['metrics'] }[]
  serverNow: string
  cursor: number
}

export interface BdiChain {
  publisher: OrgId
  subscribers: OrgId[]
  eventType: string
  done: number
  now: number | null
}

export interface Flight {
  id: string
  kind: 'notice' | 'fetch'
  from: OrgId
  to: OrgId
  label: string
  at: string
}

function canAnswer(round: RoundState, now: string, actorMatch: boolean): boolean {
  if (round.paused || !actorMatch) return false
  if (round.presentationUntil && now < round.presentationUntil) return false
  if (round.actionEnabledAt && now < round.actionEnabledAt) return false
  return STEP_ACTOR[round.stepId] !== 'engine' && round.stepId !== 'S20'
}

export function playerView(session: SessionState, userId: string, now: string): PlayerView | AccessPlayerView | null {
  if (session.gameId === 'access') return accessPlayerView(session, userId, now)
  const role = session.roles.find((item) => item.playerUserId === userId)
  if (!role) return null
  const round = session.rounds.find((item) => item.id === session.currentRoundId) ?? null
  const actor = round ? STEP_ACTOR[round.stepId] : null
  const mine = actor === role.organizationId || actor === 'all'
  const highlight = round ? highlightFor(round, role.organizationId, session.language) : null
  const fetching = Boolean(round && round.mode === 'with_bdi' && round.deliveries.some((d) => d.subscriber === role.organizationId && d.status === 'notified'))
  return {
    sessionId: session.id,
    sessionName: session.name,
    gameId: session.gameId || 'logistics',
    code: session.code,
    language: session.language,
    role: role.organizationId,
    organizationName: orgName(role.organizationId, session.language),
    displayName: role.displayName,
    connection: role.connectionStatus,
    expired: session.status === 'closed',
    paused: session.status === 'paused',
    ready: role.ready,
    cursor: (round?.projectionSeq ?? 0) * 1000 + (round?.stateVersion ?? 0),
    serverNow: now,
    round: round ? {
      id: round.id,
      number: round.number,
      mode: round.mode,
      stepId: round.stepId,
      stateVersion: round.stateVersion,
      simLabel: simLabel(round, session.language),
      paused: round.paused || session.status === 'paused',
      canAnswer: canAnswer(round, now, mine),
      waitingFor: mine ? null : waitingLabel(round, session.language),
      actorRole: activeOrg(round.stepId),
      task: mine && round.question ? {
        prompt: promptFor(round.stepId, session.language),
        hint: round.mode === 'with_bdi' && highlight ? null : hintFor(round.stepId, session.language),
        options: round.question.options,
        selectedOptionId: round.lastSubmission?.stepId === round.stepId ? round.lastSubmission.optionId : null,
        feedback: round.lastSubmission?.stepId === round.stepId ? round.lastSubmission.text : null,
        feedbackOk: round.lastSubmission?.stepId === round.stepId ? round.lastSubmission.ok : null,
        highlightOptionId: highlight?.optionId ?? null,
        highlightLabel: highlight?.label ?? null,
        fetching: fetching && !highlight,
      } : mine && round.stepId === 'S02' ? {
        prompt: session.language === 'nl' ? 'Abonneer op relevante orderinformatie' : 'Subscribe to relevant order information',
        hint: null,
        options: [{ id: 'subscribe', label: session.language === 'nl' ? 'Abonneren' : 'Subscribe' }],
        selectedOptionId: round.subscriptions.some((s) => s.subscriber === role.organizationId) ? 'subscribe' : null,
        feedback: null,
        feedbackOk: null,
        highlightOptionId: null,
        highlightLabel: null,
        fetching: false,
      } : null,
      dossier: ownDossier(round, role.organizationId, session.language),
      notifications: round.deliveries.filter((d) => d.subscriber === role.organizationId).map((d) => ({
        id: d.id,
        text: session.language === 'nl' ? `Melding van ${roleLabel(d.publisher, session.language)}` : `Notice from ${roleLabel(d.publisher, session.language)}`,
        status: d.status,
      })),
      notes: round.notes[userId] ?? '',
      delivered: round.stepId === 'S20',
    } : null,
  }
}

function waitingLabel(round: RoundState, language: Language): string {
  if (STEP_ACTOR[round.stepId] === 'engine') return narrative(round.stepId, language)
  if (STEP_ACTOR[round.stepId] === 'host') return language === 'nl' ? 'De spelleider licht de ronde toe' : 'The host introduces the round'
  if (STEP_ACTOR[round.stepId] === 'all') return language === 'nl' ? 'Iedereen abonneert' : 'Everyone subscribes'
  const org = activeOrg(round.stepId)
  return org ? (language === 'nl' ? `Wacht op ${roleLabel(org, language).toLowerCase()}` : `Waiting for ${roleLabel(org, language).toLowerCase()}`) : ''
}

export function trainingView(session: SessionState, now = new Date().toISOString()): TrainingView | AccessTrainingView {
  if (session.gameId === 'access') return accessTrainingView(session, now)
  const round = session.rounds.find((item) => item.id === session.currentRoundId) ?? null
  const ready = session.roles.every((role) => role.playerUserId && role.ready)
  const game = getGame(session.gameId)
  return {
    sessionId: session.id,
    sessionName: session.name,
    gameId: game.id,
    gameTitle: game.titles[session.language],
    code: session.code,
    language: session.language,
    status: session.status,
    paused: session.status === 'paused',
    comparison: session.comparison,
    canStart: ready && session.status !== 'closed',
    startMode: session.startMode,
    roles: session.roles.map((role) => {
      const def = game.orgs.find((o) => o.id === role.organizationId)
      return {
        organizationId: role.organizationId,
        name: def ? def.name[session.language] : orgName(role.organizationId, session.language),
        roleLabel: def ? def.roleLabel[session.language] : roleLabel(role.organizationId, session.language),
        blurb: def ? def.blurb[session.language] : scenario.roleBlurbs[role.organizationId as keyof typeof scenario.roleBlurbs][session.language],
        claimed: Boolean(role.playerUserId),
        displayName: role.displayName,
        ready: role.ready,
        connection: role.connectionStatus,
        inviteToken: role.playerUserId ? null : role.inviteToken,
      }
    }),
    round: round ? {
      id: round.id,
      number: round.number,
      mode: round.mode,
      stepId: round.stepId,
      state: round.state,
      stateVersion: round.stateVersion,
      simLabel: simLabel(round, session.language),
      label: round.mode === 'with_bdi'
        ? (session.language === 'nl' ? `Ronde ${round.number} — Met BDI` : `Round ${round.number} — With BDI`)
        : (session.language === 'nl' ? `Ronde ${round.number} — Zonder BDI` : `Round ${round.number} — Without BDI`),
      frame: buildFrame(round, session.language),
      logistics: round.logistics,
      events: round.trainingEvents.slice(-5).map((event) => ({ sequence: event.sequence, text: event.text, result: event.result })),
      history: round.trainingEvents,
      registries: round.mode === 'with_bdi' ? {
        association: ORGS.map((org) => ({
          organizationId: org,
          name: orgName(org, session.language),
          status: session.language === 'nl' ? 'Geregistreerd' : 'Registered',
        })),
        orchestration: ORGS.map((org) => ({
          organizationId: org,
          roleLabel: roleLabel(org, session.language),
          issuedBy: orgName('seller', session.language),
        })),
      } : null,
      metrics: round.metrics,
      helpCount: round.helpCount,
      introPhase: round.introPhase,
      narrative: narrative(round.stepId, session.language),
      caption: storyLine(round.stepId, round.mode, session.language),
      actor: STEP_ACTOR[round.stepId],
      activeOrg: activeOrg(round.stepId),
      askOrg: round.mode === 'without_bdi' ? askRole(round.stepId) : null,
      bdiChain: bdiChain(round),
      flights: flights(round, session.language),
    } : null,
    rounds: session.rounds.map((item) => ({ number: item.number, mode: item.mode, metrics: item.metrics })),
    serverNow: now,
    cursor: (round?.projectionSeq ?? 0) * 1000 + (round?.stateVersion ?? 0),
  }
}

function bdiChain(round: RoundState): BdiChain | null {
  if (round.mode !== 'with_bdi') return null
  const event = [...round.outbox].reverse()[0]
  if (!event) return null
  const deliveries = round.deliveries.filter((d) => d.sourceRef === event.sourceRef && d.resourceVersion === event.resourceVersion)
  const subscribers = deliveries.map((d) => d.subscriber)
  if (!event.notified) return { publisher: event.publisher, subscribers, eventType: event.eventType, done: 0, now: 0 }
  if (!event.fetched) return { publisher: event.publisher, subscribers, eventType: event.eventType, done: 1, now: 1 }
  const confirming = isConfirm(round.stepId)
  const confirmed = confirming && round.lastSubmission?.stepId === round.stepId && round.lastSubmission.ok
  if (confirmed) return { publisher: event.publisher, subscribers, eventType: event.eventType, done: 5, now: null }
  return { publisher: event.publisher, subscribers, eventType: event.eventType, done: 4, now: confirming ? 4 : null }
}

function flights(round: RoundState, language: Language): Flight[] {
  if (round.mode !== 'with_bdi') return []
  return round.trainingEvents
    .filter((event) => event.displayType === 'notification' || event.displayType === 'fetch')
    .slice(-4)
    .flatMap((event) => {
      if (!event.route) return []
      const kind = event.displayType === 'notification' ? 'notice' : 'fetch'
      return [{
        id: `${event.sequence}`,
        kind,
        from: event.route.from,
        to: event.route.to,
        label: kind === 'notice' ? (language === 'nl' ? 'Melding' : 'Notice') : (language === 'nl' ? 'Gegevens ophalen' : 'Fetch data'),
        at: event.at,
      } satisfies Flight]
    })
}

export function leaked(view: unknown): string[] {
  const raw = JSON.stringify(view)
  return ['scenarioSeed', 'answerKey', 'expectedValue', 'inviteToken'].filter((key) => raw.includes(key) && key !== 'inviteToken')
}

export function previewJoin(session: SessionState, organizationId?: OrgId): {
  name: string
  language: Language
  gameId: string
  gameTitle: string
  free: { organizationId: OrgId; roleLabel: string; name: string; blurb: string }[]
  roles: { organizationId: OrgId; roleLabel: string; name: string; blurb: string; free: boolean }[]
  role: OrgId | null
} {
  const game = getGame(session.gameId)
  const describe = (org: OrgId) => {
    const def = game.orgs.find((item) => item.id === org)
    return {
      organizationId: org,
      roleLabel: def ? def.roleLabel[session.language] : roleLabelOf(game, org, session.language),
      name: def ? def.name[session.language] : orgNameOf(game, org, session.language),
      blurb: def ? def.blurb[session.language] : '',
    }
  }
  return {
    name: session.name,
    language: session.language,
    gameId: session.gameId || 'logistics',
    gameTitle: game.titles[session.language],
    free: session.roles.filter((role) => !role.playerUserId).map((role) => describe(role.organizationId)),
    roles: session.roles.map((role) => ({ ...describe(role.organizationId), free: !role.playerUserId })),
    role: organizationId ?? null,
  }
}

export function authorizedRead(round: RoundState, actor: OrgId, ref: string): Record<string, unknown> | null {
  return readSource(round, actor, ref)
}

export { knowledgePanels, commLine }
export type { AccessPlayerView, AccessTrainingView }
