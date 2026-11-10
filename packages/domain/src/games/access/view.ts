import { getGame } from '../../catalog.js'
import type { Language, SessionState } from '../../types.js'
import { orgNameOf, roleLabelOf } from '../../game-definition.js'
import { predictionCorrect } from './decide.js'
import {
  accessActor,
  carrierName,
  liveCard,
  liveFocus,
  networkView,
  policyNews,
  questionCard,
  remainingCards,
  requestView,
  reviewCard,
  reviewOptions,
} from './present.js'
import { accessScenario, LOOKUP_LAYERS, LOOKUPS, OUTCOMES, type Lookup, type Outcome, type RequestCardId } from './scenario.js'
import {
  activeRequest,
  currentPolicy,
  PREDICTORS,
  t,
  type AccessCard,
  type AccessScene,
  type AccessState,
  type CardLine,
  type NetworkView,
  type Predictor,
  type RequestCardView,
} from './state.js'
import type { AccessOrgId } from './orgs.js'

export type AccessTask =
  | { kind: 'dossier'; prompt: string; news: string | null; items: { id: string; label: string }[]; selected: string[] }
  | { kind: 'question'; prompt: string; news: string | null; lines: CardLine[]; options: { id: string; label: string; wrong: boolean }[] }
  | { kind: 'policy'; prompt: string; news: string | null; shareLoading: boolean; shareFinance: boolean }
  | { kind: 'pick'; prompt: string; news: string | null; cards: { id: RequestCardId; title: string; note: string }[] }
  | {
    kind: 'check'
    request: RequestCardView
    lookups: { id: Lookup; label: string; done: boolean; failed: boolean }[]
    waiting: string | null
    predictUntil: string
  }

export type SidePanel = {
  title: string
  rows: { label: string; value: string; tone: 'ok' | 'bad' | 'muted' | null }[]
  log: string[]
  note: string | null
}

export type AccessDebrief = {
  missions: { label: string; ok: boolean }[]
  counts: { label: string; value: number }[]
  scores: { role: Predictor; roleLabel: string; points: number; of: number }[]
  mistakes: { role: AccessOrgId; roleLabel: string; count: number }[]
  rules: { title: string; text: string; seen: boolean }[]
  questions: string[]
}

export type AccessPlayPayload = {
  id: string
  version: number
  scene: AccessScene
  stage: number
  canAct: boolean
  waitingFor: string | null
  actor: AccessOrgId | null
  message: string | null
  mission: string | null
  task: AccessTask | null
  feedback: { id: string; text: string; ok: boolean } | null
  predict: null | {
    requestId: string
    title: string
    options: { id: Outcome; label: string }[]
    chosen: Outcome | null
    open: boolean
  }
  lastResult: null | {
    id: string
    number: number
    title: string
    delivered: boolean
    reason: string
    prediction: string | null
    correct: boolean | null
  }
  side: SidePanel
  received: { cardId: string; title: string; payload: string; label: string; stale: boolean }[]
  score: { points: number; of: number } | null
  debrief: AccessDebrief | null
  holdUntil: string | null
}

export type AccessPlayerView = {
  sessionId: string
  sessionName: string
  gameId: 'access'
  code: string
  language: Language
  role: AccessOrgId
  organizationName: string
  roleLabel: string
  displayName: string | null
  connection: string
  expired: boolean
  paused: boolean
  ready: boolean
  cursor: number
  serverNow: string
  access: null | AccessPlayPayload
}

export type AccessPhaseBand = {
  id: 'once' | 'shipment' | 'request'
  who: string
  rhythm: string
  countLabel: string
  active: boolean
  current: string | null
}

export type AccessTrainingView = {
  sessionId: string
  sessionName: string
  gameId: 'access'
  gameTitle: string
  code: string
  language: Language
  status: SessionState['status']
  paused: boolean
  comparison: boolean
  canStart: boolean
  startMode: SessionState['startMode']
  roles: {
    organizationId: string
    name: string
    roleLabel: string
    blurb: string
    claimed: boolean
    displayName: string | null
    ready: boolean
    connection: string
    inviteToken: string | null
  }[]
  access: null | {
    id: string
    version: number
    scene: AccessScene
    stage: number
    message: string | null
    actor: AccessOrgId | null
    actorLabel: string | null
    phases: { bands: AccessPhaseBand[]; debrief: boolean; debriefLabel: string }
    card: AccessCard
    network: NetworkView
    scores: { role: Predictor; roleLabel: string; points: number; of: number }[]
    history: AccessState['history']
    debrief: AccessDebrief | null
    termCards: { term: string; text: string }[]
    holdUntil: string | null
    metrics: AccessState['metrics']
  }
  rounds: []
  round: null
  serverNow: string
  cursor: number
}

