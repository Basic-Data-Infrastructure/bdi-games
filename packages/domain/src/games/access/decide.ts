import {
  accessScenario,
  LAYERS,
  LOOKUP_LAYERS,
  LOOKUPS,
  type Layer,
  type Lookup,
  type Outcome,
  type RequestCardId,
} from './scenario.js'
import { currentPolicy, t, type AccessRequest, type AccessState, type LayerStatus, type LookupResult } from './state.js'
import type { Language } from '../../types.js'

const DELTA = accessScenario.organizations.consumer.id

/** The truth for one layer, read from the state the players built. */
export function layerStatus(access: AccessState, cardId: RequestCardId, layer: Layer): LayerStatus {
  const card = accessScenario.requestCards[cardId]
  switch (layer) {
    case 'identity':
      return card.freshToken && access.keyRegistered ? 'ok' : 'failed'
    case 'membership':
      return access.deltaStatus === 'active' ? 'ok' : 'failed'
    case 'involvement':
      return access.orchestration.some((entry) =>
        entry.transportId === card.transportId && entry.carrierOrgId === DELTA && entry.status === 'active')
        ? 'ok'
        : 'failed'
    case 'policy': {
      const policy = currentPolicy(access)
      return (card.kind === 'finance' ? policy.shareFinance : policy.shareLoading) ? 'ok' : 'failed'
    }
  }
}

export function allLayers(access: AccessState, cardId: RequestCardId): Record<Layer, LayerStatus> {
  return {
    identity: layerStatus(access, cardId, 'identity'),
    membership: layerStatus(access, cardId, 'membership'),
    involvement: layerStatus(access, cardId, 'involvement'),
    policy: layerStatus(access, cardId, 'policy'),
  }
}

export function outcomeOf(layers: Record<Layer, LayerStatus>): Outcome {
  return LAYERS.find((layer) => layers[layer] === 'failed') ?? 'delivered'
}

export function lookupResult(access: AccessState, cardId: RequestCardId, source: Lookup, now: string): LookupResult {
  const layers: LookupResult['layers'] = {}
  for (const layer of LOOKUP_LAYERS[source]) layers[layer] = layerStatus(access, cardId, layer)
  return { source, at: now, layers }
}

export function gathered(request: AccessRequest): Partial<Record<Layer, LayerStatus>> {
  const result: Partial<Record<Layer, LayerStatus>> = {}
  for (const lookup of request.lookups) Object.assign(result, lookup.layers)
  return result
}

export function predictionCorrect(predicted: Outcome, layers: Record<Layer, LayerStatus>): boolean {
  if (predicted === 'delivered') return outcomeOf(layers) === 'delivered'
  return layers[predicted] === 'failed'
}

export type DecisionCheck = { ok: boolean; feedback: string }

/** The provider may only deliver after every source answered and may only refuse on a failed answer. */
export function judgeDecision(
  access: AccessState,
  request: AccessRequest,
  decision: 'deliver' | 'refuse',
  language: Language,
): DecisionCheck {
  const found = gathered(request)
  const failed = LAYERS.find((layer) => found[layer] === 'failed')
  const allDone = LOOKUPS.every((source) => request.lookups.some((item) => item.source === source))
  if (decision === 'deliver') {
    if (failed) {
      const label = accessScenario.layers[failed].label
      return {
        ok: false,
        feedback: t(language,
          `Niet leveren: ${label.nl} is niet in orde. Leveren zou een datalek zijn.`,
          `Do not deliver: ${label.en} is not in order. Delivering would be a data leak.`),
      }
    }
    if (!allDone) {
      return {
        ok: false,
        feedback: t(language,
          'Zero trust: raadpleeg eerst alle bronnen voordat je levert.',
          'Zero trust: consult every source before you deliver.'),
      }
    }
    return { ok: true, feedback: '' }
  }
  if (failed) return { ok: true, feedback: '' }
  if (allDone) {
    return {
      ok: false,
      feedback: t(language,
        'Alles is in orde. Delta heeft recht op deze gegevens; weigeren houdt de keten op.',
        'Everything is in order. Delta is entitled to this data; refusing holds up the chain.'),
    }
  }
  return {
    ok: false,
    feedback: t(language,
      'Je hebt nog geen reden om te weigeren. Raadpleeg de volgende bron.',
      'You have no reason to refuse yet. Consult the next source.'),
  }
}

