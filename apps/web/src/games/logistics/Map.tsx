import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BoxArt, TruckArt, VanArt, type Org } from '../../art/icons'
import type { Lang } from '../../i18n'

export type Logistics = {
  phase: string
  cargo: string
  night: boolean
  traffic: boolean
  phaseEnteredAt: string | null
  dueAt: string | null
}

export type Flight = { id: string; kind: 'notice' | 'fetch'; from: Org; to: Org; label: string; at: string }

type Pt = { x: number; y: number }

export const SITES: Record<Org, Pt> = {
  carrier: { x: 235, y: 360 },
  seller: { x: 330, y: 800 },
  delivery: { x: 830, y: 240 },
  buyer: { x: 850, y: 810 },
}

const ROAD_TO_SELLER = 'M235 360 C 200 470, 205 620, 250 720 S 320 800, 330 800'
const ROAD_LINEHAUL = 'M330 800 C 300 700, 285 560, 300 470 C 322 300, 430 185, 570 175 C 700 168, 790 190, 830 240'
const ROAD_LAST_MILE = 'M830 240 C 900 290, 915 340, 860 380 C 795 420, 785 455, 855 485 C 925 515, 915 565, 845 585 C 775 605, 785 655, 855 675 C 915 695, 905 770, 850 810'

const ISLAND = 'M300 930 C 190 900, 110 760, 105 600 C 100 420, 150 260, 280 170 C 420 75, 640 70, 800 110 C 950 150, 1030 300, 1030 480 C 1030 680, 980 860, 880 925 C 820 962, 760 940, 745 880 C 730 820, 790 760, 790 640 C 790 520, 730 420, 640 385 C 560 355, 470 370, 420 440 C 370 510, 380 640, 420 760 C 450 850, 400 950, 300 930 Z'

const PHASE_ROAD: Record<string, { road: 'a' | 'b' | 'c'; from: number; to: number; vehicle: 'truck' | 'van' }> = {
  to_seller: { road: 'a', from: 0, to: 1, vehicle: 'truck' },
  linehaul: { road: 'b', from: 0, to: 1, vehicle: 'truck' },
  last_mile: { road: 'c', from: 0, to: 0.55, vehicle: 'van' },
  to_buyer: { road: 'c', from: 0.55, to: 1, vehicle: 'van' },
}

const TRAFFIC_T = 0.55

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function useNow(active: boolean, offset: number, frozenAt: number | null) {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    if (frozenAt != null) { setNow(frozenAt); return }
    setNow(Date.now() + offset)
    if (!active) return
    if (prefersReducedMotion()) {
      const timer = setInterval(() => setNow(Date.now() + offset), 1000)
      return () => clearInterval(timer)
    }
    let frame = 0
    let last = 0
    const loop = (time: number) => {
      if (time - last > 33) { last = time; setNow(Date.now() + offset) }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [active, offset, frozenAt])
  return now
}

