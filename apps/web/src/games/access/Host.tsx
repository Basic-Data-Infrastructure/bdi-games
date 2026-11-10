import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { RoleIcon } from '../../art/icons'
import { tr } from '../../i18n'
import { play } from '../../sound'
import type { AccessTraining } from '../../types'
import { AccessNetworkView, PhaseStrip } from './Board'
import { CardPanel, DebriefPanel } from './Card'

type AccessData = NonNullable<AccessTraining['access']>

export function AccessHost({
  view,
  reviewing,
  reviewIndex,
  history,
  onStepReview,
  onCloseReview,
}: {
  view: AccessTraining
  reviewing: boolean
  reviewIndex: number
  history: AccessData['history']
  onStepReview: (delta: number) => void
  onCloseReview: () => void
}) {
  const t = tr(view.language)
  const access = view.access
  useAccessSounds(access?.history ?? [])
  if (!access) {
    return <p className="empty">{t.lobby}</p>
  }
  const reviewed = reviewing ? history[reviewIndex] : null
  const frame = reviewed?.frame ?? null
  const card = frame?.card ?? access.card
  const network = frame?.network ?? access.network
  const message = frame?.message ?? access.message
  const scored = access.scores.some((score) => score.of > 0)
  const holding = Boolean(access.holdUntil && view.serverNow < access.holdUntil)

  return (
    <div className="access-host" data-testid="access-host">
      <PhaseStrip phases={access.phases} />
      {access.debrief && !reviewing && !holding ? (
        <div className="access-main is-debrief" data-testid="access-board">
          <DebriefPanel debrief={access.debrief} lang={view.language} />
        </div>
      ) : (
        <div className="access-main" data-testid="access-board">
          <AccessNetworkView network={network} lang={view.language} />
          <CardPanel card={card} lang={view.language} />
        </div>
      )}
      <footer className="access-caption" data-testid="access-message">
        <div className="access-caption-text">
          <p>{reviewed ? reviewed.text : message}</p>
          {!reviewing && access.actorLabel && <small>{t.access.turn}: {access.actorLabel}</small>}
        </div>
        {scored && (
          <ul className="access-score-strip" aria-label={t.access.scores}>
            {access.scores.map((score) => (
              <li key={score.role}><RoleIcon org={score.role} /><strong>{score.points}</strong></li>
            ))}
          </ul>
        )}
        <details className="access-terms">
          <summary>{t.access.terms}</summary>
          <ul>
            {access.termCards.map((term) => (
              <li key={term.term}><strong>{term.term}</strong> — {term.text}</li>
            ))}
          </ul>
        </details>
      </footer>
      {reviewing && (
        <div className="review-banner" data-testid="review-banner">
          <strong>{t.reviewBanner}</strong>
          <span>{reviewIndex + 1} / {history.length}</span>
          <button type="button" className="btn" onClick={() => onStepReview(-1)} aria-label="←">←</button>
          <button type="button" className="btn" onClick={() => onStepReview(1)} aria-label="→">→</button>
          <button type="button" className="btn primary" onClick={onCloseReview}>{t.backToLive}</button>
        </div>
      )}
    </div>
  )
}

function useAccessSounds(history: AccessData['history']) {
  const last = useRef<number | null>(null)
  useEffect(() => {
    const latest = history.at(-1)
    if (!latest) return
    const previous = last.current
    last.current = latest.sequence
    if (previous == null || latest.sequence <= previous) return
    if (latest.result === 'wrong') play('wrong')
    else if (latest.scene === 'debrief') play('delivered')
    else if (latest.type === 'lookup') play('fetch')
    else if (latest.type === 'request') play('bell')
    else if (latest.result === 'delivered' || latest.result === 'ok') play('ok')
    else play('tick')
  }, [history])
}

export function useAccessAction(sessionId: string, refresh: () => void | Promise<void>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const post = useCallback(async (body: Record<string, unknown>) => {
    setPending(true)
    setError('')
    try {
      await api(`/api/sessions/${sessionId}/access`, { method: 'POST', body: JSON.stringify(body) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      // Stay disabled until the fresh view arrives, so a second tap cannot hit the presentation hold.
      await refresh()
      setPending(false)
    }
  }, [refresh, sessionId])
  return { post, pending, error }
}