function inHold(access: AccessState, now: string): boolean {
  return Boolean(access.holdUntil && now < access.holdUntil)
}

function waitingLabel(access: AccessState, language: Language): string {
  const actor = accessActor(access)
  if (!actor) return t(language, 'Nabespreking op het grote scherm', 'Debrief on the big screen')
  return t(language,
    `Wacht op ${accessScenario.organizations[actor].roleLabel.nl} (${accessScenario.organizations[actor].name.nl})`,
    `Waiting for ${accessScenario.organizations[actor].roleLabel.en} (${accessScenario.organizations[actor].name.en})`)
}

function scores(access: AccessState, language: Language): AccessDebrief['scores'] {
  const resolved = access.requests.filter((request) => request.finalLayers)
  return PREDICTORS.map((role) => ({
    role,
    roleLabel: accessScenario.organizations[role].roleLabel[language],
    points: resolved.filter((request) => {
      const predicted = request.predictions[role]
      return predicted ? predictionCorrect(predicted, request.finalLayers!) : false
    }).length,
    of: resolved.length,
  }))
}

function phases(access: AccessState, language: Language): { bands: AccessPhaseBand[]; debrief: boolean; debriefLabel: string } {
  const scene = access.scene
  const admitted = access.dossiers.filter((dossier) => dossier.decision === 'admitted').length
  const checked = access.requests.filter((request) => request.outcome).length
  const active = activeRequest(access)
  const onceScenes: AccessScene[] = ['dossier', 'review', 'suspend']
  const shipmentScenes: AccessScene[] = ['involve', 'record', 'policy', 'change', 'recordChange']
  const requestScenes: AccessScene[] = ['request', 'check']
  const currentFor = (): string | null => {
    switch (scene) {
      case 'dossier': return t(language, 'Delta stelt een dossier samen', 'Delta assembles a dossier')
      case 'review': return t(language, 'Admin beoordeelt het dossier', 'Admin reviews the dossier')
      case 'suspend': return t(language, 'Melding over Delta', 'Report about Delta')
      case 'involve': return t(language, 'Atlas regelt T-101', 'Atlas arranges T-101')
      case 'record': return t(language, 'Register legt T-101 vast', 'Registry records T-101')
      case 'policy': return t(language, 'Atlas zet het beleid', 'Atlas sets the policy')
      case 'change': return t(language, 'Vervoerder vervangen', 'Carrier replaced')
      case 'recordChange': return t(language, 'Register legt wijziging vast', 'Registry records the change')
      case 'request': return t(language, 'Delta kiest een verzoek', 'Delta picks a request')
      case 'check': return active
        ? t(language, `Verzoek ${access.requests.indexOf(active) + 1}`, `Request ${access.requests.indexOf(active) + 1}`)
        : null
      default: return null
    }
  }
  const once = t(language, `${admitted}× toegetreden`, `${admitted}× joined`)
  return {
    bands: [
      {
        id: 'once',
        who: 'Association',
        rhythm: t(language, 'Eenmalig', 'Once'),
        countLabel: access.deltaStatus === 'suspended' ? `${once} · ${t(language, '1× geschorst', '1× suspended')}` : once,
        active: onceScenes.includes(scene),
        current: onceScenes.includes(scene) ? currentFor() : null,
      },
      {
        id: 'shipment',
        who: 'Data Owner',
        rhythm: t(language, 'Per zending', 'Per shipment'),
        countLabel: t(language, `${access.registrations}× vastgelegd`, `${access.registrations}× recorded`),
        active: shipmentScenes.includes(scene),
        current: shipmentScenes.includes(scene) ? currentFor() : null,
      },
      {
        id: 'request',
        who: 'Data Service Provider',
        rhythm: t(language, 'Bij elk verzoek', 'On every request'),
        countLabel: t(language, `${checked}× gecontroleerd`, `${checked}× checked`),
        active: requestScenes.includes(scene),
        current: requestScenes.includes(scene) ? currentFor() : null,
      },
    ],
    debrief: scene === 'debrief',
    debriefLabel: t(language, 'Nabespreking', 'Debrief'),
  }
}

