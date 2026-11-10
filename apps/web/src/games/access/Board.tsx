import type { ReactNode } from 'react'
import { BoxArt, ClipboardArt, ConnectorArt, RegistryArt, TruckArt } from '../../art/icons'
import { tr, type Lang } from '../../i18n'
import type { AccessLine, AccessNetwork, AccessRole, AccessTraining } from '../../types'

type Phases = NonNullable<AccessTraining['access']>['phases']

export function PhaseStrip({ phases }: { phases: Phases }) {
  return (
    <div className="access-phase-strip" data-testid="access-phase-strip">
      {phases.bands.map((band) => (
        <div
          key={band.id}
          className={`access-phase-band${band.active ? ' is-active' : ''}`}
          data-testid={`phase-${band.id}`}
        >
          <span className="access-phase-label">{band.rhythm} · {band.who}</span>
          <strong className="access-phase-count">{band.countLabel}</strong>
          <span className="access-phase-current">{band.current ?? ' '}</span>
        </div>
      ))}
      <div className={`access-phase-end${phases.debrief ? ' is-active' : ''}`} data-testid="phase-debrief">
        {phases.debriefLabel}
      </div>
    </div>
  )
}

function Line({ d, state, marker = true }: { d: string; state: AccessLine; marker?: boolean }) {
  return (
    <path
      d={d}
      className={`net-line is-${state}`}
      markerEnd={marker && state !== 'idle' ? `url(#net-arrow-${state})` : undefined}
    />
  )
}

function Bubble({ x, y, text, state }: { x: number; y: number; text: string; state: AccessLine }) {
  if (state === 'idle') return null
  const mark = state === 'ok' ? ' ✓' : state === 'failed' ? ' ✗' : ''
  const width = Math.max(110, (text.length + mark.length) * 10 + 28)
  return (
    <g className={`net-bubble is-${state}`} transform={`translate(${x - width / 2},${y - 20})`}>
      <rect width={width} height="40" rx="20" />
      <text x={width / 2} y="27" textAnchor="middle">{text}{mark}</text>
    </g>
  )
}

function Node({
  x, y, r, color, name, role, art, highlight, faded, badge,
}: {
  x: number
  y: number
  r: number
  color: string
  name: string
  role: string
  art: ReactNode
  highlight: boolean
  faded?: boolean
  badge?: ReactNode
}) {
  const scale = (r * 1.25) / 64
  return (
    <g className={`net-node${faded ? ' is-faded' : ''}`}>
      {highlight && <circle cx={x} cy={y} r={r + 12} className="net-glow" style={{ stroke: color }} />}
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth="5" strokeDasharray={faded ? '8 8' : undefined} />
      <g transform={`translate(${x - 32 * scale},${y - 34 * scale}) scale(${scale})`}>{art}</g>
      <text x={x} y={y + r + 30} textAnchor="middle" className="net-name" fill={color}>{name}</text>
      <text x={x} y={y + r + 54} textAnchor="middle" className="net-role">{role}</text>
      {badge}
    </g>
  )
}

