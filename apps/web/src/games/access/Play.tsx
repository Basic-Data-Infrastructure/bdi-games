import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '../../api'
import { CheckBadge, CrossBadge, RoleIcon } from '../../art/icons'
import { tr, useDocumentLang, type Lang } from '../../i18n'
import type { LiveStatus } from '../../live'
import type { AccessPlayer, AccessTask } from '../../types'
import { RequestDetails } from './Card'
import { useAccessAction } from './Host'

type Live = {
  data: AccessPlayer | null
  status: LiveStatus | string
  error: { message: string; status?: number } | null
  refresh: () => void | Promise<void>
}

type Access = NonNullable<AccessPlayer['access']>
type Act = (body: Record<string, unknown>) => void

export function AccessPlay({
  sessionId,
  data: view,
  status,
  error,
  refresh,
}: {
  sessionId: string
} & Live) {
  const { post, pending, error: actionError } = useAccessAction(sessionId, refresh)
  const [readyError, setReadyError] = useState('')
  const [dismissed, setDismissed] = useState<string[]>([])
  const dismiss = (id: string) => setDismissed((ids) => [...ids, id])
  useDocumentLang(view?.language)

  useEffect(() => {
    if (!sessionId) return
    const beat = () => void api(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' }).catch(() => undefined)
    beat()
    const timer = setInterval(beat, 5000)
    return () => clearInterval(timer)
  }, [sessionId])

  if (!view) {
    return (
      <main className="phone-app">
        <div className="phone-body">
          <section className="waiting-card">
            <h2>{error ? error.message : tr(null).reconnecting}</h2>
          </section>
        </div>
      </main>
    )
  }

  const t = tr(view.language)
  const access = view.access
  const act: Act = (body) => {
    if (pending || !access) return
    void post({ ...body, expectedVersion: access.version, actionId: crypto.randomUUID() })
  }
  const predict = (outcome: string) => {
    if (pending || !access?.predict) return
    void post({ type: 'predict', requestId: access.predict.requestId, outcome, actionId: crypto.randomUUID() })
  }

  return (
    <main className="phone-app access-phone" style={{ '--role': `var(--${view.role})` } as CSSProperties} data-testid={`phone-${view.role}`}>
      <header className="phone-head">
        <span className="role-badge"><RoleIcon org={view.role} /></span>
        <div>
          <h1>{view.roleLabel}</h1>
          <small>
            <span className={`conn-dot${status === 'live' ? '' : ' off'}`} />
            {view.organizationName}
          </small>
        </div>
        {access?.score && access.score.of > 0 && <span className="clock-pill">{access.score.points}/{access.score.of}</span>}
      </header>
      <div className="phone-body phone-body-plain">
        {(readyError || actionError || (status === 'offline' && t.offline)) && (
          <p className="error-bar" role="alert">{readyError || actionError || t.offline}</p>
        )}
        {!access && (
          <section className="waiting-card">
            <RoleIcon org={view.role} />
            <h2>{t.youAre} {view.roleLabel.toLowerCase()}</h2>
            {view.ready ? (
              <p data-testid="ready-wait">{t.readyWait}</p>
            ) : (
              <button
                type="button"
                className="btn go ready-btn"
                data-testid="ready"
                onClick={() => {
                  setReadyError('')
                  void api(`/api/sessions/${sessionId}/ready`, { method: 'POST' })
                    .then(() => refresh())
                    .catch((err: Error) => setReadyError(err.message))
                }}
              >
                {t.imReady}
              </button>
            )}
          </section>
        )}
        {access && (
          <>
            {view.paused && <p className="feedback bad">{t.pausedPhone}</p>}
            {access.feedback && !dismissed.includes(access.feedback.id) && (
              <div className={`feedback access-notice ${access.feedback.ok ? 'ok' : 'bad'}`} data-testid="access-feedback">
                {access.feedback.ok ? <CheckBadge /> : <CrossBadge />}
                <span>{access.feedback.text}</span>
                <button type="button" className="btn" data-testid="dismiss-feedback" onClick={() => dismiss(access.feedback!.id)}>
                  {t.access.ok}
                </button>
              </div>
            )}
            {access.lastResult && !dismissed.includes(access.lastResult.id) && (
              <LastResult result={access.lastResult} lang={view.language} onDismiss={() => dismiss(access.lastResult!.id)} />
            )}
            {access.task ? (
              <TaskCard key={`${access.scene}-${access.version}`} task={access.task} lang={view.language} pending={pending} act={act} />
            ) : access.predict ? null : access.debrief ? null : (
              <section className="waiting-card compact" data-testid="access-waiting">
                <p>{access.waitingFor}</p>
              </section>
            )}
            {access.predict && <PredictCard predict={access.predict} lang={view.language} pending={pending} onPredict={predict} />}
            {access.debrief && <PhoneDebrief access={access} lang={view.language} />}
            {access.received.length > 0 && (
              <section className="task-card">
                <h3>{t.access.received}</h3>
                {access.received.map((item) => (
                  <div key={item.cardId} className={`fact ${item.stale ? 'st-stale-keep' : 'st-received'}`} data-testid={`received-${item.cardId}`}>
                    <strong>{item.title}</strong>
                    <em>{item.label}</em>
                    <p>{item.payload}</p>
                  </div>
                ))}
              </section>
            )}
            <SidePanel side={access.side} lang={view.language} />
            {access.message && <p className="access-phone-message">{access.message}</p>}
          </>
        )}
      </div>
    </main>
  )
}

function TaskCard({ task, lang, pending, act }: { task: AccessTask; lang: Lang; pending: boolean; act: Act }) {
  const t = tr(lang).access
  const [selected, setSelected] = useState<string[]>(task.kind === 'dossier' ? task.selected : [])
  const [policy, setPolicy] = useState(task.kind === 'policy'
    ? { shareLoading: task.shareLoading, shareFinance: task.shareFinance }
    : { shareLoading: false, shareFinance: false })

  switch (task.kind) {
    case 'dossier':
      return (
        <section className="task-card" data-testid="access-task">
          {task.news && <p className="access-news">{task.news}</p>}
          <h2>{task.prompt}</h2>
          {task.items.map((item) => (
            <label key={item.id} className="field check access-check-row">
              <input
                type="checkbox"
                data-testid={`dossier-${item.id}`}
                checked={selected.includes(item.id)}
                onChange={(event) => setSelected((current) => event.target.checked
                  ? [...current, item.id]
                  : current.filter((id) => id !== item.id))}
              />
              <span>{item.label}</span>
            </label>
          ))}
          <button
            type="button"
            className="btn primary"
            data-testid="submit-dossier"
            disabled={pending || selected.length === 0}
            onClick={() => act({ type: 'submitDossier', items: selected })}
          >
            {t.submitDossier}
          </button>
        </section>
      )
    case 'question':
      return (
        <section className="task-card" data-testid="access-task">
          {task.news && <p className="access-news">{task.news}</p>}
          <h2>{task.prompt}</h2>
          {task.lines.length > 0 && (
            <ul className="access-lines">
              {task.lines.map((line) => (
                <li key={line.label} className={line.status ? `line-${line.status}` : ''}>
                  <span>{line.label}</span>
                  {line.value && <strong>{line.value}</strong>}
                </li>
              ))}
            </ul>
          )}
          <div className="access-choice-list">
            {task.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`access-choice${option.wrong ? ' is-wrong' : ''}`}
                data-testid={`option-${option.id}`}
                disabled={pending || option.wrong}
                onClick={() => act(option.id === 'admit' || option.id === 'return'
                  ? { type: 'reviewDossier', decision: option.id }
                  : { type: 'answer', optionId: option.id })}
              >
                {option.wrong && <CrossBadge />}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>
      )
    case 'policy':
      return (
        <section className="task-card" data-testid="access-task">
          {task.news && <p className="access-news">{task.news}</p>}
          <h2>{task.prompt}</h2>
          <label className="field check access-check-row">
            <input
              type="checkbox"
              data-testid="policy-loading"
              checked={policy.shareLoading}
              onChange={(event) => setPolicy((p) => ({ ...p, shareLoading: event.target.checked }))}
            />
            <span>{t.shareLoading}</span>
          </label>
          <label className="field check access-check-row">
            <input
              type="checkbox"
              data-testid="policy-finance"
              checked={policy.shareFinance}
              onChange={(event) => setPolicy((p) => ({ ...p, shareFinance: event.target.checked }))}
            />
            <span>{t.shareFinance}</span>
          </label>
          <button type="button" className="btn primary" data-testid="set-policy" disabled={pending} onClick={() => act({ type: 'setPolicy', ...policy })}>
            {t.confirmPolicy}
          </button>
        </section>
      )
    case 'pick':
      return (
        <section className="task-card" data-testid="access-task">
          {task.news && <p className="access-news"><strong>{t.mission}:</strong> {task.news}</p>}
          <h2>{task.prompt}</h2>
          <div className="access-choice-list">
            {task.cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="access-choice access-request-card"
                data-testid={`pick-${card.id}`}
                disabled={pending}
                onClick={() => act({ type: 'sendRequest', cardId: card.id })}
              >
                <span>{card.title}</span>
                <small>{card.note}</small>
              </button>
            ))}
          </div>
        </section>
      )
    case 'check':
      return <CheckTask task={task} lang={lang} pending={pending} act={act} />
  }
}