function debrief(access: AccessState, language: Language): AccessDebrief | null {
  if (access.scene !== 'debrief') return null
  const delivered = (id: RequestCardId) => access.requests.some((request) => request.cardId === id && request.outcome === 'delivered')
  const financeOut = access.received.some((item) => accessScenario.requestCards[item.cardId].kind === 'finance')
  const outcomes = new Set(access.requests.map((request) => request.outcome).filter(Boolean))
  const mistakes = new Map<AccessOrgId, number>()
  for (const mistake of access.mistakes) mistakes.set(mistake.role, (mistakes.get(mistake.role) ?? 0) + 1)
  return {
    missions: [
      { label: t(language, 'Delta kon T-101 plannen', 'Delta could plan T-101'), ok: delivered('r-load-101') },
      { label: t(language, 'Delta kon T-103 plannen', 'Delta could plan T-103'), ok: delivered('r-load-103') },
      { label: t(language, 'Tarief en marge bleven bij Atlas', 'Rate and margin stayed with Atlas'), ok: !financeOut },
    ],
    counts: [
      { label: t(language, 'Toetreding', 'Onboarding'), value: access.dossiers.filter((dossier) => dossier.decision === 'admitted').length },
      { label: t(language, 'Registraties in het Orchestration Register', 'Records in the Orchestration Register'), value: access.registrations },
      { label: t(language, 'Verzoeken gecontroleerd', 'Requests checked'), value: access.requests.filter((request) => request.outcome).length },
      { label: t(language, 'Bronnen geraadpleegd door LogiData', 'Sources consulted by LogiData'), value: access.requests.reduce((sum, request) => sum + request.lookups.length, 0) },
    ],
    scores: scores(access, language),
    mistakes: [...mistakes.entries()].map(([role, count]) => ({
      role,
      roleLabel: accessScenario.organizations[role].roleLabel[language],
      count,
    })),
    rules: accessScenario.rules.map((rule) => ({
      title: rule.title[language],
      text: rule.text[language],
      seen: rule.id === 'relation-ends'
        ? access.requests.some((request) => request.cardId === 'r-again-101' && request.outcome)
        : rule.shownBy === null || outcomes.has(rule.shownBy),
    })),
    questions: accessScenario.debriefQuestions.map((question) => question[language]),
  }
}

function lookupLog(access: AccessState, source: Lookup, language: Language): string[] {
  const lines: string[] = []
  access.requests.forEach((request, index) => {
    const result = request.lookups.find((item) => item.source === source)
    if (!result) return
    const card = accessScenario.requestCards[request.cardId]
    const failed = LOOKUP_LAYERS[source].some((layer) => result.layers[layer] === 'failed')
    const answer = failed ? t(language, 'nee', 'no') : t(language, 'ja', 'yes')
    const question = {
      association: t(language, 'is dit echt Delta en is Delta lid?', 'is this really Delta and is Delta a member?'),
      orchestration: t(language, `hoort Delta bij ${card.transportId}?`, `does Delta belong to ${card.transportId}?`),
      policy: t(language, `mag een vervoerder ${card.kind === 'finance' ? 'financiële gegevens' : 'laadinformatie'} zien?`, `may a carrier see ${card.kind === 'finance' ? 'financial data' : 'loading info'}?`),
    }[source]
    lines.push(t(language, `Verzoek ${index + 1}: LogiData vroeg: ${question} → ${answer}`, `Request ${index + 1}: LogiData asked: ${question} → ${answer}`))
  })
  return lines.reverse().slice(0, 4)
}

