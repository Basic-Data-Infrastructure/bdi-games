# Bijdragen

Bijdragen zijn welkom: een fout melden, een verbetering voorstellen, tekst aanscherpen of code aanleveren.

## Een fout of idee melden

Open een issue op GitHub. Beschrijf bij een fout wat je deed, wat je verwachtte en wat er gebeurde, en op welk scherm (beamer of telefoon, browser, schermformaat). Een screenshot helpt.

Overleg bij een grotere wijziging eerst in een issue, voordat je eraan begint. Dat voorkomt werk dat niet past bij het spel of de architectuur.

Meld een beveiligingsprobleem niet in een openbaar issue, maar rechtstreeks aan de beheerders van de repository.

## Lokaal aan de slag

```bash
npm install
npm run dev:api     # game-API op http://localhost:8787
npm run dev         # website op http://localhost:5173, in een tweede terminal
```

Meer over lokaal draaien, telefoons op wifi en de productie-image staat in [docs/local.md](docs/local.md). De opbouw van de code staat in [docs/architecture.md](docs/architecture.md); de regels die niet mogen breken en de werkwijze bij veelvoorkomende wijzigingen staan in [AGENTS.md](AGENTS.md).

## Een wijziging aanleveren

1. Fork de repository en maak een branch vanaf `main`.
2. Houd de wijziging klein en bij één onderwerp.
3. Controleer je werk:

   ```bash
   npm run typecheck
   npm test
   ```

   Raak je het spelverloop, het beamerscherm, het telefoonscherm of een `data-testid`, draai dan ook `npm run test:e2e`.
4. Werk de documentatie in `docs/` bij als gedrag, configuratie of deployment verandert.
5. Open een pull request naar `main` en beschrijf wat er verandert en waarom. De controles draaien automatisch.

## Afspraken

- Code, namen en commentaar in het Engels; documentatie in `docs/` in het Nederlands.
- Tekst die spelers zien, lever je in het Nederlands én het Engels aan.
- Volg de stijl van het omliggende bestand: geen puntkomma's, enkele aanhalingstekens, twee spaties inspringen.
- Voeg alleen een dependency toe als het niet zonder kan.
- Alle organisaties en gegevens in het spel zijn fictief. Voeg geen echte namen, gegevens of koppelingen met echte registers toe.
- Zet nooit geheimen in de repository.

## Licentie

Het project valt onder de [MIT-licentie](LICENSE). Met een bijdrage ga je ermee akkoord dat die onder dezelfde licentie valt.
