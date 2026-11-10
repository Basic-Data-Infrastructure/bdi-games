import type { Ctx } from '../../runtime.js'
import { GameError, type Language, type SessionState } from '../../types.js'
import { allLayers, evidenceText, judgeDecision, lookupResult, outcomeOf, outcomeReason, payloadFor } from './decide.js'
import {
  accessActor,
  dossierCard,
  networkView,
  policyCard,
  questionCard,
  remainingCards,
  requestCard,
  reviewCard,
  type ChosenOption,
} from './present.js'
import {
  accessScenario,
  LOOKUPS,
  OUTCOMES,
  type DossierItemId,
  type Layer,
  type Lookup,
  type Outcome,
  type RequestCardId,
} from './scenario.js'
import {
  activeRequest,
  blankAccess,
  currentPolicy,
  PREDICTORS,
  QUESTION_SCENES,
  t,
  type AccessCard,
  type AccessFeedback,
  type AccessRequest,
  type AccessScene,
  type AccessState,
  type LayerStatus,
  type NetworkView,
  type Predictor,
  type QuestionScene,
} from './state.js'
import { ORGS, type AccessOrgId } from './orgs.js'

export { accessActor } from './present.js'

/** Time the other players get to predict before the provider may start checking. */
export const PREDICT_MS = 15_000

type Versioned = { userId: string; expectedVersion: number; actionId: string }

export type AccessCommand =
  | ({ type: 'accessSubmitDossier'; items: DossierItemId[] } & Versioned)
  | ({ type: 'accessReviewDossier'; decision: 'admit' | 'return' } & Versioned)
  | ({ type: 'accessAnswer'; optionId: string } & Versioned)
  | ({ type: 'accessSetPolicy'; shareLoading: boolean; shareFinance: boolean } & Versioned)
  | ({ type: 'accessSendRequest'; cardId: RequestCardId } & Versioned)
  | ({ type: 'accessLookup'; source: Lookup } & Versioned)
  | ({ type: 'accessDecide'; decision: 'deliver' | 'refuse' } & Versioned)
  | { type: 'accessPredict'; userId: string; actionId: string; requestId: string; outcome: Outcome }

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function plus(now: string, ms: number): string {
  return iso(new Date(now).getTime() + ms)
}

function roleOf(session: SessionState, userId: string): AccessOrgId | null {
  const found = session.roles.find((role) => role.playerUserId === userId)?.organizationId
  if (!found) return null
  return (ORGS as readonly string[]).includes(found) ? found as AccessOrgId : null
}

function requireAccess(session: SessionState): AccessState {
  if (session.gameId !== 'access' || !session.access) {
    throw new GameError('bad_game', 'Deze actie hoort bij een ander spel.', 409)
  }
  return session.access
}

function assertActor(session: SessionState, userId: string, expected: AccessOrgId): void {
  if (roleOf(session, userId) !== expected) throw new GameError('forbidden', 'Deze rol is niet aan zet.', 403)
}

function assertScene(access: AccessState, ...scenes: AccessScene[]): void {
  if (!scenes.includes(access.scene)) throw new GameError('bad_step', 'Deze stap is niet actief.', 409)
}

function assertHold(access: AccessState, now: string): void {
  if (access.holdUntil && now < access.holdUntil) {
    throw new GameError('presentation', 'De zaal bekijkt nog de vorige keuze.', 409)
  }
}

function duplicate(access: AccessState, actionId: string): Record<string, unknown> | null {
  const previous = access.attempts.find((item) => item.actionId === actionId)
  if (!previous) return null
  return { duplicate: true, outcome: previous.outcome, version: access.version }
}

function recordAttempt(access: AccessState, actionId: string, outcome: string): void {
  access.attempts.push({ actionId, outcome })
}

function hold(access: AccessState, ctx: Ctx, factor = 1): void {
  access.holdUntil = plus(ctx.now, Math.round(ctx.presentationMs * factor))
}

