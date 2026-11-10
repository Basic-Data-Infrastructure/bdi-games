const KEY = 'bdi-token'

export function identitySlot(): string {
  const hash = window.location.hash
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  return new URLSearchParams(query).get('slot') ?? ''
}

export function withSlot(path: string): string {
  const slot = identitySlot()
  if (!slot || path.includes('slot=')) return path
  return path.includes('?') ? `${path}&slot=${encodeURIComponent(slot)}` : `${path}?slot=${encodeURIComponent(slot)}`
}

function storageKey(): string {
  const slot = identitySlot()
  return slot ? `${KEY}:${slot}` : KEY
}

export function apiUrl(path: string): string {
  const root = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  return `${root}${path}`
}

export function publicBase(): string {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(window.location.href)
  url.hash = ''
  return url.href.replace(/\/$/, '')
}

export async function phoneBase(): Promise<string> {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined
  if (configured) return configured.replace(/\/$/, '')
  const host = window.location.hostname
  if (host !== 'localhost' && host !== '127.0.0.1') return publicBase()
  const response = await fetch(apiUrl('/api/network'))
  const body = await response.json() as { addresses?: string[] }
  const ip = body.addresses?.[0]
  if (!ip) return publicBase()
  const port = window.location.port ? `:${window.location.port}` : ''
  return `http://${ip}${port}`
}

export async function ensureToken(): Promise<string> {
  const key = storageKey()
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const response = await fetch(apiUrl('/api/dev/anonymous'), { method: 'POST' })
  const body = await response.json() as { token: string }
  localStorage.setItem(key, body.token)
  return body.token
}

export function setToken(token: string) {
  localStorage.setItem(storageKey(), token)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await ensureToken()
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body.message ?? 'Fout'), { status: response.status, body })
  return body as T
}
