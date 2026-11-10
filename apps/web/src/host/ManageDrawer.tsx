import { useState } from 'react'
import { RoleIcon } from '../art/icons'
import { tr } from '../i18n'
import type { LiveStatus } from '../live'
import type { Training } from '../types'

export type ManageAction = 'pause' | 'resume' | 'help' | 'restart' | 'finish'

export function ManageDrawer({
  view, live, sound, onSound, onAction, onReview, onLanguage, onClose,
}: {
  view: Training
  live: LiveStatus
  sound: boolean
  onSound: (on: boolean) => void
  onAction: (action: ManageAction) => void | Promise<void>
  onReview: () => void
  onLanguage: (language: 'nl' | 'en') => void
  onClose: () => void
}) {
  const t = tr(view.language)
  const [confirm, setConfirm] = useState<'restart' | 'finish' | null>(null)
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t.manage} data-testid="manage-drawer">
        <header>
          <h2>{t.manage}</h2>
          <button type="button" className="btn ghost" onClick={onClose} aria-label={t.close}>✕</button>
        </header>
        <div className="drawer-actions">
          <button type="button" className="btn primary" data-testid="toggle-pause" onClick={() => onAction(view.paused ? 'resume' : 'pause')} disabled={!view.round}>
            {view.paused ? t.resume : t.pause}
          </button>
          <button type="button" className="btn" data-testid="open-review" onClick={onReview} disabled={!view.round?.history.length}>{t.history}</button>
          <button type="button" className="btn" onClick={() => onAction('help')} disabled={!view.round}>{t.helpMark}{view.round?.helpCount ? ` (${view.round.helpCount})` : ''}</button>
          <button type="button" className="btn danger" onClick={() => setConfirm('restart')} disabled={!view.round}>{t.restart}</button>
          <button type="button" className="btn danger" onClick={() => setConfirm('finish')}>{t.finish}</button>
        </div>
        <h3>{t.connections}</h3>
        <ul className="conn">
          <li><span className={`conn-dot ${live === 'live' ? 'is-live' : live === 'polling' ? 'is-slow' : 'is-off'}`} />{t.host} · {t.connState[live] ?? live}</li>
          {view.roles.map((role) => (
            <li key={role.organizationId}>
              <span className={`conn-dot ${role.connection === 'connected' ? 'is-live' : role.connection === 'open' ? 'is-idle' : role.connection === 'reconnecting' ? 'is-slow' : 'is-off'}`} />
              <RoleIcon org={role.organizationId} />
              {role.roleLabel}{role.displayName ? ` · ${role.displayName}` : ''} · {t.connState[role.connection] ?? role.connection}
            </li>
          ))}
        </ul>
        <h3>{t.sessionLanguage}</h3>
        <div className="drawer-actions">
          <button type="button" className={`btn${view.language === 'nl' ? ' primary' : ''}`} onClick={() => onLanguage('nl')}>Nederlands</button>
          <button type="button" className={`btn${view.language === 'en' ? ' primary' : ''}`} onClick={() => onLanguage('en')}>English</button>
        </div>
        <h3>{t.sound}</h3>
        <div className="drawer-actions">
          <button type="button" className="btn" data-testid="toggle-sound" onClick={() => onSound(!sound)}>{sound ? t.soundOff : t.soundOn}</button>
        </div>
        <h3>{t.shortcuts}</h3>
        <p className="keys">{t.shortcutText}</p>
      </aside>
      {confirm && (
        <div className="confirm-dialog" role="alertdialog" aria-modal="true">
          <p>{confirm === 'restart' ? t.restart : t.finish}</p>
          <p>{t.confirmQuestion}</p>
          <div className="drawer-actions">
            <button type="button" className="btn danger" data-testid="confirm-yes" onClick={() => { void onAction(confirm); setConfirm(null); onClose() }}>{t.confirmYes}</button>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>{t.cancel}</button>
          </div>
        </div>
      )}
    </>
  )
}
