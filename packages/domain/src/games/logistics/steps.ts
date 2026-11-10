import { etaLabel, orgName, revisedEtas, roleLabel, scenario, type EtaDef } from './scenario.js'
import { shuffle } from '../../shuffle.js'
import type { GameState, Language, OrgId, QuestionOption, RoundState, StepId } from '../../types.js'

export type Actor = OrgId | 'host' | 'engine' | 'all'

export const STEP_ACTOR: Record<StepId, Actor> = {
  S00: 'host', S01: 'buyer', S02: 'all', S03: 'seller', S04: 'carrier', S05: 'delivery',
  S06: 'carrier', S07: 'delivery', S08: 'delivery', S09: 'seller', S10: 'engine',
  S11: 'seller', S12: 'engine', S13: 'delivery', S14: 'engine', S15: 'engine',
  S16: 'delivery', S17: 'seller', S18: 'engine', S19: 'buyer', S20: 'host',
}

export const COARSE: Record<StepId, GameState> = {
  S00: 'INTRO', S01: 'ORDER', S02: 'SUBSCRIPTIONS', S03: 'ORDER_CONFIRMATION',
  S04: 'PLANNING', S05: 'PLANNING', S06: 'PLANNING', S07: 'PLANNING', S08: 'PLANNING', S09: 'PLANNING',
  S10: 'PICKUP', S11: 'PICKUP', S12: 'LINEHAUL', S13: 'LINEHAUL', S14: 'TRANSFER',
  S15: 'LAST_MILE', S16: 'DISRUPTION', S17: 'DISRUPTION', S18: 'DELIVERY', S19: 'DELIVERY', S20: 'ROUND_REVIEW',
}

const CONFIRM = new Set<StepId>(['S03', 'S07', 'S09', 'S11', 'S13', 'S17', 'S19'])
const CHOOSE = new Set<StepId>(['S01', 'S04', 'S05', 'S06', 'S08', 'S16'])

export function isConfirm(step: StepId): boolean {
  return CONFIRM.has(step)
}
export function isChoose(step: StepId): boolean {
  return CHOOSE.has(step)
}

export function nextStepId(step: StepId, mode: RoundState['mode']): StepId {
  if (step === 'S01' && mode === 'without_bdi') return 'S03'
  const index = ['S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20'].indexOf(step)
  return `S${String(index + 1).padStart(2, '0')}` as StepId
}

export function promptFor(step: StepId, language: Language): string {
  const nl: Record<string, string> = {
    S00: 'Bekijk het doel en de vier rollen',
    S01: 'Kies een product',
    S03: 'Bevestig het product van de koper',
    S04: 'Kies een chauffeur',
    S05: 'Kies een chauffeur',
    S06: 'Kies een ETA',
    S07: 'Bevestig de ETA van de vervoerder',
    S08: 'Kies een ETA',
    S09: 'Bevestig de ETA en geef de leverbelofte door',
    S11: 'Bevestig de chauffeur van de vervoerder',
    S13: 'Bevestig de chauffeur van de vervoerder',
    S16: 'Kies een nieuwe ETA',
    S17: 'Bevestig de nieuwe ETA en informeer de koper',
    S19: 'Bevestig de chauffeur van de bezorger',
  }
  const en: Record<string, string> = {
    S00: 'See the goal and the four roles',
    S01: 'Choose a product',
    S03: 'Confirm the buyer’s product',
    S04: 'Choose a driver',
    S05: 'Choose a driver',
    S06: 'Choose an ETA',
    S07: 'Confirm the carrier ETA',
    S08: 'Choose an ETA',
    S09: 'Confirm the ETA and pass on the delivery promise',
    S11: 'Confirm the carrier’s driver',
    S13: 'Confirm the carrier’s driver',
    S16: 'Choose a new ETA',
    S17: 'Confirm the new ETA and inform the buyer',
    S19: 'Confirm the delivery driver’s identity',
  }
  return (language === 'nl' ? nl : en)[step] ?? step
}

export function hintFor(step: StepId, language: Language): string | null {
  const nl: Partial<Record<StepId, string>> = {
    S03: 'Vraag de koper welk product is besteld.',
    S07: 'Vraag de vervoerder welke aankomsttijd bij het DC is gekozen.',
    S09: 'Vraag de bezorger welke aflevertijd is gekozen.',
    S11: 'Vraag de vervoerder welke chauffeur is ingepland.',
    S13: 'Vraag de vervoerder welke chauffeur is ingepland.',
    S17: 'Vraag de bezorger welke nieuwe aankomsttijd is gekozen.',
    S19: 'Vraag de bezorger welke chauffeur is ingepland.',
  }
  const en: Partial<Record<StepId, string>> = {
    S03: 'Ask the buyer which product was ordered.',
    S07: 'Ask the carrier which arrival time at the DC was chosen.',
    S09: 'Ask the delivery company which delivery time was chosen.',
    S11: 'Ask the carrier which driver is scheduled.',
    S13: 'Ask the carrier which driver is scheduled.',
    S17: 'Ask the delivery company which new arrival time was chosen.',
    S19: 'Ask the delivery company which driver is scheduled.',
  }
  return (language === 'nl' ? nl : en)[step] ?? null
}

