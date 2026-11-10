import {
  accessScenario,
  type DossierItemId,
  type Layer,
  type Lookup,
  type Outcome,
  type RequestCardId,
  type Stage,
  type TransportId,
} from './scenario.js'
import type { AccessOrgId } from './orgs.js'
import type { Language } from '../../types.js'

export type AccessScene =
  | 'dossier'
  | 'review'
  | 'involve'
  | 'record'
  | 'policy'
  | 'request'
  | 'check'
  | 'change'
  | 'recordChange'
  | 'suspend'
  | 'debrief'

export type QuestionScene = 'involve' | 'record' | 'change' | 'recordChange' | 'suspend'
export const QUESTION_SCENES: QuestionScene[] = ['involve', 'record', 'change', 'recordChange', 'suspend']

export const PREDICTORS = ['admin', 'owner', 'registry', 'consumer'] as const
export type Predictor = (typeof PREDICTORS)[number]

export type LayerStatus = 'ok' | 'failed'
export type LineState = 'idle' | 'active' | 'ok' | 'failed'

export interface DossierVersion {
  version: number
  items: DossierItemId[]
  missing: DossierItemId[]
  asksAccess: boolean
  submittedAt: string
  decision: 'pending' | 'admitted' | 'returned'
  decidedAt: string | null
}

export interface PolicyVersion {
  version: number
  shareLoading: boolean
  shareFinance: boolean
  at: string
}

export interface OrchestrationEntry {
  transportId: TransportId
  carrierOrgId: string
  role: 'carrier'
  status: 'active' | 'ended'
}

export interface LookupResult {
  source: Lookup
  at: string
  layers: Partial<Record<Layer, LayerStatus>>
}

export interface AccessRequest {
  id: string
  cardId: RequestCardId
  stage: Stage
  sentAt: string
  predictUntil: string
  predictionsClosed: boolean
  predictions: Partial<Record<Predictor, Outcome>>
  lookups: LookupResult[]
  wrongDecisions: { decision: 'deliver' | 'refuse'; at: string; feedback: string }[]
  decision: 'deliver' | 'refuse' | null
  outcome: Outcome | null
  finalLayers: Record<Layer, LayerStatus> | null
  decidedAt: string | null
  policyVersion: number | null
}

export interface AccessFeedback {
  role: AccessOrgId
  scene: AccessScene
  optionId: string
  ok: boolean
  text: string
  at: string
}

export interface CardOption {
  id: string
  label: string
  state: 'idle' | 'wrong' | 'right'
}

export interface CardLine {
  label: string
  value: string
  status: 'ok' | 'failed' | 'pending' | 'skipped' | null
}

export interface RequestCardView {
  id: string
  number: number
  title: string
  http: string
  token: { issuer: string; subject: string; audience: string; issuedAt: string; expiresAt: string; fresh: boolean }
  checks: { id: Layer; label: string; source: string; status: 'pending' | 'ok' | 'failed' | 'skipped'; evidence: string | null }[]
  predictions: { role: Predictor; roleLabel: string; predicted: boolean; outcomeLabel: string | null; correct: boolean | null }[]
  predictionsOpen: boolean
  decision: null | { delivered: boolean; reason: string; payload: string | null }
  wrong: string | null
}

/** What the beamer shows next to the network: a question, a request under review or plain info. */
export interface AccessCard {
  kind: 'question' | 'request' | 'info'
  role: AccessOrgId | null
  title: string
  news: string | null
  prompt: string | null
  lines: CardLine[]
  options: CardOption[]
  feedback: string | null
  feedbackOk: boolean | null
  request: RequestCardView | null
}

export interface NetworkView {
  delta: { status: 'none' | 'pending' | 'active' | 'suspended'; statusLabel: string; keyRegistered: boolean }
  orchestration: { transportId: TransportId; carrier: string; isDelta: boolean; status: 'active' | 'ended' }[]
  policy: { version: number; shareLoading: boolean; shareFinance: boolean }
  lines: {
    onboard: LineState
    register: LineState
    request: LineState
    association: LineState
    orchestration: LineState
    policy: LineState
    data: LineState
  }
  requestLabel: string | null
  dataLabel: string | null
  highlight: AccessOrgId | null
}

export interface AccessFrame {
  scene: AccessScene
  actor: AccessOrgId | null
  message: string | null
  card: AccessCard
  network: NetworkView
}

export interface AccessHistoryEvent {
  sequence: number
  at: string
  scene: AccessScene
  actor: AccessOrgId | 'host'
  type: string
  text: string
  result: string | null
  frame: AccessFrame
}

export interface AccessState {
  id: string
  version: number
  scene: AccessScene
  stage: Stage
  paused: boolean
  pauseStartedAt: string | null
  holdUntil: string | null
  projectionSeq: number
  message: string | null
  dossiers: DossierVersion[]
  deltaStatus: 'none' | 'active' | 'suspended'
  keyRegistered: boolean
  orchestration: OrchestrationEntry[]
  registrations: number
  policies: PolicyVersion[]
  policyReview: boolean
  requests: AccessRequest[]
  received: { cardId: RequestCardId; transportId: TransportId; payload: string; at: string; requestId: string }[]
  feedback: AccessFeedback | null
  /** Latest feedback per role; the phone keeps it until the player dismisses it. */
  feedbackByRole: Partial<Record<AccessOrgId, AccessFeedback>>
  wrongOptions: Partial<Record<AccessScene, string[]>>
  mistakes: { role: AccessOrgId; scene: AccessScene; optionId: string; at: string }[]
  attempts: { actionId: string; outcome: string }[]
  history: AccessHistoryEvent[]
  notes: Record<string, string>
  helpCount: number
  metrics: {
    startedAt: string
    endedAt: string | null
    pauseMs: number
    presentationMs: number
    disconnects: number
  }
}

export function blankAccess(id: string, now: string): AccessState {
  return {
    id,
    version: 1,
    scene: 'dossier',
    stage: 1,
    paused: false,
    pauseStartedAt: null,
    holdUntil: null,
    projectionSeq: 0,
    message: null,
    dossiers: [],
    deltaStatus: 'none',
    keyRegistered: false,
    orchestration: [
      { transportId: 'T-102', carrierOrgId: accessScenario.noord.id, role: 'carrier', status: 'active' },
    ],
    registrations: 0,
    policies: [{ version: 1, shareLoading: false, shareFinance: false, at: now }],
    policyReview: false,
    requests: [],
    received: [],
    feedback: null,
    feedbackByRole: {},
    wrongOptions: {},
    mistakes: [],
    attempts: [],
    history: [],
    notes: {},
    helpCount: 0,
    metrics: {
      startedAt: now,
      endedAt: null,
      pauseMs: 0,
      presentationMs: 0,
      disconnects: 0,
    },
  }
}

export function currentPolicy(access: AccessState): PolicyVersion {
  return access.policies[access.policies.length - 1]!
}

export function activeRequest(access: AccessState): AccessRequest | null {
  const last = access.requests.at(-1)
  return last && !last.decision ? last : null
}

export function t(language: Language, nl: string, en: string): string {
  return language === 'en' ? en : nl
}