function pushHistory(
  access: AccessState,
  language: Language,
  input: {
    actor: AccessOrgId | 'host'
    type: string
    text: string
    result?: string | null
    card: AccessCard
    focus?: AccessRequest | null
    network?: NetworkView
    at: string
  },
): void {
  access.projectionSeq += 1
  access.history.push({
    sequence: access.projectionSeq,
    at: input.at,
    scene: access.scene,
    actor: input.actor,
    type: input.type,
    text: input.text,
    result: input.result ?? null,
    frame: {
      scene: access.scene,
      actor: accessActor(access),
      message: access.message,
      card: input.card,
      network: input.network ?? networkView(access, language, input.focus),
    },
  })
}

/** Records the answer of a role; a wrong answer keeps the scene so the role can try again. */
function answer(
  access: AccessState,
  role: AccessOrgId,
  optionId: string,
  ok: boolean,
  text: string,
  ctx: Ctx,
): ChosenOption {
  giveFeedback(access, { role, scene: access.scene, optionId, ok, text, at: ctx.now })
  if (ok) {
    delete access.wrongOptions[access.scene]
  } else {
    const wrong = access.wrongOptions[access.scene] ?? []
    if (!wrong.includes(optionId)) wrong.push(optionId)
    access.wrongOptions[access.scene] = wrong
    access.mistakes.push({ role, scene: access.scene, optionId, at: ctx.now })
  }
  return { optionId, ok, feedback: text }
}

function sharedPolicyNetwork(access: AccessState, language: Language): NetworkView {
  const network = networkView(access, language)
  network.lines.policy = 'ok'
  network.highlight = 'provider'
  return network
}

function giveFeedback(access: AccessState, feedback: AccessFeedback): void {
  access.feedback = feedback
  access.feedbackByRole ??= {}
  access.feedbackByRole[feedback.role] = feedback
}

function setScene(access: AccessState, scene: AccessScene): void {
  access.scene = scene
}

export function startAccessGame(session: SessionState, accessId: string, ctx: Ctx): Record<string, unknown> {
  if (session.gameId !== 'access') throw new GameError('bad_game', 'Verkeerd spel.', 409)
  if (session.access && session.access.scene !== 'debrief') {
    throw new GameError('bad_step', 'Het spel loopt nog.', 409)
  }
  if (!session.access) {
    const ready = session.roles.filter((role) => role.playerUserId && role.ready)
    if (new Set(ready.map((role) => role.organizationId)).size !== ORGS.length) {
      throw new GameError('not_ready', 'Alle rollen moeten gereed zijn.', 409)
    }
  }
  session.access = blankAccess(accessId, ctx.now)
  session.currentRoundId = null
  session.rounds = []
  session.status = 'running'
  session.comparison = false
  announceStart(session.access, ctx, 'start')
  return { accessId }
}

export function restartAccessGame(session: SessionState, accessId: string, ctx: Ctx): Record<string, unknown> {
  if (session.gameId !== 'access') throw new GameError('bad_game', 'Verkeerd spel.', 409)
  session.access = blankAccess(accessId, ctx.now)
  session.status = 'running'
  session.comparison = false
  announceStart(session.access, ctx, 'restart')
  return { accessId }
}

function announceStart(access: AccessState, ctx: Ctx, type: 'start' | 'restart'): void {
  access.message = t(ctx.language,
    'Vervoerder Delta wil zendinggegevens van Atlas ophalen. Eerst de eenmalige toetreding tot de Logistiek Association.',
    'Carrier Delta wants to retrieve shipment data from Atlas. First the one-time onboarding to the Logistics Association.')
  pushHistory(access, ctx.language, {
    actor: 'host',
    type,
    text: type === 'start'
      ? t(ctx.language, 'Het spel start.', 'The game starts.')
      : t(ctx.language, 'Nieuwe spelrun gestart.', 'New game run started.'),
    card: dossierCard(access, ctx.language),
    at: ctx.now,
  })
}

