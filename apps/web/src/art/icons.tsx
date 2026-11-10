import type { ReactNode } from 'react'

export type Org = 'buyer' | 'seller' | 'carrier' | 'delivery'
export type AccessOrg = 'admin' | 'owner' | 'registry' | 'provider' | 'consumer'
export type AnyOrg = Org | AccessOrg

export const ORG_COLOR: Record<AnyOrg, string> = {
  buyer: '#1f6f8b',
  seller: '#c46b2c',
  carrier: '#2e7d4f',
  delivery: '#6b4c9a',
  admin: '#1f6f8b',
  owner: '#c46b2c',
  registry: '#3d5a80',
  provider: '#6b4c9a',
  consumer: '#2e7d4f',
}

function Art({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  )
}

const Shadow = ({ y = 58, w = 22 }: { y?: number; w?: number }) => <ellipse cx="32" cy={y} rx={w} ry="3.2" fill="#000" opacity="0.14" />

export function BoxArt({ arrow }: { arrow: 'up' | 'down' }) {
  return (
    <>
      <Shadow />
      <path d="M10 22 32 12l22 10v24L32 57 10 46Z" fill="#c9905a" />
      <path d="M32 32v25L10 46V22Z" fill="#b57a45" />
      <path d="M10 22 32 32l22-10L32 12Z" fill="#dca774" />
      <path d="m20 17.5 22 10v8l-4-2v-6l-22-10Z" fill="#8e5a2e" opacity="0.55" />
      <rect x="40" y="42" width="8" height="5" rx="1" transform="rotate(-24 44 44)" fill="#f4efe4" opacity="0.8" />
      {arrow === 'down' ? (
        <path d="M24 2h8v12h6L28 27 18 14h6Z" fill="#4c9a3d" stroke="#2f6f25" strokeWidth="1.5" strokeLinejoin="round" />
      ) : (
        <path d="M24 27h8V15h6L28 2 18 15h6Z" fill="#8a3d2a" stroke="#5f2515" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </>
  )
}

export function TruckArt() {
  return (
    <>
      <Shadow />
      <rect x="4" y="16" width="36" height="30" rx="4" fill="#f2c230" />
      <rect x="4" y="16" width="36" height="6" rx="3" fill="#ffd95a" />
      <path d="M40 24h11l9 11v11H40Z" fill="#e0483e" />
      <path d="M43 27h7l6 8H43Z" fill="#bfe6f5" />
      <rect x="40" y="40" width="20" height="6" fill="#b8352c" />
      <circle cx="15" cy="49" r="6.5" fill="#2b3040" />
      <circle cx="15" cy="49" r="2.8" fill="#a9b0bd" />
      <circle cx="49" cy="49" r="6.5" fill="#2b3040" />
      <circle cx="49" cy="49" r="2.8" fill="#a9b0bd" />
    </>
  )
}

export function VanArt() {
  return (
    <>
      <Shadow />
      <path d="M6 26h30v18H6Z" fill="#e0483e" />
      <path d="M36 22h12l10 12v10H36Z" fill="#e0483e" />
      <path d="M39 25h8l7 9H39Z" fill="#bfe6f5" />
      <rect x="6" y="26" width="30" height="5" fill="#f06b61" />
      <rect x="10" y="33" width="20" height="6" rx="2" fill="#6b4c9a" />
      <rect x="54" y="37" width="4" height="3" rx="1" fill="#ffd95a" />
      <circle cx="17" cy="47" r="6.5" fill="#2b3040" />
      <circle cx="17" cy="47" r="2.8" fill="#a9b0bd" />
      <circle cx="47" cy="47" r="6.5" fill="#2b3040" />
      <circle cx="47" cy="47" r="2.8" fill="#a9b0bd" />
    </>
  )
}

export function ClipboardArt() {
  return (
    <>
      <Shadow />
      <rect x="14" y="10" width="36" height="46" rx="5" fill="#f4efe4" />
      <rect x="14" y="10" width="36" height="10" rx="5" fill="#1f6f8b" />
      <rect x="24" y="6" width="16" height="10" rx="3" fill="#c9905a" />
      <rect x="22" y="28" width="20" height="3" rx="1.5" fill="#1f6f8b" opacity="0.7" />
      <rect x="22" y="36" width="16" height="3" rx="1.5" fill="#1f6f8b" opacity="0.45" />
      <rect x="22" y="44" width="18" height="3" rx="1.5" fill="#1f6f8b" opacity="0.45" />
      <circle cx="46" cy="48" r="10" fill="#2fa35a" />
      <path d="M41 48l3 3 7-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

export function ConnectorArt() {
  return (
    <>
      <Shadow />
      <rect x="8" y="22" width="20" height="20" rx="4" fill="#6b4c9a" />
      <rect x="36" y="22" width="20" height="20" rx="4" fill="#6b4c9a" />
      <rect x="26" y="29" width="12" height="6" rx="2" fill="#f2c230" />
      <circle cx="18" cy="32" r="4" fill="#f4efe4" />
      <circle cx="46" cy="32" r="4" fill="#f4efe4" />
      <path d="M18 14v8M46 14v8M18 42v8M46 42v8" stroke="#2b3040" strokeWidth="3" strokeLinecap="round" />
    </>
  )
}

export function RegistryArt() {
  return (
    <>
      <Shadow />
      <rect x="12" y="10" width="40" height="46" rx="6" fill="#3d5a80" />
      <rect x="18" y="18" width="28" height="4" rx="2" fill="#f4efe4" opacity="0.9" />
      <rect x="18" y="28" width="22" height="3" rx="1.5" fill="#9eb6d4" />
      <rect x="18" y="36" width="26" height="3" rx="1.5" fill="#9eb6d4" />
      <rect x="18" y="44" width="18" height="3" rx="1.5" fill="#9eb6d4" />
      <circle cx="44" cy="46" r="8" fill="#f2c230" />
      <path d="M41 46h6M44 43v6" stroke="#1b2a4a" strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

export function RoleIcon({ org, className, label }: { org: string; className?: string; label?: string }) {
  return (
    <Art className={className} label={label}>
      {org === 'buyer' && <BoxArt arrow="down" />}
      {org === 'seller' && <BoxArt arrow="up" />}
      {org === 'carrier' && <TruckArt />}
      {org === 'delivery' && <VanArt />}
      {org === 'admin' && <ClipboardArt />}
      {org === 'owner' && <BoxArt arrow="up" />}
      {org === 'registry' && <RegistryArt />}
      {org === 'provider' && <ConnectorArt />}
      {org === 'consumer' && <TruckArt />}
    </Art>
  )
}

export function ProductIcon({ id, className }: { id: string; className?: string }) {
  return (
    <Art className={className}>
      <Shadow />
      {id === 'camera' && (
        <>
          <rect x="6" y="20" width="52" height="32" rx="7" fill="#3b4254" />
          <path d="M20 20l4-7h16l4 7Z" fill="#2b3040" />
          <rect x="6" y="26" width="52" height="6" fill="#4b5468" />
          <circle cx="32" cy="36" r="12" fill="#1c212c" />
          <circle cx="32" cy="36" r="8" fill="#4aa3e8" />
          <circle cx="29" cy="33" r="2.6" fill="#fff" opacity="0.8" />
          <rect x="46" y="23" width="7" height="4" rx="1.5" fill="#f2c230" />
        </>
      )}
      {id === 'phone' && (
        <>
          <rect x="18" y="4" width="28" height="52" rx="6" fill="#2b3040" />
          <rect x="21" y="9" width="22" height="40" rx="2" fill="#56b8e6" />
          <path d="M21 34 33 22l10 10v17H21Z" fill="#3dbb5c" opacity="0.85" />
          <circle cx="37" cy="16" r="3" fill="#f2c230" />
          <rect x="28" y="51" width="8" height="2" rx="1" fill="#6c7078" />
        </>
      )}
      {id === 'television' && (
        <>
          <rect x="4" y="10" width="56" height="36" rx="5" fill="#2b3040" />
          <rect x="8" y="14" width="48" height="28" rx="2" fill="#56b8e6" />
          <path d="M8 34c10-8 18 4 28-4s14 2 20-2v14H8Z" fill="#3dbb5c" opacity="0.85" />
          <circle cx="46" cy="21" r="3.5" fill="#f2c230" />
          <path d="M24 46h16l3 8H21Z" fill="#3b4254" />
        </>
      )}
    </Art>
  )
}

export function ClockIcon({ time, className }: { time: string; className?: string }) {
  const [h, m] = time.split(':').map(Number)
  const minuteAngle = (m / 60) * 360
  const hourAngle = (((h % 12) + m / 60) / 12) * 360
  return (
    <Art className={className} label={time}>
      <Shadow />
      <circle cx="32" cy="31" r="25" fill="#9aa3b2" />
      <circle cx="32" cy="31" r="21" fill="#fff" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="31" y="12" width="2" height={i % 3 === 0 ? 5 : 3} rx="1" fill="#6c7078" transform={`rotate(${i * 30} 32 31)`} />
      ))}
      <rect x="30.2" y="18" width="3.6" height="14" rx="1.8" fill="#1b2a4a" transform={`rotate(${hourAngle} 32 31)`} />
      <rect x="31" y="13" width="2" height="19" rx="1" fill="#e0483e" transform={`rotate(${minuteAngle} 32 31)`} />
      <circle cx="32" cy="31" r="2.6" fill="#1b2a4a" />
    </Art>
  )
}

type Look = {
  skin: string
  hair: string
  style: 'long' | 'short' | 'bob' | 'curly' | 'beard' | 'scarf'
  cap: boolean
  org: Org
  scarf?: string
}

const DRIVERS: Record<string, Look> = {
  'carrier-noor': { skin: '#f3c9a5', hair: '#f0c24a', style: 'long', cap: false, org: 'carrier' },
  'carrier-jamal': { skin: '#8a5a3b', hair: '#1f1a17', style: 'short', cap: true, org: 'carrier' },
  'carrier-lin': { skin: '#efcfae', hair: '#23201f', style: 'bob', cap: false, org: 'carrier' },
  'delivery-sara': { skin: '#c68e63', hair: '#5b3620', style: 'curly', cap: false, org: 'delivery' },
  'delivery-otto': { skin: '#f1c6a8', hair: '#b9b2a8', style: 'beard', cap: true, org: 'delivery' },
  'delivery-mina': { skin: '#d7a47f', hair: '#2b2220', style: 'scarf', cap: false, org: 'delivery', scarf: '#2fa39a' },
}

export function isDriver(id: string): boolean {
  return id in DRIVERS
}

export function DriverPortrait({ id, className, label }: { id: string; className?: string; label?: string }) {
  const look = DRIVERS[id] ?? DRIVERS['carrier-noor']
  const uniform = ORG_COLOR[look.org]
  return (
    <Art className={className} label={label}>
      <circle cx="32" cy="32" r="31" fill="#dfe9f2" />
      <path d="M8 64c2-14 11-20 24-20s22 6 24 20Z" fill={uniform} />
      <path d="M26 44h12l-6 10Z" fill="#fff" />
      <path d="M31 47h2l1 9h-4Z" fill="#1b2a4a" />
      <rect x="40" y="52" width="7" height="4" rx="1" fill="#f2c230" />
      {look.style === 'long' && <path d="M17 30c0-12 7-18 15-18s15 6 15 18v16H17Z" fill={look.hair} />}
      {look.style === 'scarf' && <path d="M15 34c0-14 7-22 17-22s17 8 17 22v12c-4 3-10 4-17 4s-13-1-17-4Z" fill={look.scarf} />}
      <rect x="28" y="36" width="8" height="8" fill={look.skin} />
      <ellipse cx="32" cy="28" rx="11" ry="12.5" fill={look.skin} />
      {look.style === 'short' && <path d="M21 25c0-8 5-12 11-12s11 4 11 12c-3-4-7-5-11-5s-8 1-11 5Z" fill={look.hair} />}
      {look.style === 'bob' && <path d="M19 32c-1-12 5-19 13-19s14 7 13 19l-4-1c0-6-3-10-9-11-4 3-8 5-10 12Z" fill={look.hair} />}
      {look.style === 'long' && <path d="M21 25c1-7 5-11 11-11s10 4 11 11c-4-3-8-6-11-6-3 2-7 4-11 6Z" fill={look.hair} />}
      {look.style === 'curly' && (
        <g fill={look.hair}>
          {[[22, 20], [27, 15], [33, 14], [39, 16], [43, 21], [20, 27], [44, 28]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" />)}
        </g>
      )}
      {look.style === 'beard' && (
        <>
          <path d="M22 22c1-6 5-9 10-9s9 3 10 9Z" fill={look.hair} />
          <path d="M21 29c1 9 5 13 11 13s10-4 11-13c-2 3-5 4-11 4s-9-1-11-4Z" fill={look.hair} />
        </>
      )}
      {look.style === 'scarf' && <path d="M20 26c0-8 5-13 12-13s12 5 12 13c-3-4-7-6-12-6s-9 2-12 6Z" fill={look.scarf} />}
      <circle cx="27.5" cy="29" r="1.6" fill="#1f1a17" />
      <circle cx="36.5" cy="29" r="1.6" fill="#1f1a17" />
      <path d="M28.5 35c2 1.6 5 1.6 7 0" stroke="#8a3d2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {look.cap && (
        <>
          <path d="M19 22c1-7 6-11 13-11s12 4 13 11Z" fill={uniform} />
          <path d="M18 22h28c0 2-2 3-4 3H22c-2 0-4-1-4-3Z" fill="#1b2a4a" />
          <rect x="29" y="14" width="6" height="4" rx="1" fill="#f2c230" />
        </>
      )}
    </Art>
  )
}

export function BellIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow />
      <path d="M32 8c-9 0-15 7-15 16v10l-5 8h40l-5-8V24c0-9-6-16-15-16Z" fill="#f2c230" />
      <path d="M22 24c0-6 4-10 9-11" stroke="#fff" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
      <circle cx="32" cy="48" r="5" fill="#c99a00" />
      <circle cx="32" cy="7" r="3" fill="#c99a00" />
    </Art>
  )
}

export function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow />
      <rect x="6" y="14" width="52" height="36" rx="5" fill="#fff" stroke="#9aa3b2" strokeWidth="2" />
      <path d="M8 17 32 35 56 17" stroke="#4aa3e8" strokeWidth="4" fill="none" strokeLinejoin="round" />
    </Art>
  )
}

