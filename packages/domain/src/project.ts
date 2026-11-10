import { authorize, minimalPayload, sourceRef, subscriptionsFor, t } from './games/logistics/policy.js'
import { driverName, etaLabel, labelOf, orgName, parseTime, roleLabel, scenario } from './games/logistics/scenario.js'
import {
  activeOrg, activityLabel, askRole, expectedValue, hintFor, isConfirm, mismatchText, narrative, promptFor, shuffledOptions, STEP_ACTOR,
} from './games/logistics/steps.js'
import { ORGS, type KnowledgePanel, type Language, type OrgId, type PanelItem, type RoundState, type SourceResource, type TrainingFrame } from './types.js'

function statusLabel(status: PanelItem['status'], language: Language): string {
  const nl = {
    source: 'Bij de afzender bekend',
    coordination: 'Afstemming nodig',
    confirmed: 'Bevestigd door ontvanger',
    received: 'Ontvangen',
    stale: 'Verouderd',
    waiting: 'Nog niet ontvangen',
  }
  const en = {
    source: 'Known at the source',
    coordination: 'Coordination needed',
    confirmed: 'Confirmed by receiver',
    received: 'Received',
    stale: 'Outdated',
    waiting: 'Not received yet',
  }
  return (language === 'nl' ? nl : en)[status]
}

function item(label: string, value: string, status: PanelItem['status'], language: Language): PanelItem {
  return { label, value, status, statusLabel: statusLabel(status, language) }
}

function factValue(resource: SourceResource, language: Language): string {
  const p = resource.payload
  if (resource.type === 'order' || resource.type === 'acceptance') return labelOf(scenario.products, String(p.productId), language)
  if (resource.type === 'driver') return String(p.name)
  if (resource.type === 'eta' || resource.type === 'promise') {
    return `${etaLabel(Number(p.day), String(p.time), language)} · v${resource.type === 'promise' ? p.version : resource.version}`
  }
  if (resource.type === 'receipt') return language === 'nl' ? 'Ontvangen' : 'Received'
  return language === 'nl' ? 'Klaar' : 'Ready'
}

const RESOURCE_LABELS: Record<string, Record<Language, string>> = {
  order: { nl: 'Bestelling', en: 'Order' },
  acceptance: { nl: 'Bevestigd product', en: 'Confirmed product' },
  driver: { nl: 'Chauffeur', en: 'Driver' },
  promise: { nl: 'Leverbelofte', en: 'Delivery promise' },
  receipt: { nl: 'Ontvangstbewijs', en: 'Receipt' },
  etaConfirmation: { nl: 'ETA-bevestiging', en: 'ETA confirmation' },
}

function resourceLabel(type: string, version: number, language: Language): string {
  if (type === 'eta') return `ETA v${version}`
  const base = RESOURCE_LABELS[type]?.[language] ?? type
  return type === 'promise' ? `${base} v${version}` : base
}

