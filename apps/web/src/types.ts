import type { Org } from './art/icons'
import type { Flight, Logistics } from './Map'

export type Option = { id: string; label: string }

export type Fact = { label: string; value: string; status?: string; statusLabel: string }

export type Panel = {
  organizationId: string
  name: string
  roleLabel: string
  activity: string
  items: Fact[]
}

export type Frame = {
  prompt: string | null
  options: Option[]
  selectedOptionId: string | null
  feedback: string | null
  feedbackOk: boolean | null
  highlightOptionId: string | null
  highlightLabel: string | null
  panels: Panel[]
  comm: string
}

export type RoleCard = {
  organizationId: string
  name: string
  roleLabel: string
  blurb: string
  claimed: boolean
  displayName: string | null
  ready: boolean
  connection: string
  inviteToken: string | null
}

export type Metrics = Record<string, number | string | null | string[]>

export type BdiChain = { publisher: Org; subscribers: Org[]; eventType: string; done: number; now: number | null }

export type Training = {
  sessionId: string
  sessionName: string
  gameId: string
  gameTitle: string
  code: string
  language: 'nl' | 'en'
  status: string
  paused: boolean
  comparison: boolean
  canStart: boolean
  startMode: 'without_bdi' | 'only_bdi' | 'story'
  roles: RoleCard[]
  round: null | {
    id: string
    number: number
    mode: 'without_bdi' | 'with_bdi'
    stepId: string
    state: string
    stateVersion: number
    simLabel: string
    label: string
    frame: Frame
    logistics: Logistics
    events: { sequence: number; text: string; result: string | null }[]
    history: { sequence: number; text: string; stepId: string; actorRole: string; displayType: string; result: string | null; frame: Frame }[]
    registries: null | {
      association: { organizationId: Org; name: string; status: string }[]
      orchestration: { organizationId: Org; roleLabel: string; issuedBy: string }[]
    }
    metrics: Metrics
    helpCount: number
    introPhase: 'goals' | 'bdi-agreements' | 'bdi-roles' | 'bdi-flow'
    narrative: string
    caption: string
    actor: string
    activeOrg: Org | null
    askOrg: Org | null
    bdiChain: BdiChain | null
    flights: Flight[]
  }
  rounds: { number: number; mode: 'without_bdi' | 'with_bdi'; metrics: Metrics }[]
  serverNow: string
  cursor: number
  access?: AccessTraining['access']
}

export type AccessRole = 'admin' | 'owner' | 'registry' | 'provider' | 'consumer'
export type AccessPredictor = 'admin' | 'owner' | 'registry' | 'consumer'
export type AccessLayer = 'identity' | 'membership' | 'involvement' | 'policy'
export type AccessOutcome = 'delivered' | AccessLayer
export type AccessLookup = 'association' | 'orchestration' | 'policy'
export type AccessLine = 'idle' | 'active' | 'ok' | 'failed'
export type AccessLineStatus = 'ok' | 'failed' | 'pending' | 'skipped' | null

export type AccessCardLine = { label: string; value: string; status: AccessLineStatus }

export type AccessRequestView = {
  id: string
  number: number
  title: string
  http: string
  token: { issuer: string; subject: string; audience: string; issuedAt: string; expiresAt: string; fresh: boolean }
  checks: { id: AccessLayer; label: string; source: string; status: 'pending' | 'ok' | 'failed' | 'skipped'; evidence: string | null }[]
  predictions: { role: AccessPredictor; roleLabel: string; predicted: boolean; outcomeLabel: string | null; correct: boolean | null }[]
  predictionsOpen: boolean
  decision: null | { delivered: boolean; reason: string; payload: string | null }
  wrong: string | null
}

export type AccessCard = {
  kind: 'question' | 'request' | 'info'
  role: AccessRole | null
  title: string
  news: string | null
  prompt: string | null
  lines: AccessCardLine[]
  options: { id: string; label: string; state: 'idle' | 'wrong' | 'right' }[]
  feedback: string | null
  feedbackOk: boolean | null
  request: AccessRequestView | null
}

export type AccessNetwork = {
  delta: { status: 'none' | 'pending' | 'active' | 'suspended'; statusLabel: string; keyRegistered: boolean }
  orchestration: { transportId: string; carrier: string; isDelta: boolean; status: 'active' | 'ended' }[]
  policy: { version: number; shareLoading: boolean; shareFinance: boolean }
  lines: Record<'onboard' | 'register' | 'request' | 'association' | 'orchestration' | 'policy' | 'data', AccessLine>
  requestLabel: string | null
  dataLabel: string | null
  highlight: AccessRole | null
}

