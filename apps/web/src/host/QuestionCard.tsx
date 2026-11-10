import type { CSSProperties } from 'react'
import { CheckBadge, CrossBadge, RoleIcon, TrophyIcon, type Org } from '../art/icons'
import { tr } from '../i18n'
import { Tile, type TileState } from '../ui'
import { CONFIRM_STEPS, type Frame, type Training } from '../types'

type Round = NonNullable<Training['round']>

export function QuestionCard({
  round, frame, lang, onNextRound, nextRoundLabel, review,
}: {
  round: Round
  frame: Frame
  lang: 'nl' | 'en'
  review?: { org: Org | null; stepId: string }
  onNextRound: (() => void) | null
  nextRoundLabel: string
}) {
  const t = tr(lang)
  const reviewing = review !== undefined
  const stepId = review?.stepId ?? round.stepId
  if (stepId === 'S20' && !reviewing) {
    return (
      <section className="question-card" data-testid="training-question" aria-live="polite">
        <div className="who"><TrophyIcon className="trophy" /><h2>{t.delivered}</h2></div>
        <p>{round.caption}</p>
        {onNextRound && <div className="host-actions"><button type="button" className="btn go" onClick={onNextRound}>{nextRoundLabel}</button></div>}
      </section>
    )
  }
  if (!reviewing && (round.actor === 'engine' || round.stepId === 'S00')) return null
  if (reviewing && frame.options.length === 0 && !frame.prompt) return null
  const org = reviewing ? review.org : round.activeOrg
  const style = org ? ({ '--role': `var(--${org})` } as CSSProperties) : undefined
  const confirm = CONFIRM_STEPS.has(stepId)
  const stateFor = (id: string): TileState => {
    if (!reviewing) return 'neutral'
    if (frame.selectedOptionId === id) {
      if (frame.feedbackOk === false) return 'wrong'
      return confirm ? 'ok' : 'selected'
    }
    if (frame.highlightOptionId === id) return 'available'
    return 'neutral'
  }
  const roleName = org ? frame.panels.find((p) => p.organizationId === org)?.roleLabel : t.everyone
  return (
    <section className="question-card" style={style} data-testid="training-question" aria-live="polite">
      <div className="who">
        {org && <RoleIcon org={org} />}
        <span>{roleName} · {t.turn}</span>
      </div>
      <h2>{frame.prompt}</h2>
      {frame.options.length > 0 && (
        <div className="tiles">
          {frame.options.map((option) => (
            <Tile
              key={option.id}
              id={option.id}
              label={option.label}
              state={stateFor(option.id)}
              note={reviewing && frame.highlightOptionId === option.id ? t.fromSource : null}
              testId={`host-option-${option.id}`}
            />
          ))}
        </div>
      )}
      {reviewing && frame.highlightLabel && <p className="verdict">{frame.highlightLabel}</p>}
      {reviewing && frame.feedback && (
        <p className={`verdict ${frame.feedbackOk ? 'status-ok' : 'status-bad'}`} data-testid="feedback">
          {frame.feedbackOk ? <CheckBadge /> : <CrossBadge />}
          {frame.feedbackOk ? (confirm ? t.confirmed : frame.feedback) : `${t.mismatch} — ${t.tryAgain}`}
        </p>
      )}
    </section>
  )
}
