import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, apiUrl, setToken, withSlot } from './api'
import { RoleIcon } from './art/icons'
import { storedLang, tr, type Lang } from './i18n'
import { ORGS, type Training } from './types'
import { Wordmark } from './ui'

export { Host } from './host/Host'
export { Join } from './phone/Join'
export { Play } from './phone/Play'

type GameCard = {
  id: string
  version: number
  titles: { nl: string; en: string }
  blurbs: { nl: string; en: string }
  startModes: ('without_bdi' | 'only_bdi' | 'story')[]
}

const GAME_ORGS: Record<string, string[]> = {
  logistics: [...ORGS],
  access: ['admin', 'owner', 'registry', 'provider', 'consumer'],
}

export function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [games, setGames] = useState<GameCard[] | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const lang = storedLang()
  const t = tr(lang)
  const selected = games?.find((game) => game.id === gameId) ?? null

  useEffect(() => {
    void fetch(apiUrl('/api/games'))
      .then(async (response) => {
        if (!response.ok) throw new Error(t.offline)
        const body = await response.json() as { games: GameCard[] }
        setGames(body.games)
        if (body.games.length === 1) setGameId(body.games[0].id)
      })
      .catch(() => {
        setGames([])
        setError(t.offline)
      })
  }, [t.offline])

  async function create(startMode: 'without_bdi' | 'only_bdi' | 'story', id = gameId) {
    if (!id) return
    setBusy(true)
    setGameId(id)
    try {
      const view = await api<Training>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ language: lang, startMode, gameId: id }),
      })
      const path = withSlot(`/host/${view.sessionId}`)
      if (window.top && window.top !== window) {
        window.top.location.hash = `#${path}`
        return
      }
      navigate(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.offline)
      setBusy(false)
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch(apiUrl(`/api/join?code=${encodeURIComponent(code)}`)).catch(() => null)
    if (!response?.ok) {
      setError(t.unknownCode)
      return
    }
    navigate(withSlot(`/join?code=${encodeURIComponent(code)}`))
  }

  function primaryMode(game: GameCard): 'without_bdi' | 'only_bdi' | 'story' {
    if (game.startModes.includes('story')) return 'story'
    if (game.startModes.includes('without_bdi')) return 'without_bdi'
    return game.startModes[0] ?? 'without_bdi'
  }

  return (
    <main className="home">
      <section className={`home-card${(games?.length ?? 0) > 1 ? ' home-card-wide' : ''}`}>
        <Wordmark />
        <h1>{t.tagline}</h1>
        <p className="home-sub">{t.chooseGame}</p>
        <div className="game-tiles" data-testid="game-list">
          {games === null && (
            <p className="empty" data-testid="games-loading">{t.loadingGames}</p>
          )}
          {(games ?? []).map((game) => {
            const active = game.id === gameId
            const orgs = GAME_ORGS[game.id] ?? ORGS
            return (
              <article
                key={game.id}
                className={`game-tile${active ? ' is-selected' : ''}`}
                style={{ '--tile-accent': `var(--${orgs[0]})` } as CSSProperties}
                data-testid={`game-${game.id}`}
              >
                <button
                  type="button"
                  className="game-tile-pick"
                  aria-pressed={active}
                  onClick={() => setGameId(game.id)}
                >
                  <div className="home-roles game-tile-roles" aria-hidden="true">
                    {orgs.map((org) => <RoleIcon key={org} org={org} />)}
                  </div>
                  <strong className="game-tile-title">{game.titles[lang]}</strong>
                  <span className="game-tile-blurb">{game.blurbs[lang]}</span>
                </button>
                {active && (
                  <div className="game-tile-actions">
                    <button
                      type="button"
                      className="btn go"
                      data-testid="start-session"
                      disabled={busy}
                      onClick={() => void create(primaryMode(game), game.id)}
                    >
                      {t.newGame}
                    </button>
                    {game.startModes.includes('only_bdi') && (
                      <button type="button" className="btn" disabled={busy} onClick={() => void create('only_bdi', game.id)}>
                        {t.onlyBdi}
                      </button>
                    )}
                    <Link className="btn ghost" to={`/table?game=${encodeURIComponent(game.id)}&slot=host`}>{t.allRoles}</Link>
                  </div>
                )}
              </article>
            )
          })}
        </div>
        {selected && (games?.length ?? 0) > 1 && (
          <button type="button" className="btn ghost home-clear" onClick={() => setGameId(null)}>{t.backToGames}</button>
        )}
        <div className="divider" />
        <form onSubmit={(event) => void join(event)}>
          <label className="field">
            <span>{t.joinWithCode}</span>
            <input data-testid="join-code" value={code} autoCapitalize="characters" onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }} />
          </label>
          <button type="submit" className="btn primary" disabled={!code}>{t.join}</button>
        </form>
        {error && <p className="error-bar" role="alert">{error}</p>}
        <div className="home-links"><Link to="/settings">{t.settings}</Link></div>
      </section>
    </main>
  )
}

