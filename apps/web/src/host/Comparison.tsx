import { TrophyIcon } from '../art/icons'
import { tr } from '../i18n'
import type { Training } from '../types'

function seconds(value: unknown): string {
  const n = Number(value ?? 0)
  return `${Math.round(n / 1000)} s`
}

export function Comparison({ view, onClose }: { view: Training; onClose: () => void }) {
  const t = tr(view.language)
  const rows: { label: string; read: (m: Training['rounds'][number]['metrics']) => string }[] = [
    { label: t.mWrong, read: (m) => String(m.wrongAttempts ?? 0) },
    { label: t.mDecision, read: (m) => seconds(m.activeDecisionMs) },
    { label: t.mPresentation, read: (m) => seconds(m.presentationMs) },
    { label: t.mPause, read: (m) => seconds(m.pauseMs) },
    { label: t.mCoordination, read: (m) => String(Array.isArray(m.coordinationSteps) ? m.coordinationSteps.length : 0) },
    { label: t.mNotices, read: (m) => String(m.notificationsReceived ?? 0) },
    { label: t.mFetches, read: (m) => String(m.fetchesOk ?? 0) },
    { label: t.mHelp, read: (m) => String(m.helpActions ?? 0) },
  ]
  return (
    <section className="comparison" data-testid="comparison">
      <h2><TrophyIcon />{t.comparisonTitle}</h2>
      <table>
        <thead>
          <tr>
            <th>{t.metric}</th>
            {view.rounds.map((round) => <th key={round.number}>{t.round} {round.number} — {round.mode === 'with_bdi' ? t.withBdi : t.withoutBdi}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {view.rounds.map((round) => <td key={round.number}>{row.read(round.metrics)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ul>{t.debrief.map((q) => <li key={q}>{q}</li>)}</ul>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>{t.close}</button></div>
    </section>
  )
}