function sidePanel(access: AccessState, role: AccessOrgId, language: Language): SidePanel {
  const policy = currentPolicy(access)
  const network = networkView(access, language)
  const yes = t(language, 'ja', 'yes')
  const no = t(language, 'nee', 'no')
  switch (role) {
    case 'admin':
      return {
        title: t(language, 'Jouw Association Register', 'Your Association Register'),
        rows: [
          ...(['owner', 'registry', 'provider'] as const).map((org) => ({
            label: accessScenario.organizations[org].name[language],
            value: t(language, 'actief lid', 'active member'),
            tone: 'ok' as const,
          })),
          {
            label: accessScenario.organizations.consumer.name[language],
            value: network.delta.statusLabel + (access.keyRegistered ? t(language, ' · sleutel geregistreerd', ' · key registered') : ''),
            tone: access.deltaStatus === 'active' ? 'ok' : access.deltaStatus === 'suspended' ? 'bad' : 'muted',
          },
        ],
        log: lookupLog(access, 'association', language),
        note: t(language, 'Je kent leden, sleutels en status. Zendingdata zie je nooit.', 'You know members, keys and status. You never see shipment data.'),
      }
    case 'registry':
      return {
        title: t(language, 'Jouw Orchestration Register', 'Your Orchestration Register'),
        rows: network.orchestration.map((entry) => ({
          label: `${entry.transportId} · ${t(language, 'vervoerder', 'carrier')}`,
          value: entry.status === 'ended' ? `${entry.carrier} (${t(language, 'vervallen', 'ended')})` : entry.carrier,
          tone: entry.status === 'ended' ? 'muted' : 'ok',
        })),
        log: lookupLog(access, 'orchestration', language),
        note: t(language, 'Je legt feiten vast, geen toestemming. Zendingdata zie je nooit.', 'You record facts, not permissions. You never see shipment data.'),
      }
    case 'owner':
      return {
        title: t(language, 'Jouw zendingen en beleid', 'Your shipments and policy'),
        rows: [
          ...(['T-101', 'T-102', 'T-103'] as const).map((id) => {
            const entry = access.orchestration.find((item) => item.transportId === id && item.status === 'active')
            return {
              label: `${id} · ${accessScenario.transports[id].route[language]}`,
              value: entry ? carrierName(entry.carrierOrgId, language) : t(language, 'nog niet vastgelegd', 'not recorded yet'),
              tone: entry ? 'ok' as const : 'muted' as const,
            }
          }),
          { label: t(language, `Beleid v${policy.version} bij LogiData · laadinformatie`, `Policy v${policy.version} at LogiData · loading info`), value: policy.shareLoading ? yes : no, tone: null },
          { label: t(language, `Beleid v${policy.version} bij LogiData · financiële gegevens`, `Policy v${policy.version} at LogiData · financial data`), value: policy.shareFinance ? yes : no, tone: null },
        ],
        log: lookupLog(access, 'policy', language),
        note: t(language, 'LogiData past je beleid toe bij elk verzoek. Je hoeft niet mee te kijken.', 'LogiData applies your policy on every request. You do not need to watch.'),
      }
    case 'provider': {
      const resolved = access.requests.filter((request) => request.outcome)
      return {
        title: t(language, 'LogiData · BDI Connector', 'LogiData · BDI Connector'),
        rows: [
          { label: t(language, 'Verzoeken beoordeeld', 'Requests judged'), value: String(resolved.length), tone: null },
          { label: t(language, 'Geleverd', 'Delivered'), value: String(resolved.filter((r) => r.outcome === 'delivered').length), tone: 'ok' },
          { label: t(language, 'Geweigerd', 'Refused'), value: String(resolved.filter((r) => r.outcome !== 'delivered').length), tone: 'bad' },
        ],
        log: resolved.slice(-4).reverse().map((request) => {
          const card = accessScenario.requestCards[request.cardId]
          return `${card.title[language]} → ${accessScenario.outcomes[request.outcome!][language]}`
        }),
        note: t(language, 'Jij beslist, lokaal en bij elk verzoek opnieuw.', 'You decide, locally and again on every request.'),
      }
    }
    case 'consumer':
      return {
        title: accessScenario.organizations.consumer.name[language],
        rows: [
          { label: t(language, 'Lidmaatschap', 'Membership'), value: network.delta.statusLabel, tone: access.deltaStatus === 'active' ? 'ok' : access.deltaStatus === 'suspended' ? 'bad' : 'muted' },
          { label: t(language, 'Sleutelmateriaal', 'Key material'), value: access.keyRegistered ? t(language, 'geregistreerd', 'registered') : t(language, 'nog niet geregistreerd', 'not registered yet'), tone: access.keyRegistered ? 'ok' : 'muted' },
        ],
        log: [],
        note: null,
      }
  }
}