export function tickAccess(session: SessionState, ctx: Ctx): Record<string, unknown> {
  const access = session.access
  if (!access) return { idle: true }
  if (access.paused || session.status === 'paused') return { paused: true }
  if (access.holdUntil && ctx.now >= access.holdUntil) {
    access.metrics.presentationMs += ctx.presentationMs
    access.holdUntil = null
    return { holdCleared: true }
  }
  return { scene: access.scene }
}

export function pauseAccess(session: SessionState, ctx: Ctx): void {
  const access = requireAccess(session)
  if (!access.paused) {
    access.paused = true
    access.pauseStartedAt = ctx.now
  }
}

export function resumeAccess(session: SessionState, ctx: Ctx): void {
  const access = requireAccess(session)
  if (access.pauseStartedAt) {
    const delta = new Date(ctx.now).getTime() - new Date(access.pauseStartedAt).getTime()
    access.metrics.pauseMs += Math.max(0, delta)
    if (access.holdUntil) access.holdUntil = plus(access.holdUntil, delta)
    const request = activeRequest(access)
    if (request && !request.predictionsClosed) request.predictUntil = plus(request.predictUntil, delta)
    access.pauseStartedAt = null
    access.paused = false
  }
}

export function releasePausesAccess(session: SessionState, ctx: Ctx): void {
  if (!session.access) return
  if (!session.access.paused) {
    session.access.paused = true
    session.access.pauseStartedAt = ctx.now
  }
}

export function reduceAccess(session: SessionState, command: AccessCommand, ctx: Ctx): Record<string, unknown> {
  const access = requireAccess(session)
  if (access.paused) throw new GameError('paused', 'Het spel is gepauzeerd.', 409)

  const dup = duplicate(access, command.actionId)
  if (dup) return dup

  // Predictions run in parallel with the provider and the presentation hold, so they skip both guards.
  if (command.type === 'accessPredict') return predict(session, command)

  assertHold(access, ctx.now)
  if (command.expectedVersion !== access.version) {
    throw new GameError('conflict', 'De stand is intussen veranderd.', 409)
  }

  switch (command.type) {
    case 'accessSubmitDossier':
      return submitDossier(session, command, ctx)
    case 'accessReviewDossier':
      return reviewDossier(session, command, ctx)
    case 'accessAnswer':
      return answerQuestion(session, command, ctx)
    case 'accessSetPolicy':
      return setPolicy(session, command, ctx)
    case 'accessSendRequest':
      return sendRequest(session, command, ctx)
    case 'accessLookup':
      return lookup(session, command, ctx)
    case 'accessDecide':
      return decide(session, command, ctx)
    default:
      throw new GameError('unknown', 'Onbekende actie.', 400)
  }
}

function submitDossier(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessSubmitDossier' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  assertActor(session, command.userId, 'consumer')
  assertScene(access, 'dossier')
  const known = new Set<string>(accessScenario.dossierItems.map((item) => item.id))
  const items = [...new Set(command.items)].filter((id) => known.has(id)) as DossierItemId[]
  if (items.length === 0) throw new GameError('empty', 'Kies minstens één onderdeel voor het dossier.', 409)
  const missing = accessScenario.dossierItems
    .filter((item) => item.required && !items.includes(item.id))
    .map((item) => item.id as DossierItemId)
  const version = access.dossiers.length + 1
  access.dossiers.push({
    version,
    items,
    missing,
    asksAccess: items.includes('access'),
    submittedAt: ctx.now,
    decision: 'pending',
    decidedAt: null,
  })
  access.feedback = null
  setScene(access, 'review')
  access.version += 1
  recordAttempt(access, command.actionId, 'submitted')
  access.message = t(ctx.language,
    `Delta dient dossier v${version} in. De Association Admin beoordeelt het.`,
    `Delta submits dossier v${version}. The Association Admin reviews it.`)
  pushHistory(access, ctx.language, {
    actor: 'consumer',
    type: 'dossier',
    text: access.message,
    card: reviewCard(access, ctx.language),
    at: ctx.now,
  })
  hold(access, ctx)
  return { version: access.version, dossierVersion: version }
}

