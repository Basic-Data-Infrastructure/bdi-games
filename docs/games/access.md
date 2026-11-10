# Wie mag deze gegevens zien?

Spelpack `access`: een trainingsgame over federatieve identificatie, authenticatie en autorisatie (IAA) binnen **één** Association. Doelgroep: business analisten, architecten en developers. Speelduur ongeveer 20 minuten spel plus 10 minuten nabespreking.

De kern die spelers moeten ervaren: **niemand in het midden beslist**. Elke partij levert een eigen stukje vertrouwen (lidmaatschap, betrokkenheid, beleid) en de Data Service Provider haalt die stukjes bij elk verzoek opnieuw op en beslist zelf.

## Rollen

| Org-id | Schermnaam | Fictieve organisatie | Wat de speler doet |
| --- | --- | --- | --- |
| `admin` | Association Admin | Logistiek Association | Beoordeelt het toetredingsdossier; reageert later op een melding (schorsing) |
| `owner` | Data Owner | Verlader Atlas | Legt betrokkenheid vast, kiest het beleid, verwerkt een vervoerderswissel |
| `registry` | Orchestration Register | Orchestration Register | Beoordeelt meldingen van de orkestrator en legt feiten vast (BVOD) |
| `provider` | Data Service Provider | LogiData (met BDI Connector) | Raadpleegt per verzoek de bronnen en beslist: leveren of weigeren |
| `consumer` | Data Consumer | Vervoerder Delta | Stelt het dossier samen en kiest welke verzoekkaart wordt verstuurd |

Admin, Atlas, het register en Delta voorspellen bij elk verzoek wat LogiData gaat doen. Zo heeft iedereen bij elk verzoek iets te doen.

## Drie ritmes op de beamer

Bovenaan staat een strip met drie banden en een teller per band:

- **Eenmalig · Association** — toetreding (en later één schorsing): `1× toegetreden · 1× geschorst`
- **Per zending · Data Owner** — registraties in het Orchestration Register: `3× vastgelegd`
- **Bij elk verzoek · Data Service Provider** — gecontroleerde verzoeken: `7× gecontroleerd`

De tellers maken het verschil in frequentie zichtbaar zonder uitleg.

Daaronder staat links het netwerk (Association Register, Orchestration Register, Delta, LogiData met connector, Atlas met beleid) en rechts de actuele kaart: de vraag met keuzes en uitleg, of het verzoek dat LogiData beoordeelt (HTTP-regel, token-claims, vier controles, voorspellingen, besluit). Bij elke raadpleging licht de lijn van LogiData naar die bron groen of rood op, met de vraag erbij ("lid? echt Delta?", "betrokken?", "mag dit?").

## Speelverloop

### 1. Toetreding (eenmalig)

1. **Delta** kiest wat in het dossier gaat: identiteit (KvK/EUID), mandaat, ondertekend afsprakenstelsel, en een afleider: "leesrecht op de zendingen van Atlas".
2. **Admin** kiest *toelaten* of *teruggeven*. Toelaten mag alleen als de drie verplichte onderdelen er zijn en de afleider niet. Een fout antwoord geeft uitleg (bijvoorbeeld: zonder mandaat is niet zeker dat de ondertekenaar namens Delta mag tekenen; de Association verleent geen leesrecht op data).

Resultaat: Delta is lid; het Association Register kent identiteit, sleutelmateriaal en status (BVAD). Of Delta het sleutelmateriaal aanlevert of de Admin het verstrekt, laat het spel open. Dit gebeurt één keer.

### 2. Per zending (Data Owner)

3. **Atlas** ziet zijn twee zendingen: T-101 (net gegund aan Delta) en T-102 (Noord, eerder vastgelegd). Atlas kiest hoe LogiData straks zelf kan controleren dat Delta bij T-101 hoort. Juist: vastleggen in het Orchestration Register. Afleiders: LogiData mailen, de Association om leesrecht vragen, Delta zichzelf laten aanmelden.
4. **Orchestration Register** kiest wat het met de melding doet. Juist: vastleggen en op vraag aantonen (BVOD). Afleiders: meteen leesrecht geven (een registratie is een feit, geen toestemming), eerst de Association vragen.
5. **Atlas** legt beleid vast bij LogiData: mogen partijen met de rol vervoerder laadinformatie en/of financiële gegevens zien? LogiData dwingt dat beleid daarna bij elk verzoek af; op de beamer licht de lijn van Atlas naar LogiData op. Er is geen goed of fout antwoord; de gevolgen worden zichtbaar bij de verzoeken.

### 3. Bij elk verzoek (ronde 1)

Delta speelt vier verzoekkaarten in een zelfgekozen volgorde:

| Kaart | Wat de zaal ziet (bij need-to-know-beleid) |
| --- | --- |
| Laadinformatie T-101 | Alle lagen in orde → geleverd |
| Financiële gegevens T-101 | Betrokken, maar beleid staat het niet toe → geweigerd (beleid) |
| Laadinformatie T-102 | Lid en echt Delta, maar niet betrokken (Noord rijdt) → geweigerd (betrokkenheid) |
| Laadinformatie T-101 via je oude server | Token van gisteren → geweigerd (token); Delta blijft lid |

Per verzoek:

