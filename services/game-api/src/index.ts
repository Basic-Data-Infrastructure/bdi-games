import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { attachPostgres } from './postgres.js'
import { MemoryStore } from './service.js'

// Local file backup only when there is no Postgres. Do not default GAME_FILE when
// DATABASE_URL is set: that would rewrite game.json on every change for no benefit.
if (!process.env.DATABASE_URL) {
  process.env.GAME_FILE ??= 'data/game.json'
}
const store = new MemoryStore()
if (process.env.DATABASE_URL) {
  await attachPostgres(store, process.env.DATABASE_URL)
  console.log('Sessions worden in Postgres bewaard.')
} else if (process.env.GAME_FILE) {
  console.log(`Sessions worden in ${process.env.GAME_FILE} bewaard.`)
} else {
  console.log('Sessions alleen in geheugen (weg bij herstart).')
}
const { app, game } = createApp(store)
const port = Number(process.env.PORT ?? 8787)
setInterval(() => { void game.tickAll() }, 500)
serve({ fetch: app.fetch, port, hostname: process.env.LISTEN_HOST }, () => {
  console.log(`BDI game API on http://localhost:${port}`)
})

const shutdown = (signal: string) => {
  console.log(`${signal}: pending sessions wegschrijven…`)
  void store.flushNow().finally(() => process.exit(0))
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
