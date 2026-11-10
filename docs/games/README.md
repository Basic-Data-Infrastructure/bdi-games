# Game packs

Dit platform ondersteunt meerdere BDI-games met hetzelfde speelskelet (beamer + telefoons, claim/ready, zonder→met BDI, policy/authorize). Elk spel is een **pack**.

## Bestaande packs

| Id | Docs |
| --- | --- |
| `logistics` | [logistics.md](logistics.md) |
| `access` | [access.md](access.md) |

Voorstellen voor volgende packs (nog niet gebouwd): [voorstellen.md](voorstellen.md).

## Nieuw pack toevoegen

1. **Domain** onder `packages/domain/src/games/<id>/`:
   - `orgs.ts` — org-constanten (en stappen, als het pack die heeft)
   - de inhoud: bij `logistics` `scenario.ts`, `steps.ts` en `policy.ts`; bij `access` `scenario.ts`, `state.ts`, `decide.ts`, `reduce.ts`, `present.ts` en `view.ts`
   - `definition.ts` — exporteer een `GameDefinition` (`kind: 'rounds'` of `'story'`) en registreer die in `packages/domain/src/catalog.ts`
2. **Engine en API.** De rondes met stappen S00–S20 in `dispatch.ts` zijn die van `logistics`. Een pack met een eigen verloop volgt `access`: een eigen reducer en eigen views, aangesloten in `dispatch.ts` (commando's, start, pauze, hervatten, herstart en tick), in `views.ts` (`playerView` en `trainingView` kiezen op `gameId`) en met een eigen route in `services/game-api/src/app.ts`.
3. **Web** onder `apps/web/src/games/<id>/`:
   - Schermonderdelen voor beamer en telefoon
   - `logistics` registreert kaart en uitleg in `apps/web/src/games/registry.ts` (`hostPackFor`); `access` heeft eigen schermen, gekozen op `gameId` in `host/Host.tsx` en `phone/Play.tsx`
   - De view-types in `apps/web/src/types.ts` en de rollen op het startscherm (`GAME_ORGS` in `screens.tsx`)
4. **Docs** — `docs/games/<id>.md` en een regel in deze tabel
5. Tests: `npm run typecheck` en `npm test`; e2e als je flow of `data-testid`s raakt

Session create stuurt `gameId`. Limieten (`MAX_OPEN_SESSIONS_PER_IP`, idle/TTL) en Postgres-flush gelden **engine-breed** over alle games — niet opnieuw per pack.

## Invarianten bij packs

- Geen I/O in domain-packs (deterministisch).
- Geen extra remote writes vanuit step-handlers; tick/persist-pad blijft debounced.
- Open-sessie-cap telt alle games per client-IP samen.
- Views lekken geen antwoorden of `scenarioSeed` naar spelers.