export function DataIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow />
      <ellipse cx="32" cy="14" rx="20" ry="7" fill="#4aa3e8" />
      <path d="M12 14v30c0 4 9 7 20 7s20-3 20-7V14c0 4-9 7-20 7s-20-3-20-7Z" fill="#2f86cc" />
      <path d="M12 29c0 4 9 7 20 7s20-3 20-7" stroke="#bfe6f5" strokeWidth="2.5" fill="none" />
    </Art>
  )
}

export function GateIcon({ open, className }: { open?: boolean; className?: string }) {
  return (
    <Art className={className}>
      <Shadow />
      <rect x="8" y="22" width="8" height="34" rx="2" fill="#3b4254" />
      <g transform={open ? 'rotate(-70 12 26)' : undefined}>
        <rect x="12" y="23" width="46" height="7" rx="3" fill="#fff" stroke="#3b4254" strokeWidth="1.5" />
        {[18, 30, 42].map((x) => <rect key={x} x={x} y="23" width="6" height="7" fill="#e0483e" />)}
      </g>
      <circle cx="12" cy="17" r="4" fill={open ? '#3dbb5c' : '#e0483e'} />
    </Art>
  )
}

export function CheckBadge({ className }: { className?: string }) {
  return (
    <Art className={className} label="✓">
      <rect x="4" y="4" width="56" height="56" rx="12" fill="#3dbb5c" stroke="#fff" strokeWidth="4" />
      <path d="M17 33l10 10 20-22" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Art>
  )
}

