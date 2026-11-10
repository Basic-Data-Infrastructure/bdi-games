# AGENTS.md

Guidance for AI coding agents working in this repository. Human-facing docs are in Dutch under `docs/`; this file is the technical entry point for agents.

## What this is

An educational multiplayer platform for BDI teaching games. Games share one skeleton (host beamer + phones, claim/ready, without→with BDI, policy on every read). The first pack is the logistics chain (`gameId: logistics`): four roles `buyer`, `seller`, `carrier`, `delivery`. The second pack is `access` (*Wie mag deze gegevens zien?*): five roles `admin`, `owner`, `registry`, `provider`, `consumer`, with its own story reducer instead of the without→with BDI rounds. All organisations and data are fictional.

Read before changing behaviour:

- `docs/gameplay.md` / `docs/games/`: packs and the logistics script (S00–S20, traffic jam).
- `docs/games/README.md`: how to add a game pack.
- `docs/bdi-model.md`: what BDI means in this game (membership ≠ read right, policy checked on every read).
- `docs/architecture.md`: storage, realtime, clock, identity, engine vs packs.
- `docs/design-decisions.md`: deliberate design choices and why. Add new ones here.

The Dutch docs under `docs/` are the source of truth for game rules.

## Commands

```bash
npm install
npm run dev:api        # API on :8787 (tsx watch)
npm run dev            # web on :5173, proxies /api and /health to :8787
npm run typecheck      # domain, API and web
npm test               # Vitest: packages/**/*.test.ts, services/**/*.test.ts
npm run test:e2e       # Playwright, ~8 min, starts API and web itself
npm run check:bundle   # build web and fail on secrets in the bundle
npm run db:up          # local Postgres on :5432 (Docker); db:down stops it
npm run docker:up      # build and run the production image plus Postgres on :8080
```

The shell on the maintainer's machine is PowerShell on Windows. Nothing loads `.env` files; set env vars in the shell (`$env:NAME = "value"`). All variables are listed in `.env.example`.

Definition of done for a change: `npm run typecheck` and `npm test` pass. Run `npm run test:e2e` when you touch game flow, the host screen, the phone screen or anything with a `data-testid`. Update the Dutch docs in `docs/` when behaviour, configuration or deployment changes.

## Layout

| Path | Role |
| --- | --- |
| `packages/domain` | Engine + game packs. Pure TypeScript, no I/O. Imported as `@bdi/domain` (source, no build step). |
| `services/game-api` | Hono HTTP server on Node. Auth, persistence, SSE, 500 ms tick loop. |
| `apps/web` | React 19 + Vite SPA with a hash router. Shell in `src/host` / `src/phone`; pack UI in `src/games/<id>`. |
| `e2e` | Playwright acceptance tests; one browser context per role. |
| `scripts` | Local helpers (`seed-session.mjs`, `open-sessions.mjs`, `check-bundle.mjs`, `cdp-shot.mjs`). |
| `Dockerfile`, `deploy` | Production image: nginx (web + `/api` proxy, port 8080) and the API in one container. |
| `docker-compose.yml` | Local Postgres and a local run of the production image. |
| `infra` | Bicep template for Azure: Container App (one replica), registry, optional PostgreSQL (`enablePostgres`, default off), OIDC identity. |
| `.github/workflows/deploy.yml` | Checks on every PR; builds and deploys the image on every push to `main`. See `docs/deployment.md`. |

### Domain (`packages/domain/src`)

- `types.ts`: `SessionState` (includes `gameId`), `RoundState`, `GameError`; `OrgId`/`StepId` are strings.
- `catalog.ts` / `game-definition.ts`: registered packs; `getGame`, `listGames`.
- `games/logistics/`: logistics content (`scenario`, `steps`, `policy`, `definition`); public API re-exports these from `index.ts`.
- `games/access/`: the access pack (`scenario`, `state`, `decide`, `reduce`, `present`, `view`, `definition`). Its state lives in `session.access`, not in rounds.
- `dispatch.ts`: `dispatch(session, command, ctx)` is the single reducer; `createSession` takes `gameId`. `access*` commands are passed on to `games/access/reduce.ts`.
- `project.ts`: BDI pipeline (publish → outbox → notify → fetch), knowledge panels, frames.
- `views.ts`: `trainingView` (host only) and `playerView` (one role). These are the only shapes that leave the server.

### API (`services/game-api/src`)

