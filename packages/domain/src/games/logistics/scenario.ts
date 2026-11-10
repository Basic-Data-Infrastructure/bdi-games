import type { Language, OrgId } from '../../types.js'
import type { LogisticsOrgId } from './orgs.js'

export interface Named {
  id: string
  nl: string
  en: string
}

export interface DriverDef {
  id: string
  name: string
}

export interface EtaDef {
  id: string
  day: number
  time: string
}

export const scenario = {
  quantity: 1,
  disruption: { day: 2, minutes: 4 * 60 + 30 },
  simStart: { day: 1, minutes: 8 * 60 },
  organizations: {
    buyer: { nl: 'Noordkaai Retail', en: 'Noordkaai Retail', color: '#1F6F8B' },
    seller: { nl: 'Havenlicht Electronics', en: 'Havenlicht Electronics', color: '#C46B2C' },
    carrier: { nl: 'Dijklijn Transport', en: 'Dijklijn Transport', color: '#2E7D4F' },
    delivery: { nl: 'Morgenpost Logistiek', en: 'Morgenpost Logistiek', color: '#6B4C9A' },
  } satisfies Record<LogisticsOrgId, { nl: string; en: string; color: string }>,
  roleLabels: {
    buyer: { nl: 'Koper', en: 'Buyer' },
    seller: { nl: 'Verkoper', en: 'Seller' },
    carrier: { nl: 'Vervoerder', en: 'Carrier' },
    delivery: { nl: 'Bezorger', en: 'Delivery' },
  } satisfies Record<LogisticsOrgId, { nl: string; en: string }>,
  roleBlurbs: {
    buyer: {
      nl: 'Bestelt het product en ontvangt de lading op een beveiligd terrein.',
      en: 'Orders the product and receives the load at a secured site.',
    },
    seller: {
      nl: 'Bevestigt het product, geeft de lading vrij en informeert de koper.',
      en: 'Confirms the product, releases the load and informs the buyer.',
    },
    carrier: {
      nl: 'Haalt de lading op en rijdt naar het DC van de bezorger.',
      en: 'Picks up the load and drives to the delivery DC.',
    },
    delivery: {
      nl: 'Slaat de lading over en levert af bij de koper.',
      en: 'Transships the load and delivers it to the buyer.',
    },
  } satisfies Record<LogisticsOrgId, { nl: string; en: string }>,
  products: [
    { id: 'camera', nl: 'Camera', en: 'Camera' },
    { id: 'phone', nl: 'Telefoon', en: 'Phone' },
    { id: 'television', nl: 'Televisie', en: 'Television' },
  ] as Named[],
  drivers: {
    carrier: [
      { id: 'carrier-noor', name: 'Noor Bakker' },
      { id: 'carrier-jamal', name: 'Jamal de Vries' },
      { id: 'carrier-lin', name: 'Lin Vos' },
    ],
    delivery: [
      { id: 'delivery-sara', name: 'Sara Mendes' },
      { id: 'delivery-otto', name: 'Otto Klein' },
      { id: 'delivery-mina', name: 'Mina Rahimi' },
    ],
  } satisfies Record<'carrier' | 'delivery', DriverDef[]>,
  linehaulEtas: [
    { id: 'eta-d1-0900', day: 1, time: '09:00' },
    { id: 'eta-d1-1200', day: 1, time: '12:00' },
    { id: 'eta-d1-1500', day: 1, time: '15:00' },
  ] as EtaDef[],
  deliveryEtas: [
    { id: 'eta-d2-0500', day: 2, time: '05:00' },
    { id: 'eta-d2-0600', day: 2, time: '06:00' },
    { id: 'eta-d2-0800', day: 2, time: '08:00' },
  ] as EtaDef[],
  locations: {
    seller: { nl: 'DC Havenlicht', en: 'Havenlicht DC' },
    carrierBase: { nl: 'Standplaats Dijklijn', en: 'Dijklijn depot' },
    deliveryDc: { nl: 'DC Morgenpost', en: 'Morgenpost DC' },
    buyer: { nl: 'Terrein Noordkaai', en: 'Noordkaai site' },
  },
}

export function orgName(org: OrgId, language: Language): string {
  const entry = scenario.organizations[org as LogisticsOrgId]
  return entry?.[language] ?? org
}

export function roleLabel(org: OrgId, language: Language): string {
  const entry = scenario.roleLabels[org as LogisticsOrgId]
  return entry?.[language] ?? org
}

export function labelOf(items: { id: string; nl: string; en: string }[], id: string, language: Language): string {
  return items.find((item) => item.id === id)?.[language] ?? id
}

export function driverName(id: string): string {
  return [...scenario.drivers.carrier, ...scenario.drivers.delivery].find((d) => d.id === id)?.name ?? id
}

export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function formatTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(day: number, time: string, delta: number): { day: number; time: string } {
  const total = day * 24 * 60 + parseTime(time) + delta
  const dayIndex = Math.floor(total / (24 * 60))
  return { day: dayIndex, time: formatTime(total) }
}

export function simStamp(day: number, minutes: number): number {
  return day * 24 * 60 + minutes
}

export function revisedEtas(base: { day: number; time: string }): EtaDef[] {
  return [30, 60, 90].map((delta) => {
    const next = addMinutes(base.day, base.time, delta)
    return { id: `rev-${delta}`, day: next.day, time: next.time }
  })
}

export function etaLabel(day: number, time: string, language: Language): string {
  return language === 'nl' ? `Dag ${day} ${time}` : `Day ${day} ${time}`
}
