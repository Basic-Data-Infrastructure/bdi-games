import { ORGS } from './orgs.js'
import type { Language, OrgId, PolicyAction, ResourceType, RoundState, SourceResource } from '../../types.js'

export interface PolicyRule {
  owner: OrgId
  recipient: OrgId | 'owner'
  resourceType: ResourceType
  action: PolicyAction
  legId?: string
}

export const POLICY_RULES: PolicyRule[] = [
  { owner: 'buyer', recipient: 'owner', resourceType: 'order', action: 'publish' },
  { owner: 'buyer', recipient: 'seller', resourceType: 'order', action: 'subscribe' },
  { owner: 'buyer', recipient: 'seller', resourceType: 'order', action: 'notify' },
  { owner: 'buyer', recipient: 'seller', resourceType: 'order', action: 'read' },
  { owner: 'seller', recipient: 'owner', resourceType: 'acceptance', action: 'publish' },
  { owner: 'seller', recipient: 'buyer', resourceType: 'acceptance', action: 'subscribe' },
  { owner: 'seller', recipient: 'buyer', resourceType: 'acceptance', action: 'notify' },
  { owner: 'seller', recipient: 'buyer', resourceType: 'acceptance', action: 'read' },
  { owner: 'seller', recipient: 'owner', resourceType: 'execution', action: 'publish' },
  { owner: 'seller', recipient: 'carrier', resourceType: 'execution', action: 'subscribe' },
  { owner: 'seller', recipient: 'carrier', resourceType: 'execution', action: 'notify' },
  { owner: 'seller', recipient: 'carrier', resourceType: 'execution', action: 'read' },
  { owner: 'seller', recipient: 'delivery', resourceType: 'execution', action: 'subscribe' },
  { owner: 'seller', recipient: 'delivery', resourceType: 'execution', action: 'notify' },
  { owner: 'seller', recipient: 'delivery', resourceType: 'execution', action: 'read' },
  { owner: 'carrier', recipient: 'owner', resourceType: 'driver', action: 'publish' },
  { owner: 'carrier', recipient: 'seller', resourceType: 'driver', action: 'subscribe', legId: 'leg-1' },
  { owner: 'carrier', recipient: 'seller', resourceType: 'driver', action: 'notify', legId: 'leg-1' },
  { owner: 'carrier', recipient: 'seller', resourceType: 'driver', action: 'read', legId: 'leg-1' },
  { owner: 'carrier', recipient: 'delivery', resourceType: 'driver', action: 'subscribe', legId: 'leg-1' },
  { owner: 'carrier', recipient: 'delivery', resourceType: 'driver', action: 'notify', legId: 'leg-1' },
  { owner: 'carrier', recipient: 'delivery', resourceType: 'driver', action: 'read', legId: 'leg-1' },
  { owner: 'delivery', recipient: 'owner', resourceType: 'driver', action: 'publish' },
  { owner: 'delivery', recipient: 'buyer', resourceType: 'driver', action: 'subscribe', legId: 'leg-2' },
  { owner: 'delivery', recipient: 'buyer', resourceType: 'driver', action: 'notify', legId: 'leg-2' },
  { owner: 'delivery', recipient: 'buyer', resourceType: 'driver', action: 'read', legId: 'leg-2' },
  { owner: 'carrier', recipient: 'owner', resourceType: 'eta', action: 'publish' },
  { owner: 'carrier', recipient: 'delivery', resourceType: 'eta', action: 'subscribe' },
  { owner: 'carrier', recipient: 'delivery', resourceType: 'eta', action: 'notify' },
  { owner: 'carrier', recipient: 'delivery', resourceType: 'eta', action: 'read' },
  { owner: 'delivery', recipient: 'owner', resourceType: 'etaConfirmation', action: 'publish' },
  { owner: 'delivery', recipient: 'carrier', resourceType: 'etaConfirmation', action: 'subscribe' },
  { owner: 'delivery', recipient: 'carrier', resourceType: 'etaConfirmation', action: 'notify' },
  { owner: 'delivery', recipient: 'carrier', resourceType: 'etaConfirmation', action: 'read' },
  { owner: 'delivery', recipient: 'owner', resourceType: 'eta', action: 'publish' },
  { owner: 'delivery', recipient: 'seller', resourceType: 'eta', action: 'subscribe' },
  { owner: 'delivery', recipient: 'seller', resourceType: 'eta', action: 'notify' },
  { owner: 'delivery', recipient: 'seller', resourceType: 'eta', action: 'read' },
  { owner: 'seller', recipient: 'owner', resourceType: 'promise', action: 'publish' },
  { owner: 'seller', recipient: 'buyer', resourceType: 'promise', action: 'subscribe' },
  { owner: 'seller', recipient: 'buyer', resourceType: 'promise', action: 'notify' },
  { owner: 'seller', recipient: 'buyer', resourceType: 'promise', action: 'read' },
  { owner: 'buyer', recipient: 'owner', resourceType: 'receipt', action: 'publish' },
  { owner: 'buyer', recipient: 'seller', resourceType: 'receipt', action: 'subscribe' },
  { owner: 'buyer', recipient: 'seller', resourceType: 'receipt', action: 'notify' },
  { owner: 'buyer', recipient: 'seller', resourceType: 'receipt', action: 'read' },
  { owner: 'buyer', recipient: 'delivery', resourceType: 'receipt', action: 'subscribe' },
  { owner: 'buyer', recipient: 'delivery', resourceType: 'receipt', action: 'notify' },
  { owner: 'buyer', recipient: 'delivery', resourceType: 'receipt', action: 'read' },
]