export function narrative(step: StepId, language: Language): string {
  const nl: Partial<Record<StepId, string>> = {
    S10: 'De vervoerder rijdt naar de verkoper.',
    S12: 'De lading reist mee naar het DC van de bezorger.',
    S14: 'In de nacht verhuist de lading naar de bezorgtruck.',
    S15: 'De file verandert de verwachte aankomsttijd. Wie moet dat weten?',
    S18: 'De bezorger rijdt verder naar het terrein van de koper.',
  }
  const en: Partial<Record<StepId, string>> = {
    S10: 'The carrier drives to the seller.',
    S12: 'The load travels to the delivery DC.',
    S14: 'During the night the load moves onto the delivery truck.',
    S15: 'The traffic jam changes the expected arrival. Who needs to know?',
    S18: 'The delivery truck continues to the buyer’s site.',
  }
  return (language === 'nl' ? nl : en)[step] ?? ''
}

export function storyLine(step: StepId, mode: RoundState['mode'], language: Language): string {
  const bdi = mode === 'with_bdi'
  const nl: Record<StepId, string> = {
    S00: bdi ? 'Ronde 2: nu met BDI. Kijk hoe gegevens bij de bron blijven.' : 'Ronde 1: zonder BDI. Iedereen weet alleen wat hij zelf vastlegt.',
    S01: 'Koper, zou jij een bestelling bij de verkoper kunnen plaatsen?',
    S02: 'Iedere organisatie abonneert zich op de wijzigingen die zij mag ontvangen.',
    S03: bdi ? 'De verkoper heeft een melding gekregen en haalt de bestelling op bij de koper.' : 'De koper belt nu de verkoper en geeft door wat deze wil kopen.',
    S04: 'De vervoerder kiest de chauffeur die de lading ophaalt.',
    S05: 'De bezorger kiest de chauffeur voor de laatste rit.',
    S06: 'Vervoerder, hoe laat kom je aan bij de bezorger?',
    S07: bdi ? 'De bezorger ontvangt de ETA van de vervoerder uit de bron.' : 'Bezorger, vraag de vervoerder hoe laat de lading aankomt.',
    S08: 'Bezorger, hoe laat ben je bij de koper?',
    S09: bdi ? 'De verkoper ontvangt de ETA van de bezorger en geeft de leverbelofte door.' : 'De verkoper vraagt de bezorger naar de aflevertijd en geeft die door aan de koper.',
    S10: 'De vervoerder rijdt naar de verkoper om de lading op te halen.',
    S11: 'Verkoper, klopt de chauffeur die aan de poort staat?',
    S12: 'De lading reist mee naar het DC van de bezorger.',
    S13: 'Bezorger, controleer de chauffeur van de vervoerder bij de poort.',
    S14: 'In de nacht verhuist de lading naar de bezorgtruck.',
    S15: 'De bezorgtruck vertrekt richting de koper…',
    S16: 'File! De verwachte aankomsttijd verandert. Bezorger, kies een nieuwe ETA.',
    S17: bdi ? 'De bron heeft een nieuwe ETA. De verkoper krijgt een melding en haalt de update op.' : 'Bezorger, kun je aan de verkoper doorgeven hoe laat je bij de koper bent?',
    S18: 'De bezorger rijdt verder naar het terrein van de koper.',
    S19: 'Koper, kun jij de identiteit van de chauffeur van de bezorger controleren?',
    S20: 'Afgeleverd! Het product is bij de koper.',
  }
  const en: Record<StepId, string> = {
    S00: bdi ? 'Round 2: now with BDI. Watch how data stays at the source.' : 'Round 1: without BDI. Everyone only knows what they record themselves.',
    S01: 'Buyer, could you place an order with the seller?',
    S02: 'Each organisation subscribes to the changes it may receive.',
    S03: bdi ? 'The seller got a notice and fetches the order from the buyer.' : 'The buyer now calls the seller and says what to buy.',
    S04: 'The carrier chooses the driver who picks up the load.',
    S05: 'The delivery company chooses the driver for the last leg.',
    S06: 'Carrier, what time do you arrive at the delivery DC?',
    S07: bdi ? 'The delivery company receives the carrier ETA from the source.' : 'Delivery, ask the carrier when the load arrives.',
    S08: 'Delivery, what time will you be at the buyer?',
    S09: bdi ? 'The seller receives the delivery ETA and passes on the promise.' : 'The seller asks the delivery company for the time and tells the buyer.',
    S10: 'The carrier drives to the seller to pick up the load.',
    S11: 'Seller, is the driver at the gate the right one?',
    S12: 'The load travels to the delivery DC.',
    S13: 'Delivery, check the carrier’s driver at the gate.',
    S14: 'During the night the load moves onto the delivery truck.',
    S15: 'The delivery truck leaves for the buyer…',
    S16: 'Traffic jam! The expected arrival changes. Delivery, choose a new ETA.',
    S17: bdi ? 'The source has a new ETA. The seller gets a notice and fetches the update.' : 'Delivery, can you tell the seller when you will reach the buyer?',
    S18: 'The delivery truck continues to the buyer’s site.',
    S19: 'Buyer, can you check the identity of the delivery driver?',
    S20: 'Delivered! The product has reached the buyer.',
  }
  return (language === 'nl' ? nl : en)[step]
}

