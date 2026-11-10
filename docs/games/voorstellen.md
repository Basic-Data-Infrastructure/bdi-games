# Voorstellen voor nieuwe game packs

Drie scenario's die verder bouwen op de twee bestaande packs (`logistics`: notificeren en ophalen; `access`: federatieve IAA). Elk scenario past in hetzelfde skelet: beamer bij de spelleider, telefoons per rol via QR, claim/ready, servergestuurde stappen, presentatiepauze, terugkijken en een nabespreking. Ze zijn bedoeld voor trainingen én voor een stand op een beurs.

Uitgangspunt per scenario: één kernvraag die spelers aan den lijve ervaren, niet alleen horen. Elk scenario noemt wat het platform al heeft en wat nieuw moet.

| | A. Negentig koppelingen | B. Van file tot melding | C. Charter in de keten |
| --- | --- | --- | --- |
| Kernvraag | Waarom federatief en niet punt-tot-punt of platform? | Wie moet wat weten, wanneer, en hoe? | Wie mag registreren en waar leg je toegang vast? |
| BDI-onderwerp | Drie manieren van data delen, Association, afsprakenstelsel | Event Layer Model, notificatie vs. ophalen, doelbinding | Orkestratie, delegatie, autorisatierichtingen A/B/C |
| Doelgroep | Iedereen; sterk voor management en beurs | Analisten, architecten, developers | Architecten, developers, ketenregisseurs |
| Duur | 8–10 min (beurs) / 20 min | 10 min (beurs) / 25 min | 30 min (training) |
| Spelers | 4–6 | 4–5 | 5–6 |
| Herbruik | Rondes zonder→met, vergelijkingsscherm | Kaart, outbox/notify/fetch, beleid | Access-netwerk, voorspellingen, controles |

---

## A. Negentig koppelingen

*"Tien partijen die allemaal 1-op-1 koppelen, hebben er negentig nodig."* Spelers bouwen dezelfde keten drie keer: punt-tot-punt, via een platform en federatief. Ze voelen het verschil in werk, afhankelijkheid en regie.

### Leerdoelen

- Federatief aansluiten is één keer werk per partij; punt-tot-punt groeit kwadratisch.
- Een platform is snel, maar de platformpartij bepaalt voorwaarden, ziet de data en is een single point of dependency.
- In het federatieve model blijft data bij de bron en beslist de Data Owner (via zijn Data Service Provider).
- Elk model heeft zijn plek: bij een vaste kleine community kan punt-tot-punt of een platform prima zijn.

### Rollen

Verhuurder, Vervoerder, Aannemer, Groothandel, plus optioneel Softwareleverancier (TMS) en Nieuwkomer (charter die halverwege aansluit). Vier tot zes telefoons; lege rollen speelt een bot (zie "Gedeelde verbeteringen").

### Verloop (drie rondes van ±3 minuten)

1. **Punt-tot-punt.** Het scherm toont vier datastromen (transportopdracht, ETA, voortgang, ontvangstmelding). Voor elke stroom moeten beide partijen een koppeling "bouwen": een korte tikopdracht op de telefoon (kies formaat, spreek veld af, test). De spaghetti op de beamer groeit live. Halverwege: *"Charter Zuid doet mee"* — iedereen moet opnieuw bouwen.
2. **Platform.** Iedereen sluit één keer aan op "KetenPlatform". Snel. Dan gebeuren er dingen waar spelers op moeten reageren: tariefverhoging, platformstoring (alle stromen vallen tegelijk stil), het platform wil ritdata gebruiken voor eigen analyses (accepteren of vertrekken? vertrekken kost alle koppelingen). Charter Zuid sluit aan onder de voorwaarden van het platform.
3. **Federatief (BDI).** Iedereen treedt één keer toe tot de Association (kort dossier, zoals in `access`) en zet een connector aan. Per stroom legt de Data Owner vast wie mag (zoals in `access`). Charter Zuid: één toetreding, één registratie door de orkestrator, klaar. Storing bij één partij raakt alleen die partij.

Per ronde voorspellen spelers vooraf hoeveel koppelingen en minuten het kost; na afloop klopt het of niet.

### Beamer