const PARTICIPANTS = new Set<string>(ORGS)

export function isParticipant(org: string): boolean {
  return PARTICIPANTS.has(org)
}

export function authorize(input: {
  actor: OrgId
  action: PolicyAction
  resource: Pick<SourceResource, 'owner' | 'type' | 'legId' | 'sessionId' | 'roundId'>
  sessionId: string
  roundId: string
  participating: boolean
}): boolean {
  if (input.resource.sessionId !== input.sessionId || input.resource.roundId !== input.roundId) return false
  if (!input.participating) return false
  if (input.actor === input.resource.owner && (input.action === 'read' || input.action === 'publish')) return true
  return POLICY_RULES.some((rule) => {
    if (rule.owner !== input.resource.owner || rule.resourceType !== input.resource.type || rule.action !== input.action) return false
    if (rule.recipient !== input.actor) return false
    if (rule.legId && rule.legId !== input.resource.legId) return false
    return true
  })
}

export function minimalPayload(resource: SourceResource, recipient: OrgId): Record<string, unknown> {
  const p = resource.payload
  if (resource.type === 'execution') {
    const tasks = p.tasks as Record<string, string>
    return {
      transportId: p.transportId,
      task: tasks[recipient] ?? tasks.shared,
      locations: p.locations,
    }
  }
  if (resource.type === 'driver') {
    return {
      driverId: p.driverId,
      name: p.name,
      organizationId: resource.owner,
      legId: resource.legId,
      transportId: p.transportId,
    }
  }
  if (resource.type === 'order') return { orderId: p.orderId, productId: p.productId, quantity: p.quantity }
  if (resource.type === 'acceptance') return { orderId: p.orderId, productId: p.productId }
  if (resource.type === 'eta') {
    return {
      etaId: p.etaId,
      destination: p.destination,
      legId: resource.legId,
      version: resource.version,
      day: p.day,
      time: p.time,
      previousVersion: p.previousVersion ?? null,
      reason: p.reason ?? null,
    }
  }
  if (resource.type === 'etaConfirmation') return { etaId: p.etaId, version: p.version }
  if (resource.type === 'promise') {
    return {
      etaId: p.etaId,
      version: p.version,
      sourceRef: p.sourceRef,
      day: p.day,
      time: p.time,
      stale: resource.stale,
    }
  }
  return { status: p.status, simTime: p.simTime }
}

export function sourceRef(resource: SourceResource): string {
  return `${resource.owner}-data/${resource.type}/${resource.id}`
}

export function subscriptionsFor(org: OrgId): { publisher: OrgId; eventTypes: ResourceType[] }[] {
  const map: Record<OrgId, { publisher: OrgId; eventTypes: ResourceType[] }[]> = {
    buyer: [
      { publisher: 'seller', eventTypes: ['acceptance', 'promise'] },
      { publisher: 'delivery', eventTypes: ['driver'] },
    ],
    seller: [
      { publisher: 'buyer', eventTypes: ['order', 'receipt'] },
      { publisher: 'carrier', eventTypes: ['driver'] },
      { publisher: 'delivery', eventTypes: ['eta'] },
    ],
    carrier: [
      { publisher: 'seller', eventTypes: ['execution'] },
      { publisher: 'delivery', eventTypes: ['etaConfirmation'] },
    ],
    delivery: [
      { publisher: 'seller', eventTypes: ['execution', 'receipt'] },
      { publisher: 'carrier', eventTypes: ['driver', 'eta'] },
    ],
  }
  return map[org]
}

export function t(language: Language, nl: string, en: string): string {
  return language === 'nl' ? nl : en
}

export function coordinationSteps(round: RoundState): boolean {
  return round.mode === 'without_bdi'
}