function missingReason(missing: DossierItemId[], asksAccess: boolean, language: Language): string {
  const reasons: string[] = []
  const texts: Record<DossierItemId, { nl: string; en: string }> = {
    identity: { nl: 'Zonder identiteit weet niemand wie Delta is.', en: 'Without an identity nobody knows who Delta is.' },
    mandate: { nl: 'Zonder mandaat is niet zeker dat de ondertekenaar namens Delta mag tekenen.', en: 'Without a mandate it is not certain the signatory may sign for Delta.' },
    terms: { nl: 'Zonder ondertekend afsprakenstelsel gelden de afspraken niet voor Delta.', en: 'Without a signed trust framework the agreements do not bind Delta.' },
    access: { nl: '', en: '' },
  }
  for (const id of missing) reasons.push(texts[id][language])
  if (asksAccess) {
    reasons.push(t(language,
      'De Association verleent geen leesrecht op data van Atlas; dat bepaalt Atlas als Data Owner.',
      'The Association grants no read access to data of Atlas; Atlas decides that as Data Owner.'))
  }
  return reasons.join(' ')
}

function reviewDossier(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessReviewDossier' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  assertActor(session, command.userId, 'admin')
  assertScene(access, 'review')
  const dossier = access.dossiers.at(-1)
  if (!dossier || dossier.decision !== 'pending') throw new GameError('bad_step', 'Er is geen dossier ter beoordeling.', 409)
  const admissible = dossier.missing.length === 0 && !dossier.asksAccess
  const ok = (command.decision === 'admit') === admissible
  const reason = missingReason(dossier.missing, dossier.asksAccess, ctx.language)
  const text = ok
    ? admissible
      ? t(ctx.language,
        'Juist. Delta is lid; identiteit, sleutelmateriaal en status staan in het Association Register. Lid zijn geeft nog geen toegang tot data.',
        'Right. Delta is a member; identity, key material and status are in the Association Register. Membership does not yet give access to data.')
      : t(ctx.language, `Terecht teruggegeven. ${reason}`, `Rightly returned. ${reason}`)
    : admissible
      ? t(ctx.language, 'Dit dossier is compleet. Teruggeven vertraagt alleen.', 'This dossier is complete. Returning it only causes delay.')
      : t(ctx.language, `Niet toelaten. ${reason}`, `Do not admit. ${reason}`)
  const card = reviewCard(access, ctx.language, answer(access, 'admin', command.decision, ok, text, ctx))
  access.version += 1
  recordAttempt(access, command.actionId, ok ? command.decision : 'wrong')

  if (ok) {
    dossier.decision = admissible ? 'admitted' : 'returned'
    dossier.decidedAt = ctx.now
    if (admissible) {
      access.deltaStatus = 'active'
      access.keyRegistered = true
      setScene(access, 'involve')
      access.message = t(ctx.language,
        'Toetreding klaar, en dat gebeurt één keer. Nu legt Atlas vast wie bij zending T-101 hoort.',
        'Onboarding done, and that happens once. Now Atlas records who belongs to shipment T-101.')
    } else {
      setScene(access, 'dossier')
      access.message = t(ctx.language, 'Het dossier gaat terug naar Delta.', 'The dossier goes back to Delta.')
    }
  } else {
    access.message = t(ctx.language, 'Niet juist. De Admin kiest opnieuw.', 'Not right. The Admin chooses again.')
  }
  pushHistory(access, ctx.language, {
    actor: 'admin',
    type: ok ? `review_${command.decision}` : 'review_wrong',
    text,
    result: ok ? 'ok' : 'wrong',
    card,
    at: ctx.now,
  })
  hold(access, ctx)
  return { version: access.version, ok }
}

