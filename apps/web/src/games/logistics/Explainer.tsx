import { useState } from 'react'
import { BoxArt, TruckArt, VanArt, type Org } from '../../art/icons'
import { tr } from '../../i18n'
import { Caption } from '../../ui'

const PHASE_INDEX = { goals: 0, 'bdi-agreements': 1, 'bdi-roles': 2, 'bdi-flow': 3 } as const

export function Explainer({
  mode, introPhase, lang, onContinue, onSkip,
}: {
  mode: 'without_bdi' | 'with_bdi'
  introPhase: keyof typeof PHASE_INDEX
  lang: 'nl' | 'en'
  onContinue: () => void
  onSkip: () => void
}) {
  const t = tr(lang)
  const [local, setLocal] = useState(0)
  const bdi = mode === 'with_bdi'
  const slides = bdi ? t.explainerBdi : t.explainerRound1
  const index = bdi ? PHASE_INDEX[introPhase] : local
  const last = index >= slides.length - 1
  const next = () => {
    if (bdi || last) onContinue()
    else setLocal(local + 1)
  }
  const variant = bdi ? (['chain', 'association', 'roles', 'flow'] as const)[index] : (['chain', 'silo', 'watch'] as const)[index]
  return (
    <section className="explainer" aria-live="polite">
      <ChainArt variant={variant} />
      <div className="explainer-foot">
        <Caption>{slides[index]}</Caption>
        <div className="dots">{slides.map((s, i) => <span key={s} className={i === index ? 'on' : ''} />)}</div>
        <div className="actions">
          <button type="button" className="btn primary" data-testid="intro-continue" onClick={next}>{last ? t.continue : t.next}</button>
          {bdi && <button type="button" className="btn" onClick={onSkip}>{t.skipIntro}</button>}
        </div>
      </div>
    </section>
  )
}

const CHAIN: { org: Org; x: number }[] = [
  { org: 'seller', x: 160 },
  { org: 'carrier', x: 400 },
  { org: 'delivery', x: 640 },
  { org: 'buyer', x: 880 },
]

function Actor({ org, x, y }: { org: Org; x: number; y: number }) {
  return (
    <g transform={`translate(${x - 60} ${y - 60})`}>
      <circle cx="60" cy="60" r="62" fill="#fff" opacity="0.95" />
      <svg width="120" height="120" viewBox="0 0 64 64">
        {org === 'seller' && <BoxArt arrow="up" />}
        {org === 'buyer' && <BoxArt arrow="down" />}
        {org === 'carrier' && <TruckArt />}
        {org === 'delivery' && <VanArt />}
      </svg>
    </g>
  )
}

function Balloon({ x, y, glyph, faded = false }: { x: number; y: number; glyph: 'box' | 'clock' | 'person'; faded?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.45 : 1}>
      <g className="balloon">
      <path d="M-58 -44h116v70H14l-14 18-14-18h-44Z" fill="#fff" stroke="#1b2a4a" strokeWidth="2" />
      {glyph === 'box' && <svg x="-50" y="-40" width="60" height="60" viewBox="0 0 64 64"><path d="M10 22 32 12l22 10v24L32 57 10 46Z" fill="#c9905a" /><path d="M10 22 32 32l22-10L32 12Z" fill="#dca774" /></svg>}
      {glyph === 'clock' && <g transform="translate(-20 -10)"><circle r="22" fill="#fff" stroke="#6c7078" strokeWidth="5" /><path d="M0 0V-14M0 0h10" stroke="#1b2a4a" strokeWidth="4" strokeLinecap="round" /></g>}
      {glyph === 'person' && <g transform="translate(-20 -10)"><circle cy="-8" r="10" fill="#f1c6a8" /><path d="M-18 20c2-14 34-14 36 0Z" fill="#6b4c9a" /></g>}
      <text x="26" y="6" fontSize="44" fontWeight="900" fill="#1b2a4a">?</text>
      </g>
    </g>
  )
}

