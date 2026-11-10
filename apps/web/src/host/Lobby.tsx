import type { CSSProperties } from 'react'
import { CheckBadge, RoleIcon } from '../art/icons'
import { tr } from '../i18n'
import { isLanHost, Qr } from '../ui'
import type { Training } from '../types'

export function Lobby({
  view, phoneUrl, onRelease, onStart, startLabel,
}: {
  view: Training
  phoneUrl: string
  onRelease: (org: string) => void
  onStart: () => void
  startLabel: string
}) {
  const t = tr(view.language)
  const lan = isLanHost()
  return (
    <section className="lobby">
      <div className="lobby-head">
        <span className="code" aria-label={t.sessionCode} data-testid="session-code">{view.code}</span>
        <p>{lan ? t.lobbyHintLocal(phoneUrl || t.lobbyWifi) : t.lobbyHintOnline}</p>
      </div>
      <div className="qr-grid" style={{ '--qr-cols': view.roles.length } as CSSProperties}>
        {view.roles.map((role) => (
          <article
            key={role.organizationId}
            className="qr-card"
            style={{ '--role': `var(--${role.organizationId})` } as CSSProperties}
            data-testid={`qr-${role.organizationId}`}
          >
            <header>
              <RoleIcon org={role.organizationId} />
              <div>
                <h2>{role.roleLabel}</h2>
                <small>{role.name}</small>
              </div>
            </header>
            <p className="blurb">{role.blurb}</p>
            {role.claimed ? (
              <div className="joined">
                <span className={role.ready ? 'ready-ring' : ''}><CheckBadge /></span>
                <span>{role.displayName ?? t.connected}</span>
              </div>
            ) : (
              <Qr path={`#/join?code=${view.code}&role=${role.organizationId}&invite=${role.inviteToken}`} />
            )}
            <footer>
              <span>{role.claimed ? (role.ready ? `✓ ${t.readyLabel}` : t.notReady) : t.waitingForPlayer}</span>
              {role.claimed && <button type="button" className="btn" onClick={() => onRelease(role.organizationId)}>{t.release}</button>}
            </footer>
          </article>
        ))}
      </div>
      <div className="lobby-foot">
        <button type="button" className="btn go" data-testid="start-round" disabled={!view.canStart} onClick={onStart}>{startLabel}</button>
      </div>
    </section>
  )
}
