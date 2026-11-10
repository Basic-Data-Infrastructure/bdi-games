# Lokaal draaien en testen

Voor ontwikkelen, testen en spelen in één ruimte. Alles draait op je eigen computer; een cloudaccount is niet nodig. Telefoons doen mee via hetzelfde wifi-netwerk.

Wil je spelen zonder dat je computer de server is, of met telefoons op mobiele data, zie dan [Online zetten](deployment.md).

## Vereisten

- Node.js 22.12 of nieuwer (https://nodejs.org); uit de 20-reeks werkt 20.19 of nieuwer ook
- Een browser. Voor de acceptatietests installeert Playwright zelf Chromium.
- Optioneel: Docker (bijvoorbeeld Docker Desktop), alleen als je lokaal tegen Postgres wilt testen of de productie-image wilt draaien.

## Starten

Twee terminals in de map van het project:

```bash
npm install
npm run dev:api     # game-API op http://localhost:8787
```

```bash
npm run dev         # website op http://localhost:5173
```

De ontwikkelserver stuurt `/api` door naar de API, dus je hoeft niets in te stellen.

Open http://localhost:5173 op de computer, kies een spel en daarna:

- **Alle rollen op deze computer**: beamer bovenaan en eronder een telefoonvak per rol, elk met een eigen identiteit. Handig om alleen te testen.
- **Nieuw spel**: echte telefoons scannen de QR-code (zie hieronder).
- **Direct de BDI-ronde** (alleen bij de logistieke keten): slaat de ronde zonder BDI over.

Beamer-sneltoetsen: spatie pauzeert, ← opent de terugblik en bladert terug, → bladert vooruit, Esc opent het beheer, F geeft volledig scherm.

## Spelen met echte telefoons op wifi

De computer en de telefoons moeten op hetzelfde wifi-netwerk zitten. Mobiele data op de telefoon werkt niet. Gastnetwerken die apparaten van elkaar afschermen (vaak op kantoor of in hotels) werken ook niet; gebruik dan een hotspot of een [online installatie](deployment.md).

1. Start API en website zoals hierboven, kies een spel en daarna **Nieuw spel**.
2. De QR-codes wijzen naar het wifi-adres van de computer, bijvoorbeeld `http://192.168.1.20:5173`, niet naar `localhost`.
3. Vraagt Windows of Node.js netwerktoegang mag: kies **privénetwerk** en sta het toe.
4. Scan een code met de gewone camera van de telefoon, tik op de link en kies **Neem deze rol**.
5. Lukt scannen niet, typ dan het adres boven de QR-codes in de browser van de telefoon en gebruik **Deelnemen** met de sessiecode.

## Instellingen

De API en de website lezen geen `.env`-bestand. Standaardwaarden zijn voor lokaal gebruik goed. Wil je iets aanpassen, zet de variabele dan in de terminal voordat je start, bijvoorbeeld in PowerShell:

```powershell
$env:PRESENTATION_MS = "1500"
npm run dev:api
```

Alle variabelen met uitleg staan in [`.env.example`](../.env.example). Lokaal staat dev-login automatisch aan: elke browser krijgt een ondertekend tijdelijk token.

## Opslag

Lokaal bewaart de API sessies standaard in `services/game-api/data/game.json`, zodat een herstart van de ontwikkelserver het spel niet kwijtraakt. Verwijder dat bestand om met een schone lei te beginnen. Zet je `DATABASE_URL`, dan gebruikt de API Postgres en geen `game.json`. Zonder beide (zoals de standaard Azure-installatie) leven sessies alleen in het geheugen. Zie [architecture.md](architecture.md).

Optioneel kun je lokaal tegen Postgres testen. `npm run db:up` start met Docker een Postgres-database op poort 5432; daarna wijs je de API ernaar. In PowerShell:

```powershell
npm run db:up
$env:DATABASE_URL = "postgresql://bdi:bdi@localhost:5432/bdi"
npm run dev:api
```

In bash:

```bash
npm run db:up
DATABASE_URL=postgresql://bdi:bdi@localhost:5432/bdi npm run dev:api
```

De API maakt de tabel `session_documents` zelf aan. `npm run db:down` stopt de database; de gegevens blijven in een Docker-volume staan. Met `docker compose --profile app down --volumes` gooi je ook die weg. In PowerShell blijft `DATABASE_URL` gezet zolang de terminal open is; `Remove-Item Env:DATABASE_URL` brengt je terug naar het JSON-bestand.

## De productie-image lokaal draaien

Online draait de game als één Docker-image: nginx met de gebouwde website, en daarachter de API (zie [Online zetten](deployment.md)). Diezelfde image kun je lokaal bouwen en draaien, samen met Postgres:

```bash
npm run docker:up
```

Open daarna http://localhost:8080. Ctrl+C stopt de containers; `npm run db:down` ruimt ze op.

Gebruik dit om te controleren wat de ontwikkelservers niet laten zien: de `Dockerfile`, de nginx-configuratie, de live-verbinding door de proxy en het wegschrijven naar Postgres bij afsluiten. Voor het dagelijkse werk zijn `npm run dev:api` en `npm run dev` sneller, want de image herlaadt geen code: na een wijziging bouw je hem opnieuw.

De acceptatietests kunnen ook tegen de image draaien. In PowerShell:

```powershell
$env:WEB_URL = "http://localhost:8080"
npm run test:e2e
```

Verschillen met de ontwikkelservers:

- De website is een productiebuild. De route `#/bootstrap` staat uit, dus de inloglinks van `seed-session.mjs` werken hier niet.
- De wachtwoorden en sleutels in [`docker-compose.yml`](../docker-compose.yml) zijn lokale voorbeeldwaarden. Gebruik ze nergens anders.
- Wil je telefoons laten meedoen, open de beamer dan op het wifi-adres van de computer, bijvoorbeeld `http://192.168.1.20:8080`, en niet op `localhost`. De QR-codes volgen het adres waarop de beamer de game opent; vanuit de container is het wifi-adres van de computer niet te achterhalen.

## Hulpscripts

- `node scripts/seed-session.mjs` maakt een sessie van de logistieke keten met vier geclaimde, gereed gemelde rollen en print per rol een inloglink. Met `--start` start ronde 1, met `--keepalive` blijven de rollen verbonden, en met `--autoplay S16` speelt het script zelf tot die stap en logt elke handeling. Alleen lokaal: het gebruikt dev-login.
- `npm run dispatcher` post elke halve seconde een tick naar de API. De API doet dat zelf ook; de losse dispatcher is de herstartbare variant.
- `npm run testmode` opent een hostvenster van de logistieke keten. `npm run sessions:two` opent er twee. Met `node scripts/open-sessions.mjs --game access` start je het access-spel.
- `npm run check:bundle` bouwt de website en controleert dat er geen geheime sleutels in de bundel staan.

## Tests

```bash
npm run typecheck   # TypeScript-controle van domein, API en website
npm test            # domein- en API-tests (Vitest)
npx playwright install chromium
npm run test:e2e    # acceptatietests in echte browsers (Playwright)
```

De acceptatietests starten zelf de API en de website als die nog niet draaien. Elke rol krijgt een eigen browsercontext, dus een eigen identiteit; de beamer draait op 1920×1080 en de telefoons op 360×640, 390×844 en 430×932.
Wat de tests dekken:

- `npm test` (29 tests, een paar seconden):
  - Logistieke keten: productbevestiging op id, het file-voorbeeld 06:00/06:30 zonder BDI, meldingen pas na een BDI-abonnement, geweigerde bronlezing, pauzetijd die niet als beslistijd telt, sluiten na inactiviteit of verlopen, en herstarten tijdens een pauze.
  - Access: het toetredingsdossier, foute keuzes als leermoment, het besluit van de provider op drie bronnen, voorspellingen met tijdslimiet, de verzoekkaarten per laag, de vervoerderswissel en de schorsing, en dat spelers de uitkomst pas na het besluit zien.
  - API: gelijktijdige rolclaim, de afgeschermde trainingsweergave, commandotype en gebruiker nooit uit de request-body, de limiet op open sessies per IP, en een sessie aanmaken per spel.
  - Opslag en logboek: nieuwe en gesloten sessies gaan meteen naar de database, latere wijzigingen gebundeld, een stilstaande lobby schrijft niets, en logregels ouder dan 24 uur verdwijnen.
- `npm run test:e2e` (4 scenario's in Chromium, samen ongeveer 8 minuten):
  - Logistieke keten, twee volledige rondes met beamer en vier losse telefoons. Daarbij wordt een telefoon midden in de ronde herladen, scrolt de beamer niet, scrollen telefoons niet horizontaal, komen meldingen alleen in de BDI-ronde en maakt de BDI-ronde minder foute pogingen.
  - Een bezette rol toont direct de vrije rollen.
  - De spelleider kan pauzeren, terugblikken en hervatten met het toetsenbord.
  - Access van toetreding tot nabespreking met beamer en vijf telefoons, zonder scrollen.

  Met `E2E_VERBOSE=1` logt de test elke tik en het antwoord van de server.

Niet automatisch getest: geluid, de kaartanimaties zelf (alleen dat ze op servertijd lopen), en echte telefoons op wifi. Die zijn met de hand in de browser bekeken.