export type AccessFrame = {
  scene: string
  actor: AccessRole | null
  message: string | null
  card: AccessCard
  network: AccessNetwork
}

export type AccessDebrief = {
  missions: { label: string; ok: boolean }[]
  counts: { label: string; value: number }[]
  scores: { role: AccessPredictor; roleLabel: string; points: number; of: number }[]
  mistakes: { role: AccessRole; roleLabel: string; count: number }[]
  rules: { title: string; text: string; seen: boolean }[]
  questions: string[]
}

export type AccessTraining = Omit<Training, 'gameId' | 'round' | 'rounds' | 'access'> & {
  gameId: 'access'
  round: null
  rounds: []
  access: null | {
    id: string
    version: number
    scene: string
    stage: number
    message: string | null
    actor: AccessRole | null
    actorLabel: string | null
    phases: {
      bands: { id: 'once' | 'shipment' | 'request'; who: string; rhythm: string; countLabel: string; active: boolean; current: string | null }[]
      debrief: boolean
      debriefLabel: string
    }
    card: AccessCard
    network: AccessNetwork
    scores: AccessDebrief['scores']
    history: {
      sequence: number
      at: string
      scene: string
      actor: string
      type: string
      text: string
      result: string | null
      frame: AccessFrame
    }[]
    debrief: AccessDebrief | null
    termCards: { term: string; text: string }[]
    holdUntil: string | null
    metrics: Metrics
  }
}

export type Player = {
  sessionId: string
  sessionName: string
  gameId: string
  code: string
  language: 'nl' | 'en'
  role: string
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
    mode: 'without_bdi' | 'with_bdi'
    stepId: string
    stateVersion: number
    simLabel: string
    paused: boolean
    canAnswer: boolean
    waitingFor: string | null
    actorRole: Org | null
    task: null | {
      prompt: string
      hint: string | null
      options: Option[]
      selectedOptionId: string | null
      feedback: string | null
      feedbackOk: boolean | null
      highlightOptionId: string | null
      highlightLabel: string | null
      fetching: boolean
    }
    dossier: Fact[]
    notifications: { id: string; text: string; status: string }[]
    notes: string
    delivered: boolean
  }
  access?: AccessPlayer['access']
  roleLabel?: string
}

export type AccessTask =
  | { kind: 'dossier'; prompt: string; news: string | null; items: { id: string; label: string }[]; selected: string[] }
  | { kind: 'question'; prompt: string; news: string | null; lines: AccessCardLine[]; options: { id: string; label: string; wrong: boolean }[] }
  | { kind: 'policy'; prompt: string; news: string | null; shareLoading: boolean; shareFinance: boolean }
  | { kind: 'pick'; prompt: string; news: string | null; cards: { id: string; title: string; note: string }[] }
  | {
    kind: 'check'
    request: AccessRequestView
    lookups: { id: AccessLookup; label: string; done: boolean; failed: boolean }[]
    waiting: string | null
    predictUntil: string
  }

export type AccessPlayer = Omit<Player, 'gameId' | 'round' | 'access' | 'role'> & {
  gameId: 'access'
  role: AccessRole
  roleLabel: string
  round?: never
  access: null | {
    id: string
    version: number
    scene: string
    stage: number
    canAct: boolean
    waitingFor: string | null
    actor: AccessRole | null
    message: string | null
    mission: string | null
    task: AccessTask | null
    feedback: { id: string; text: string; ok: boolean } | null
    predict: null | {
      requestId: string
      title: string
      options: { id: AccessOutcome; label: string }[]
      chosen: AccessOutcome | null
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
    side: {
      title: string
      rows: { label: string; value: string; tone: 'ok' | 'bad' | 'muted' | null }[]
      log: string[]
      note: string | null
    }
    received: { cardId: string; title: string; payload: string; label: string; stale: boolean }[]
    score: { points: number; of: number } | null
    debrief: AccessDebrief | null
    holdUntil: string | null
  }
}

export const CONFIRM_STEPS = new Set(['S03', 'S07', 'S09', 'S11', 'S13', 'S17', 'S19'])
export const ORGS: Org[] = ['buyer', 'seller', 'carrier', 'delivery']
export const ACCESS_ORGS = ['admin', 'owner', 'registry', 'provider', 'consumer'] as const