function answerQuestion(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessAnswer' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  if (!(QUESTION_SCENES as AccessScene[]).includes(access.scene)) {
    throw new GameError('bad_step', 'Deze stap is niet actief.', 409)
  }
  const scene = access.scene as QuestionScene
  const question = accessScenario.questions[scene]
  assertActor(session, command.userId, question.actor)
  const option = question.options.find((item) => item.id === command.optionId)
  if (!option) throw new GameError('unknown', 'Onbekende keuze.', 400)

  const card = questionCard(access, scene, ctx.language,
    answer(access, question.actor, option.id, option.correct, option.feedback[ctx.language], ctx))
  access.version += 1
  recordAttempt(access, command.actionId, option.correct ? 'ok' : 'wrong')

  if (!option.correct) {
    access.message = t(ctx.language, 'Niet juist. Probeer het opnieuw.', 'Not right. Try again.')
  } else {
    applyAnswer(access, scene, ctx)
  }
  pushHistory(access, ctx.language, {
    actor: question.actor,
    type: `answer_${scene}`,
    text: `${option.label[ctx.language]} — ${option.feedback[ctx.language]}`,
    result: option.correct ? 'ok' : 'wrong',
    card,
    at: ctx.now,
  })
  hold(access, ctx)
  return { version: access.version, ok: option.correct }
}

function applyAnswer(access: AccessState, scene: QuestionScene, ctx: Ctx): void {
  const delta = accessScenario.organizations.consumer.id
  switch (scene) {
    case 'involve':
      setScene(access, 'record')
      access.message = t(ctx.language,
        'Atlas meldt bij het Orchestration Register: T-101 · Delta · vervoerder.',
        'Atlas reports to the Orchestration Register: T-101 · Delta · carrier.')
      return
    case 'record':
      access.orchestration.push({ transportId: 'T-101', carrierOrgId: delta, role: 'carrier', status: 'active' })
      access.registrations += 1
      setScene(access, 'policy')
      access.message = t(ctx.language,
        'Vastgelegd: het register kan aantonen dat Delta bij T-101 hoort (BVOD). Nu bepaalt Atlas wat vervoerders mogen zien.',
        'Recorded: the registry can prove that Delta belongs to T-101 (BVOD). Now Atlas decides what carriers may see.')
      return
    case 'change':
      setScene(access, 'recordChange')
      access.message = t(ctx.language,
        'Atlas meldt de wijziging bij het Orchestration Register.',
        'Atlas reports the change to the Orchestration Register.')
      return
    case 'recordChange':
      for (const entry of access.orchestration) {
        if (entry.transportId === 'T-101' && entry.carrierOrgId === delta) entry.status = 'ended'
      }
      access.orchestration.push(
        { transportId: 'T-101', carrierOrgId: accessScenario.noord.id, role: 'carrier', status: 'active' },
        { transportId: 'T-103', carrierOrgId: delta, role: 'carrier', status: 'active' },
      )
      access.registrations += 2
      setScene(access, access.policyReview ? 'policy' : 'request')
      access.message = access.policyReview
        ? t(ctx.language,
          'Vastgelegd. Delta blijft lid en houdt dezelfde sleutel. Atlas kijkt nog even naar het beleid.',
          'Recorded. Delta stays a member and keeps the same key. Atlas takes another look at the policy.')
        : t(ctx.language,
          'Vastgelegd. Delta blijft lid en houdt dezelfde sleutel. Delta stuurt nieuwe verzoeken.',
          'Recorded. Delta stays a member and keeps the same key. Delta sends new requests.')
      return
    case 'suspend':
      access.deltaStatus = 'suspended'
      access.stage = 3
      setScene(access, 'request')
      access.message = t(ctx.language,
        'Delta staat op geschorst in het Association Register. Niemand heeft LogiData gebeld. Delta probeert nog één verzoek.',
        'Delta is suspended in the Association Register. Nobody called LogiData. Delta tries one more request.')
      return
  }
}

