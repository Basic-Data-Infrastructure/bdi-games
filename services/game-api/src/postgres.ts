import pg from 'pg'
import type { SessionState } from '@bdi/domain'
import { MemoryStore } from './service.js'

export async function attachPostgres(store: MemoryStore, databaseUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  await pool.query(`
    create table if not exists session_documents (
      id uuid primary key,
      code text not null unique,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `)
  const existing = await pool.query<{ data: SessionState }>('select data from session_documents')
  if (existing.rows.length > 0) store.replaceAll(existing.rows.map((row) => row.data))
  store.onFlush = async (sessions) => {
    for (const session of sessions) {
      await pool.query(
        `insert into session_documents (id, code, data, updated_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (id) do update set code = excluded.code, data = excluded.data, updated_at = now()`,
        [session.id, session.code, JSON.stringify(session)],
      )
    }
  }
  store.onDelete = async (ids) => {
    if (ids.length === 0) return
    await pool.query('delete from session_documents where id = any($1::uuid[])', [ids])
  }
}
