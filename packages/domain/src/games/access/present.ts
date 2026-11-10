import type { Language } from '../../types.js'
import { evidenceText, gathered, outcomeReason, payloadFor, predictionCorrect } from './decide.js'
import type { AccessOrgId } from './orgs.js'
import {
  accessScenario,
  LAYERS,
  LOOKUP_LAYERS,
  requestCardsForStage,
  type Lookup,
} from './scenario.js'
import {
  activeRequest,
  currentPolicy,
  PREDICTORS,
  t,
  type AccessCard,
  type AccessRequest,
  type AccessScene,
  type AccessState,
  type CardLine,
  type LineState,
  type NetworkView,
  type QuestionScene,
  type RequestCardView,
} from './state.js'

const SCENE_ACTOR: Record<AccessScene, AccessOrgId | null> = {
  dossier: 'consumer',
  review: 'admin',
  involve: 'owner',
  record: 'registry',
  policy: 'owner',
  request: 'consumer',
  check: 'provider',
  change: 'owner',
  recordChange: 'registry',
  suspend: 'admin',
  debrief: null,
}

export function accessActor(access: AccessState): AccessOrgId | null {
  return SCENE_ACTOR[access.scene]
}

export function roleTitle(role: AccessOrgId, language: Language): string {
  const org = accessScenario.organizations[role]
  return `${org.roleLabel[language]} · ${org.name[language]}`
}

export function carrierName(orgId: string, language: Language): string {
  if (orgId === accessScenario.organizations.consumer.id) return accessScenario.organizations.consumer.name[language]
  if (orgId === accessScenario.noord.id) return accessScenario.noord.name[language]
  return orgId
}

export type ChosenOption = { optionId: string; ok: boolean; feedback: string }

function blankCard(role: AccessOrgId | null, title: string): AccessCard {
  return {
    kind: 'info',
    role,
    title,
    news: null,
    prompt: null,
    lines: [],
    options: [],
    feedback: null,
    feedbackOk: null,
    request: null,
  }
}

function optionStates(
  ids: string[],
  wrong: string[] | undefined,
  chosen: ChosenOption | undefined,
): Map<string, 'idle' | 'wrong' | 'right'> {
  const states = new Map<string, 'idle' | 'wrong' | 'right'>()
  for (const id of ids) states.set(id, wrong?.includes(id) ? 'wrong' : 'idle')
  if (chosen) states.set(chosen.optionId, chosen.ok ? 'right' : 'wrong')
  return states
}

export function dossierCard(access: AccessState, language: Language): AccessCard {
  const card = blankCard('consumer', roleTitle('consumer', language))
  const returned = access.dossiers.at(-1)?.decision === 'returned'
  card.news = returned
    ? access.feedback?.scene === 'review' ? access.feedback.text : t(language, 'Het vorige dossier kwam terug van de Association.', 'The previous dossier came back from the Association.')
    : t(language,
      'Delta wil gegevens van verladers ophalen en meldt zich aan bij de Logistiek Association.',
      'Delta wants to retrieve shipper data and applies to the Logistics Association.')
  card.prompt = t(language, 'Wat stuurt Delta mee in het toetredingsdossier?', 'What does Delta include in the onboarding dossier?')
  card.lines = accessScenario.dossierItems.map((item) => ({ label: item.label[language], value: '', status: null }))
  return card
}

export function reviewOptions(language: Language): { id: 'admit' | 'return'; label: string }[] {
  return [
    { id: 'admit', label: t(language, 'Toelaten: Delta registreren met status actief (BVAD)', 'Admit: register Delta with status active (BVAD)') },
    { id: 'return', label: t(language, 'Teruggeven aan Delta met uitleg', 'Return to Delta with an explanation') },
  ]
}

export function reviewCard(access: AccessState, language: Language, chosen?: ChosenOption): AccessCard {
  const dossier = access.dossiers.at(-1)
  const card = blankCard('admin', roleTitle('admin', language))
  card.kind = 'question'
  card.news = dossier
    ? t(language, `Delta dient dossier v${dossier.version} in.`, `Delta submits dossier v${dossier.version}.`)
    : null
  card.prompt = t(language, 'Laat je Delta toe als lid?', 'Do you admit Delta as a member?')
  if (dossier) {
    card.lines = accessScenario.dossierItems
      .filter((item) => item.required || dossier.items.includes(item.id))
      .map((item): CardLine => item.required
        ? {
          label: item.label[language],
          value: dossier.items.includes(item.id) ? t(language, 'aanwezig', 'included') : t(language, 'ontbreekt', 'missing'),
          status: dossier.items.includes(item.id) ? 'ok' : 'failed',
        }
        : { label: item.label[language], value: t(language, 'meegestuurd', 'included'), status: null })
  }
  const options = reviewOptions(language)
  const states = optionStates(options.map((o) => o.id), access.wrongOptions.review, chosen)
  card.options = options.map((option) => ({ ...option, state: states.get(option.id)! }))
  if (chosen) {
    card.feedback = chosen.feedback
    card.feedbackOk = chosen.ok
  }
  return card
}

