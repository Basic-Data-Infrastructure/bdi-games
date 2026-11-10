export const ORGS = ['admin', 'owner', 'registry', 'provider', 'consumer'] as const
export type AccessOrgId = (typeof ORGS)[number]

export const START_MODES = ['story'] as const
