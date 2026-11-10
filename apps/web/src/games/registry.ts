import type { ComponentType } from 'react'
import { Explainer as LogisticsExplainer, MapView as LogisticsMapView } from './logistics'

export type HostPack = {
  id: string
  MapView: typeof LogisticsMapView
  Explainer: typeof LogisticsExplainer
}

const packs: Record<string, HostPack> = {
  logistics: {
    id: 'logistics',
    MapView: LogisticsMapView,
    Explainer: LogisticsExplainer,
  },
}

export function hostPackFor(gameId: string | undefined | null): HostPack {
  return packs[gameId || 'logistics'] ?? packs.logistics
}

export type { ComponentType }
