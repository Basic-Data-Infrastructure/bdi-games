import type { CSSProperties } from 'react'
import { RoleIcon } from '../art/icons'
import { FactRow } from '../ui'
import type { Panel } from '../types'

export function RolePanel({
  panel, active, ask, reveal = false,
}: {
  panel: Panel | undefined
  active: boolean
  ask: boolean
  reveal?: boolean
}) {
  if (!panel) return null
  const org = panel.organizationId
  return (
    <article
      className={`role-panel${active || ask ? ' is-active' : ''}${reveal ? '' : ' is-sealed'}`}
      style={{ '--role': `var(--${org})` } as CSSProperties}
      data-testid={`panel-${org}`}
      aria-label={`${panel.roleLabel} — ${panel.name}`}
    >
      <header>
        <RoleIcon org={org} />
        <div>
          <h3>{panel.roleLabel}</h3>
          <small>{panel.name}</small>
        </div>
        {reveal && <span className="activity">{panel.activity}</span>}
      </header>
      {!reveal && <span className="activity">{panel.activity}</span>}
      {reveal && (
        <div className="facts">
          {panel.items.map((item) => <FactRow key={`${item.label}-${item.value}-${item.status}`} fact={item} />)}
        </div>
      )}
    </article>
  )
}