- Netwerkgraaf per ronde: spaghetti, ster, gefedereerd web met de Association als vertrouwenslaag (niet als datahub).
- Tellers: aantal koppelingen, tijd tot nieuwe partner meedraait, wie ziet welke data, wat valt uit bij een storing.
- Vergelijkingsscherm na ronde 3 (zoals `Comparison` in `logistics`), met eerlijke kanttekening: welk model past bij welke situatie.

### Platform

- Herbruik: rondestructuur zonder → met (uitgebreid naar drie rondes), vergelijkingsscherm, presentatiepauze, voorspellingen uit `access`.
- Nieuw: domain pack `networks` met een eenvoudige kosten- en storingsmodel per ronde; host-visual voor de groeiende graaf; tikopdrachten voor "koppeling bouwen".
- Risico: het mag geen reclame voor federatief worden. Laat de platformronde ook echte voordelen tonen (snel starten) en laat de nabespreking vragen wanneer punt-tot-punt of platform beter past.

---

## B. Van file tot melding

Een gebeurtenis in de echte wereld krijgt per ontvanger een andere betekenis. Spelers ontdekken het Event Layer Model door het zelf te doen: wat is er gebeurd, voor wie betekent dat iets, wat stuur je, en wie haalt wat op?

### Leerdoelen

- Vier lagen: real-world event → business event → event notification → technical message.
- Eén gebeurtenis, verschillende business events per ontvanger (file: *dock later inplannen* voor de ontvanger, *klantenservice informeren* voor de groothandel).
- Een notificatie bevat minimale metadata en een verwijzing; details haal je op met je eigen rechten (zoals in `logistics`).
- Per datastroom kies je ophalen of notificeren, afhankelijk van hoe tijdkritisch het is.
- Doelbinding: ritdata voor tijdslot, niet om chauffeurs te beoordelen.

### Rollen

Vervoerder (Data Owner en Data Service Provider van ritdata), Verhuurder of Groothandel, Aannemer of Ontvanger, Koelketen-kwaliteitsdienst, en optioneel een "Nieuwsgierige partij" die zich op alles abonneert.

### Verloop

1. **Ontwerpronde (2 min).** Per datastroom (opdracht, ETA, temperatuur, ontvangstmelding) kiest de Data Owner samen met de afnemers: periodiek ophalen (elk uur) of notificatie. Voorbeeld uit de handreiking: opdracht en ontvangstmelding mogen ophalen, ETA en temperatuur moeten notificeren.
2. **Rit (6–8 min).** Op de kaart (de bestaande kaart uit `logistics`) rijdt de truck. Er gebeuren echte dingen: file, koelmotor valt 20 minuten uit, chauffeur rijdt om. Bij elke gebeurtenis:
   - De vervoerder kiest welk business event het is en voor wie (meerkeuze per ontvanger).
   - Ontvangers krijgen alleen een notificatie: "zending 0123 · etaUpdated · bron". Ze kiezen: ophalen of negeren, en welke actie (dock verschuiven, kwaliteitscontrole, niets).
   - Wie op ophalen stond, ziet het pas bij de volgende ophaalronde, soms te laat.
   - De nieuwsgierige partij probeert mee te lezen; zonder betrokkenheid krijgt die alleen een notificatie als de vervoerder te ruim notificeert, en kan nooit de payload ophalen.
3. **Gevolgen.** Dock op tijd verschoven? Koelwaar gecontroleerd vóór acceptatie? Te veel meldingen naar de verkeerde partij?

### Beamer

- Vier lagen naast elkaar per gebeurtenis, live gevuld: wat gebeurde er, wat betekent het voor wie, welk bericht ging eruit, wat werd opgehaald.
- Kaart met truck en tijd; per ontvanger een tijdlijn "wist het om … / handelde om …".
- Nabespreking: welke stromen hadden een notificatie nodig, waar was ophalen genoeg, waar ging doelbinding mis.

### Platform

- Herbruik: kaart, simulatieklok, outbox → notificatie → ophalen en `authorize` uit `logistics`, voorspellingen uit `access`.
- Nieuw: domain pack `events` met een gebeurtenissenscript (zoals S00–S20) en een ontwerpronde die de stroominstellingen bewaart; host-visual voor de vier lagen.
- Aansluiting op de BDI Logistics Event KIT (eventtypen zoals `etaUpdated`, `temperatureExceeded`) houdt het herkenbaar voor developers.

---

## C. Charter in de keten

