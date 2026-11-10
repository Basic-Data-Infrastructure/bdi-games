# Architectuur

Vier lagen:

1. Spelbesturing in `packages/domain`: gedeelde engine plus game packs (stappen, scenario, policy).
2. Vertrouwenscontext: lidmaatschap, transportrollen en het spelbeleid in het actieve pack (`games/logistics/policy.ts`).
3. Organisatiediensten `buyer-data`, `seller-data`, `carrier-data` en `delivery-data`, aangesproken via `/api/data/:org/:type/:id`.
4. Trainingsprojectie, alleen voor de host, via `/api/sessions/:id/training`.

De HTTP-server staat in `services/game-api`. Elke spelhandeling is één aanroep op een gekloonde sessie die daarna atomair wordt opgeslagen. Clients sturen geen rol als bewijs; de server leidt de speler af uit het token.

## Engine en game packs

`SessionState.gameId` wijst naar een pack in `catalog.ts` (`logistics` of `access`). De entree haalt `GET /api/games` op; `POST /api/sessions` stuurt `gameId` mee. Domain-inhoud per pack leeft onder `packages/domain/src/games/<id>/`. Schermonderdelen per pack staan onder `apps/web/src/games/<id>/`. De kaart en uitleg van `logistics` komen via `hostPackFor(gameId)`; `access` heeft een eigen beamer- en telefoonscherm (`AccessHost`, `AccessPlay`), gekozen op `gameId` in `host/Host.tsx` en `phone/Play.tsx`. Pack `access` gebruikt een eigen story-reducer (`session.access`) in plaats van logistieke rondes; tick, idle-cleanup en Postgres-flush blijven engine-breed.

Idle-cleanup, IP-sessielimiet en debounced Postgres-flush horen bij de engine/API, niet bij een pack. Zie ook [games/README.md](games/README.md).

## Opslag

Een sessie is één document: de domeinstaat `SessionState`. **Het geheugen van de API is altijd de bron van waarheid.** Daarnaast kan er een kopie op schijf of in Postgres staan, zodat een herstart het spel niet kwijtraakt. Er is precies één van deze drie modi:

| Modus | Wanneer | Wat er gebeurt bij herstart of deploy |
| --- | --- | --- |
| Alleen geheugen | Geen `DATABASE_URL` en geen `GAME_FILE` (standaard op Azure) | Alle sessies weg. |
| Lokaal bestand | Geen `DATABASE_URL`; lokaal zet de API standaard `GAME_FILE=data/game.json` | Sessies komen terug uit dat bestand. Alleen bij een echte wijziging wordt het herschreven, niet bij elke tick. |
| Postgres | `DATABASE_URL` gezet (optioneel op Azure via `enablePostgres=true`) | Sessies komen terug uit de tabel `session_documents`. Geen `game.json`. |

Met Postgres laadt de API bij het opstarten alle rijen en schrijft gewijzigde sessies terug — gebundeld elke `PERSIST_INTERVAL_MS` (standaard 15 s), meteen bij een nieuwe of gesloten sessie, en bij afsluiten van het proces. De tick-lus (500 ms) werkt alleen in het geheugen; een tick zonder wijziging markeert de sessie niet als dirty. Sessies zonder commando’s of heartbeats langer dan `SESSION_IDLE_MS` (standaard 30 minuten), of voorbij `expiresAt` (`SESSION_TTL_HOURS`), worden gesloten en daarna uit geheugen en (indien aanwezig) Postgres verwijderd. De API maakt de tabel zelf aan als hij ontbreekt.

Omdat het geheugen de bron van waarheid is, draait er precies één API-instantie. Twee instanties naast elkaar zouden elkaars wijzigingen niet zien. Er is bewust geen relationeel model per entiteit.

## Hosting

