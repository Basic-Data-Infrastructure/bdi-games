export const ORGS = ['buyer', 'seller', 'carrier', 'delivery'] as const
export type LogisticsOrgId = (typeof ORGS)[number]

export const STEPS = [
  'S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09',
  'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20',
] as const
export type LogisticsStepId = (typeof STEPS)[number]

export const START_MODES = ['without_bdi', 'only_bdi'] as const