export function evidenceText(
  access: AccessState,
  cardId: RequestCardId,
  layer: Layer,
  status: LayerStatus,
  language: Language,
): string {
  const card = accessScenario.requestCards[cardId]
  const policy = currentPolicy(access)
  const kindNl = card.kind === 'finance' ? 'financiële gegevens' : 'laadinformatie'
  const kindEn = card.kind === 'finance' ? 'financial data' : 'loading info'
  switch (layer) {
    case 'identity':
      return status === 'ok'
        ? t(language, 'Handtekening klopt met de sleutel van Delta uit het Association Register; token is geldig.', "Signature matches Delta's key from the Association Register; token is valid.")
        : t(language, 'Token is verlopen: het is van gisteren.', 'Token has expired: it is from yesterday.')
    case 'membership':
      return status === 'ok'
        ? t(language, 'BVAD: Delta is actief lid.', 'BVAD: Delta is an active member.')
        : t(language, 'BVAD: Delta is geschorst.', 'BVAD: Delta is suspended.')
    case 'involvement': {
      if (status === 'ok') {
        return t(language, `BVOD: Delta is vervoerder van ${card.transportId}.`, `BVOD: Delta is carrier of ${card.transportId}.`)
      }
      const ended = access.orchestration.some((entry) =>
        entry.transportId === card.transportId && entry.carrierOrgId === DELTA && entry.status === 'ended')
      if (ended) {
        return t(language,
          `Geen BVOD: Delta is niet meer betrokken bij ${card.transportId}.`,
          `No BVOD: Delta is no longer involved in ${card.transportId}.`)
      }
      const carrier = access.orchestration.find((entry) => entry.transportId === card.transportId && entry.status === 'active')
      return carrier?.carrierOrgId === accessScenario.noord.id
        ? t(language,
          `Geen BVOD: vervoerder van ${card.transportId} is Noord.`,
          `No BVOD: the carrier of ${card.transportId} is Noord.`)
        : t(language,
          `Geen BVOD: niets vastgelegd voor Delta bij ${card.transportId}.`,
          `No BVOD: nothing recorded for Delta on ${card.transportId}.`)
    }
    case 'policy':
      return status === 'ok'
        ? t(language,
          `Beleid v${policy.version}: vervoerders mogen ${kindNl} zien.`,
          `Policy v${policy.version}: carriers may see ${kindEn}.`)
        : t(language,
          `Beleid v${policy.version}: Atlas deelt ${kindNl} niet met vervoerders.`,
          `Policy v${policy.version}: Atlas does not share ${kindEn} with carriers.`)
  }
}

export function outcomeReason(cardId: RequestCardId, outcome: Outcome, language: Language): string {
  const card = accessScenario.requestCards[cardId]
  switch (outcome) {
    case 'delivered':
      return t(language,
        'Alle lagen in orde. LogiData levert rechtstreeks aan Delta.',
        'All layers in order. LogiData delivers straight to Delta.')
    case 'identity':
      return t(language,
        'Geweigerd: het token is verlopen. Delta blijft lid; alleen dit verzoek telt niet.',
        'Refused: the token has expired. Delta stays a member; only this request does not count.')
    case 'membership':
      return t(language,
        'Geweigerd: Delta is geschorst. Dat geldt meteen voor alle zendingen en alle data owners.',
        'Refused: Delta is suspended. That applies at once to all shipments and all data owners.')
    case 'involvement':
      return card.transportId === 'T-101'
        ? t(language,
          'Geweigerd: Delta is niet meer betrokken bij T-101. Eerder ontvangen gegevens blijven, er komt niets nieuws bij.',
          'Refused: Delta is no longer involved in T-101. Earlier data stays, nothing new is added.')
        : t(language,
          `Geweigerd: Delta is lid, maar niet betrokken bij ${card.transportId}. Lid zijn is geen leesrecht.`,
          `Refused: Delta is a member, but not involved in ${card.transportId}. Membership is not a read right.`)
    case 'policy':
      return t(language,
        'Geweigerd: Delta is betrokken, maar Atlas deelt dit niet met vervoerders.',
        'Refused: Delta is involved, but Atlas does not share this with carriers.')
  }
}

export function payloadFor(cardId: RequestCardId, language: Language): string {
  const card = accessScenario.requestCards[cardId]
  const transport = accessScenario.transports[card.transportId]
  return card.kind === 'finance' ? transport.financeInfo[language] : transport.loadInfo[language]
}
