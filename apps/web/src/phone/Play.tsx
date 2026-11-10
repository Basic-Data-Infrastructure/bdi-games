import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import {
  BellIcon, BellOutline, CheckBadge, CrossBadge, DataIcon, EnvelopeIcon, FolderIcon, InfoIcon, RoleIcon, TaskIcon,
} from '../art/icons'
import { AccessPlay } from '../games/access/Play'
import { ROLE_NAMES, tr, useDocumentLang } from '../i18n'
import { useLive } from '../live'
import type { AccessPlayer, Player } from '../types'
import { FactRow, Tile, type TileState } from '../ui'

type Tab = 'task' | 'info' | 'notices'

export function Play() {
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const gameHint = params.get('game')
  const live = useLive<Player | AccessPlayer>(sessionId, { kind: 'player' })
  const gameId = live.data?.gameId ?? gameHint

  if (!live.data) {
    const t = tr(null)
    return (
      <main className="phone-app">
        <div className="phone-body">
          <section className="waiting-card">
            <InfoIcon />
            <h2>
              {live.error
                ? (live.error.status === 403 || live.error.status === 404 ? t.sessionClosed : live.error.message)
                : t.reconnecting}
            </h2>
          </section>
        </div>
      </main>
    )
  }

  if (gameId === 'access') {
    return (
      <AccessPlay
        sessionId={sessionId}
        data={live.data as AccessPlayer}
        status={live.status}
        error={live.error}
        refresh={live.refresh}
      />
    )
  }

  return <LogisticsPlay sessionId={sessionId} data={live.data as Player} status={live.status} error={live.error} refresh={live.refresh} />
}

