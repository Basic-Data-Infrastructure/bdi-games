# Logistieke keten (game pack `logistics`)

Vier rollen: koper (Noordkaai Retail), verkoper (Havenlicht Electronics), vervoerder (Dijklijn Transport) en bezorger (Morgenpost Logistiek).

De host start standaard zonder BDI. Na aflevering start de host ronde 2 met BDI. De knop **Direct de BDI-ronde** slaat ronde 1 over en toont geen vergelijking.

Stappen S00 tot S20 vormen het script. Zonder BDI slaat het spel S02 over. Een foute bevestiging blijft op dezelfde vraag, telt één keer per actie en houdt het voertuig bij de poort. De server wacht de presentatieperiode (standaard 3 seconden) voordat de volgende vraag opent.

De file ontstaat op dag 2 om 04:30. Nieuwe tijden zijn de gekozen aflever-ETA plus 30, 60 en 90 minuten. De verkoper bevestigt beide aflever-ETA's. De koper controleert alleen de chauffeur van de bezorger.

De beamer toont de vraag en de opties zonder te markeren wat gekozen is, plus of afstemming nodig is. Dossiers, gebeurtenissen en registers blijven standaard verborgen; de spelleider kan ze tonen. In de terugblik zijn antwoorden wel zichtbaar. Telefoons krijgen alleen de eigen bron en, in de BDI-ronde, geautoriseerd ontvangen gegevens.

## Code

- Domain: `packages/domain/src/games/logistics/` (`scenario`, `steps`, `policy`, `definition`)
- Web host-pack: `apps/web/src/games/logistics/` (`Map`, `Explainer`), geregistreerd in `apps/web/src/games/registry.ts`