function etaOptions(etas: EtaDef[], language: Language): QuestionOption[] {
  return etas.map((eta) => ({ id: eta.id, label: etaLabel(eta.day, eta.time, language) }))
}

export function optionsFor(round: RoundState, step: StepId, language: Language): QuestionOption[] {
  if (step === 'S01' || step === 'S03') {
    return scenario.products.map((p) => ({ id: p.id, label: language === 'nl' ? p.nl : p.en }))
  }
  if (step === 'S04' || step === 'S11') return scenario.drivers.carrier.map((d) => ({ id: d.id, label: d.name }))
  if (step === 'S05' || step === 'S19') return scenario.drivers.delivery.map((d) => ({ id: d.id, label: d.name }))
  if (step === 'S13') return scenario.drivers.carrier.map((d) => ({ id: d.id, label: d.name }))
  if (step === 'S06' || step === 'S07') return etaOptions(scenario.linehaulEtas, language)
  if (step === 'S08' || step === 'S09') return etaOptions(scenario.deliveryEtas, language)
  if (step === 'S16' || step === 'S17') {
    const current = round.resources.find((r) => r.type === 'eta' && r.owner === 'delivery' && r.version === 1 && r.legId === round.leg2Id)
    const base = current ? { day: Number(current.payload.day), time: String(current.payload.time) } : { day: 2, time: '06:00' }
    return etaOptions(revisedEtas(base), language)
  }
  return []
}

export function expectedValue(round: RoundState, step: StepId): string | null {
  const res = round.resources
  if (step === 'S03') return String(res.find((r) => r.type === 'order')?.payload.productId ?? '')
  if (step === 'S07') return String(res.find((r) => r.owner === 'carrier' && r.type === 'eta')?.payload.etaId ?? '')
  if (step === 'S09') return String(res.find((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 1)?.payload.etaId ?? '')
  if (step === 'S11' || step === 'S13') return String(res.find((r) => r.owner === 'carrier' && r.type === 'driver')?.payload.driverId ?? '')
  if (step === 'S17') return String(res.find((r) => r.owner === 'delivery' && r.type === 'eta' && r.version === 2)?.payload.etaId ?? '')
  if (step === 'S19') return String(res.find((r) => r.owner === 'delivery' && r.type === 'driver')?.payload.driverId ?? '')
  return null
}

export function shuffledOptions(round: RoundState, step: StepId, language: Language): QuestionOption[] {
  return shuffle(optionsFor(round, step, language), `${round.scenarioSeed}:${step}`)
}

export function mismatchText(language: Language): string {
  return language === 'nl'
    ? 'Deze informatie komt niet overeen. Vraag het na of controleer je ontvangen gegevens.'
    : 'This information does not match. Ask again or check the data you received.'
}

export function askRole(step: StepId): OrgId | null {
  if (step === 'S03') return 'buyer'
  if (step === 'S07' || step === 'S11' || step === 'S13') return 'carrier'
  if (step === 'S09' || step === 'S17' || step === 'S19') return 'delivery'
  return null
}

export function activeOrg(step: StepId): OrgId | null {
  const actor = STEP_ACTOR[step]
  return actor === 'host' || actor === 'engine' || actor === 'all' ? null : actor
}

export function activityLabel(org: OrgId, round: RoundState, language: Language): string {
  const actor = STEP_ACTOR[round.stepId]
  if (actor === org || (actor === 'all' && !round.subscriptions.some((s) => s.subscriber === org))) {
    return language === 'nl' ? 'Aan zet' : 'Your turn'
  }
  if (['to_seller', 'linehaul', 'last_mile', 'to_buyer'].includes(round.logistics.phase) && (org === 'carrier' || org === 'delivery')) {
    return language === 'nl' ? 'Onderweg' : 'En route'
  }
  return language === 'nl' ? 'Wacht' : 'Waiting'
}

export function orgMention(org: OrgId, language: Language): string {
  return `${roleLabel(org, language)} (${orgName(org, language)})`
}