function ChainArt({ variant }: { variant: 'chain' | 'silo' | 'watch' | 'association' | 'roles' | 'flow' }) {
  return (
    <svg className="chain-art" viewBox="0 0 1040 560" role="img" aria-hidden="true">
      {(variant === 'chain' || variant === 'silo' || variant === 'watch') && (
        <>
          <path d="M100 330h780l0 -34 70 56 -70 56 0 -34H100Z" fill="#bfe6f5" opacity="0.8" />
          {CHAIN.map((c) => <Actor key={c.org} org={c.org} x={c.x} y={352} />)}
          {variant !== 'watch' && (
            <>
              <Balloon x={160} y={180} glyph="box" />
              <Balloon x={400} y={180} glyph="clock" />
              <Balloon x={640} y={180} glyph="person" faded={variant === 'chain'} />
              <Balloon x={880} y={180} glyph="clock" faded />
            </>
          )}
          {variant === 'silo' && CHAIN.map((c) => (
            <rect key={c.org} x={c.x - 90} y={250} width="180" height="210" rx="24" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="14 10" />
          ))}
          {variant === 'watch' && (
            <g transform="translate(520 150)">
              <rect x="-170" y="-90" width="340" height="170" rx="18" fill="#1b2a4a" />
              <rect x="-150" y="-72" width="300" height="130" rx="10" fill="#62aeb1" />
              <path d="M-120 30c40-70 110-80 160-40s70 20 80 30" fill="none" stroke="#7a8a43" strokeWidth="28" strokeLinecap="round" />
              <rect x="-30" y="80" width="60" height="30" fill="#1b2a4a" />
            </g>
          )}
        </>
      )}
      {variant === 'association' && (
        <>
          <circle cx="520" cy="290" r="200" fill="none" stroke="#fff" strokeWidth="6" strokeDasharray="18 12" />
          <text x="520" y="300" textAnchor="middle" fontSize="36" fontWeight="900" fill="#fff">Association</text>
          {CHAIN.map((c, i) => {
            const angle = (i / 4) * Math.PI * 2 - Math.PI / 4
            return <Actor key={c.org} org={c.org} x={520 + Math.cos(angle) * 200} y={290 + Math.sin(angle) * 200} />
          })}
        </>
      )}
      {variant === 'roles' && (
        <>
          {CHAIN.map((c) => (
            <g key={c.org}>
              <Actor org={c.org} x={c.x} y={230} />
              <g transform={`translate(${c.x - 50} ${330})`}>
                <rect width="100" height="130" rx="10" fill="#fff" stroke="#1b2a4a" strokeWidth="3" />
                {[30, 55, 80].map((y) => <rect key={y} x="18" y={y} width="64" height="8" rx="4" fill="#c3c9d3" />)}
                <circle cx="76" cy="108" r="16" fill="#3dbb5c" />
                <path d="M68 108l6 6 11-12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
              </g>
            </g>
          ))}
        </>
      )}
      {variant === 'flow' && (
        <>
          <Actor org="delivery" x={220} y={290} />
          <Actor org="seller" x={820} y={290} />
          <path d="M300 230 Q 520 90 740 230" fill="none" stroke="#f2c230" strokeWidth="10" strokeDasharray="6 18" strokeLinecap="round" />
          <g transform="translate(520 150)"><circle r="40" fill="#fff" /><path d="M0 -24c-11 0-17 8-17 18v10l-6 9h46l-6-9V-6c0-10-6-18-17-18Z" fill="#f2c230" /></g>
          <path d="M740 360 Q 520 480 300 360" fill="none" stroke="#2f86cc" strokeWidth="10" strokeLinecap="round" />
          <path d="M300 360 l 34 -6 -12 30Z" fill="#2f86cc" />
          <g transform="translate(520 430)"><rect x="-40" y="-40" width="80" height="80" rx="18" fill="#fff" /><ellipse cy="-14" rx="24" ry="8" fill="#4aa3e8" /><path d="M-24 -14v30c0 5 11 9 24 9s24-4 24-9v-30c0 5-11 9-24 9s-24-4-24-9Z" fill="#2f86cc" /></g>
        </>
      )}
    </svg>
  )
}