export function CrossBadge({ className }: { className?: string }) {
  return (
    <Art className={className} label="✗">
      <rect x="4" y="4" width="56" height="56" rx="12" fill="#e0483e" stroke="#fff" strokeWidth="4" />
      <path d="M20 20l24 24M44 20 20 44" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    </Art>
  )
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <circle cx="32" cy="32" r="26" fill="#56b8e6" />
      <rect x="28.5" y="27" width="7" height="20" rx="3.5" fill="#fff" />
      <circle cx="32" cy="19" r="4.2" fill="#fff" />
    </Art>
  )
}

export function CallIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <circle cx="32" cy="32" r="26" fill="#3dbb5c" />
      <path d="M22 17c2-1 4 0 5 2l3 6c1 2 0 3-1 4l-2 2c2 4 5 7 9 9l2-2c1-1 2-2 4-1l6 3c2 1 3 3 2 5l-2 4c-1 2-4 3-7 2-11-3-20-12-23-23-1-3 0-6 2-7Z" fill="#fff" />
    </Art>
  )
}

export function PackageIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path d="M10 22 32 12l22 10v24L32 57 10 46Z" fill="#c9905a" />
      <path d="M32 32v25L10 46V22Z" fill="#b57a45" />
      <path d="M10 22 32 32l22-10L32 12Z" fill="#dca774" />
    </Art>
  )
}

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow />
      <path d="M18 8h28v14c0 9-6 16-14 16s-14-7-14-16Z" fill="#f2c230" />
      <path d="M18 12H9c0 9 4 14 11 15M46 12h9c0 9-4 14-11 15" stroke="#c99a00" strokeWidth="4" fill="none" />
      <rect x="28" y="37" width="8" height="9" fill="#c99a00" />
      <rect x="20" y="46" width="24" height="8" rx="2" fill="#1b2a4a" />
      <path d="M26 14c0 6 1 10 4 13" stroke="#fff" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
    </Art>
  )
}

export function TaskIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <rect x="12" y="8" width="40" height="50" rx="6" fill="currentColor" opacity="0.18" />
      <rect x="12" y="8" width="40" height="50" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M21 26l5 5 10-10M21 44h22" stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Art>
  )
}

export function FolderIcon({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path d="M6 16c0-3 2-5 5-5h14l6 6h22c3 0 5 2 5 5v26c0 3-2 5-5 5H11c-3 0-5-2-5-5Z" fill="currentColor" opacity="0.18" />
      <path d="M6 16c0-3 2-5 5-5h14l6 6h22c3 0 5 2 5 5v26c0 3-2 5-5 5H11c-3 0-5-2-5-5Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    </Art>
  )
}

export function BellOutline({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path d="M32 8c-9 0-15 7-15 16v10l-5 8h40l-5-8V24c0-9-6-16-15-16Z" fill="currentColor" opacity="0.18" />
      <path d="M32 8c-9 0-15 7-15 16v10l-5 8h40l-5-8V24c0-9-6-16-15-16Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M26 48a6 6 0 0 0 12 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </Art>
  )
}