export function questionCard(access: AccessState, scene: QuestionScene, language: Language, chosen?: ChosenOption): AccessCard {
  const question = accessScenario.questions[scene]
  const card = blankCard(question.actor, roleTitle(question.actor, language))
  card.kind = 'question'
  card.news = question.news?.[language] ?? null
  card.prompt = question.prompt[language]
  card.lines = question.details.map((detail) => ({ label: detail.label[language], value: detail.value[language], status: null }))
  const states = optionStates(question.options.map((o) => o.id), access.wrongOptions[scene], chosen)
  card.options = question.options.map((option) => ({ id: option.id, label: option.label[language], state: states.get(option.id)! }))
  if (chosen) {
    card.feedback = chosen.feedback
    card.feedbackOk = chosen.ok
  }
  return card
}

export function policyNews(access: AccessState, language: Language): string | null {
  if (access.stage === 1) {
    return t(language,
      'Delta staat als vervoerder van T-101 in het Orchestration Register: een feit, nog geen toestemming. Jij bepaalt welke gegevens bij de rol vervoerder horen. Dat leg je vast als beleid bij LogiData, die jouw zendinggegevens beheert en het bij elk verzoek toepast.',
      'Delta is in the Orchestration Register as carrier of T-101: a fact, not yet a permission. You decide which data comes with the carrier role. You record that as policy at LogiData, which manages your shipment data and applies it on every request.')
  }
  const stage1 = access.requests.filter((request) => request.stage === 1 && request.finalLayers)
  const loadingBlocked = stage1.some((request) =>
    accessScenario.requestCards[request.cardId].kind === 'loading' && request.finalLayers!.policy === 'failed')
  const financeOut = stage1.some((request) =>
    accessScenario.requestCards[request.cardId].kind === 'finance' && request.outcome === 'delivered')
  const parts: string[] = []
  if (loadingBlocked) {
    parts.push(t(language,
      'In ronde 1 kreeg Delta geen laadinformatie: jouw beleid stond dat niet toe. Delta kon niet plannen.',
      'In round 1 Delta got no loading info: your policy did not allow it. Delta could not plan.'))
  }
  if (financeOut) {
    parts.push(t(language,
      'In ronde 1 leverde LogiData je tarief en marge aan een vervoerder.',
      'In round 1 LogiData delivered your rate and margin to a carrier.'))
  }
  return parts.join(' ') || null
}

export function policyCard(access: AccessState, language: Language): AccessCard {
  const policy = currentPolicy(access)
  const card = blankCard('owner', roleTitle('owner', language))
  card.news = policyNews(access, language)
  card.prompt = access.stage === 1
    ? t(language, 'Welk beleid leg je vast bij LogiData: wat mogen vervoerders van jouw zendingen zien?', 'Which policy do you record at LogiData: what may carriers see of your shipments?')
    : t(language, 'Wil je je beleid bij LogiData aanpassen? Het geldt direct bij het volgende verzoek.', 'Do you want to change your policy at LogiData? It applies on the very next request.')
  card.lines = policyLines(policy.shareLoading, policy.shareFinance, policy.version, language)
  return card
}

export function policyLines(shareLoading: boolean, shareFinance: boolean, version: number, language: Language): CardLine[] {
  const yes = t(language, 'ja', 'yes')
  const no = t(language, 'nee', 'no')
  return [
    { label: t(language, `Beleid v${version} bij LogiData · laadinformatie voor vervoerders`, `Policy v${version} at LogiData · loading info for carriers`), value: shareLoading ? yes : no, status: shareLoading ? 'ok' : 'failed' },
    { label: t(language, `Beleid v${version} bij LogiData · financiële gegevens voor vervoerders`, `Policy v${version} at LogiData · financial data for carriers`), value: shareFinance ? yes : no, status: shareFinance ? 'ok' : 'failed' },
  ]
}

export function remainingCards(access: AccessState) {
  const used = new Set(access.requests.map((request) => request.cardId))
  return requestCardsForStage(access.stage).filter((id) => !used.has(id))
}