function setPolicy(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessSetPolicy' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  assertActor(session, command.userId, 'owner')
  assertScene(access, 'policy')
  const current = currentPolicy(access)
  const changed = current.shareLoading !== command.shareLoading || current.shareFinance !== command.shareFinance
  if (changed) {
    access.policies.push({
      version: current.version + 1,
      shareLoading: command.shareLoading,
      shareFinance: command.shareFinance,
      at: ctx.now,
    })
  }
  const policy = currentPolicy(access)
  const card = policyCard(access, ctx.language)
  card.kind = 'info'
  card.news = null
  card.prompt = changed
    ? t(ctx.language, `Atlas legt beleid v${policy.version} vast bij LogiData.`, `Atlas records policy v${policy.version} at LogiData.`)
    : t(ctx.language, `Atlas houdt beleid v${policy.version} bij LogiData.`, `Atlas keeps policy v${policy.version} at LogiData.`)
  card.feedback = t(ctx.language,
    'LogiData dwingt dit beleid af bij elk verzoek van een vervoerder. Atlas hoeft niet mee te kijken.',
    'LogiData enforces this policy on every request from a carrier. Atlas does not need to watch.')
  card.feedbackOk = true
  const yes = t(ctx.language, 'ja', 'yes')
  const no = t(ctx.language, 'nee', 'no')
  giveFeedback(access, {
    role: 'owner',
    scene: 'policy',
    optionId: 'policy',
    ok: true,
    text: t(ctx.language,
      `Beleid v${policy.version} staat bij LogiData: vervoerders zien laadinformatie ${policy.shareLoading ? yes : no}, financiële gegevens ${policy.shareFinance ? yes : no}. LogiData past dit bij elk verzoek toe.`,
      `Policy v${policy.version} is at LogiData: carriers see loading info ${policy.shareLoading ? yes : no}, financial data ${policy.shareFinance ? yes : no}. LogiData applies it on every request.`),
    at: ctx.now,
  })
  access.policyReview = false
  setScene(access, 'request')
  access.version += 1
  recordAttempt(access, command.actionId, changed ? 'policy_set' : 'policy_kept')
  access.message = t(ctx.language,
    'LogiData past dit beleid toe bij elk verzoek; Atlas hoeft niet mee te kijken. Nu stuurt Delta verzoeken.',
    'LogiData applies this policy on every request; Atlas does not need to watch. Now Delta sends requests.')
  pushHistory(access, ctx.language, {
    actor: 'owner',
    type: 'policy',
    text: card.prompt,
    result: policy.shareFinance ? 'overshare' : 'ok',
    card,
    network: sharedPolicyNetwork(access, ctx.language),
    at: ctx.now,
  })
  hold(access, ctx)
  return { version: access.version, policyVersion: policy.version }
}

function sendRequest(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessSendRequest' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  assertActor(session, command.userId, 'consumer')
  assertScene(access, 'request')
  if (!remainingCards(access).includes(command.cardId)) {
    throw new GameError('bad_card', 'Deze verzoekkaart is niet (meer) beschikbaar.', 409)
  }
  const request: AccessRequest = {
    id: `req-${access.requests.length + 1}`,
    cardId: command.cardId,
    stage: access.stage,
    sentAt: ctx.now,
    predictUntil: plus(ctx.now, ctx.presentationMs + PREDICT_MS),
    predictionsClosed: false,
    predictions: {},
    lookups: [],
    wrongDecisions: [],
    decision: null,
    outcome: null,
    finalLayers: null,
    decidedAt: null,
    policyVersion: null,
  }
  access.requests.push(request)
  access.feedback = null
  setScene(access, 'check')
  access.version += 1
  recordAttempt(access, command.actionId, 'sent')
  const title = accessScenario.requestCards[command.cardId].title[ctx.language]
  access.message = t(ctx.language,
    `Delta vraagt ${title}, met een token dat Delta zelf ondertekent. Voorspel op je telefoon wat LogiData doet.`,
    `Delta asks for ${title}, with a token Delta signs itself. Predict on your phone what LogiData will do.`)
  pushHistory(access, ctx.language, {
    actor: 'consumer',
    type: 'request',
    text: access.message,
    card: requestCard(access, request, ctx.language),
    focus: request,
    at: ctx.now,
  })
  hold(access, ctx)
  return { version: access.version, requestId: request.id }
}

