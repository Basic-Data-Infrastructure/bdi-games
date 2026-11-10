import type { Language, OrgId, PolicyAction, ResourceType, RoundMode, StartMode } from './types.js'
import type { PolicyRule } from './games/logistics/policy.js'

export interface OrgDefinition {
  id: OrgId
  name: { nl: string; en: string }
  roleLabel: { nl: string; en: string }
  blurb: { nl: string; en: string }
  color: string
}

export interface GameCatalogEntry {
  id: string
  version: number
  titles: { nl: string; en: string }
  blurbs: { nl: string; en: string }
  startModes: StartMode[]
}

export interface GameDefinition extends GameCatalogEntry {
  kind: 'rounds' | 'story'
  orgs: OrgDefinition[]
  steps: string[]
  policyRules: PolicyRule[]
  defaultStartMode: StartMode
  roundModes: RoundMode[]
}

export function catalogEntry(game: GameDefinition): GameCatalogEntry {
  const { id, version, titles, blurbs, startModes } = game
  return { id, version, titles, blurbs, startModes }
}

export function orgIds(game: GameDefinition): OrgId[] {
  return game.orgs.map((org) => org.id)
}

export function orgNameOf(game: GameDefinition, org: OrgId, language: Language): string {
  return game.orgs.find((item) => item.id === org)?.name[language] ?? org
}

export function roleLabelOf(game: GameDefinition, org: OrgId, language: Language): string {
  return game.orgs.find((item) => item.id === org)?.roleLabel[language] ?? org
}

export type { PolicyRule }