export function pickCard(access: AccessState, language: Language): AccessCard {
  const card = blankCard('consumer', roleTitle('consumer', language))
  card.news = access.stage === 1 ? accessScenario.missions.consumer[language] : null
  card.prompt = t(language, 'Delta kiest het volgende verzoek.', 'Delta picks the next request.')
  const done = access.requests.filter((request) => request.stage === access.stage && request.outcome)
  card.lines = [
    ...done.map((request): CardLine => ({
      label: accessScenario.requestCards[request.cardId].title[language],
      value: accessScenario.outcomes[request.outcome!][language],
      status: request.outcome === 'delivered' ? 'ok' : 'failed',
    })),
    ...remainingCards(access).map((id): CardLine => ({
      label: accessScenario.requestCards[id].title[language],
      value: accessScenario.requestCards[id].note[language],
      status: 'pending',
    })),
  ]
  return card
}

function shiftIso(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString()
}

export function requestView(access: AccessState, request: AccessRequest, language: Language): RequestCardView {
  const card = accessScenario.requestCards[request.cardId]
  const delta = accessScenario.organizations.consumer
  const issuedAt = card.freshToken ? request.sentAt : shiftIso(request.sentAt, -17 * 3600_000)
  const found = gathered(request)
  const decided = Boolean(request.decision)
  const path = language === 'en'
    ? `/shipments/${card.transportId}/${card.kind === 'finance' ? 'finance' : 'loading'}`
    : `/zendingen/${card.transportId}/${card.kind === 'finance' ? 'financieel' : 'laadinformatie'}`
  return {
    id: request.id,
    number: access.requests.indexOf(request) + 1,
    title: card.title[language],
    http: `GET ${path}`,
    token: {
      issuer: `EUID ${accessScenario.delta.euid}`,
      subject: delta.name[language],
      audience: accessScenario.delta.tokenAudience,
      issuedAt,
      expiresAt: shiftIso(issuedAt, 10 * 60_000),
      fresh: card.freshToken,
    },
    checks: LAYERS.map((layer) => {
      const status = found[layer]
      const finalStatus = request.finalLayers?.[layer]
      let evidence: string | null = null
      if (status) evidence = evidenceText(access, request.cardId, layer, status, language)
      else if (decided && finalStatus === 'failed') {
        evidence = t(language, 'Niet meer gecontroleerd; zou ook geweigerd zijn.', 'Not checked any more; would also have failed.')
      } else if (decided) {
        evidence = t(language, 'Niet meer nodig.', 'No longer needed.')
      }
      return {
        id: layer,
        label: accessScenario.layers[layer].label[language],
        source: accessScenario.layers[layer].source[language],
        status: status ?? (decided ? 'skipped' : 'pending'),
        evidence,
      }
    }),
    predictions: PREDICTORS.map((role) => {
      const predicted = request.predictions[role]
      const reveal = decided && predicted && request.finalLayers
      return {
        role,
        roleLabel: accessScenario.organizations[role].roleLabel[language],
        predicted: Boolean(predicted),
        outcomeLabel: reveal ? accessScenario.outcomes[predicted][language] : null,
        correct: reveal ? predictionCorrect(predicted, request.finalLayers!) : null,
      }
    }),
    predictionsOpen: !request.predictionsClosed && !decided,
    decision: request.outcome
      ? {
        delivered: request.outcome === 'delivered',
        reason: outcomeReason(request.cardId, request.outcome, language),
        payload: request.outcome === 'delivered' ? payloadFor(request.cardId, language) : null,
      }
      : null,
    wrong: decided ? null : request.wrongDecisions.at(-1)?.feedback ?? null,
  }
}

export function requestCard(access: AccessState, request: AccessRequest, language: Language): AccessCard {
  const view = requestView(access, request, language)
  const card = blankCard('provider', t(language, `Verzoek ${view.number} · ${view.title}`, `Request ${view.number} · ${view.title}`))
  card.kind = 'request'
  card.request = view
  card.prompt = view.decision
    ? null
    : view.predictionsOpen
      ? t(language, 'Voorspel op je telefoon: wat doet LogiData?', 'Predict on your phone: what will LogiData do?')
      : t(language, 'LogiData raadpleegt de bronnen en beslist zelf.', 'LogiData consults the sources and decides locally.')
  if (view.decision) {
    card.feedback = view.decision.reason
    card.feedbackOk = view.decision.delivered
  } else if (view.wrong) {
    card.feedback = view.wrong
    card.feedbackOk = false
  }
  return card
}

