# BDI Game

Educatief multiplayer-platform voor BDI-lesspellen. Games delen één skelet (beamer + telefoons, zonder→met BDI). Het eerste pack is de logistieke keten: koper, verkoper, vervoerder en bezorger — fictieve organisaties, geen aansluiting op echte BDI-registers. Op de entree kies je welk spel je start; packs staan beschreven in [docs/games/](docs/games/).

De beamer toont een eiland met wegen waarover de lading rijdt, een vraagkaart met grote tegels, per rol wat die partij weet, en in de BDI-ronde de keten melding → toegang gecontroleerd → gegevens opgehaald → beschikbaar → bevestigd. De telefoon is een controller in de kleur van de rol: opdracht, meldingen en eigen dossier. Alleen de beamer maakt geluid.

## Draaien: lokaal of online

Er zijn twee manieren om het spel te draaien. Beide gebruiken dezelfde code.

| | Lokaal | Online |
| --- | --- | --- |
| Bedoeld voor | ontwikkelen, testen, spelen in één ruimte | spelen zonder laptop als server |
| Server | je eigen computer | één Docker-container op Azure Container Apps |
| Telefoons | op hetzelfde wifi-netwerk | overal, ook via mobiele data |
| Opslag | `services/game-api/data/game.json` | standaard alleen geheugen; optioneel Postgres |
| Accounts nodig | geen | GitHub en een Azure-abonnement |
| Handleiding | [docs/local.md](docs/local.md) | [docs/deployment.md](docs/deployment.md) |

### Snel lokaal starten

Node.js 20+ is genoeg:

```bash
npm install
npm run dev:api
npm run dev          # in een tweede terminal
```

Open http://localhost:5173 en kies **Alle rollen op deze computer** om alleen te testen, of **Nieuw spel** om telefoons op hetzelfde wifi te laten scannen. Wifi-instellingen, hulpscripts en tests staan in [docs/local.md](docs/local.md). Met Docker draai je ook de productie-image lokaal: `npm run docker:up`.

### Online zetten

Iedereen kan een eigen installatie online zetten. Website en game-API draaien samen in één Docker-image op Azure Container Apps. Sessies staan standaard alleen in het geheugen; Postgres is optioneel. Je richt Azure en GitHub één keer in; daarna bouwt GitHub Actions bij elke push naar `main` een nieuwe image en rolt die uit. Stap voor stap, met waar je wat instelt: [docs/deployment.md](docs/deployment.md).

## Documentatie

Spel en inhoud:

- [Spelverloop](docs/gameplay.md): rollen, rondes, stappen S00 tot S20 en de file.
- [BDI-model in dit spel](docs/bdi-model.md): registers, rechten en de meldingsstroom.

Techniek:

- [Architectuur](docs/architecture.md): lagen, opslag, realtime, klok en identiteit.
- [Ontwerpkeuzes](docs/design-decisions.md): bewuste keuzes in architectuur en spel, en waarom.
- [AGENTS.md](AGENTS.md): instructies voor AI-agents (Engels): commando's, codekaart, invarianten en werkwijze bij veelvoorkomende wijzigingen.
- [Bijdragen](CONTRIBUTING.md): een fout melden of een wijziging aanleveren.

Draaien en beheren:

- [Lokaal draaien en testen](docs/local.md): starten, telefoons op wifi, instellingen, Postgres en de productie-image met Docker, hulpscripts, tests.
- [Online zetten (Azure)](docs/deployment.md): eenmalige inrichting, automatische deploy, beheer, kosten en problemen oplossen.
- [`.env.example`](.env.example): alle omgevingsvariabelen met uitleg.
- [`Dockerfile`](Dockerfile), [`deploy/`](deploy/) en [`docker-compose.yml`](docker-compose.yml): de image en het lokaal draaien ervan.
- [`infra/`](infra/README.md) en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): de Azure-infrastructuur en de pipeline.

## Mappen

- `packages/domain`: spelregels, scenario en beleid (TypeScript, gedeeld door server en tests).
- `services/game-api`: de autoritatieve HTTP-server (Hono op Node).
- `apps/web`: beamer- en telefoonapp (React, Vite).
- `deploy/`: nginx-configuratie en startscript van de Docker-image.
- `infra/`: Bicep-template voor de Azure-resources.
- `e2e/`: Playwright-acceptatietests. `scripts/`: hulpscripts.