export function MapView({
  logistics, flights = [], serverNow, paused = false, lang = 'nl', activeOrg = null,
}: {
  logistics: Logistics | null
  flights?: Flight[]
  serverNow?: string
  paused?: boolean
  lang?: Lang
  activeOrg?: Org | null
}) {
  const roadA = useRef<SVGPathElement>(null)
  const roadB = useRef<SVGPathElement>(null)
  const roadC = useRef<SVGPathElement>(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => setReady(true), [])

  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (serverNow) setOffset(Date.parse(serverNow) - Date.now())
  }, [serverNow])

  const phase = logistics?.phase ?? 'idle'
  const entered = logistics?.phaseEnteredAt ? Date.parse(logistics.phaseEnteredAt) : 0
  const due = logistics?.dueAt ? Date.parse(logistics.dueAt) : 0
  const moving = Boolean(PHASE_ROAD[phase] || phase === 'transfer')
  const recentFlight = flights.some((f) => Date.now() + offset - Date.parse(f.at) < 4500)
  const frozen = paused && serverNow ? Date.parse(serverNow) : null
  const now = useNow(moving || recentFlight || phase === 'delivered', offset, frozen)
  const progress = due > entered ? clamp((now - entered) / (due - entered)) : 1

  const roads = { a: roadA, b: roadB, c: roadC }
  const pointOn = (road: 'a' | 'b' | 'c', t: number): Pt & { angle: number } => {
    const path = roads[road].current
    if (!ready || !path) {
      const fallback = road === 'a' ? SITES.carrier : road === 'b' ? SITES.seller : SITES.delivery
      return { ...fallback, angle: 0 }
    }
    const length = path.getTotalLength()
    const p = path.getPointAtLength(length * clamp(t))
    const q = path.getPointAtLength(Math.min(length, length * clamp(t) + 2))
    const r = path.getPointAtLength(Math.max(0, length * clamp(t) - 2))
    return { x: p.x, y: p.y, angle: (Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI }
  }

  const leg = PHASE_ROAD[phase]
  let truck = pointOn('a', 0)
  if (phase === 'to_seller' || phase === 'at_seller_gate') truck = pointOn('a', phase === 'to_seller' ? progress : 1)
  if (phase === 'linehaul') truck = pointOn('b', progress)
  if (['at_delivery_dc', 'transfer', 'last_mile', 'traffic', 'to_buyer', 'at_buyer_gate', 'delivered'].includes(phase)) {
    truck = { x: SITES.delivery.x - 70, y: SITES.delivery.y + 30, angle: 180 }
  }
  let van = { x: SITES.delivery.x + 40, y: SITES.delivery.y + 70, angle: 90 }
  if (leg?.vehicle === 'van') van = pointOn('c', leg.from + (leg.to - leg.from) * progress)
  if (phase === 'traffic') van = pointOn('c', TRAFFIC_T)
  if (phase === 'at_buyer_gate' || phase === 'delivered') van = pointOn('c', 1)

  const onTruck = ['linehaul', 'at_delivery_dc'].includes(phase) && logistics?.cargo !== 'delivery_truck'
  const onVan = ['last_mile', 'traffic', 'to_buyer', 'at_buyer_gate'].includes(phase) || (phase === 'at_delivery_dc' && logistics?.cargo === 'delivery_truck')
  let box: Pt | null = null
  if (['idle', 'to_seller', 'at_seller_gate'].includes(phase)) box = { x: SITES.seller.x + 58, y: SITES.seller.y - 30 }
  if (phase === 'transfer') {
    const from = { x: truck.x, y: truck.y - 12 }
    const to = { x: van.x, y: van.y - 12 }
    box = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress - Math.sin(progress * Math.PI) * 60 }
  }
  if (phase === 'delivered') box = { x: SITES.buyer.x - 64, y: SITES.buyer.y - 20 }

  const night = logistics?.night || phase === 'transfer'
  const gates = {
    seller: phase === 'at_seller_gate' ? 'closed' : ['linehaul'].includes(phase) ? 'open' : 'idle',
    delivery: phase === 'at_delivery_dc' && logistics?.cargo !== 'delivery_truck' ? 'closed' : phase === 'transfer' ? 'open' : 'idle',
    buyer: phase === 'at_buyer_gate' ? 'closed' : phase === 'delivered' ? 'open' : 'idle',
  } as const
  const L = lang === 'en'
    ? { seller: 'Havenlicht DC', carrier: 'Dijklijn depot', delivery: 'Morgenpost DC', buyer: 'Noordkaai site', delay: 'Delay', gateCheck: 'Gate check' }
    : { seller: 'DC Havenlicht', carrier: 'Standplaats Dijklijn', delivery: 'DC Morgenpost', buyer: 'Terrein Noordkaai', delay: 'Vertraging', gateCheck: 'Poortcontrole' }

  const trafficCars = [0.6, 0.635, 0.67, 0.705].map((t) => pointOn('c', t))
  const trafficLabel = pointOn('c', 0.63)

  return (
    <svg className="map" viewBox="0 0 1100 1000" preserveAspectRatio="xMidYMid meet" role="img" aria-label={lang === 'en' ? 'Logistics map' : 'Logistieke kaart'}>
      <defs>
        <radialGradient id="sea" cx="50%" cy="55%" r="70%">
          <stop offset="0" stopColor="#86c8c3" />
          <stop offset="0.55" stopColor="#62aeb1" />
          <stop offset="1" stopColor="#4f9aa0" />
        </radialGradient>
        <clipPath id="island-clip"><path d={ISLAND} /></clipPath>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.25" />
        </filter>
      </defs>
      <rect width="1100" height="1000" fill="url(#sea)" />
      <path d={ISLAND} fill="none" stroke="#8fd0ca" strokeWidth="110" strokeLinejoin="round" opacity="0.55" />
      <path d={ISLAND} fill="none" stroke="#a9ddd4" strokeWidth="50" strokeLinejoin="round" opacity="0.8" />
      <path d={ISLAND} fill="#d9cd9a" stroke="#d9cd9a" strokeWidth="26" strokeLinejoin="round" />
      <path d={ISLAND} fill="#7a8a43" />
      <g clipPath="url(#island-clip)">
        <path d="M130 300 C 200 180, 330 160, 360 250 C 390 330, 300 380, 250 470 C 210 540, 140 520, 130 440 Z" fill="#56662d" opacity="0.8" />
        <path d="M520 120 C 640 90, 760 110, 820 170 C 700 150, 600 170, 520 220 Z" fill="#697a38" />
        <path d="M880 330 C 980 360, 1010 500, 980 620 C 950 700, 900 690, 900 600 C 900 500, 850 420, 880 330 Z" fill="#56662d" opacity="0.8" />
        <path d="M150 600 C 180 700, 240 800, 300 860 C 230 860, 160 760, 150 600 Z" fill="#697a38" />
        <path d="M820 760 C 880 780, 940 820, 900 900 C 860 920, 800 880, 820 760 Z" fill="#697a38" />
        {[[180, 240], [205, 262], [900, 420], [930, 445], [610, 140], [640, 150], [180, 660], [950, 700]].map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <circle r="14" fill="#4a5a26" />
            <circle r="10" cx="-3" cy="-3" fill="#5f7030" />
          </g>
        ))}
      </g>

      {[roadA, roadB, roadC].map((ref, index) => {
        const d = [ROAD_TO_SELLER, ROAD_LINEHAUL, ROAD_LAST_MILE][index]
        return (
          <g key={d}>
            <path d={d} fill="none" stroke="#c3c6cc" strokeWidth="22" strokeLinecap="round" />
            <path ref={ref} d={d} fill="none" stroke="#6c7078" strokeWidth="16" strokeLinecap="round" />
            <path d={d} fill="none" stroke="#e7e2d0" strokeWidth="1.6" strokeDasharray="10 12" opacity="0.8" />
          </g>
        )
      })}

      <Site at={SITES.carrier} org="carrier" label={L.carrier} active={activeOrg === 'carrier'} />
      <Site at={SITES.seller} org="seller" label={L.seller} active={activeOrg === 'seller'} building gate={gates.seller} />
      <Site at={SITES.delivery} org="delivery" label={L.delivery} active={activeOrg === 'delivery'} building gate={gates.delivery} />
      <Site at={SITES.buyer} org="buyer" label={L.buyer} active={activeOrg === 'buyer'} fence gate={gates.buyer} />

      {logistics?.traffic && phase === 'traffic' && (
        <g className="traffic">
          {trafficCars.map((car, index) => (
            <g key={index} transform={`translate(${car.x} ${car.y}) rotate(${car.angle})`}>
              <rect x="-13" y="-8" width="26" height="16" rx="5" fill={['#3b4254', '#4aa3e8', '#e0a800', '#8a5a3b'][index]} stroke="#1b2433" strokeWidth="1.5" />
              <rect x="-6" y="-6" width="10" height="12" rx="2" fill="#bfe6f5" opacity="0.8" />
              <circle className="brake" cx="-13" cy="-5" r="3" fill="#ff3b30" />
              <circle className="brake" cx="-13" cy="5" r="3" fill="#ff3b30" />
            </g>
          ))}
          <g transform={`translate(${trafficLabel.x + 70} ${trafficLabel.y - 30})`} filter="url(#soft)">
            <rect x="-70" y="-24" width="140" height="44" rx="22" fill="#e0483e" />
            <text x="0" y="7" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" fontFamily="inherit">{L.delay}</text>
          </g>
        </g>
      )}

      <Vehicle at={truck} kind="truck" cargo={onTruck} />
      <Vehicle at={van} kind="van" cargo={onVan} />
      {box && (
        <g transform={`translate(${box.x - 20} ${box.y - 20})`} filter="url(#soft)">
          <svg width="40" height="40" viewBox="0 0 64 64"><BoxArt arrow={phase === 'delivered' ? 'down' : 'up'} /></svg>
        </g>
      )}

      {night && (
        <g pointerEvents="none">
          <rect width="1100" height="1000" fill="#0e1a3a" opacity="0.45" />
          {[[120, 90], [300, 60], [520, 40], [700, 80], [980, 60], [1040, 180], [60, 260]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#fff" opacity="0.85" />
          ))}
          <path d="M1000 110 a38 38 0 1 0 30 60 a30 30 0 1 1 -30 -60" fill="#ffe8a3" />
        </g>
      )}

      {flights.map((flight) => (
        <FlightMark key={flight.id} flight={flight} now={now} />
      ))}

      {phase === 'delivered' && <Confetti at={SITES.buyer} now={now} since={entered} />}
    </svg>
  )
}