- `index.ts`: boot, optional Postgres, `setInterval(tickAll, 500)`.
- `app.ts`: routes. Every mutating route maps to exactly one domain `Command`.
- `service.ts`: `MemoryStore` (serialized `run()` transactions on cloned documents), dev-token signing and checking, `GameService`.
- `postgres.ts`: loads all sessions at boot; `MemoryStore` upserts via debounced `onFlush` (`PERSIST_INTERVAL_MS`, immediate for new/closed) and deletes via `onDelete` after idle/expiry close.

## Invariants — do not break these

1. **The domain is deterministic.** No `Date.now()`, `new Date()`, `Math.random()`, `randomUUID()` or `process.env` inside `packages/domain` (the default argument in `trainingView` is the only exception). Time comes from `ctx.now`; ids and seeds are generated in the API and passed in the command. Shuffling uses `shuffle(items, seed)`.
2. **`dispatch` returns a new state.** It `structuredClone`s the input; never mutate a session outside `store.run()`.
3. **Identity comes from the token, never from the body.** Routes set `userId` from `userFromAuth(...)`. Build commands field by field; do not spread `c.req.json()` into a command.
4. **No answer leaks to players.** `playerView` exposes only the player's own sources and, in the BDI round, authorized received data. Never add `scenarioSeed`, expected values or other roles' sources to a player view. `trainingView` is host-only (checked in `GameService.training`) and must not expose invite tokens of claimed roles.
5. **BDI rules live in the active pack’s policy (`games/logistics/policy.ts`; for `access` the per-layer truth in `games/access/decide.ts`).** Every read goes through `authorize` at the source; being a member or having a transport role is not a read right. Notifications carry minimal metadata; payloads are fetched separately.
6. **Server time drives everything.** The client animates from `phaseEnteredAt`, `dueAt` and `serverNow`; it never advances the game itself. Pausing shifts all deadlines so pause time is not counted as decision time.
7. **One API instance.** Memory is the source of truth. Optional write-behind: local `GAME_FILE` (dev default without `DATABASE_URL`) or Postgres (`DATABASE_URL` / Azure `enablePostgres`). Do not introduce designs that assume multiple instances or serverless functions without redesigning storage first. The Container App in `infra/main.bicep` is pinned to one replica for this reason.
8. **Secrets stay server-side.** Only `VITE_*` variables reach the browser. Never put `AUTH_SECRET`, `INTERNAL_TICK_SECRET` or `DATABASE_URL` in a `VITE_*` variable; `check:bundle` guards the dev defaults. Secrets never go into the repository, the image or GitHub: on Azure they are Container App secrets set by `infra/main.bicep`.

## Common changes

**New player or host action**

1. Add a variant to `Command` in `dispatch.ts`, a `case` in `dispatch`, and a handler function.
2. Decide whether it is allowed while paused (list at the top of `dispatch`).
3. Add a route in `app.ts` that sets `type` and `userId` itself and picks body fields explicitly.
4. Call it from the web app through `api(...)` in `apps/web/src/api.ts`.
5. Add a domain test in `round.test.ts` (and an API test in `app.test.ts` for auth or isolation rules).

Actions of the `access` pack follow the same rules, but share one route: `POST /api/sessions/:id/access` maps the body's `type` to one `access*` command, handled in `games/access/reduce.ts` and tested in `games/access/access.test.ts`.

**Changing what a screen shows**

The web app does not import `@bdi/domain`. Its view types in `apps/web/src/types.ts` are a hand-maintained mirror of `TrainingView` and `PlayerView` in `views.ts`. Change both, then run `npm run typecheck`.

**Changing step flow or scenario data**

Edit `steps.ts` and `scenario.ts`. Check `nextStepId`, `STEP_ACTOR`, `COARSE`, `CONFIRM`/`CHOOSE`, and the mirrored `CONFIRM_STEPS` in `apps/web/src/types.ts`. The e2e helper plays by trying options per role, so it survives answer reshuffles, but it relies on test ids.

**Text and language**

Both Dutch (`nl`, default) and English (`en`) are required.

- Domain and server text: `t(language, nl, en)` or `{ nl, en }` records in `scenario.ts`/`steps.ts`.
- UI text: `apps/web/src/i18n.ts`. The `en` object is typed as `typeof nl`, so a missing key is a type error.
- Error messages in `GameError` are Dutch and shown to users.

**Environment variable**

