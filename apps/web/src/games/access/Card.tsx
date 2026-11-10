import { CheckBadge, CrossBadge, RoleIcon } from '../../art/icons'
import { tr, type Lang } from '../../i18n'
import type { AccessCard, AccessDebrief, AccessRequestView } from '../../types'

export function clock(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_MARK: Record<string, string> = { ok: '✓', failed: '✗', pending: '…', skipped: '–' }

export function RequestDetails({ request, lang, compact = false }: { request: AccessRequestView; lang: Lang; compact?: boolean }) {
  const t = tr(lang).access
  return (
    <div className={`access-request${compact ? ' compact' : ''}`} data-testid="access-request">
      <code className="access-http">{request.http}</code>
      <div className="access-token">
        <strong>{t.token}</strong>
        <span>iss/sub · {request.token.issuer} ({request.token.subject})</span>
        <span>aud · {request.token.audience}</span>
        <span className={request.token.fresh ? 'is-ok' : 'is-bad'}>
          exp · {t.tokenExpires} {request.token.fresh ? '' : `${t.yesterday} `}{clock(request.token.expiresAt, lang)} {request.token.fresh ? '✓' : '✗'}
        </span>
      </div>
      <ol className="access-checklist">
        {request.checks.map((check) => (
          <li key={check.id} className={`line-${check.status}`} data-testid={`check-${check.id}`}>
            <span className="mark">{STATUS_MARK[check.status]}</span>
            <div>
              <strong>{check.label}</strong>
              <small>{check.source}</small>
              {check.evidence && <em>{check.evidence}</em>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Predictions({ request, lang }: { request: AccessRequestView; lang: Lang }) {
  const t = tr(lang).access
  return (
    <div className="access-predictions" data-testid="access-predictions">
      <strong>{t.predictions}</strong>
      <ul>
        {request.predictions.map((item) => (
          <li
            key={item.role}
            className={item.correct == null ? (item.predicted ? 'is-in' : '') : item.correct ? 'is-right' : 'is-wrong'}
          >
            <RoleIcon org={item.role} />
            <span>{item.roleLabel}</span>
            <em>{item.outcomeLabel ?? (item.predicted ? t.predicted : t.notPredicted)}</em>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CardPanel({ card, lang }: { card: AccessCard; lang: Lang }) {
  const request = card.request
  const t = tr(lang).access
  return (
    <section className={`access-card kind-${card.kind}`} data-testid="access-card">
      <header>
        {card.role && <RoleIcon org={card.role} />}
        <h2>{card.title}</h2>
      </header>
      {card.news && <p className="access-news">{card.news}</p>}
      {card.prompt && <p className="access-prompt" data-testid="access-prompt">{card.prompt}</p>}
      {card.lines.length > 0 && (
        <ul className="access-lines">
          {card.lines.map((line) => (
            <li key={line.label} className={line.status ? `line-${line.status}` : ''}>
              <span>{line.label}</span>
              {line.value && <strong>{line.value}</strong>}
            </li>
          ))}
        </ul>
      )}
      {card.options.length > 0 && (
        <ol className="access-options">
          {card.options.map((option) => (
            <li key={option.id} className={`is-${option.state}`}>
              {option.state === 'right' && <CheckBadge />}
              {option.state === 'wrong' && <CrossBadge />}
              <span>{option.label}</span>
            </li>
          ))}
        </ol>
      )}
      {request && <RequestDetails request={request} lang={lang} />}
      {request && <Predictions request={request} lang={lang} />}
      {request?.decision?.payload && (
        <p className="access-payload"><strong>{t.delivered}:</strong> {request.decision.payload}</p>
      )}
      {card.feedback && (
        <p className={`access-feedback ${card.feedbackOk ? 'ok' : 'bad'}`} data-testid="access-feedback">{card.feedback}</p>
      )}
    </section>
  )
}

export function DebriefPanel({ debrief, lang }: { debrief: AccessDebrief; lang: Lang }) {
  const t = tr(lang).access
  return (
    <section className="access-debrief" data-testid="access-debrief">
      <div className="access-debrief-col">
        <h2>{t.debrief}</h2>
        <h3>{t.missions}</h3>
        <ul className="access-missions">
          {debrief.missions.map((mission) => (
            <li key={mission.label} className={mission.ok ? 'is-ok' : 'is-bad'}>
              {mission.ok ? <CheckBadge /> : <CrossBadge />}
              <span>{mission.label}</span>
            </li>
          ))}
        </ul>
        <h3>{t.counts}</h3>
        <ul className="access-counts">
          {debrief.counts.map((count) => (
            <li key={count.label}><strong>{count.value}×</strong><span>{count.label}</span></li>
          ))}
        </ul>
        <h3>{t.scores}</h3>
        <ul className="access-scores">
          {debrief.scores.map((score) => (
            <li key={score.role}><RoleIcon org={score.role} /><span>{score.roleLabel}</span><strong>{score.points}/{score.of}</strong></li>
          ))}
        </ul>
        <h3>{t.mistakes}</h3>
        {debrief.mistakes.length === 0 ? <p className="access-muted">{t.noMistakes}</p> : (
          <ul className="access-scores">
            {debrief.mistakes.map((item) => (
              <li key={item.role}><RoleIcon org={item.role} /><span>{item.roleLabel}</span><strong>{item.count}</strong></li>
            ))}
          </ul>
        )}
      </div>
      <div className="access-debrief-col">
        <h3>{t.rules}</h3>
        <ol className="access-rules">
          {debrief.rules.map((rule) => (
            <li key={rule.title} className={rule.seen ? '' : 'is-unseen'}>
              <strong>{rule.title}</strong>
              <span>{rule.text}</span>
            </li>
          ))}
        </ol>
        <h3>{t.questions}</h3>
        <ol className="access-questions">
          {debrief.questions.map((question) => <li key={question}>{question}</li>)}
        </ol>
      </div>
    </section>
  )
}