function Site({
  at, org, label, active, building, fence, gate,
}: {
  at: Pt
  org: Org
  label: string
  active: boolean
  building?: boolean
  fence?: boolean
  gate?: 'open' | 'closed' | 'idle'
}) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      {building && (
        <g transform="translate(-86 -70)">
          <rect width="72" height="52" rx="6" fill="#e9e3d2" stroke="#8b8577" strokeWidth="2" />
          <path d="M-6 4 36 -18 78 4Z" fill="#b8352c" />
          {[10, 30, 50].map((x) => <rect key={x} x={x} y="24" width="14" height="28" fill="#6c7078" />)}
        </g>
      )}
      {fence && (
        <rect x="-110" y="-72" width="220" height="130" rx="18" fill="rgb(255 255 255 / 12%)" stroke="#f4efe4" strokeWidth="4" strokeDasharray="10 8" />
      )}
      {active && <circle r="62" fill="none" stroke="#ffd54a" strokeWidth="8" className="site-pulse" />}
      <circle r="44" fill="#fff" filter="url(#soft)" />
      <circle r="44" fill="none" stroke={`var(--${org})`} strokeWidth="5" />
      <svg x="-32" y="-34" width="64" height="64" viewBox="0 0 64 64">
        {org === 'buyer' && <BoxArt arrow="down" />}
        {org === 'seller' && <BoxArt arrow="up" />}
        {org === 'carrier' && <TruckArt />}
        {org === 'delivery' && <VanArt />}
      </svg>
      <g transform="translate(0 70)">
        <rect x={-label.length * 6.4 - 14} y="-18" width={label.length * 12.8 + 28} height="32" rx="16" fill="rgb(24 44 50 / 80%)" />
        <text y="5" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff" fontFamily="inherit">{label}</text>
      </g>
      {gate && gate !== 'idle' && (
        <g transform="translate(46 -8)">
          <rect x="0" y="-26" width="8" height="40" rx="2" fill="#3b4254" />
          <g transform={gate === 'open' ? 'rotate(-75 4 -20)' : undefined} style={{ transition: 'transform 600ms ease' }}>
            <rect x="4" y="-24" width="58" height="9" rx="4" fill="#fff" stroke="#3b4254" strokeWidth="1.5" />
            {[12, 30, 48].map((x) => <rect key={x} x={x} y="-24" width="8" height="9" fill="#e0483e" />)}
          </g>
          <circle cx="4" cy="-34" r="6" fill={gate === 'open' ? '#3dbb5c' : '#e0483e'} />
        </g>
      )}
    </g>
  )
}