function taskFor(access: AccessState, role: AccessOrgId, language: Language, now: string): AccessTask | null {
  if (accessActor(access) !== role) return null
  switch (access.scene) {
    case 'dossier': {
      const previous = access.dossiers.at(-1)
      const card = liveCard(access, language)
      return {
        kind: 'dossier',
        prompt: card.prompt ?? '',
        news: previous?.decision === 'returned' && access.feedback?.scene === 'review'
          ? access.feedback.text
          : null,
        items: accessScenario.dossierItems.map((item) => ({ id: item.id, label: item.label[language] })),
        selected: previous ? [...previous.items] : [],
      }
    }
    case 'review': {
      const card = reviewCard(access, language)
      const wrong = access.wrongOptions.review ?? []
      return {
        kind: 'question',
        prompt: card.prompt ?? '',
        news: card.news,
        lines: card.lines,
        options: reviewOptions(language).map((option) => ({ ...option, wrong: wrong.includes(option.id) })),
      }
    }
    case 'involve':
    case 'record':
    case 'change':
    case 'recordChange':
    case 'suspend': {
      const card = questionCard(access, access.scene, language)
      return {
        kind: 'question',
        prompt: card.prompt ?? '',
        news: card.news,
        lines: card.lines,
        options: card.options.map((option) => ({ id: option.id, label: option.label, wrong: option.state === 'wrong' })),
      }
    }
    case 'policy': {
      const policy = currentPolicy(access)
      return {
        kind: 'policy',
        prompt: liveCard(access, language).prompt ?? '',
        news: policyNews(access, language),
        shareLoading: policy.shareLoading,
        shareFinance: policy.shareFinance,
      }
    }
    case 'request':
      return {
        kind: 'pick',
        prompt: t(language, 'Welk verzoek stuurt je planningssysteem nu?', 'Which request does your planning system send now?'),
        news: access.stage === 1 ? accessScenario.missions.consumer[language] : null,
        cards: remainingCards(access).map((id) => ({
          id,
          title: accessScenario.requestCards[id].title[language],
          note: accessScenario.requestCards[id].note[language],
        })),
      }
    case 'check': {
      const request = activeRequest(access)
      if (!request) return null
      const count = PREDICTORS.filter((predictor) => request.predictions[predictor]).length
      const open = !request.predictionsClosed && count < PREDICTORS.length && now < request.predictUntil
      return {
        kind: 'check',
        request: requestView(access, request, language),
        lookups: LOOKUPS.map((source) => {
          const result = request.lookups.find((item) => item.source === source)
          return {
            id: source,
            label: accessScenario.lookups[source][language],
            done: Boolean(result),
            failed: Boolean(result && Object.values(result.layers).includes('failed')),
          }
        }),
        waiting: open
          ? t(language, `Voorspellingen: ${count} van ${PREDICTORS.length} binnen`, `Predictions: ${count} of ${PREDICTORS.length} in`)
          : null,
        predictUntil: request.predictUntil,
      }
    }
    default:
      return null
  }
}

function playPayload(access: AccessState, role: AccessOrgId, language: Language, now: string): AccessPlayPayload {
  const actor = accessActor(access)
  const canAct = !access.paused && !inHold(access, now) && actor === role
  const request = activeRequest(access)
  const isPredictor = (PREDICTORS as readonly string[]).includes(role)
  const lastResolved = [...access.requests].reverse().find((item) => item.outcome)
  const own = access.feedbackByRole?.[role]
  const ownFeedback = own ? { id: `${own.scene}-${own.at}`, text: own.text, ok: own.ok } : null
  const lastPrediction = lastResolved && isPredictor ? lastResolved.predictions[role as Predictor] ?? null : null
  const resolvedCount = access.requests.filter((item) => item.finalLayers).length
  const myScore = isPredictor
    ? scores(access, language).find((item) => item.role === role)!.points
    : 0
  const endedT101 = access.orchestration.some((entry) =>
    entry.transportId === 'T-101' && entry.carrierOrgId === accessScenario.organizations.consumer.id && entry.status === 'ended')
  return {
    id: access.id,
    version: access.version,
    scene: access.scene,
    stage: access.stage,
    canAct,
    waitingFor: canAct ? null : waitingLabel(access, language),
    actor,
    message: access.message,
    mission: role === 'consumer' && access.scene !== 'debrief' ? accessScenario.missions.consumer[language] : null,
    task: canAct ? taskFor(access, role, language, now) : null,
    feedback: ownFeedback,
    predict: isPredictor && access.scene === 'check' && request
      ? {
        requestId: request.id,
        title: accessScenario.requestCards[request.cardId].title[language],
        options: OUTCOMES.map((id) => ({ id, label: accessScenario.outcomes[id][language] })),
        chosen: request.predictions[role as Predictor] ?? null,
        open: !request.predictionsClosed,
      }
      : null,
    lastResult: lastResolved
      ? {
        id: lastResolved.id,
        number: access.requests.indexOf(lastResolved) + 1,
        title: accessScenario.requestCards[lastResolved.cardId].title[language],
        delivered: lastResolved.outcome === 'delivered',
        reason: requestView(access, lastResolved, language).decision?.reason ?? '',
        prediction: lastPrediction ? accessScenario.outcomes[lastPrediction][language] : null,
        correct: lastPrediction ? predictionCorrect(lastPrediction, lastResolved.finalLayers!) : null,
      }
      : null,
    side: sidePanel(access, role, language),
    received: role === 'consumer'
      ? access.received.map((item) => {
        const stale = item.transportId === 'T-101' && endedT101
        return {
          cardId: item.cardId,
          title: accessScenario.requestCards[item.cardId].title[language],
          payload: item.payload,
          label: stale
            ? t(language, 'Eerder ontvangen · geen nieuwe updates', 'Received earlier · no new updates')
            : t(language, 'Ontvangen van LogiData', 'Received from LogiData'),
          stale,
        }
      })
      : [],
    score: isPredictor ? { points: myScore, of: resolvedCount } : null,
    debrief: debrief(access, language),
    holdUntil: access.holdUntil,
  }
}