export function Settings() {
  const [lang, setLang] = useState<Lang>(storedLang())
  const [volume, setVolume] = useState(localStorage.getItem('bdi-volume') ?? '0.4')
  const [muted, setMuted] = useState(localStorage.getItem('bdi-mute') === '1')
  const t = tr(lang)
  return (
    <main className="home">
      <section className="home-card">
        <Wordmark />
        <h1>{t.settings}</h1>
        <label className="field">
          <span>{t.language}</span>
          <select value={lang} onChange={(e) => { const next = e.target.value as Lang; setLang(next); localStorage.setItem('bdi-lang', next) }}>
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="field">
          <span>{t.volume}</span>
          <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => { setVolume(e.target.value); localStorage.setItem('bdi-volume', e.target.value) }} />
        </label>
        <label className="field check">
          <span><input type="checkbox" checked={muted} onChange={(e) => { setMuted(e.target.checked); localStorage.setItem('bdi-mute', e.target.checked ? '1' : '0') }} /> {t.mute}</span>
        </label>
        <p>{t.phonesSilent}</p>
        <Link className="btn" to="/">{t.back}</Link>
      </section>
    </main>
  )
}

// Survives React Strict Mode remounts so the table creates one session, not two.
let tableCreateInFlight: Promise<string> | null = null

export function TestTable() {
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const gameId = params.get('game') ?? 'logistics'
  const [view, setView] = useState<Training | null>(null)
  const [phones, setPhones] = useState<{ label: string; src: string }[] | null>(null)
  const [error, setError] = useState('')
  const phoneSession = useRef<string | null>(null)
  const t = tr(storedLang())
  useEffect(() => {
    if (sessionId) {
      tableCreateInFlight = null
      return
    }
    setError('')
    const startMode = gameId === 'access' ? 'story' : 'without_bdi'
    tableCreateInFlight ??= api<Training>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: t.allRoles, language: storedLang(), startMode, gameId }),
    }).then((created) => created.sessionId)
    void tableCreateInFlight.then((id) => {
      navigate(`/table/${id}?slot=host&game=${encodeURIComponent(gameId)}`, { replace: true })
    }).catch((err) => {
      tableCreateInFlight = null
      setError(err instanceof Error ? err.message : t.offline)
    })
  }, [navigate, sessionId, t.allRoles, t.offline, gameId])
  useEffect(() => {
    if (!sessionId) return
    setView(null)
    phoneSession.current = null
    setPhones(null)
    void api<Training>(`/api/sessions/${sessionId}/training`).then(setView)
    const timer = setInterval(() => {
      void api<Training>(`/api/sessions/${sessionId}/training`).then(setView).catch(() => undefined)
    }, 2000)
    return () => clearInterval(timer)
  }, [sessionId])
  useEffect(() => {
    if (!view || phoneSession.current === view.sessionId) return
    phoneSession.current = view.sessionId
    const origin = window.location.href.split('#')[0]
    setPhones(view.roles.map((role) => ({
      label: role.organizationId,
      src: `${origin}#/join?code=${encodeURIComponent(view.code)}&role=${encodeURIComponent(role.organizationId)}&invite=${encodeURIComponent(role.inviteToken ?? '')}&slot=${encodeURIComponent(role.organizationId)}&game=${encodeURIComponent(view.gameId)}`,
    })))
  }, [view])
  if (error) {
    return (
      <main className="table-wait">
        <p className="error-bar" role="alert">{error}</p>
        <Link className="btn" to="/">{t.back}</Link>
      </main>
    )
  }
  if (!view || !phones) return <p className="table-wait">{t.testTablePrep}</p>
  return (
    <main className="test-table">
      <div className="test-grid" style={{ '--test-cols': phones.length } as CSSProperties}>
        <iframe title="Beamer" src={`${window.location.href.split('#')[0]}#/host/${view.sessionId}?slot=host`} />
        {phones.map((phone) => <iframe key={`${view.sessionId}-${phone.label}`} title={phone.label} src={phone.src} />)}
      </div>
    </main>
  )
}

export function Bootstrap() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const allowed = import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEV_AUTH === 'true'
  useEffect(() => {
    if (!allowed) return
    const token = params.get('token')
    if (token) setToken(token)
    navigate(withSlot(params.get('next') ?? '/'))
  }, [allowed, navigate, params])
  return <p className="table-wait">{allowed ? tr(storedLang()).reconnecting : 'Not available'}</p>
}
