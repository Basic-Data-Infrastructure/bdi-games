# Infrastructuur (Bicep)

[`main.bicep`](main.bicep) maakt in één resource group alles aan wat een eigen installatie op Azure nodig heeft. De volledige procedure, met de commando's in de juiste volgorde, staat in [docs/deployment.md](../docs/deployment.md). Dit bestand is de naslag voor het template zelf.

## Wat het template aanmaakt

| Resource | Naam | Doel |
| --- | --- | --- |
| Log Analytics workspace | `<namePrefix>-logs` | Logregels van de container, 30 dagen bewaard. |
| Container Apps environment | `<namePrefix>-env` | Omgeving waarin de app draait (Consumption). |
| Container Registry (Basic) | `<namePrefix><uniek>` | Opslag voor de images die de pipeline bouwt. |
| Managed identity | `<namePrefix>-pull` | Waarmee de Container App images ophaalt (rol AcrPull op de registry). |
| Managed identity | `<namePrefix>-deploy` | Waarmee GitHub Actions inlogt via OIDC (rol Contributor op de Container App, de omgeving, de registry en de pull-identity). |
| PostgreSQL Flexible Server (Burstable B1ms) | `<namePrefix>-pg-<uniek>` | Alleen bij `enablePostgres=true`: database `bdi` met de sessies. |
| Container App | `<namePrefix>` | De game: 0,25 vCPU, 0,5 GiB, precies één replica, publiek via HTTPS. |

`<uniek>` is afgeleid van de resource group, zodat wereldwijd unieke namen niet botsen.

## Parameters

| Parameter | Verplicht | Standaard | Betekenis |
| --- | --- | --- | --- |
| `githubRepository` | ja | | Repository die mag deployen, als `<github-owner>/<repo>`, exact zoals op GitHub. |
| `authSecret` | ja | | Sleutel waarmee de API identiteitstokens ondertekent, minstens 32 tekens. |
| `internalTickSecret` | ja | | Sleutel voor het interne tick-endpoint, minstens 32 tekens. |
| `enablePostgres` | nee | `false` | Zet op `true` om een PostgreSQL-server aan te maken en sessies daar te bewaren. |
| `postgresAdminPassword` | alleen bij Postgres | leeg | Wachtwoord van de databasebeheerder, minstens 16 tekens. Alleen nodig met `enablePostgres=true`. |
| `imageTag` | nee | leeg | Tag van de image die moet draaien. Leeg alleen bij de allereerste uitrol; daarna `latest`. |
| `githubBranch` | nee | `main` | Branch waarvan pushes mogen deployen. |
| `namePrefix` | nee | `bdigames` | Voorvoegsel voor resourcenamen: 3 tot 12 kleine letters en cijfers. |
| `location` | nee | regio van de resource group | Regio voor alle resources. |
| `postgresLocation` | nee | gelijk aan `location` | Afwijkende regio voor PostgreSQL, als je abonnement die in `location` niet mag aanmaken. |
| `postgresAdminLogin` | nee | `bdiadmin` | Loginnaam van de databasebeheerder. |
| `customDomain` | nee | leeg | Optionele hint (bijvoorbeeld `game.voorbeeld.nl`) in de uitvoer. Koppel het domein in het Azure-portaal; zie [docs/deployment.md](../docs/deployment.md#eigen-domein). |

De geheime parameters zijn `@secure()`: Azure bewaart ze niet in de deploymentgeschiedenis. Met Postgres zet het template `DATABASE_URL` (met `sslmode=verify-full`) als secret op de Container App.

## Uitvoer

De uitvoer met een naam die met `AZURE_` begint, neem je één op één over als GitHub Actions-variabele: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_CONTAINER_REGISTRY` en `AZURE_CONTAINER_APP`. `appUrl` is het adres van de game. `enablePostgres` en `customDomainHint` herhalen de gekozen parameters.

## Controleren zonder uit te rollen

```bash
az bicep build --file infra/main.bicep --stdout > /dev/null   # syntaxis en typen
az deployment group what-if \
  --resource-group <resource-group> \
  --template-file infra/main.bicep \
  --parameters githubRepository=<github-owner>/<repo> imageTag=latest \
               authSecret=<sleutel> internalTickSecret=<sleutel>
```

`what-if` toont wat een uitrol zou wijzigen, zonder iets aan te passen. Voor een what-if mét database voeg je `enablePostgres=true` en `postgresAdminPassword=<wachtwoord>` toe.

## Vaste keuzes

- **Eén replica.** `minReplicas` en `maxReplicas` staan beide op 1. De API houdt sessies in het geheugen van één proces; een tweede replica zou een eigen, afwijkende toestand hebben. Verhoog `maxReplicas` niet.
- **Postgres standaard uit.** Zonder database verdwijnen sessies bij elke herstart of deploy. Zet hem alleen aan als je dat wilt vermijden; hij is de grootste kostenpost.
- **Database bereikbaar vanuit Azure.** De firewallregel `0.0.0.0` laat verbindingen toe die binnen Azure ontstaan, niet vanaf internet. De server eist TLS en het beheerderswachtwoord. Wil je het strenger, zet de Container Apps environment en de database dan in een virtueel netwerk; dat valt buiten dit template.
- **Tijdelijke image bij de eerste uitrol.** Zonder `imageTag` start de app met een voorbeeldimage van Microsoft. Die antwoordt niet op de poort van de game, dus de app blijft ongezond tot de pipeline de eerste echte image heeft uitgerold.