1. Delta verstuurt de kaart met een zelf ondertekend token.
2. De vier andere spelers (behalve LogiData) voorspellen: geleverd, of geweigerd op token, lidmaatschap, betrokkenheid of beleid. LogiData kan pas beginnen als iedereen voorspeld heeft, of 15 seconden na de presentatiepauze.
3. **LogiData** raadpleegt in eigen volgorde het Association Register (token + lidmaatschap), het Orchestration Register (BVOD) en het beleid van Atlas, en beslist *leveren* of *weigeren*.
   - Leveren voordat alle bronnen zijn geraadpleegd: "Zero trust: raadpleeg eerst alle bronnen voordat je levert."
   - Leveren terwijl een bron "nee" zegt: geblokkeerd als datalek.
   - Weigeren zonder gevonden reden of terwijl alles in orde is: uitleg, opnieuw kiezen.
   - Weigeren mag zodra één bron "nee" zegt (fail fast); de overige lagen worden na afloop wel getoond.
4. De beamer toont de uitkomst, de juiste en foute voorspellingen en, bij levering, de data die rechtstreeks naar Delta gaat. Die uitkomst blijft staan tot Delta de volgende kaart kiest.

### 4. Er verandert iets (ronde 2)

6. **Atlas** krijgt een melding: de vrachtwagen van Delta voor T-101 valt uit; T-101 gaat naar Noord, Delta rijdt T-103. Juist: Orchestration Register bijwerken. Afleiders: Delta laten schorsen, de sleutel van Delta laten blokkeren, het beleid voor alle vervoerders dichtzetten.
7. **Orchestration Register** legt de wijziging vast (afleiders: Delta om akkoord vragen, Delta opdragen data te wissen).
8. Alleen als ronde 1 liet zien dat het beleid te streng of te ruim was, krijgt **Atlas** de kans het beleid aan te passen.
9. Delta speelt *Laadinformatie T-101 (opnieuw)* → geweigerd (betrokkenheid; eerder ontvangen gegevens blijven gelabeld "eerder ontvangen · geen nieuwe updates") en *Laadinformatie T-103* → geleverd. Geen nieuwe toetreding, geen sleutelwissel.

### 5. Schorsing (ronde 3)

10. **Admin** krijgt een melding: Delta leverde de securitytoets niet in. Juist: status in het Association Register op "geschorst". Afleiders: alle providers mailen, Atlas vragen Delta uit het register te halen, LogiData vragen data terug te halen.
11. Delta speelt *Laadinformatie T-103 (laatste update)* → geweigerd (lidmaatschap). Niemand heeft LogiData gebeld; de status wordt bij het verzoek gecontroleerd.

## Nabespreking

Op de beamer, nadat de laatste uitkomst is getoond:

- Resultaat: kon Delta T-101 en T-103 plannen, bleven tarief en marge bij Atlas?
- Hoe vaak gebeurde wat (toetreding, registraties, verzoeken, geraadpleegde bronnen)
- Voorspellingen goed per rol en leermomenten (foute keuzes) per rol
- Zes regels die de zaal zag, gemarkeerd als het spel ze echt liet zien: lid zijn is geen leesrecht; authenticatie bij elk verzoek; betrokkenheid is een feit, het beleid bepaalt wat; toegang stopt als de relatie stopt; schorsing werkt overal tegelijk; niemand in het midden
- Vier bespreekvragen, onder meer over charters en wat een BDI Connector zou overnemen

Spelers zien op hun telefoon het resultaat, hun eigen voorspellingsscore en de zes regels. De tellingen, de scores van de andere rollen, de leermomenten en de bespreekvragen staan alleen op de beamer.

Uitleg na een keuze en de uitkomst van een verzoek blijven op de telefoon staan tot de speler op **OK** tikt; ze verdwijnen niet na de presentatiepauze.

## Spelleider

- De spelleider neemt geen beslissingen; de server beoordeelt elke keuze.
- Pauze, terugkijken (pijltjes), herstart en beëindigen werken zoals bij de logistieke game. Terugkijken toont per stap de kaart en het netwerk zoals ze toen waren.
- Na elke actie houdt het scherm de keuze `PRESENTATION_MS` vast (een raadpleging door LogiData de helft daarvan).
- Bespreekpunten die goed werken: waarom de Admin de afleider "leesrecht" moet weigeren; waarom het register geen toestemming geeft; waarom LogiData niet gebeld hoeft te worden bij een schorsing.

## Technische notities

- Domain: `packages/domain/src/games/access/` — `scenario.ts` (inhoud, vragen, kaarten), `decide.ts` (waarheid per laag, oordeel over het besluit), `present.ts` (kaart en netwerk voor beamer en terugkijken), `reduce.ts` (commando's), `view.ts` (speler- en trainingsview).
- Commando's via `POST /api/sessions/:id/access` met `type`: `submitDossier`, `reviewDossier`, `answer`, `setPolicy`, `sendRequest`, `predict`, `lookup`, `decide`.
- `predict` heeft geen `expectedVersion` en loopt door de presentatiepauze heen, zodat vier spelers tegelijk kunnen voorspellen zonder conflicten. Voorspellingen sluiten bij de eerste raadpleging of het eerste besluit van LogiData.
- Spelers zien de uitkomst van een verzoek pas na het besluit van LogiData; controles worden alleen getoond voor zover LogiData ze heeft uitgevoerd.
- Web: `apps/web/src/games/access/` — `Board.tsx` (fasestrip, netwerk), `Card.tsx` (kaart, verzoek, nabespreking), `Host.tsx`, `Play.tsx`.
- Bewust buiten deze basisgame: een tweede Association, onderaannemers/charters, een Authorization Registry en personen (Identity Provider).