export function AccessNetworkView({ network, lang }: { network: AccessNetwork; lang: Lang }) {
  const t = tr(lang).access
  const lines = network.lines
  const highlight = (role: AccessRole) => network.highlight === role
  const delta = network.delta
  const rows = network.orchestration.slice(-4)
  return (
    <svg viewBox="0 0 1000 760" className="access-net" role="img" aria-label="BDI" data-testid="access-network">
      <defs>
        {(['active', 'ok', 'failed'] as const).map((state) => (
          <marker key={state} id={`net-arrow-${state}`} markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" className={`net-arrowhead is-${state}`} />
          </marker>
        ))}
      </defs>
      <rect x="4" y="4" width="992" height="752" rx="28" className="net-backdrop" />

      <g className={`net-card${highlight('admin') ? ' is-highlight' : ''}`}>
        <rect x="30" y="24" width="350" height="186" rx="18" stroke="#1f6f8b" />
        <g transform="translate(44,36) scale(0.85)"><ClipboardArt /></g>
        <text x="106" y="62" className="net-card-title" fill="#1f6f8b">{t.association}</text>
        <text x="106" y="88" className="net-card-sub">{t.associationSub}</text>
        <text x="50" y="136" className="net-card-row">{t.members}: {t.member} ✓</text>
        <text x="50" y="174" className={`net-card-row status-${delta.status}`}>
          Delta: {delta.statusLabel}{delta.keyRegistered ? ` · ${t.key} ✓` : ''}
        </text>
      </g>

      <g className={`net-card${highlight('registry') ? ' is-highlight' : ''}`}>
        <rect x="620" y="24" width="350" height="186" rx="18" stroke="#3d5a80" />
        <g transform="translate(634,36) scale(0.85)"><RegistryArt /></g>
        <text x="696" y="62" className="net-card-title" fill="#3d5a80">{t.orchestration}</text>
        <text x="696" y="88" className="net-card-sub">{t.orchestrationSub}</text>
        {rows.map((row, index) => (
          <text
            key={`${row.transportId}-${row.carrier}-${row.status}`}
            x="640"
            y={128 + index * 24}
            className={`net-card-row small${row.status === 'ended' ? ' is-ended' : ''}${row.isDelta ? ' is-delta' : ''}`}
          >
            {row.transportId} · {row.carrier}{row.status === 'ended' ? ` (${t.ended})` : ''}
          </text>
        ))}
      </g>

      <Line d="M150 476 L188 214" state={lines.onboard} marker={false} />
      <Line d="M852 476 L812 214" state={lines.register} />
      <Line d="M452 480 C 430 390, 360 300, 300 216" state={lines.association} />
      <Line d="M548 480 C 570 390, 640 300, 700 216" state={lines.orchestration} />
      <Line d="M802 540 L578 540" state={lines.policy} />
      <Line d="M196 518 L424 518" state={lines.request} />
      <Line d="M424 570 L196 570" state={lines.data} />

      <Bubble x={372} y={350} text={t.askAssociation} state={lines.association} />
      <Bubble x={628} y={350} text={t.askOrchestration} state={lines.orchestration} />
      {network.requestLabel && lines.request !== 'idle' && (
        <text x="310" y="502" textAnchor="middle" className="net-label">{network.requestLabel}</text>
      )}
      {network.dataLabel && lines.data === 'ok' && (
        <text x="310" y="602" textAnchor="middle" className="net-label is-data">{network.dataLabel}</text>
      )}

      <Node
        x={130}
        y={540}
        r={62}
        color="#2e7d4f"
        name="Delta"
        role="Data Consumer"
        art={<TruckArt />}
        highlight={highlight('consumer')}
        faded={delta.status === 'none' || delta.status === 'pending'}
        badge={delta.status === 'suspended' ? (
          <g transform="translate(80,448)">
            <rect width="100" height="30" rx="15" className="net-badge-bad" />
            <text x="50" y="21" textAnchor="middle" className="net-badge-text">{delta.statusLabel}</text>
          </g>
        ) : undefined}
      />
      <Node
        x={500}
        y={540}
        r={70}
        color="#6b4c9a"
        name="LogiData"
        role="Data Service Provider"
        art={<ConnectorArt />}
        highlight={highlight('provider')}
        badge={(
          <g transform="translate(438,438)">
            <rect width="124" height="28" rx="14" fill="#6b4c9a" />
            <text x="62" y="19" textAnchor="middle" className="net-badge-text">{t.connector}</text>
          </g>
        )}
      />
      <Node
        x={870}
        y={540}
        r={62}
        color="#c46b2c"
        name="Atlas"
        role="Data Owner"
        art={<BoxArt arrow="up" />}
        highlight={highlight('owner')}
      />

      <g className={`net-policy${lines.policy !== 'idle' ? ` is-${lines.policy}` : ''}`} transform="translate(585,444)">
        <rect width="210" height="68" rx="12" />
        <text x="105" y="19" textAnchor="middle" className="net-policy-title">{t.policyChip} v{network.policy.version}</text>
        <text x="105" y="39" textAnchor="middle" className="net-policy-row">
          {t.loading} {network.policy.shareLoading ? '✓' : '✗'} · {t.finance} {network.policy.shareFinance ? '✓' : '✗'}
        </text>
        <text x="105" y="58" textAnchor="middle" className="net-policy-note">{t.policyEnforced}</text>
      </g>
      {lines.policy !== 'idle' && lines.policy !== 'active' && (
        <Bubble x={690} y={584} text={t.askPolicy} state={lines.policy} />
      )}

      <text x="500" y="734" textAnchor="middle" className="net-footer">{t.footer}</text>
    </svg>
  )
}