function predictionsGate(access: AccessState, request: AccessRequest, now: string): void {
  if (request.predictionsClosed) return
  const all = PREDICTORS.every((role) => request.predictions[role])
  if (!all && now < request.predictUntil) {
    throw new GameError('predicting', 'De andere spelers voorspellen nog.', 409)
  }
  request.predictionsClosed = true
}

function predict(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessPredict' }>,
): Record<string, unknown> {
  const access = requireAccess(session)
  const role = roleOf(session, command.userId)
  if (!role || !(PREDICTORS as readonly string[]).includes(role)) {
    throw new GameError('forbidden', 'Deze rol voorspelt niet.', 403)
  }
  const request = activeRequest(access)
  if (access.scene !== 'check' || !request || request.id !== command.requestId) {
    throw new GameError('bad_step', 'Er is geen verzoek om te voorspellen.', 409)
  }
  if (request.predictionsClosed) throw new GameError('closed', 'De voorspellingen zijn gesloten.', 409)
  if (!OUTCOMES.includes(command.outcome)) throw new GameError('unknown', 'Onbekende voorspelling.', 400)
  if (request.predictions[role as Predictor]) throw new GameError('conflict', 'Je hebt al voorspeld.', 409)
  request.predictions[role as Predictor] = command.outcome
  recordAttempt(access, command.actionId, 'predicted')
  return { version: access.version, predicted: true }
}

function lookup(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessLookup' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  assertActor(session, command.userId, 'provider')
  assertScene(access, 'check')
  const request = activeRequest(access)
  if (!request) throw new GameError('bad_step', 'Er is geen verzoek.', 409)
  if (!LOOKUPS.includes(command.source)) throw new GameError('unknown', 'Onbekende bron.', 400)
  if (request.lookups.some((item) => item.source === command.source)) {
    throw new GameError('conflict', 'Deze bron is al geraadpleegd.', 409)
  }
  predictionsGate(access, request, ctx.now)
  const result = lookupResult(access, request.cardId, command.source, ctx.now)
  request.lookups.push(result)
  access.version += 1
  recordAttempt(access, command.actionId, `lookup_${command.source}`)
  const failed = Object.values(result.layers).includes('failed')
  const source = {
    association: accessScenario.layers.membership.source,
    orchestration: accessScenario.layers.involvement.source,
    policy: accessScenario.layers.policy.source,
  }[command.source][ctx.language]
  const evidence = (Object.entries(result.layers) as [Layer, LayerStatus][])
    .map(([layer, status]) => evidenceText(access, request.cardId, layer, status, ctx.language))
    .join(' ')
  access.message = `LogiData → ${source}: ${evidence}`
  pushHistory(access, ctx.language, {
    actor: 'provider',
    type: 'lookup',
    text: access.message,
    result: failed ? 'failed' : 'ok',
    card: requestCard(access, request, ctx.language),
    focus: request,
    at: ctx.now,
  })
  hold(access, ctx, 0.5)
  return { version: access.version, source: command.source, failed }
}