export function accessPlayerView(session: SessionState, userId: string, now: string): AccessPlayerView | null {
  const role = session.roles.find((item) => item.playerUserId === userId)
  if (!role) return null
  const org = role.organizationId as AccessOrgId
  const game = getGame(session.gameId)
  const access = session.access
  return {
    sessionId: session.id,
    sessionName: session.name,
    gameId: 'access',
    code: session.code,
    language: session.language,
    role: org,
    organizationName: orgNameOf(game, org, session.language),
    roleLabel: roleLabelOf(game, org, session.language),
    displayName: role.displayName,
    connection: role.connectionStatus,
    expired: session.status === 'closed',
    paused: session.status === 'paused' || Boolean(access?.paused),
    ready: role.ready,
    cursor: (access?.projectionSeq ?? 0) * 1000 + (access?.version ?? 0),
    serverNow: now,
    access: access ? playPayload(access, org, session.language, now) : null,
  }
}

export function accessTrainingView(session: SessionState, now: string): AccessTrainingView {
  const game = getGame(session.gameId)
  const ready = session.roles.every((role) => role.playerUserId && role.ready)
  const access = session.access
  const language = session.language
  const held = access && inHold(access, now) ? access.history.at(-1)?.frame ?? null : null
  const actor = access ? accessActor(access) : null
  return {
    sessionId: session.id,
    sessionName: session.name,
    gameId: 'access',
    gameTitle: game.titles[language],
    code: session.code,
    language,
    status: session.status,
    paused: session.status === 'paused' || Boolean(access?.paused),
    comparison: false,
    canStart: ready && session.status !== 'closed',
    startMode: session.startMode,
    roles: session.roles.map((role) => {
      const def = game.orgs.find((o) => o.id === role.organizationId)!
      return {
        organizationId: role.organizationId,
        name: def.name[language],
        roleLabel: def.roleLabel[language],
        blurb: def.blurb[language],
        claimed: Boolean(role.playerUserId),
        displayName: role.displayName,
        ready: role.ready,
        connection: role.connectionStatus,
        inviteToken: role.playerUserId ? null : role.inviteToken,
      }
    }),
    access: access ? {
      id: access.id,
      version: access.version,
      scene: access.scene,
      stage: access.stage,
      message: held?.message ?? access.message,
      actor,
      actorLabel: actor ? roleTitleShort(actor, language) : null,
      phases: phases(access, language),
      card: held?.card ?? liveCard(access, language),
      network: held?.network ?? networkView(access, language, liveFocus(access)),
      scores: scores(access, language),
      history: access.history,
      debrief: debrief(access, language),
      termCards: accessScenario.termCards.map((card) => ({ term: card.term, text: card[language] })),
      holdUntil: access.holdUntil,
      metrics: access.metrics,
    } : null,
    rounds: [],
    round: null,
    serverNow: now,
    cursor: (access?.projectionSeq ?? 0) * 1000 + (access?.version ?? 0),
  }
}

function roleTitleShort(role: AccessOrgId, language: Language): string {
  const org = accessScenario.organizations[role]
  return `${org.roleLabel[language]} (${org.name[language]})`
}