function panelItems(round: RoundState, org: OrgId, language: Language): PanelItem[] {
  const items: PanelItem[] = []
  const owned = round.resources.filter((r) => r.owner === org && !r.stale && r.type !== 'execution' && r.type !== 'etaConfirmation')
  for (const resource of owned) {
    items.push(item(resourceLabel(resource.type, resource.version, language), factValue(resource, language), 'source', language))
  }
  const received = round.received.filter((r) => r.subscriber === org && r.resourceType !== 'execution')
  for (const resource of received) {
    const label = resourceLabel(resource.resourceType, resource.version, language)
    items.push(item(label, factValue({ ...resource, owner: resource.owner, payload: resource.payload, type: resource.resourceType, version: resource.version, stale: resource.stale } as unknown as SourceResource, language), resource.stale ? 'stale' : 'received', language))
  }
  const waitingFacts: { label: string; from: OrgId; types: string[] }[] = []
  if (org === 'seller' && round.resources.some((r) => r.type === 'order') && !owned.some((r) => r.type === 'acceptance') && !received.some((r) => r.resourceType === 'order')) {
    waitingFacts.push({ label: language === 'nl' ? 'Product' : 'Product', from: 'buyer', types: ['order'] })
  }
  if (org === 'seller' && round.resources.some((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 2) && !received.some((r) => r.resourceType === 'eta' && r.version === 2)) {
    waitingFacts.push({ label: 'ETA v2', from: 'delivery', types: ['eta'] })
  }
  if (org === 'buyer' && round.resources.some((r) => r.type === 'promise' && r.version === 2) && !received.some((r) => r.resourceType === 'promise' && r.version === 2)) {
    waitingFacts.push({ label: 'ETA v2', from: 'seller', types: ['promise'] })
  }
  for (const fact of waitingFacts) {
    const status = round.mode === 'without_bdi' ? 'coordination' : 'waiting'
    items.push(item(fact.label, statusLabel(status, language), status, language))
  }
  if (items.length === 0) {
    items.push(item(language === 'nl' ? 'Dossier' : 'Dossier', language === 'nl' ? 'Nog leeg' : 'Empty', 'waiting', language))
  }
  return items
}

export function knowledgePanels(round: RoundState, language: Language): KnowledgePanel[] {
  return ORGS.map((org) => ({
    organizationId: org,
    name: orgName(org, language),
    roleLabel: roleLabel(org, language),
    activity: activityLabel(org, round, language),
    items: panelItems(round, org, language),
  }))
}

export function commLine(round: RoundState, language: Language): string {
  const etaV2 = round.resources.some((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 2)
  const sellerHasV2 = round.received.some((r) => r.subscriber === 'seller' && r.resourceType === 'eta' && r.version === 2 && !r.stale)
    || round.resources.some((r) => r.owner === 'seller' && r.type === 'promise' && r.version === 2)
  if (round.mode === 'without_bdi' && etaV2 && !sellerHasV2) {
    return language === 'nl'
      ? 'Afstemming nodig tussen bezorger en verkoper'
      : 'Coordination needed between delivery and seller'
  }
  const partner = askRole(round.stepId)
  const actor = activeOrg(round.stepId)
  if (round.mode === 'without_bdi' && partner && actor) {
    return language === 'nl'
      ? `Afstemming nodig tussen ${roleLabel(partner, language).toLowerCase()} en ${roleLabel(actor, language).toLowerCase()}`
      : `Coordination needed between ${roleLabel(partner, language).toLowerCase()} and ${roleLabel(actor, language).toLowerCase()}`
  }
  if (round.mode === 'with_bdi') {
    const latest = [...round.deliveries].reverse()[0]
    if (latest?.status === 'fetched') {
      return language === 'nl'
        ? 'Melding → toegang controleren → gegevens ophalen → beschikbaar → bevestigd'
        : 'Notice → check access → fetch data → available → confirmed'
    }
    if (latest?.status === 'notified') {
      return language === 'nl' ? 'Melding → toegang controleren → gegevens ophalen' : 'Notice → check access → fetch data'
    }
    return language === 'nl'
      ? 'De bron publiceert een wijziging. Gerechtigde partijen krijgen een melding.'
      : 'The source publishes a change. Entitled parties receive a notice.'
  }
  return language === 'nl' ? 'Mondelinge afstemming tussen de rollen.' : 'Spoken coordination between the roles.'
}

export function highlightFor(round: RoundState, actor: OrgId | null, language: Language): { optionId: string; label: string } | null {
  if (round.mode !== 'with_bdi' || !actor || !isConfirm(round.stepId)) return null
  const expected = expectedValue(round, round.stepId)
  if (!expected) return null
  const hit = round.received.find((r) => r.subscriber === actor && !r.stale && JSON.stringify(r.payload).includes(`"${expected}"`) || (r.subscriber === actor && !r.stale && (r.payload.productId === expected || r.payload.etaId === expected || r.payload.driverId === expected)))
  if (!hit) return null
  return {
    optionId: expected,
    label: language === 'nl' ? `Gegevens van ${orgName(hit.owner, language)} · versie ${hit.version}` : `Data from ${orgName(hit.owner, language)} · version ${hit.version}`,
  }
}

export function buildFrame(round: RoundState, language: Language): TrainingFrame {
  const actor = activeOrg(round.stepId)
  const highlight = highlightFor(round, actor, language)
  const showingFeedback = round.lastSubmission?.stepId === round.stepId
  return {
    prompt: STEP_ACTOR[round.stepId] === 'engine' ? narrative(round.stepId, language) : promptFor(round.stepId, language),
    options: round.question?.options ?? [],
    selectedOptionId: showingFeedback ? round.lastSubmission!.optionId : null,
    feedback: showingFeedback ? round.lastSubmission!.text : null,
    feedbackOk: showingFeedback ? round.lastSubmission!.ok : null,
    highlightOptionId: highlight?.optionId ?? null,
    highlightLabel: highlight?.label ?? null,
    panels: knowledgePanels(round, language),
    comm: commLine(round, language),
    logisticsPhase: round.logistics.phase,
  }
}

export function canReadResource(round: RoundState, actor: OrgId, resource: SourceResource): boolean {
  return authorize({
    actor,
    action: 'read',
    resource,
    sessionId: round.sessionId,
    roundId: round.id,
    participating: true,
  })
}

export function stageFetch(round: RoundState, subscriber: OrgId, resource: SourceResource, now: string): void {
  if (!canReadResource(round, subscriber, resource)) return
  const existing = round.received.find((r) => r.subscriber === subscriber && r.sourceRef === sourceRef(resource))
  if (existing && existing.version >= resource.version) return
  if (existing) existing.stale = true
  round.received.push({
    id: `recv-${round.received.length + 1}-${subscriber}`,
    subscriber,
    sourceRef: sourceRef(resource),
    resourceType: resource.type,
    owner: resource.owner,
    version: resource.version,
    payload: minimalPayload(resource, subscriber),
    receivedAt: now,
    stale: resource.stale,
  })
  if (resource.type === 'promise' && subscriber === 'buyer') round.metrics.promiseAvailableAtBuyer = now
}

export function publishResource(round: RoundState, resource: SourceResource, now: string, pipelineMs: number): void {
  round.resources.push(resource)
  if (round.mode !== 'with_bdi') return
  const when = new Date(new Date(now).getTime() + pipelineMs).toISOString()
  const later = new Date(new Date(now).getTime() + pipelineMs * 2).toISOString()
  round.outbox.push({
    id: `evt-${round.outbox.length + 1}`,
    publisher: resource.owner,
    eventType: resource.type,
    sourceRef: sourceRef(resource),
    resourceVersion: resource.version,
    status: 'pending',
    notifyAt: when,
    fetchAt: later,
    notified: false,
    fetched: false,
  })
}

export function catchUp(round: RoundState, subscriber: OrgId, now: string): void {
  for (const resource of round.resources) {
    if (resource.owner === subscriber || resource.stale) continue
    const sub = round.subscriptions.find((s) => s.subscriber === subscriber && s.publisher === resource.owner && s.eventTypes.includes(resource.type) && s.status === 'active')
    if (!sub) continue
    if (!canReadResource(round, subscriber, resource)) continue
    stageFetch(round, subscriber, resource, now)
    round.metrics.fetchesOk += 1
    round.metrics.notificationsReceived += 1
  }
}

export function processOutbox(
  round: RoundState,
  now: string,
  language: Language,
  push: (type: 'notification' | 'fetch', text: string, route: { from: OrgId; to: OrgId }) => void,
): void {
  if (round.mode !== 'with_bdi') return
  for (const event of round.outbox) {
    if (event.status === 'dispatched') continue
    const resource = round.resources.find((r) => sourceRef(r) === event.sourceRef && r.version === event.resourceVersion)
    if (!resource) continue
    if (!event.notified && now >= event.notifyAt) {
      for (const sub of round.subscriptions.filter((s) => s.status === 'active' && s.publisher === event.publisher && s.eventTypes.includes(event.eventType))) {
        if (!canReadResource(round, sub.subscriber, resource)) continue
        round.deliveryCursor += 1
        round.deliveries.push({
          id: `del-${round.deliveryCursor}`,
          subscriber: sub.subscriber,
          publisher: event.publisher,
          eventType: event.eventType,
          sourceRef: event.sourceRef,
          resourceVersion: event.resourceVersion,
          status: 'notified',
          cursor: round.deliveryCursor,
          error: null,
        })
        round.metrics.notificationsReceived += 1
        push('notification', language === 'nl'
          ? `Melding van ${roleLabel(event.publisher, language).toLowerCase()} naar ${roleLabel(sub.subscriber, language).toLowerCase()}`
          : `Notice from ${roleLabel(event.publisher, language).toLowerCase()} to ${roleLabel(sub.subscriber, language).toLowerCase()}`,
        { from: event.publisher, to: sub.subscriber })
      }
      event.notified = true
    }
    if (event.notified && !event.fetched && now >= event.fetchAt) {
      for (const delivery of round.deliveries.filter((d) => d.sourceRef === event.sourceRef && d.resourceVersion === event.resourceVersion && d.status === 'notified')) {
        if (!canReadResource(round, delivery.subscriber, resource)) {
          delivery.status = 'failed'
          delivery.error = 'denied'
          continue
        }
        stageFetch(round, delivery.subscriber, resource, now)
        delivery.status = 'fetched'
        round.metrics.fetchesOk += 1
        push('fetch', language === 'nl'
          ? `${roleLabel(delivery.subscriber, language)} haalt gegevens op bij ${roleLabel(delivery.publisher, language).toLowerCase()}`
          : `${roleLabel(delivery.subscriber, language)} fetches data from ${roleLabel(delivery.publisher, language).toLowerCase()}`,
        { from: delivery.subscriber, to: delivery.publisher })
      }
      event.fetched = true
      event.status = 'dispatched'
    }
  }
}

export function ownDossier(round: RoundState, org: OrgId, language: Language): { label: string; value: string; statusLabel: string }[] {
  return panelItems(round, org, language).filter((entry) => entry.status === 'source' || entry.status === 'received' || entry.status === 'confirmed' || entry.status === 'stale')
}

export function simLabel(round: RoundState, language: Language): string {
  const h = Math.floor(round.simMinutes / 60)
  const m = round.simMinutes % 60
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return language === 'nl' ? `Dag ${round.simDay} · ${time}` : `Day ${round.simDay} · ${time}`
}

export function driverLabel(id: string): string {
  return driverName(id)
}

export function productLabel(id: string, language: Language): string {
  return labelOf(scenario.products, id, language)
}

export function minutesOf(time: string): number {
  return parseTime(time)
}

export { hintFor, t }