function decide(
  session: SessionState,
  command: Extract<AccessCommand, { type: 'accessDecide' }>,
  ctx: Ctx,
): Record<string, unknown> {
  const access = requireAccess(session)
  assertActor(session, command.userId, 'provider')
  assertScene(access, 'check')
  const request = activeRequest(access)
  if (!request) throw new GameError('bad_step', 'Er is geen verzoek.', 409)
  predictionsGate(access, request, ctx.now)
  const verdict = judgeDecision(access, request, command.decision, ctx.language)
  access.version += 1

  if (!verdict.ok) {
    request.wrongDecisions.push({ decision: command.decision, at: ctx.now, feedback: verdict.feedback })
    access.mistakes.push({ role: 'provider', scene: 'check', optionId: command.decision, at: ctx.now })
    giveFeedback(access, { role: 'provider', scene: 'check', optionId: command.decision, ok: false, text: verdict.feedback, at: ctx.now })
    recordAttempt(access, command.actionId, 'wrong')
    access.message = t(ctx.language, `LogiData twijfelt: ${verdict.feedback}`, `LogiData hesitates: ${verdict.feedback}`)
    pushHistory(access, ctx.language, {
      actor: 'provider',
      type: 'decision_wrong',
      text: verdict.feedback,
      result: 'wrong',
      card: requestCard(access, request, ctx.language),
      focus: request,
      at: ctx.now,
    })
    hold(access, ctx)
    return { version: access.version, ok: false }
  }

  request.finalLayers = allLayers(access, request.cardId)
  request.outcome = outcomeOf(request.finalLayers)
  request.decision = command.decision
  request.decidedAt = ctx.now
  request.policyVersion = currentPolicy(access).version
  if (request.outcome === 'delivered') {
    access.received.push({
      cardId: request.cardId,
      transportId: accessScenario.requestCards[request.cardId].transportId,
      payload: payloadFor(request.cardId, ctx.language),
      at: ctx.now,
      requestId: request.id,
    })
  }
  const reason = outcomeReason(request.cardId, request.outcome, ctx.language)
  // The phone shows the outcome as the request result, so an earlier hesitation can go.
  access.feedback = { role: 'provider', scene: 'check', optionId: command.decision, ok: true, text: reason, at: ctx.now }
  delete access.feedbackByRole.provider
  recordAttempt(access, command.actionId, request.outcome)
  const card = requestCard(access, request, ctx.language)
  access.message = `${reason} ${advanceAfterRequest(access, ctx)}`
  pushHistory(access, ctx.language, {
    actor: 'provider',
    type: 'decision',
    text: reason,
    result: request.outcome === 'delivered' ? 'delivered' : 'refused',
    card,
    focus: request,
    at: ctx.now,
  })
  hold(access, ctx)
  return { version: access.version, ok: true, outcome: request.outcome }
}

function advanceAfterRequest(access: AccessState, ctx: Ctx): string {
  if (remainingCards(access).length > 0) {
    setScene(access, 'request')
    return t(ctx.language, 'Delta kiest het volgende verzoek.', 'Delta picks the next request.')
  }
  if (access.stage === 1) {
    const stage1 = access.requests.filter((request) => request.stage === 1)
    access.policyReview = stage1.some((request) => {
      const kind = accessScenario.requestCards[request.cardId].kind
      return (kind === 'loading' && request.finalLayers?.policy === 'failed')
        || (kind === 'finance' && request.outcome === 'delivered')
    })
    access.stage = 2
    setScene(access, 'change')
    return t(ctx.language,
      `Ronde 1 klaar: ${stage1.length} verzoeken, elk opnieuw gecontroleerd. Dan verandert er iets bij Atlas.`,
      `Round 1 done: ${stage1.length} requests, each checked again. Then something changes at Atlas.`)
  }
  if (access.stage === 2) {
    setScene(access, 'suspend')
    return t(ctx.language, 'Dan krijgt de Association een melding over Delta.', 'Then the Association receives a report about Delta.')
  }
  setScene(access, 'debrief')
  access.metrics.endedAt = ctx.now
  return t(ctx.language, 'Einde van het spel. Tijd voor de nabespreking.', 'End of the game. Time for the debrief.')
}