Online draait alles in één container, gebouwd uit de [`Dockerfile`](../Dockerfile). nginx serveert de gebouwde website en stuurt `/api` en `/health` door naar de API, die in dezelfde container alleen op loopback luistert. Browser en API delen dus één adres: er is geen CORS-instelling en geen `VITE_API_URL` nodig. nginx geeft de SSE-stroom ongebufferd door en schrijft geen toegangslog. `/internal/tick` is van buiten niet bereikbaar. De container draait niet als root.

Stopt de container, dan krijgt de API een stopsignaal en spoelt hij openstaande wijzigingen naar Postgres (als die aan staat) voordat het proces eindigt. Valt de API of nginx weg, dan stopt de hele container, zodat het platform beide samen herstart.

Op Azure is de container een Container App met precies één replica, en bouwt de pipeline in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) bij elke push naar `main` een nieuwe image. Standaard staat Postgres uit: een deploy of herstart wist dan alle sessies. Met `enablePostgres=true` blijven ze bewaard, maar bij een uitrol starten de nieuwe en de oude container kort naast elkaar; de nieuwe laadt wat op dat moment in Postgres staat, dus de laatste tientallen seconden kunnen verloren gaan. Daarom geen deploy tijdens een spel. Zie [deployment.md](deployment.md).

## Realtime

Beamer en telefoons openen `GET /api/sessions/:id/stream?kind=training|player&cursor=`. Dat is een server-sent-events-stroom met de Authorization-header (de client leest hem met `fetch`, niet met `EventSource`, omdat die geen headers kan sturen). De server stuurt direct een `snapshot` en daarna een nieuwe zodra de weergave verandert; de `cursor` is `projectionSeq * 1000 + stateVersion`. Elke tien seconden komt er een `ping`.

De client (`apps/web/src/live.ts`) valt terug op elke seconde ophalen als de stroom wegvalt, en probeert na vijf seconden opnieuw te streamen. Komt er vijftien seconden niets binnen, ook geen ping, dan breekt de client de verbinding zelf af: een half open verbinding achter een proxy of na een wifi-wissel mag niet als live gelden. Omdat elke snapshot de volledige weergave is, is er na herverbinden niets in te halen. De testtafel (alle rollen op één computer) streamt niet maar haalt elke seconde op: een open stroom per vak zou de verbindingslimiet van de browser per adres uitputten.

De API logt SSE open/close (`[bdi] sse.open` / `sse.close`), sessie-aanmaak/start, claim, access-acties en HTTP-fouten naar stdout (de logstroom van de container) en naar `api-events.jsonl` naast `GAME_FILE`. Heartbeats en ticks blijven stil; `LOG_HTTP=all` zet ook geslaagde HTTP aan. Bij `POST /api/sessions` of start van een ronde worden logregels ouder dan 24 uur uit het bestand verwijderd — geen cron; bij lange stilte kan het bestand tijdelijk groter blijven.

## Klok en animatie

De dispatcher verwerkt motorstappen en de outbox. Een herstart leest `dueAt` en de outbox opnieuw. De kaart rekent de positie van voertuigen uit `phaseEnteredAt`, `dueAt` en de servertijd in de snapshot, met een correctie voor het klokverschil van het apparaat. Animatie is een afgeleide van die klok, geen lokale timer die de beurt claimt. Bij hervatten na een pauze schuiven alle deadlines, de fase-starttijd en de begintijd van de beslissing mee, zodat pauzes niet als beslistijd meetellen.

## Identiteit

Elke browser krijgt een door de API ondertekend token (`dev.<userId>.<hmac>`). Deze dev-login is de enige vorm van identiteit: een anonieme identiteit per browser, geen account. Hij staat standaard aan buiten productie en kan met `ALLOW_DEV_AUTH` expliciet aan of uit. Met `NODE_ENV=production` moet hij expliciet aan staan, en dan moet ook `AUTH_SECRET` gezet zijn. De testtafel op één computer geeft elk vak een eigen `slot`, zodat elk vak een eigen token in `localStorage` heeft.

Er is geen `getEverythingForSession` voor spelers. De vier diensten delen in deze simulatie één database; dat is geen fysiek decentraal netwerk.