function useSecondsLeft(until: string | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [until])
  return until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000)) : 0
}

function CheckTask({ task, lang, pending, act }: { task: Extract<AccessTask, { kind: 'check' }>; lang: Lang; pending: boolean; act: Act }) {
  const t = tr(lang).access
  const seconds = useSecondsLeft(task.waiting ? task.predictUntil : null)
  const waiting = Boolean(task.waiting) && seconds > 0
  return (
    <section className="task-card" data-testid="access-task">
      <h2>{t.request} {task.request.number}: {task.request.title}</h2>
      <RequestDetails request={task.request} lang={lang} compact />
      {waiting && <p className="access-news" data-testid="access-predict-wait">{task.waiting} · {t.secondsLeft(seconds)}</p>}
      {task.request.wrong && <p className="feedback bad"><CrossBadge /><span>{task.request.wrong}</span></p>}
      <h3>{t.lookupsTitle}</h3>
      <div className="access-choice-list">
        {task.lookups.map((lookup) => (
          <button
            key={lookup.id}
            type="button"
            className={`access-choice${lookup.done ? (lookup.failed ? ' is-wrong' : ' is-right') : ''}`}
            data-testid={`lookup-${lookup.id}`}
            disabled={pending || waiting || lookup.done}
            onClick={() => act({ type: 'lookup', source: lookup.id })}
          >
            {lookup.done && (lookup.failed ? <CrossBadge /> : <CheckBadge />)}
            <span>{lookup.label}</span>
          </button>
        ))}
      </div>
      <h3>{t.decide}</h3>
      <div className="access-decide">
        <button type="button" className="btn go" data-testid="decide-deliver" disabled={pending || waiting} onClick={() => act({ type: 'decide', decision: 'deliver' })}>
          {t.deliver}
        </button>
        <button type="button" className="btn danger" data-testid="decide-refuse" disabled={pending || waiting} onClick={() => act({ type: 'decide', decision: 'refuse' })}>
          {t.refuse}
        </button>
      </div>
    </section>
  )
}