Read it in the API (`service.ts` or `index.ts`), never in the domain; pass values via `Ctx` if the domain needs them. Add it to `.env.example`, to `infra/main.bicep` if it is needed online (as a secret when it is one), and to `docs/local.md` or `docs/deployment.md`.

**Docker image, pipeline or infrastructure**

The image must keep working as one container on port 8080 as a non-root user, with the API on loopback behind nginx. After changing `Dockerfile`, `deploy/` or `docker-compose.yml`, run `npm run docker:up` and check `http://localhost:8080/health`. After changing `infra/main.bicep`, run `az bicep build --file infra/main.bicep --stdout`. Keep `minReplicas` and `maxReplicas` at 1 (invariant 7). The deploy procedure in `docs/deployment.md` is written for anyone who forks the repository: keep it generic, with placeholders instead of real names.

## Testing notes

- Domain tests build a session with `createSession` + `claimRole`/`markReady` for all four orgs and drive it with `dispatch`, advancing `ctx.now` by hand. Follow that pattern; do not use fake timers.
- API tests use `createApp(new MemoryStore())` and `app.request(...)` with dev tokens from `/api/dev/anonymous`. Without `GAME_FILE` the store stays in memory.
- E2E tests locate elements by `data-testid` (for example `game-<id>`, `start-session`, `session-code`, `free-<org>`, `claim-role`, `phone-<org>`, `ready`). Keep existing test ids stable when refactoring UI. `E2E_VERBOSE=1` logs every tap and the server's answer.
- Layout requirements covered by e2e: the host screen at 1920×1080 must not scroll; phones (360×640, 390×844, 430×932) must not scroll horizontally.
- Only the host screen plays sound (`apps/web/src/sound.ts`); phones stay silent.

## Code style

- TypeScript strict, ES modules. Inside `packages/domain` and `services/game-api`, relative imports use the `.js` extension (`./types.js`).
- No semicolons, single quotes, two-space indent, trailing commas in multiline literals. Match the surrounding file; there is no formatter or linter configured.
- Code, identifiers and comments in English; user-facing text bilingual as above; docs in `docs/` in Dutch.
- Comments only for constraints the code cannot show. No narrating comments.
- Keep dependencies minimal. Prefer the platform and existing libraries (Hono, React Router, `pg`, `qrcode`).

## Should have — keep runtime efficient

Correctness invariants above are musts. These are **shoulds** for changes to the API, persistence, realtime, ticks, or cloud config: avoid unnecessary network, CPU, and storage work. Wasteful loops (for example writing the full session to Postgres on every tick) burn bandwidth and money on any plan and can take the service down when quotas are hit.

1. **Do not chat with the database or network for free.** Postgres (when enabled) is a write-behind copy. Never write the full session document on every tick, heartbeat, or no-op. Persist via debounced `onFlush` (`PERSIST_INTERVAL_MS`); flush immediately only for new or closed sessions (and on process shutdown). The local `GAME_FILE` is only for environments without `DATABASE_URL` and must not be rewritten when nothing changed.
2. **Idle must be cheap.** An open `lobby` / `paused` / abandoned session with nobody playing must not generate steady network, CPU, or DB write load. Skip remote persist when state is unchanged. Idle sessions close after `SESSION_IDLE_MS` (default 30 min without commands/heartbeats) and are deleted from memory and Postgres; keep that behaviour.
3. **Batch and debounce side effects.** Periodic loops (tick, health, cleanup) may run often in memory; side effects that leave the process (DB upserts, external HTTP, large logs) should be rare relative to the loop.
4. **No keep-alive by hammering the network.** No self-fetch loops, dispatcher spam, or chatty probes just to avoid host sleep unless the user explicitly asks.
5. **Prefer in-memory truth.** Do not add per-tick analytics, audit rows, or chatty third-party calls unless required for the game.
6. **When in doubt, estimate.** Before adding a `setInterval`, flush, or external call: rough bytes × frequency × open sessions. If that can reach hundreds of MB/hour with one forgotten session, redesign before merging.
7. **Document cost- or load-relevant behaviour** in `docs/architecture.md` / `docs/design-decisions.md` when you change persistence, ticks, or hosting assumptions.

## Out of scope unless asked

- Ideas that were on the original brief’s backlog (for example a second Association) are not to be built unless asked. See `docs/games/voorstellen.md` for separate pack proposals.
- No connections to real BDI registries, identity providers or organisations.
- No per-entity relational schema; sessions stay one JSON document.