function LogisticsPlay({
  sessionId, data: view, status, error, refresh,
}: {
  sessionId: string
  data: Player | null
  status: string
  error: { message: string; status?: number } | null
  refresh: () => void
}) {
  const [tab, setTab] = useState<Tab>('task')
  const [pending, setPending] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const seenNotices = useRef(0)
  useDocumentLang(view?.language)

  useEffect(() => {
    if (!sessionId) return
    const beat = () => void api(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' }).catch(() => undefined)
    beat()
    const timer = setInterval(beat, 5000)
    return () => clearInterval(timer)
  }, [sessionId])

  const stepKey = view?.round ? `${view.round.id}:${view.round.stepId}:${view.round.stateVersion}` : ''
  useEffect(() => { setPending(null) }, [stepKey])
  useEffect(() => { if (tab === 'notices') seenNotices.current = view?.round?.notifications.length ?? 0 }, [tab, view?.round?.notifications.length])

  const t = tr(view?.language)

  if (!view) {
    return (
      <main className="phone-app">
        <div className="phone-body">
          <section className="waiting-card">
            <InfoIcon />
            <h2>{error ? (error.status === 403 || error.status === 404 ? t.sessionClosed : error.message) : t.reconnecting}</h2>
          </section>
        </div>
      </main>
    )
  }

  const round = view.round
  const task = round?.task ?? null

  async function choose(value: string) {
    if (!round || pending) return
    setPending(value)
    setActionError('')
    try {
      await api(`/api/sessions/${sessionId}/actions`, {
        method: 'POST',
        body: JSON.stringify({ roundId: round.id, stepId: round.stepId, expectedStateVersion: round.stateVersion, actionId: crypto.randomUUID(), value }),
      })
    } catch (err) {
      setPending(null)
      // The step moved on while this tap was on its way; the refresh below shows the current task.
      const code = (err as { body?: { error?: string } }).body?.error
      if (code === 'bad_step' || code === 'conflict' || code === 'presentation') return
      setActionError(err instanceof Error ? err.message : t.offline)
    } finally {
      void refresh()
    }
  }

  async function ready() {
    try {
      await api(`/api/sessions/${sessionId}/ready`, { method: 'POST' })
    } finally {
      void refresh()
    }
  }

  const stateFor = (id: string): TileState => {
    if (pending === id) return 'pending'
    if (task?.selectedOptionId === id) {
      if (task.feedbackOk === false) return 'wrong'
      if (task.feedbackOk === true) return 'ok'
      return 'selected'
    }
    if (task?.highlightOptionId === id) return 'available'
    return 'neutral'
  }

  const optionCount = task?.options.length ?? 0
  const tilesClass = optionCount === 1 ? 'tiles one' : optionCount === 2 || optionCount === 4 ? 'tiles two' : 'tiles'
  const unseen = Math.max(0, (round?.notifications.length ?? 0) - seenNotices.current)
  const roleName = view.organizationName

  return (
    <main className="phone-app" style={{ '--role': `var(--${view.role})` } as CSSProperties} data-testid={`phone-${view.role}`}>
      <header className="phone-head">
        <span className="role-badge"><RoleIcon org={view.role} /></span>
        <div>
          <h1>{ROLE_NAMES[view.language][view.role as keyof typeof ROLE_NAMES.nl]}</h1>
          <small>
            <span className={`conn-dot${status === 'live' ? '' : ' off'}`} />
            {roleName}{view.displayName ? ` · ${view.displayName}` : ''}
          </small>
        </div>
        {round && <span className="clock-pill" data-testid="phone-sim">{view.paused ? t.paused : round.simLabel}</span>}
      </header>

      <div className="phone-body">
        {status === 'offline' && <p className="error-bar">{t.offline}</p>}
        {actionError && <p className="error-bar" role="alert">{actionError}</p>}

        {!round && (
          <section className="waiting-card">
            <RoleIcon org={view.role} />
            <h2>{t.youAre} {ROLE_NAMES[view.language][view.role as keyof typeof ROLE_NAMES.nl].toLowerCase()}</h2>
            <p>{roleName}</p>
            {view.ready ? (
              <p data-testid="ready-wait">{t.readyWait}</p>
            ) : (
              <button type="button" className="btn go ready-btn" data-testid="ready" onClick={() => void ready()}>{t.imReady}</button>
            )}
          </section>
        )}

        {round && tab === 'task' && (
          <>
            {view.paused && (
              <section className="waiting-card"><InfoIcon /><h2>{t.pausedPhone}</h2></section>
            )}
            {!view.paused && round.delivered && (
              <section className="waiting-card done-card" data-testid="delivered"><CheckBadge /><h2>{t.roundDone}</h2></section>
            )}
            {!view.paused && !round.delivered && task && (
              <section className="task-card" data-testid="task">
                <h2>{task.prompt}</h2>
                {task.hint && <p className="hint-text"><InfoIcon />{task.hint}</p>}
                {task.fetching && <p className="fetching"><DataIcon />{t.fetchingData}</p>}
                <div className={tilesClass}>
                  {task.options.map((option) => (
                    <Tile
                      key={option.id}
                      id={option.id}
                      label={option.label}
                      state={stateFor(option.id)}
                      note={task.highlightOptionId === option.id ? task.highlightLabel : pending === option.id ? t.sending : null}
                      disabled={!round.canAnswer || Boolean(pending)}
                      onClick={() => void choose(option.id)}
                      testId={`option-${option.id}`}
                    />
                  ))}
                </div>
                {task.feedback && (
                  <p className={`feedback ${task.feedbackOk ? 'ok' : 'bad'}`} data-testid="phone-feedback" role="status">
                    {task.feedbackOk ? <CheckBadge /> : <CrossBadge />}
                    {task.feedback}
                  </p>
                )}
              </section>
            )}
            {!view.paused && !round.delivered && !task && (
              <section className="waiting-card" data-testid="waiting">
                {round.actorRole ? <RoleIcon org={round.actorRole} /> : <EnvelopeIcon />}
                <h2>{round.waitingFor ?? t.readyWait}</h2>
              </section>
            )}
          </>
        )}

        {round && tab === 'info' && (
          <section className="dossier" data-testid="dossier">
            {round.dossier.length === 0 && <p className="empty">{t.noInfo}</p>}
            {round.dossier.map((item) => <FactRow key={`${item.label}-${item.value}`} fact={item} />)}
          </section>
        )}

        {round && tab === 'notices' && (
          <section className="dossier" data-testid="notices">
            {round.notifications.length === 0 && <p className="empty">{t.noNotices}</p>}
            {[...round.notifications].reverse().map((item) => (
              <p key={item.id} className="notice">
                <BellIcon />
                <span>{item.text}</span>
                <span className={`state ${item.status}`}>{t.noticeState[item.status] ?? item.status}</span>
              </p>
            ))}
          </section>
        )}
      </div>

      {round && (
        <nav className="phone-nav" aria-label={roleName}>
          <button type="button" aria-current={tab === 'task' ? 'page' : undefined} onClick={() => setTab('task')}><TaskIcon />{t.tabTask}</button>
          <button type="button" aria-current={tab === 'notices' ? 'page' : undefined} onClick={() => setTab('notices')} data-testid="tab-notices">
            <BellOutline />{t.tabNotices}
            {unseen > 0 && tab !== 'notices' && <span className="count">{unseen}</span>}
          </button>
          <button type="button" aria-current={tab === 'info' ? 'page' : undefined} onClick={() => setTab('info')} data-testid="tab-info"><FolderIcon />{t.tabInfo}</button>
        </nav>
      )}
    </main>
  )
}