Op een drukke dag zet de vervoerder een charter in. Wie mag die registreren, wat mag de charter zien, en wat betekent je keuze voor waar toegang wordt vastgelegd? Spelers spelen hetzelfde incident onder drie ontwerpen (A, B en C uit de handreiking) en voelen de afweging.

### Leerdoelen

- Orkestratie centraal (A): toegang volgt uit betrokkenheid; delegatie (vervoerder namens verlader) en onderaannemers vragen spelregels.
- Autorisatie centraal (B): één register voor toestemmingen; eenvoudig voor kleine partijen, maar de Data Owner legt alles apart vast en wordt een knelpunt.
- Autorisatie decentraal (C): elke Data Service Provider beheert het zelf; maximale autonomie, maar een charter moet bij elke bron apart worden ingericht.
- Rolscheiding: een charter is vervoerder voor deze zending, maar mag niet automatisch alles zien wat de hoofdvervoerder ziet.
- Na afloop moet toegang aantoonbaar vervallen.

### Rollen

Verlader (Data Owner, orkestrator), Hoofdvervoerder (Data Consumer én Data Owner van ritdata), Charter (nieuw lid), ERP-platform van de verlader (Data Service Provider), Register (orkestratie- of autorisatieregister, afhankelijk van de ronde), optioneel Association Admin.

### Verloop (drie rondes, elk 8–10 min)

1. **Stemming.** Alle spelers stemmen als leden van de Association: welke richting kiezen we voor deze datastroom (A, B of C)? De meerderheid bepaalt de ronde; de andere richtingen volgen daarna, zodat elke groep ze alle drie ervaart.
2. **Incident.** Om 06:00 valt een truck uit; de hoofdvervoerder zet om 06:10 charter Zuid in.
   - In A: de hoofdvervoerder vraagt het register een delegatie te registreren; het register controleert of de verlader delegatie toestaat. De charter krijgt een BVOD als "subvervoerder".
   - In B: de verlader moet expliciet toestemming registreren voor Zuid. Is de verlader niet bereikbaar (gebeurtenis), dan wacht iedereen.
   - In C: het ERP-platform én het TMS van de hoofdvervoerder moeten elk een eigen toegangsregel voor Zuid aanmaken; een vergeten regel betekent dat Zuid niets of juist te veel ziet.
3. **Verzoeken.** Zuid en de anderen vragen gegevens op; de Data Service Provider controleert zoals in `access` (bron raadplegen, besluiten), de rest voorspelt.
4. **Afsluiten.** Rit klaar: de toegang van Zuid moet vervallen. Welke stappen kost dat per ontwerp, en wie vergeet wat?

### Beamer

- Netwerk uit `access`, uitgebreid met de charter en een delegatiepijl.
- Per ronde een scorebord: tijd tot Zuid kon rijden, aantal handelingen per partij, onterecht geleverde of geweigerde gegevens, toegang na afloop.
- Nabespreking: welke richting past bij welke datastroom? (De handreiking: opdracht decentraal via de gunning in het ERP, ritdata via een gedeeld register.)

### Platform

- Herbruik: `access` bijna volledig (netwerkweergave, verzoekkaart met controles, voorspellingen, uitlegkaarten, fasestrip met tellers).
- Nieuw: stemfase (alle telefoons tegelijk, zelfde patroon als voorspellen), drie varianten van de beleidsbron (`orchestration`, `authorization`, `decentral`) achter dezelfde `layerStatus`-functie, delegatie in het Orchestration Register.
- Uitbreiding later: een tweede Association waar de charter lid van is (federatie tussen Associations, token exchange). Die hoort niet bij deze basisgame.

---

## Gedeelde verbeteringen voor training en beurs

Deze maken alle drie de scenario's (en de bestaande packs) beter inzetbaar:

- **Bots voor lege rollen.** Op een beurs zijn er niet altijd vijf spelers. Een bot die de juiste keuze maakt na een korte pauze laat twee mensen een vijfrolsgame spelen. Past in de tick-loop: de server handelt namens een vrijgegeven rol, met dezelfde commando's.
- **Beursmodus.** Kortere presentatiepauze, automatisch opnieuw starten na de nabespreking, een "doe mee"-scherm met grote QR-codes wanneer niemand speelt (zonder netwerkverkeer bij idle, conform de efficiency-regels in `AGENTS.md`).
- **Highscore per dag.** Voorspellingsscore per team, anoniem, alleen in het geheugen van de sessie.