function Vehicle({ at, kind, cargo }: { at: Pt & { angle: number }; kind: 'truck' | 'van'; cargo: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${at.angle})`} filter="url(#soft)">
      {kind === 'truck' ? (
        <>
          <rect x="-34" y="-13" width="50" height="26" rx="4" fill="#f2c230" stroke="#b8860b" strokeWidth="2" />
          <rect x="16" y="-12" width="18" height="24" rx="5" fill="#e0483e" stroke="#9b2119" strokeWidth="2" />
          <rect x="26" y="-9" width="6" height="18" rx="2" fill="#bfe6f5" />
          {cargo && <rect x="-24" y="-8" width="16" height="16" rx="2" fill="#c9905a" stroke="#8e5a2e" strokeWidth="1.5" />}
        </>
      ) : (
        <>
          <rect x="-24" y="-11" width="48" height="22" rx="6" fill="#e0483e" stroke="#9b2119" strokeWidth="2" />
          <rect x="12" y="-9" width="9" height="18" rx="2" fill="#bfe6f5" />
          <rect x="-20" y="-4" width="24" height="8" rx="2" fill="#6b4c9a" />
          {cargo && <rect x="-18" y="-9" width="14" height="14" rx="2" fill="#c9905a" stroke="#8e5a2e" strokeWidth="1.5" transform="translate(0 2)" />}
        </>
      )}
    </g>
  )
}

function FlightMark({ flight, now }: { flight: Flight; now: number }) {
  const age = now - Date.parse(flight.at)
  const duration = 3800
  if (age < 0 || age > duration + 600) return null
  const from = SITES[flight.from]
  const to = SITES[flight.to]
  const mid = { x: (from.x + to.x) / 2 + (flight.kind === 'fetch' ? 60 : -60), y: (from.y + to.y) / 2 - 120 }
  const curve = `M${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`
  const back = `M${to.x} ${to.y} Q ${mid.x + 40} ${mid.y + 40} ${from.x} ${from.y}`
  const t = clamp(age / duration)
  const along = (p: Pt, c: Pt, q: Pt, s: number) => ({
    x: (1 - s) * (1 - s) * p.x + 2 * (1 - s) * s * c.x + s * s * q.x,
    y: (1 - s) * (1 - s) * p.y + 2 * (1 - s) * s * c.y + s * s * q.y,
  })
  const fade = age > duration ? 1 - (age - duration) / 600 : 1
  if (flight.kind === 'notice') {
    const p = along(from, mid, to, t)
    return (
      <g opacity={fade} pointerEvents="none">
        <path d={curve} fill="none" stroke="#f2c230" strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" />
        <g transform={`translate(${p.x} ${p.y})`} filter="url(#soft)">
          <circle r="26" fill="#fff" />
          <path d="M0 -16c-7 0-11 5-11 12v7l-4 6h30l-4-6v-7c0-7-4-12-11-12Z" fill="#f2c230" />
          <circle cy="12" r="4" fill="#c99a00" />
        </g>
        <Tag at={mid} text={flight.label} tone="#c99a00" />
      </g>
    )
  }
  const going = t < 0.5
  const s = going ? t * 2 : (t - 0.5) * 2
  const p = going ? along(from, mid, to, s) : along(to, { x: mid.x + 40, y: mid.y + 40 }, from, s)
  return (
    <g opacity={fade} pointerEvents="none">
      <path d={curve} fill="none" stroke="#4aa3e8" strokeWidth="6" strokeLinecap="round" />
      <path d={back} fill="none" stroke="#2f86cc" strokeWidth="4" strokeDasharray="14 8" strokeLinecap="round" />
      <g transform={`translate(${p.x} ${p.y})`} filter="url(#soft)">
        <rect x="-24" y="-24" width="48" height="48" rx="12" fill="#fff" />
        <ellipse cy="-9" rx="14" ry="5" fill="#4aa3e8" />
        <path d="M-14 -9v18c0 3 6 5 14 5s14-2 14-5V-9c0 3-6 5-14 5s-14-2-14-5Z" fill="#2f86cc" />
      </g>
      <Tag at={{ x: mid.x + 20, y: mid.y + 20 }} text={flight.label} tone="#2f86cc" />
    </g>
  )
}

function Tag({ at, text, tone }: { at: Pt; text: string; tone: string }) {
  const width = text.length * 11 + 30
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <rect x={-width / 2} y="-20" width={width} height="36" rx="18" fill={tone} />
      <text y="5" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff" fontFamily="inherit">{text}</text>
    </g>
  )
}

function Confetti({ at, now, since }: { at: Pt; now: number; since: number }) {
  const age = (now - since) / 1000
  if (age > 6) return null
  const colors = ['#f2c230', '#e0483e', '#4aa3e8', '#3dbb5c', '#6b4c9a']
  return (
    <g pointerEvents="none">
      {Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * Math.PI * 2
        const speed = 120 + (i % 5) * 30
        const x = at.x + Math.cos(angle) * speed * Math.min(age, 1.2)
        const y = at.y - 60 + Math.sin(angle) * speed * Math.min(age, 1.2) * 0.6 + 60 * age * age
        return <rect key={i} x={x} y={y} width="10" height="16" rx="2" fill={colors[i % colors.length]} transform={`rotate(${i * 37 + age * 200} ${x} ${y})`} opacity={Math.max(0, 1 - age / 6)} />
      })}
    </g>
  )
}
