import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiUrl, identitySlot } from '../api'
import { RoleIcon } from '../art/icons'
import { storedLang, tr } from '../i18n'

type Preview = {
  sessionId: string
  name: string
  language: 'nl' | 'en'
  gameId: string
  gameTitle: string
  free: { organizationId: string; roleLabel: string; name: string; blurb: string }[]
  roles: { organizationId: string; roleLabel: string; name: string; blurb: string; free: boolean }[]
}

export function Join() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const code = params.get('code') ?? ''
  const requested = (params.get('role') ?? '') as string
  const invite = params.get('invite') ?? ''
  const gameHint = params.get('game') ?? ''
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [role, setRole] = useState(requested)
  const [invited, setInvited] = useState(Boolean(invite))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const response = await fetch(apiUrl(`/api/join?code=${encodeURIComponent(code)}`))
    const body = await response.json()
    if (!response.ok) throw new Error(body.message ?? tr(storedLang()).unknownCode)
    setPreview(body as Preview)
    return body as Preview
  }

  useEffect(() => {
    if (!code) return
    load().catch((err: Error) => setError(err.message))
  }, [code])

  const t = tr(preview?.language ?? storedLang())
  const requestedCard = preview?.roles.find((r) => r.organizationId === role)
  const taken = Boolean(requestedCard && !requestedCard.free)
  const card = taken ? undefined : requestedCard

  function goPlay(sessionId: string, gameId: string) {
    // The slot selects the stored token; switching slots after the claim would seat a different user.
    const slot = identitySlot()
    const game = gameId || gameHint
    const search = new URLSearchParams()
    if (slot) search.set('slot', slot)
    if (game) search.set('game', game)
    navigate(`/play/${sessionId}?${search.toString()}`)
  }

  async function claim() {
    if (!preview || !role || busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/sessions/${preview.sessionId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ organizationId: role, inviteToken: invited ? invite : null, displayName: name }),
      })
      goPlay(preview.sessionId, preview.gameId)
    } catch (err) {
      const e = err as Error & { body?: { error?: string } }
      if (e.body?.error === 'already_seated') {
        goPlay(preview.sessionId, preview.gameId)
        return
      }
      setError(e.message || t.roleTaken)
      setRole('')
      setInvited(false)
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="join-screen">
      <section className="join-card" style={card ? ({ '--role': `var(--${card.organizationId})` } as CSSProperties) : undefined}>
        <small className="org">{t.session} · {preview?.name ?? code}{preview?.gameTitle ? ` · ${preview.gameTitle}` : ''}</small>
        {card ? (
          <>
            <RoleIcon org={card.organizationId} className="big-icon" />
            <div>
              <p className="org">{t.youAre}</p>
              <h1>{card.roleLabel}</h1>
              <p className="org">{card.name}</p>
            </div>
            <p>{card.blurb}</p>
            <label className="field">
              <span>{t.nameOptional}</span>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="button" className="btn go" data-testid="claim-role" disabled={busy} onClick={() => void claim()}>
              {busy ? t.reconnecting : t.takeRole}
            </button>
            {!requested && <button type="button" className="btn ghost" onClick={() => setRole('')}>{t.back}</button>}
          </>
        ) : !preview ? (
          <h1>{error || t.reconnecting}</h1>
        ) : preview.free.length === 0 ? (
          <h1 data-testid="no-roles-free">{t.noRolesFree}</h1>
        ) : (
          <>
            <h1>{t.chooseRole}</h1>
            <div className="choose">
              {preview.free.map((item) => (
                <button
                  key={item.organizationId}
                  type="button"
                  className="btn"
                  data-testid={`free-${item.organizationId}`}
                  style={{ '--role': `var(--${item.organizationId})` } as CSSProperties}
                  onClick={() => { setRole(item.organizationId); setInvited(false) }}
                >
                  <RoleIcon org={item.organizationId} />
                  {item.roleLabel}
                </button>
              ))}
            </div>
          </>
        )}
        {preview && (error || (taken && preview.free.length > 0)) && (
          <p className="error-bar" data-testid="claim-error">{error || t.roleTaken}</p>
        )}
      </section>
    </main>
  )
}
