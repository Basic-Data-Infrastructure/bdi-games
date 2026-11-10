import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { phoneBase } from './api'
import { BdiMark } from './art/BdiMark'
import {
  BellIcon, CheckBadge, ClockIcon, CrossBadge, DriverPortrait, isDriver, ProductIcon, RoleIcon, type Org,
} from './art/icons'

export function Qr({ path }: { path: string }) {
  const [href, setHref] = useState('')
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let stop = false
    void phoneBase().then((base) => {
      if (stop) return
      const next = `${base}/${path.replace(/^\//, '')}`
      setHref(next)
      void QRCode.toString(next, { type: 'svg', margin: 3, width: 320, color: { dark: '#1b2a4a', light: '#ffffff' } }).then((image) => {
        if (!stop) setSvg(image)
      })
    })
    return () => { stop = true }
  }, [path])
  return <div className="qr" data-join-url={href} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark${light ? ' is-light' : ''}`} role="img" aria-label="BDI Games">
      <BdiMark className="wordmark-mark" />
      <span className="wordmark-text">BDI Games</span>
    </span>
  )
}

export function VolumeIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8.5h3.6L11 4.2v15.6L6.6 15.5H3Z" fill="currentColor" />
      {!muted && (
        <>
          <path d="M14.2 8.4a4 4 0 0 1 0 7.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16.8 5.6a7.2 7.2 0 0 1 0 12.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {muted && <path d="M14 8.5 20.5 15M20.5 8.5 14 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}

export function FullscreenIcon({ exit = false }: { exit?: boolean }) {
  return (
    <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
      {exit ? (
        <>
          <path d="M9 4v5H4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 4v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 20v-5H4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 20v-5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M4 9V4h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 9V4h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 15v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.1 3.4h3.8l.4 2.1c.5.2 1 .4 1.4.8l2-.8 1.9 1.9-.8 2c.3.5.6 1 .8 1.4l2.1.4v3.8l-2.1.4c-.2.5-.4 1-.8 1.4l.8 2-1.9 1.9-2-.8c-.5.3-1 .6-1.4.8l-.4 2.1h-3.8l-.4-2.1c-.5-.2-1-.4-1.4-.8l-2 .8-1.9-1.9.8-2c-.3-.5-.6-1-.8-1.4l-2.1-.4v-3.8l2.1-.4c.2-.5.4-1 .8-1.4l-.8-2 1.9-1.9 2 .8c.5-.3 1-.6 1.4-.8l.4-2.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/** True when phones join over LAN (local/dev), not a public HTTPS host. */
export function isLanHost(hostname = window.location.hostname): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
}

export function timeOf(label: string): string | null {
  return label.match(/(\d{1,2}:\d{2})/)?.[1] ?? null
}

export function OptionArt({ id, label }: { id: string; label: string }) {
  if (isDriver(id)) return <DriverPortrait id={id} />
  if (['camera', 'phone', 'television'].includes(id)) return <ProductIcon id={id} />
  if (id === 'subscribe') return <BellIcon />
  const time = timeOf(label)
  if (time) return <ClockIcon time={time} />
  return null
}

export type TileState = 'neutral' | 'selected' | 'available' | 'wrong' | 'ok' | 'pending'

export function Tile({
  id, label, state = 'neutral', note, onClick, disabled, testId,
}: {
  id: string
  label: string
  state?: TileState
  note?: string | null
  onClick?: () => void
  disabled?: boolean
  testId?: string
}) {
  const art = <OptionArt id={id} label={label} />
  const body: ReactNode = (
    <>
      {art && <span className="tile-art">{art}</span>}
      <span className="tile-label">{label}</span>
      {note && <span className="tile-note">{note}</span>}
      {(state === 'selected' || state === 'ok') && <CheckBadge className="badge" />}
      {state === 'wrong' && <CrossBadge className="badge" />}
    </>
  )
  const className = `tile is-${state}`
  if (!onClick) return <div className={className} data-testid={testId}>{body}</div>
  return (
    <button type="button" className={className} data-testid={testId} onClick={onClick} disabled={disabled} aria-pressed={state === 'selected'}>
      {body}
    </button>
  )
}

export function Caption({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`caption ${className}`} role="status" aria-live="polite">{children}</p>
}

export function RoleBadge({ org, className }: { org: Org; className?: string }) {
  return <RoleIcon org={org} className={className} />
}

const PRODUCT_BY_NAME: Record<string, string> = {
  camera: 'camera', telefoon: 'phone', phone: 'phone', televisie: 'television', television: 'television',
}

const DRIVER_BY_NAME: Record<string, string> = {
  'Noor Bakker': 'carrier-noor',
  'Jamal de Vries': 'carrier-jamal',
  'Lin Vos': 'carrier-lin',
  'Sara Mendes': 'delivery-sara',
  'Otto Klein': 'delivery-otto',
  'Mina Rahimi': 'delivery-mina',
}

export function FactArt({ label, value }: { label: string; value: string }) {
  const product = PRODUCT_BY_NAME[value.toLowerCase()]
  if (product) return <ProductIcon id={product} />
  const driver = DRIVER_BY_NAME[value]
  if (driver) return <DriverPortrait id={driver} />
  const time = timeOf(value)
  if (time) return <ClockIcon time={time} />
  if (/eta/i.test(label)) return <ClockIcon time="12:00" />
  return <FolderGlyph />
}

function FolderGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 18c0-3 2-5 5-5h14l6 6h22c3 0 5 2 5 5v24c0 3-2 5-5 5H11c-3 0-5-2-5-5Z" fill="#9aa3b2" />
      <path d="M6 26h52v22c0 3-2 5-5 5H11c-3 0-5-2-5-5Z" fill="#c3c9d3" />
    </svg>
  )
}

export function FactRow({ fact }: { fact: { label: string; value: string; status?: string; statusLabel: string } }) {
  return (
    <div className={`fact st-${fact.status ?? 'source'}`}>
      <FactArt label={fact.label} value={fact.value} />
      <strong>{fact.label}: {fact.value}</strong>
      <em>{fact.statusLabel}</em>
    </div>
  )
}