/** While Delta picks the next card, the beamer keeps showing the previous result of this round. */
export function liveFocus(access: AccessState): AccessRequest | null {
  if (access.scene !== 'request') return null
  return [...access.requests].reverse().find((request) => request.stage === access.stage && request.outcome) ?? null
}

/** The last answer given in the current scene, so its explanation stays on the beamer until the next try. */
function lastChoice(access: AccessState): ChosenOption | undefined {
  const feedback = access.feedback
  if (!feedback || feedback.scene !== access.scene) return undefined
  return { optionId: feedback.optionId, ok: feedback.ok, feedback: feedback.text }
}

export function liveCard(access: AccessState, language: Language): AccessCard {
  switch (access.scene) {
    case 'dossier':
      return dossierCard(access, language)
    case 'review':
      return reviewCard(access, language, lastChoice(access))
    case 'involve':
    case 'record':
    case 'change':
    case 'recordChange':
    case 'suspend':
      return questionCard(access, access.scene, language, lastChoice(access))
    case 'policy':
      return policyCard(access, language)
    case 'request': {
      const last = liveFocus(access)
      if (!last) return pickCard(access, language)
      const card = requestCard(access, last, language)
      const left = remainingCards(access).map((id) => accessScenario.requestCards[id].title[language]).join(' · ')
      card.news = t(language, `Delta kiest het volgende verzoek. Nog te spelen: ${left}.`, `Delta picks the next request. Still to play: ${left}.`)
      return card
    }
    case 'check': {
      const request = activeRequest(access)
      return request ? requestCard(access, request, language) : pickCard(access, language)
    }
    case 'debrief':
      return blankCard(null, t(language, 'Nabespreking', 'Debrief'))
  }
}

function lookupLine(request: AccessRequest, source: Lookup): LineState {
  const result = request.lookups.find((item) => item.source === source)
  if (!result) return 'idle'
  return LOOKUP_LAYERS[source].some((layer) => result.layers[layer] === 'failed') ? 'failed' : 'ok'
}

export function networkView(access: AccessState, language: Language, focus?: AccessRequest | null): NetworkView {
  const lines: NetworkView['lines'] = {
    onboard: 'idle',
    register: 'idle',
    request: 'idle',
    association: 'idle',
    orchestration: 'idle',
    policy: 'idle',
    data: 'idle',
  }
  switch (focus ? null : access.scene) {
    case 'dossier':
    case 'review':
    case 'suspend':
      lines.onboard = 'active'
      break
    case 'involve':
    case 'record':
    case 'change':
    case 'recordChange':
      lines.register = 'active'
      break
    case 'policy':
      lines.policy = 'active'
      break
    default:
      break
  }
  const request = focus ?? (access.scene === 'check' ? activeRequest(access) : null)
  let requestLabel: string | null = null
  let dataLabel: string | null = null
  if (request) {
    const delivered = request.outcome === 'delivered'
    lines.request = request.outcome ? (delivered ? 'ok' : 'failed') : 'active'
    lines.association = lookupLine(request, 'association')
    lines.orchestration = lookupLine(request, 'orchestration')
    lines.policy = lookupLine(request, 'policy')
    lines.data = request.outcome ? (delivered ? 'ok' : 'failed') : 'idle'
    const card = accessScenario.requestCards[request.cardId]
    requestLabel = `${card.transportId} · ${t(language, 'token', 'token')}`
    dataLabel = delivered ? card.title[language] : null
  }
  const pending = access.dossiers.some((dossier) => dossier.decision === 'pending')
  const status = access.deltaStatus === 'none' ? (pending ? 'pending' : 'none') : access.deltaStatus
  const policy = currentPolicy(access)
  return {
    delta: {
      status,
      statusLabel: {
        none: t(language, 'geen lid', 'not a member'),
        pending: t(language, 'aanvraag', 'applying'),
        active: t(language, 'actief lid', 'active member'),
        suspended: t(language, 'geschorst', 'suspended'),
      }[status],
      keyRegistered: access.keyRegistered,
    },
    orchestration: access.orchestration.map((entry) => ({
      transportId: entry.transportId,
      carrier: carrierName(entry.carrierOrgId, language),
      isDelta: entry.carrierOrgId === accessScenario.organizations.consumer.id,
      status: entry.status,
    })),
    policy: { version: policy.version, shareLoading: policy.shareLoading, shareFinance: policy.shareFinance },
    lines,
    requestLabel,
    dataLabel,
    highlight: request && !request.outcome ? 'provider' : accessActor(access),
  }
}
