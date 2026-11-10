import { ORGS, START_MODES } from './orgs.js'
import { accessScenario } from './scenario.js'
import type { GameDefinition } from '../../game-definition.js'

export const ACCESS_GAME_ID = 'access'

export const accessGame: GameDefinition = {
  id: ACCESS_GAME_ID,
  version: 1,
  kind: 'story',
  titles: {
    nl: 'Wie mag deze gegevens zien?',
    en: 'Who may see this data?',
  },
  blurbs: {
    nl: 'Eén keer toetreden, per zending vastleggen, bij elk verzoek controleren: federatieve IAA in de praktijk.',
    en: 'Join once, record per shipment, check every request: federated IAA in practice.',
  },
  startModes: [...START_MODES],
  defaultStartMode: 'story',
  roundModes: [],
  steps: [],
  policyRules: [],
  orgs: ORGS.map((id) => ({
    id,
    name: { nl: accessScenario.organizations[id].name.nl, en: accessScenario.organizations[id].name.en },
    roleLabel: { nl: accessScenario.organizations[id].roleLabel.nl, en: accessScenario.organizations[id].roleLabel.en },
    blurb: { nl: accessScenario.organizations[id].blurb.nl, en: accessScenario.organizations[id].blurb.en },
    color: accessScenario.organizations[id].color,
  })),
}

export { ORGS, START_MODES } from './orgs.js'
export * from './scenario.js'
export * from './state.js'
export * from './decide.js'
export * from './reduce.js'
export * from './view.js'
