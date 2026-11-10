import { ORGS, START_MODES, STEPS } from './orgs.js'
import { POLICY_RULES } from './policy.js'
import { scenario } from './scenario.js'
import type { GameDefinition } from '../../game-definition.js'

export const LOGISTICS_GAME_ID = 'logistics'

export const logisticsGame: GameDefinition = {
  id: LOGISTICS_GAME_ID,
  version: 1,
  kind: 'rounds',
  titles: {
    nl: 'Logistieke keten',
    en: 'Logistics chain',
  },
  blurbs: {
    nl: 'Een spel over gegevens delen in de logistieke keten, zonder en met BDI.',
    en: 'A game about sharing data in the logistics chain, without and with BDI.',
  },
  startModes: [...START_MODES],
  defaultStartMode: 'without_bdi',
  roundModes: ['without_bdi', 'with_bdi'],
  steps: [...STEPS],
  policyRules: POLICY_RULES,
  orgs: ORGS.map((id) => ({
    id,
    name: { nl: scenario.organizations[id].nl, en: scenario.organizations[id].en },
    roleLabel: { nl: scenario.roleLabels[id].nl, en: scenario.roleLabels[id].en },
    blurb: { nl: scenario.roleBlurbs[id].nl, en: scenario.roleBlurbs[id].en },
    color: scenario.organizations[id].color,
  })),
}

export { ORGS, STEPS, START_MODES } from './orgs.js'
export * from './scenario.js'
export * from './steps.js'
export * from './policy.js'
