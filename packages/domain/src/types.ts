import type { AccessState } from './games/access/state.js'

export type OrgId = string
export type StepId = string
export type ResourceType = string

export { ORGS, STEPS } from './games/logistics/orgs.js'

export type RoundMode = 'without_bdi' | 'with_bdi'
export type StartMode = 'without_bdi' | 'only_bdi' | 'story'
export type Language = 'nl' | 'en'
export type GameState =
  | 'LOBBY' | 'INTRO' | 'ORDER' | 'SUBSCRIPTIONS' | 'ORDER_CONFIRMATION'
  | 'PLANNING' | 'PICKUP' | 'LINEHAUL' | 'TRANSFER' | 'LAST_MILE'
  | 'DISRUPTION' | 'DELIVERY' | 'ROUND_REVIEW' | 'COMPARISON' | 'CLOSED'

export type PolicyAction = 'publish' | 'subscribe' | 'notify' | 'read'

export interface SourceResource {
  id: string
  sessionId: string
  roundId: string
  owner: OrgId
  type: ResourceType
  version: number
  legId: string | null
  payload: Record<string, unknown>
  stale: boolean
  createdAt: string
}

export interface ReceivedResource {
  id: string
  subscriber: OrgId
  sourceRef: string
  resourceType: ResourceType
  owner: OrgId
  version: number
  payload: Record<string, unknown>
  receivedAt: string
  stale: boolean
}

export interface Subscription {
  id: string
  subscriber: OrgId
  publisher: OrgId
  eventTypes: ResourceType[]
  status: 'active' | 'closed'
  cursor: number
}

export interface OutboxEvent {
  id: string
  publisher: OrgId
  eventType: ResourceType
  sourceRef: string
  resourceVersion: number
  status: 'pending' | 'dispatched'
  notifyAt: string
  fetchAt: string
  notified: boolean
  fetched: boolean
}

export interface Delivery {
  id: string
  subscriber: OrgId
  publisher: OrgId
  eventType: ResourceType
  sourceRef: string
  resourceVersion: number
  status: 'notified' | 'fetched' | 'failed'
  cursor: number
  error: string | null
}

export interface Attempt {
  actionId: string
  stepId: StepId
  userId: string
  value: string
  outcome: 'accepted' | 'mismatch'
  at: string
}

export interface QuestionOption {
  id: string
  label: string
}

export interface QuestionInstance {
  stepId: StepId
  instanceId: string
  options: QuestionOption[]
}

export interface TrainingEvent {
  sequence: number
  stepId: StepId
  actorRole: string
  displayType: 'choice' | 'feedback' | 'engine' | 'notification' | 'fetch' | 'intro' | 'help' | 'system'
  text: string
  choiceLabel: string | null
  result: string | null
  organizationId: string | null
  version: number | null
  at: string
  frame: TrainingFrame
  route?: { from: OrgId; to: OrgId } | null
}

export interface PanelItem {
  label: string
  value: string
  status: 'source' | 'coordination' | 'confirmed' | 'received' | 'stale' | 'waiting'
  statusLabel: string
}

export interface KnowledgePanel {
  organizationId: OrgId
  name: string
  roleLabel: string
  activity: string
  items: PanelItem[]
}

export interface TrainingFrame {
  prompt: string | null
  options: QuestionOption[]
  selectedOptionId: string | null
  feedback: string | null
  feedbackOk: boolean | null
  highlightOptionId: string | null
  highlightLabel: string | null
  panels: KnowledgePanel[]
  comm: string
  logisticsPhase: string
}

export interface Logistics {
  phase:
    | 'idle' | 'to_seller' | 'at_seller_gate' | 'linehaul' | 'at_delivery_dc'
    | 'transfer' | 'last_mile' | 'traffic' | 'to_buyer' | 'at_buyer_gate' | 'delivered'
  cargo: 'seller' | 'linehaul_truck' | 'delivery_truck' | 'buyer'
  night: boolean
  traffic: boolean
  phaseEnteredAt: string | null
  dueAt: string | null
}

export interface Metrics {
  startedAt: string
  endedAt: string | null
  activeDecisionMs: number
  presentationMs: number
  animationMs: number
  pauseMs: number
  wrongAttempts: number
  notificationsReceived: number
  fetchesOk: number
  helpActions: number
  disconnects: number
  coordinationSteps: StepId[]
  etaV2ChosenAt: string | null
  etaV2ConfirmedAt: string | null
  promiseAvailableAtBuyer: string | null
  decisionStartedAt: string | null
}

export interface RoleAssignment {
  organizationId: OrgId
  playerUserId: string | null
  displayName: string | null
  assignmentVersion: number
  inviteToken: string
  connectionStatus: 'open' | 'connected' | 'reconnecting' | 'disconnected'
  ready: boolean
  lastSeenAt: string | null
}

export interface RoundState {
  id: string
  sessionId: string
  number: number
  mode: RoundMode
  stepId: StepId
  state: GameState
  stateVersion: number
  scenarioSeed: string
  simDay: number
  simMinutes: number
  paused: boolean
  pauseStartedAt: string | null
  presentationUntil: string | null
  actionEnabledAt: string | null
  pendingAdvance: boolean
  introPhase: 'goals' | 'bdi-agreements' | 'bdi-roles' | 'bdi-flow'
  question: QuestionInstance | null
  lastSubmission: { stepId: StepId; optionId: string; ok: boolean; text: string } | null
  resources: SourceResource[]
  received: ReceivedResource[]
  subscriptions: Subscription[]
  outbox: OutboxEvent[]
  deliveries: Delivery[]
  attempts: Attempt[]
  trainingEvents: TrainingEvent[]
  projectionSeq: number
  logistics: Logistics
  metrics: Metrics
  orderId: string
  transportId: string
  leg1Id: string
  leg2Id: string
  deliveryCursor: number
  notes: Record<string, string>
  helpCount: number
}

export interface SessionState {
  id: string
  code: string
  name: string
  /** Catalog id of the game pack (e.g. logistics). Missing on old saves → treat as logistics. */
  gameId: string
  hostUserId: string
  status: 'lobby' | 'running' | 'paused' | 'closed'
  language: Language
  startMode: StartMode
  createdAt: string
  /** Last non-tick command (including heartbeat). Used for idle cleanup. */
  lastActivityAt: string
  expiresAt: string
  /** Client IP that created the session; used for open-session limits. */
  creatorIp: string | null
  roles: RoleAssignment[]
  rounds: RoundState[]
  currentRoundId: string | null
  /** Story pack state (access). Null for logistics. */
  access: AccessState | null
  comparison: boolean
  creates: { userId: string; at: string }[]
}

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message)
  }
}
