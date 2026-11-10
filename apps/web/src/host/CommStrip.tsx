import { CallIcon, RoleIcon } from '../art/icons'
import { tr } from '../i18n'
import type { Training } from '../types'

type Round = NonNullable<Training['round']>

export function CommStrip({ round, comm, lang }: { round: Round; comm: string; lang: 'nl' | 'en' }) {
  const t = tr(lang)
  const chain = round.bdiChain
  return (
    <section className="board-card comm-strip" data-testid="comm">
      <h4>{t.info}</h4>
      {round.mode === 'without_bdi' ? (
        <>
          {round.askOrg && round.activeOrg && (
            <p className="coord-arrow">
              <RoleIcon org={round.askOrg} /> <CallIcon /> <RoleIcon org={round.activeOrg} />
            </p>
          )}
          <p className="comm-text">{comm}</p>
        </>
      ) : (
        <>
          {chain && (
            <p className="coord-arrow">
              <RoleIcon org={chain.publisher} /> →{' '}
              {chain.subscribers.map((org) => <RoleIcon key={org} org={org} />)}
            </p>
          )}
          <ol className="chain" aria-label="BDI">
            {t.chain.map((label, index) => {
              const done = chain ? index < chain.done : false
              const now = chain?.now === index
              return (
                <li key={label} className={now ? 'is-now' : done ? 'is-done' : ''}>
                  <span className="dot" />{label}
                </li>
              )
            })}
          </ol>
          {!chain && <p>{comm}</p>}
        </>
      )}
    </section>
  )
}

export function EventsCard({ round, lang }: { round: Round; lang: 'nl' | 'en' }) {
  const t = tr(lang)
  return (
    <section className="board-card">
      <h4>{t.events}</h4>
      <div className="event-list">
        {round.events.slice(-4).map((event) => <p key={event.sequence}>{event.text}</p>)}
      </div>
    </section>
  )
}

export function RegistryCard({ round, lang }: { round: Round; lang: 'nl' | 'en' }) {
  const t = tr(lang)
  if (!round.registries) return null
  return (
    <section className="board-card registry-strip">
      <h4>{t.association}</h4>
      <div className="chips">
        {round.registries.association.map((org) => (
          <span key={org.name} className="chip" title={org.name}><RoleIcon org={org.organizationId} /> ✓</span>
        ))}
      </div>
      <h4>{t.orchestration}</h4>
      <div className="chips">
        {round.registries.orchestration.map((org) => <span key={org.roleLabel} className="chip">{org.roleLabel}</span>)}
      </div>
      <p>{t.assignedBy} {round.registries.orchestration[0]?.issuedBy}</p>
    </section>
  )
}