function PredictCard({
  predict, lang, pending, onPredict,
}: {
  predict: NonNullable<Access['predict']>
  lang: Lang
  pending: boolean
  onPredict: (outcome: string) => void
}) {
  const t = tr(lang).access
  const chosen = predict.options.find((option) => option.id === predict.chosen)
  return (
    <section className="task-card access-predict" data-testid="access-predict">
      <h2>{t.predictTitle}</h2>
      <p className="access-news">{predict.title}</p>
      {chosen ? (
        <p className="feedback ok" data-testid="access-predicted"><span>{t.yourPrediction}: {chosen.label}</span></p>
      ) : predict.open ? (
        <div className="access-choice-list">
          {predict.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`access-choice outcome-${option.id}`}
              data-testid={`predict-${option.id}`}
              disabled={pending}
              onClick={() => onPredict(option.id)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="access-muted">{t.predictionsClosed}</p>
      )}
    </section>
  )
}

function LastResult({ result, lang, onDismiss }: { result: NonNullable<Access['lastResult']>; lang: Lang; onDismiss: () => void }) {
  const t = tr(lang).access
  return (
    <section className={`task-card access-result ${result.delivered ? 'is-ok' : 'is-bad'}`} data-testid="access-last-result">
      <h3>{t.result} · {t.request} {result.number}: {result.title}</h3>
      <p>{result.reason}</p>
      {result.prediction && (
        <p className={result.correct ? 'status-ok' : 'status-bad'}>
          {t.yourPrediction}: {result.prediction} · {result.correct ? t.correct : t.wrong}
        </p>
      )}
      <button type="button" className="btn" data-testid="dismiss-result" onClick={onDismiss}>{t.ok}</button>
    </section>
  )
}

function SidePanel({ side, lang }: { side: Access['side']; lang: Lang }) {
  const t = tr(lang).access
  return (
    <section className="task-card access-side" data-testid="access-side">
      <h3>{side.title}</h3>
      <ul className="access-lines">
        {side.rows.map((row) => (
          <li key={row.label} className={row.tone ? `tone-${row.tone}` : ''}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>
      {side.note && <p className="access-muted">{side.note}</p>}
      {side.log.length > 0 && (
        <>
          <h4>{t.log}</h4>
          <ul className="access-log">
            {side.log.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}

function PhoneDebrief({ access, lang }: { access: Access; lang: Lang }) {
  const t = tr(lang).access
  const debrief = access.debrief!
  return (
    <section className="task-card" data-testid="access-phone-debrief">
      <h2>{t.debrief}</h2>
      <ul className="access-missions">
        {debrief.missions.map((mission) => (
          <li key={mission.label} className={mission.ok ? 'is-ok' : 'is-bad'}>
            {mission.ok ? <CheckBadge /> : <CrossBadge />}
            <span>{mission.label}</span>
          </li>
        ))}
      </ul>
      {access.score && <p><strong>{t.yourScore(access.score.points, access.score.of)}</strong></p>}
      <ol className="access-rules">
        {debrief.rules.map((rule) => (
          <li key={rule.title}><strong>{rule.title}</strong><span>{rule.text}</span></li>
        ))}
      </ol>
    </section>
  )
}
