import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiUrl, ensureToken } from './api'

export type LiveStatus = 'connecting' | 'live' | 'polling' | 'offline'

type Options = { kind: 'training' | 'player'; pollMs?: number }

const STALE_MS = 15000

async function readStream(
  url: string,
  token: string,
  signal: AbortSignal,
  onSnapshot: (data: string, id: string) => void,
  onActivity: () => void,
): Promise<void> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' }, signal })
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}))
    throw Object.assign(new Error(body.message ?? 'stream'), { status: response.status })
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) throw new Error('stream closed')
    onActivity()
    buffer += decoder.decode(value, { stream: true })
    let split = buffer.indexOf('\n\n')
    while (split >= 0) {
      const chunk = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      let event = 'message'
      let id = ''
      const data: string[] = []
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('id:')) id = line.slice(3).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      if (event === 'snapshot') onSnapshot(data.join('\n'), id)
      if (event === 'gone') throw Object.assign(new Error(JSON.parse(data.join('\n')).message), { status: 403 })
      split = buffer.indexOf('\n\n')
    }
  }
}

function inIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function useLive<T extends { cursor?: number }>(sessionId: string, { kind, pollMs = 1000 }: Options) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  const cursor = useRef(-1)
  const run = useRef<string | null>(null)
  const seen = useRef<{ roundId: string; version: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Test table embeds host + every role; six long-lived SSE streams exhaust the browser's
  // per-host HTTP/1.1 limit (~6), so later Ready/claim fetches hang. Prefer short polls in iframes.
  const preferPoll = inIframe()

  const accept = useCallback((next: T) => {
    // A stream snapshot and a refresh response can cross; an older view must not undo a newer one.
    const round = (next as { round?: { id?: string; stateVersion?: number } | null }).round
    if (round?.id && typeof round.stateVersion === 'number') {
      if (seen.current?.roundId === round.id && round.stateVersion < seen.current.version) return
      seen.current = { roundId: round.id, version: round.stateVersion }
    }
    if (typeof next.cursor === 'number') {
      // The cursor restarts with every round or story run, so only compare it within one run.
      const story = (next as { access?: { id?: string } | null }).access
      const runId = round?.id ?? story?.id ?? ''
      if (runId === run.current && cursor.current >= 0 && next.cursor < cursor.current) return
      run.current = runId
      cursor.current = next.cursor
    }
    setData(next)
    setError(null)
  }, [])

  const path = kind === 'training' ? `/api/sessions/${sessionId}/training` : `/api/sessions/${sessionId}/player`

  const refresh = useCallback(async () => {
    try {
      accept(await api<T>(path))
    } catch (err) {
      const e = err as Error & { status?: number }
      setError({ message: e.message, status: e.status })
    }
  }, [accept, path])

  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    let poll: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let lastActivity = Date.now()
    // The server pings every ~10 s; a silent half-open connection (proxy, Wi-Fi handover) must not look live.
    const watchdog = setInterval(() => {
      if (preferPoll) return
      if (Date.now() - lastActivity > STALE_MS) controller.abort()
    }, 2000)
    const startPolling = () => {
      if (poll) return
      // In an iframe polling is the chosen transport, not a degraded fallback.
      setStatus(!navigator.onLine ? 'offline' : preferPoll ? 'live' : 'polling')
      void refresh()
      poll = setInterval(() => void refresh(), pollMs)
    }
    void (async () => {
      if (preferPoll) {
        clearInterval(watchdog)
        startPolling()
        return
      }
      try {
        const token = await ensureToken()
        const url = apiUrl(`/api/sessions/${sessionId}/stream?kind=${kind}&cursor=${cursor.current}`)
        await readStream(url, token, controller.signal, (raw) => {
          if (stopped) return
          if (poll) { clearInterval(poll); poll = null }
          setStatus('live')
          accept(JSON.parse(raw) as T)
        }, () => { lastActivity = Date.now() })
      } catch (err) {
        clearInterval(watchdog)
        if (stopped) return
        const e = err as Error & { status?: number }
        if (e.status === 401 || e.status === 403 || e.status === 404) {
          setError({ message: e.message, status: e.status })
          setStatus('offline')
          return
        }
        startPolling()
        retry = setTimeout(() => setAttempt((n) => n + 1), 5000)
      }
    })()
    const online = () => setAttempt((n) => n + 1)
    window.addEventListener('online', online)
    return () => {
      stopped = true
      clearInterval(watchdog)
      controller.abort()
      if (poll) clearInterval(poll)
      if (retry) clearTimeout(retry)
      window.removeEventListener('online', online)
    }
  }, [sessionId, kind, pollMs, attempt, accept, refresh, preferPoll])

  return { data, status, error, refresh, accept }
}
