import type { AccessOrgId } from './orgs.js'

export type LocaleText = { nl: string; en: string }

export type Layer = 'identity' | 'membership' | 'involvement' | 'policy'
export type Outcome = 'delivered' | Layer
export type Lookup = 'association' | 'orchestration' | 'policy'
export type DataKind = 'loading' | 'finance'
export type TransportId = 'T-101' | 'T-102' | 'T-103'
export type Stage = 1 | 2 | 3

export const LAYERS: Layer[] = ['identity', 'membership', 'involvement', 'policy']
export const LOOKUPS: Lookup[] = ['association', 'orchestration', 'policy']
export const LOOKUP_LAYERS: Record<Lookup, Layer[]> = {
  association: ['identity', 'membership'],
  orchestration: ['involvement'],
  policy: ['policy'],
}
export const OUTCOMES: Outcome[] = ['delivered', 'identity', 'membership', 'involvement', 'policy']

export type QuestionOption = { id: string; label: LocaleText; correct: boolean; feedback: LocaleText }
export type QuestionDef = {
  actor: AccessOrgId
  news: LocaleText | null
  prompt: LocaleText
  details: { label: LocaleText; value: LocaleText }[]
  options: QuestionOption[]
}

const organizations: Record<AccessOrgId, {
  id: string
  name: LocaleText
  roleLabel: LocaleText
  blurb: LocaleText
  color: string
  memberAtStart: boolean
}> = {
  admin: {
    id: 'org-admin',
    name: { nl: 'Logistiek Association', en: 'Logistics Association' },
    roleLabel: { nl: 'Association Admin', en: 'Association Admin' },
    blurb: {
      nl: 'Laat organisaties toe en legt hun identiteit, sleutelmateriaal en status vast in het Association Register. Ziet zelf geen data.',
      en: 'Admits organisations and records their identity, key material and status in the Association Register. Never sees data.',
    },
    color: '#1f6f8b',
    memberAtStart: true,
  },
  owner: {
    id: 'org-atlas',
    name: { nl: 'Verlader Atlas', en: 'Shipper Atlas' },
    roleLabel: { nl: 'Data Owner', en: 'Data Owner' },
    blurb: {
      nl: 'Gunt zendingen, legt vast wie erbij betrokken is en bepaalt wat vervoerders mogen zien.',
      en: 'Awards shipments, records who is involved and decides what carriers may see.',
    },
    color: '#c46b2c',
    memberAtStart: true,
  },
  registry: {
    id: 'org-orchestration',
    name: { nl: 'Orchestration Register', en: 'Orchestration Register' },
    roleLabel: { nl: 'Orchestration Register', en: 'Orchestration Register' },
    blurb: {
      nl: 'Legt per zending vast wie in welke rol betrokken is en kan dat aantonen (BVOD). Een feit, geen toestemming.',
      en: 'Records per shipment who is involved in which role and can prove it (BVOD). A fact, not a permission.',
    },
    color: '#3d5a80',
    memberAtStart: true,
  },
  provider: {
    id: 'org-logidata',
    name: { nl: 'LogiData', en: 'LogiData' },
    roleLabel: { nl: 'Data Service Provider', en: 'Data Service Provider' },
    blurb: {
      nl: 'Bewaart de zendinggegevens namens Atlas. Controleert met de BDI Connector elk verzoek en beslist zelf.',
      en: 'Holds shipment data on behalf of Atlas. Checks every request with the BDI Connector and decides locally.',
    },
    color: '#6b4c9a',
    memberAtStart: true,
  },
  consumer: {
    id: 'org-delta',
    name: { nl: 'Vervoerder Delta', en: 'Carrier Delta' },
    roleLabel: { nl: 'Data Consumer', en: 'Data Consumer' },
    blurb: {
      nl: 'Treedt één keer toe en haalt daarna met een eigen ondertekend token zendinggegevens op.',
      en: 'Joins once and then retrieves shipment data with its own signed token.',
    },
    color: '#2e7d4f',
    memberAtStart: false,
  },
}

const transports: Record<TransportId, {
  id: TransportId
  route: LocaleText
  initialCarrier: string | null
  loadInfo: LocaleText
  financeInfo: LocaleText
}> = {
  'T-101': {
    id: 'T-101',
    route: { nl: 'Rotterdam → Venlo', en: 'Rotterdam → Venlo' },
    initialCarrier: null,
    loadInfo: { nl: 'Dock 4 · twee pallets · laden 11.00–12.00', en: 'Dock 4 · two pallets · loading 11:00–12:00' },
    financeInfo: { nl: 'Intern tarief €185 · marge 12%', en: 'Internal rate €185 · margin 12%' },
  },
  'T-102': {
    id: 'T-102',
    route: { nl: 'Rotterdam → Zwolle', en: 'Rotterdam → Zwolle' },
    initialCarrier: 'org-noord',
    loadInfo: { nl: 'Dock 7 · één container · laden 14.00–15.00', en: 'Dock 7 · one container · loading 14:00–15:00' },
    financeInfo: { nl: 'Intern tarief €240 · marge 9%', en: 'Internal rate €240 · margin 9%' },
  },
  'T-103': {
    id: 'T-103',
    route: { nl: 'Rotterdam → Eindhoven', en: 'Rotterdam → Eindhoven' },
    initialCarrier: null,
    loadInfo: { nl: 'Dock 2 · zes rolcontainers · laden 07.00–08.00', en: 'Dock 2 · six roll cages · loading 07:00–08:00' },
    financeInfo: { nl: 'Intern tarief €150 · marge 14%', en: 'Internal rate €150 · margin 14%' },
  },
}

const requestCards = {
  'r-load-101': {
    stage: 1 as Stage,
    transportId: 'T-101' as TransportId,
    kind: 'loading' as DataKind,
    freshToken: true,
    title: { nl: 'Laadinformatie T-101', en: 'Loading info T-101' },
    note: { nl: 'Vers token', en: 'Fresh token' },
  },
  'r-fin-101': {
    stage: 1 as Stage,
    transportId: 'T-101' as TransportId,
    kind: 'finance' as DataKind,
    freshToken: true,
    title: { nl: 'Financiële gegevens T-101', en: 'Financial data T-101' },
    note: { nl: 'Vers token', en: 'Fresh token' },
  },
  'r-load-102': {
    stage: 1 as Stage,
    transportId: 'T-102' as TransportId,
    kind: 'loading' as DataKind,
    freshToken: true,
    title: { nl: 'Laadinformatie T-102', en: 'Loading info T-102' },
    note: { nl: 'Vers token', en: 'Fresh token' },
  },
  'r-old-101': {
    stage: 1 as Stage,
    transportId: 'T-101' as TransportId,
    kind: 'loading' as DataKind,
    freshToken: false,
    title: { nl: 'Laadinformatie T-101 via je oude server', en: 'Loading info T-101 via your old server' },
    note: { nl: 'Token van gisteren', en: "Yesterday's token" },
  },
  'r-again-101': {
    stage: 2 as Stage,
    transportId: 'T-101' as TransportId,
    kind: 'loading' as DataKind,
    freshToken: true,
    title: { nl: 'Laadinformatie T-101 (opnieuw)', en: 'Loading info T-101 (again)' },
    note: { nl: 'Vers token', en: 'Fresh token' },
  },
  'r-load-103': {
    stage: 2 as Stage,
    transportId: 'T-103' as TransportId,
    kind: 'loading' as DataKind,
    freshToken: true,
    title: { nl: 'Laadinformatie T-103', en: 'Loading info T-103' },
    note: { nl: 'Vers token', en: 'Fresh token' },
  },
  'r-update-103': {
    stage: 3 as Stage,
    transportId: 'T-103' as TransportId,
    kind: 'loading' as DataKind,
    freshToken: true,
    title: { nl: 'Laadinformatie T-103 (laatste update)', en: 'Loading info T-103 (latest update)' },
    note: { nl: 'Vers token', en: 'Fresh token' },
  },
}

export type RequestCardId = keyof typeof requestCards

const dossierItems = [
  { id: 'identity', required: true, label: { nl: 'Identiteit van Delta (KvK-nummer / EUID)', en: 'Identity of Delta (company number / EUID)' } },
  { id: 'mandate', required: true, label: { nl: 'Bewijs dat de ondertekenaar Delta mag vertegenwoordigen', en: 'Proof that the signatory may represent Delta' } },
  { id: 'terms', required: true, label: { nl: 'Ondertekend afsprakenstelsel van de Association', en: 'Signed trust framework of the Association' } },
  { id: 'access', required: false, label: { nl: 'Aanvraag: leesrecht op de zendingen van Atlas', en: "Request: read access to Atlas's shipments" } },
] as const

export type DossierItemId = (typeof dossierItems)[number]['id']

const questions: Record<'involve' | 'record' | 'change' | 'recordChange' | 'suspend', QuestionDef> = {
  involve: {
    actor: 'owner',
    news: {
      nl: 'Jij bent Verlader Atlas en regisseert je eigen zendingen. Delta is net lid geworden van de Association. Straks vraagt Delta bij LogiData, die jouw zendinggegevens beheert, de laadinformatie van T-101 op. LogiData moet dan zelf kunnen nagaan of Delta echt bij T-101 hoort, zonder jou te bellen.',
      en: 'You are Shipper Atlas and you orchestrate your own shipments. Delta has just joined the Association. Soon Delta will ask LogiData, which manages your shipment data, for the loading info of T-101. LogiData must then be able to check by itself that Delta really belongs to T-101, without calling you.',
    },
    prompt: {
      nl: 'Hoe zorg je dat LogiData straks kan controleren dat Delta bij T-101 hoort?',
      en: 'How do you make sure LogiData can later verify that Delta belongs to T-101?',
    },
    details: [
      { label: { nl: 'T-101 · Rotterdam → Venlo', en: 'T-101 · Rotterdam → Venlo' }, value: { nl: 'net gegund aan Delta', en: 'just awarded to Delta' } },
      { label: { nl: 'T-102 · Rotterdam → Zwolle', en: 'T-102 · Rotterdam → Zwolle' }, value: { nl: 'Noord, eerder vastgelegd', en: 'Noord, recorded earlier' } },
    ],
    options: [
      {
        id: 'email',
        label: { nl: 'LogiData mailen dat Delta T-101 rijdt', en: 'Email LogiData that Delta drives T-101' },
        correct: false,
        feedback: {
          nl: 'Een mail is niet controleerbaar en werkt alleen bij LogiData. Een registratie in het Orchestration Register kan elke Data Service Provider controleren.',
          en: 'An email cannot be verified and only works at LogiData. A record in the Orchestration Register can be verified by any Data Service Provider.',
        },
      },
      {
        id: 'association',
        label: { nl: 'De Association vragen Delta leesrecht op T-101 te geven', en: 'Ask the Association to give Delta read access to T-101' },
        correct: false,
        feedback: {
          nl: 'De Association regelt lidmaatschap, geen toegang tot jouw zendingen. Wie bij een zending hoort, leg jij als orkestrator vast.',
          en: 'The Association handles membership, not access to your shipments. As orchestrator, you record who belongs to a shipment.',
        },
      },
      {
        id: 'register',
        label: { nl: 'In het Orchestration Register vastleggen: T-101 · Delta · vervoerder', en: 'Record in the Orchestration Register: T-101 · Delta · carrier' },
        correct: true,
        feedback: {
          nl: 'Juist. Atlas is de orkestrator van T-101 en meldt de betrokkenheid aan bij het Orchestration Register.',
          en: 'Right. Atlas orchestrates T-101 and reports the involvement to the Orchestration Register.',
        },
      },
      {
        id: 'delta',
        label: { nl: 'Delta vragen zichzelf aan te melden als vervoerder', en: 'Ask Delta to register itself as carrier' },
        correct: false,
        feedback: {
          nl: 'Dan kan elke partij zich overal aanmelden. De orkestrator van de zending legt betrokkenheid vast, niet de vervoerder zelf.',
          en: 'Then any party could sign up anywhere. The orchestrator of the shipment records involvement, not the carrier itself.',
        },
      },
    ],
  },
  record: {
    actor: 'registry',
    news: {
      nl: 'Melding van Verlader Atlas, orkestrator van T-101: “T-101 · Vervoerder Delta · rol vervoerder”.',
      en: 'Report from Shipper Atlas, orchestrator of T-101: “T-101 · Carrier Delta · role carrier”.',
    },
    prompt: { nl: 'Wat doe je met deze melding?', en: 'What do you do with this report?' },
    details: [],
    options: [
      {
        id: 'grant',
        label: { nl: 'Vastleggen en Delta meteen leesrecht op alle gegevens van T-101 geven', en: 'Record it and give Delta read access to all T-101 data right away' },
        correct: false,
        feedback: {
          nl: 'Een registratie is een feit: wie is betrokken, in welke rol. Het is geen toestemming. Wat Delta mag zien, bepaalt het beleid van Atlas.',
          en: 'A record is a fact: who is involved, in which role. It is not a permission. What Delta may see is decided by the policy of Atlas.',
        },
      },
      {
        id: 'record',
        label: { nl: 'Vastleggen. Op vraag toon ik dit aan met een BVOD', en: 'Record it. On request I prove it with a BVOD' },
        correct: true,
        feedback: {
          nl: 'Juist. Het register legt het feit vast en kan het bij elk verzoek aantonen (BVOD). Het ziet zelf geen zendingdata.',
          en: 'Right. The registry records the fact and can prove it on every request (BVOD). It never sees shipment data.',
        },
      },
      {
        id: 'ask-association',
        label: { nl: 'Eerst toestemming vragen aan de Association', en: 'First ask the Association for approval' },
        correct: false,
        feedback: {
          nl: 'De Association bemoeit zich niet met zendingen. Atlas is de orkestrator van T-101 en mag dit melden.',
          en: 'The Association does not deal with shipments. Atlas orchestrates T-101 and may report this.',
        },
      },
    ],
  },
  change: {
    actor: 'owner',
    news: {
      nl: 'De vrachtwagen van Delta voor T-101 is uitgevallen. Je gunt T-101 nu aan Vervoerder Noord. Delta rijdt morgen zending T-103 (Rotterdam → Eindhoven) voor je.',
      en: "Delta's truck for T-101 broke down. You now award T-101 to Carrier Noord. Tomorrow Delta drives shipment T-103 (Rotterdam → Eindhoven) for you.",
    },
    prompt: { nl: 'Wat doe je?', en: 'What do you do?' },
    details: [
      { label: { nl: 'T-101 · Rotterdam → Venlo', en: 'T-101 · Rotterdam → Venlo' }, value: { nl: 'Delta → Noord', en: 'Delta → Noord' } },
      { label: { nl: 'T-103 · Rotterdam → Eindhoven', en: 'T-103 · Rotterdam → Eindhoven' }, value: { nl: 'nieuw: Delta', en: 'new: Delta' } },
    ],
    options: [
      {
        id: 'suspend',
        label: { nl: 'De Association vragen Delta te schorsen', en: 'Ask the Association to suspend Delta' },
        correct: false,
        feedback: {
          nl: 'Delta deed niets fout en blijft lid. Alleen de betrokkenheid bij T-101 verandert.',
          en: 'Delta did nothing wrong and stays a member. Only the involvement in T-101 changes.',
        },
      },
      {
        id: 'block-key',
        label: { nl: 'LogiData vragen de sleutel van Delta te blokkeren', en: "Ask LogiData to block Delta's key" },
        correct: false,
        feedback: {
          nl: 'Dan kan Delta ook T-103 niet ophalen. De sleutel gaat over identiteit, niet over één zending.',
          en: 'Then Delta cannot retrieve T-103 either. The key is about identity, not about one shipment.',
        },
      },
      {
        id: 'policy-off',
        label: { nl: 'Je beleid aanpassen: vervoerders mogen niets meer zien', en: 'Change your policy: carriers may see nothing' },
        correct: false,
        feedback: {
          nl: 'Dan kan Noord ook niet plannen. Beleid geldt per rol; betrokkenheid per zending.',
          en: 'Then Noord cannot plan either. Policy applies per role; involvement per shipment.',
        },
      },
      {
        id: 'update',
        label: { nl: 'Orchestration Register bijwerken: T-101 → Noord, T-103 → Delta', en: 'Update the Orchestration Register: T-101 → Noord, T-103 → Delta' },
        correct: true,
        feedback: {
          nl: 'Juist. Je meldt de wijziging bij het Orchestration Register. Niemand hoeft opnieuw toe te treden.',
          en: 'Right. You report the change to the Orchestration Register. Nobody needs to join again.',
        },
      },
    ],
  },
  recordChange: {
    actor: 'registry',
    news: {
      nl: 'Melding van Verlader Atlas: “T-101 · vervoerder wordt Noord (Delta vervalt)” en “T-103 · Vervoerder Delta · rol vervoerder”.',
      en: 'Report from Shipper Atlas: “T-101 · carrier becomes Noord (Delta ends)” and “T-103 · Carrier Delta · role carrier”.',
    },
    prompt: { nl: 'Wat doe je met deze wijziging?', en: 'What do you do with this change?' },
    details: [],
    options: [
      {
        id: 'ask-delta',
        label: { nl: 'Eerst Delta om akkoord vragen', en: 'First ask Delta for consent' },
        correct: false,
        feedback: {
          nl: 'Atlas is orkestrator van haar eigen zendingen. Delta hoeft niet in te stemmen.',
          en: 'Atlas orchestrates its own shipments. Delta does not need to agree.',
        },
      },
      {
        id: 'record',
        label: { nl: 'Vastleggen: Delta vervalt bij T-101, T-103 komt erbij', en: 'Record it: Delta ends on T-101, T-103 is added' },
        correct: true,
        feedback: {
          nl: 'Juist. Vanaf nu kan het register voor T-101 geen BVOD meer afgeven voor Delta, wel voor T-103.',
          en: 'Right. From now on the registry can no longer issue a BVOD for Delta on T-101, but it can on T-103.',
        },
      },
      {
        id: 'delete-data',
        label: { nl: 'Delta opdragen de gegevens van T-101 te wissen', en: 'Order Delta to erase the T-101 data' },
        correct: false,
        feedback: {
          nl: 'Het register ziet en beheert geen data. Wat Delta met eerder ontvangen gegevens mag doen, staat in het afsprakenstelsel.',
          en: 'The registry neither sees nor manages data. What Delta may do with data it already received is set in the trust framework.',
        },
      },
    ],
  },
  suspend: {
    actor: 'admin',
    news: {
      nl: 'Delta heeft de verplichte jaarlijkse securitytoets niet ingeleverd. Volgens het afsprakenstelsel volgt schorsing tot de toets binnen is.',
      en: 'Delta did not submit the mandatory annual security audit. Under the trust framework this means suspension until it is submitted.',
    },
    prompt: { nl: 'Wat doe je?', en: 'What do you do?' },
    details: [],
    options: [
      {
        id: 'mail',
        label: { nl: 'Alle Data Service Providers mailen dat ze Delta moeten blokkeren', en: 'Email all Data Service Providers to block Delta' },
        correct: false,
        feedback: {
          nl: 'Dat schaalt niet, en je weet niet bij welke providers Delta gegevens ophaalt. Providers controleren de status zelf bij elk verzoek.',
          en: 'That does not scale, and you do not know where Delta retrieves data. Providers check the status themselves on every request.',
        },
      },
      {
        id: 'orchestration',
        label: { nl: 'Atlas vragen Delta uit het Orchestration Register te halen', en: 'Ask Atlas to remove Delta from the Orchestration Register' },
        correct: false,
        feedback: {
          nl: 'Dat regelt alleen de zendingen van Atlas. Schorsing gaat over lidmaatschap en geldt voor alle data owners tegelijk.',
          en: 'That only covers the shipments of Atlas. Suspension is about membership and applies to all data owners at once.',
        },
      },
      {
        id: 'suspend',
        label: { nl: 'Status van Delta in het Association Register op “geschorst” zetten', en: "Set Delta's status in the Association Register to “suspended”" },
        correct: true,
        feedback: {
          nl: 'Juist. Eén wijziging in het register. Elke provider ziet het bij het volgende verzoek, zonder dat iemand hoeft te bellen.',
          en: 'Right. One change in the register. Every provider sees it on the next request, without anyone having to call.',
        },
      },
      {
        id: 'recall',
        label: { nl: 'LogiData vragen de geleverde gegevens bij Delta terug te halen', en: 'Ask LogiData to recall the data delivered to Delta' },
        correct: false,
        feedback: {
          nl: 'De Association ziet geen data en haalt niets terug. Ze beheert lidmaatschap en status.',
          en: 'The Association never sees data and recalls nothing. It manages membership and status.',
        },
      },
    ],
  },
}

export const accessScenario = {
  association: {
    id: 'assoc-logistics',
    name: { nl: 'Logistiek Association', en: 'Logistics Association' } satisfies LocaleText,
  },
  organizations,
  noord: { id: 'org-noord', name: { nl: 'Vervoerder Noord', en: 'Carrier Noord' } satisfies LocaleText },
  delta: {
    euid: 'NLNHR.90000001',
    tokenAudience: 'LogiData',
  },
  transports,
  requestCards,
  dossierItems,
  questions,
  missions: {
    consumer: {
      nl: 'Jij rijdt T-101. Je planningssysteem heeft de laadinformatie nodig. Speel alle verzoekkaarten en kijk wat je krijgt.',
      en: 'You drive T-101. Your planning system needs the loading info. Play all request cards and see what you get.',
    },
  },
  layers: {
    identity: { label: { nl: 'Authenticatie', en: 'Authentication' }, source: { nl: 'Token + sleutel uit Association Register', en: 'Token + key from Association Register' } },
    membership: { label: { nl: 'Lidmaatschap (BVAD)', en: 'Membership (BVAD)' }, source: { nl: 'Association Register', en: 'Association Register' } },
    involvement: { label: { nl: 'Betrokkenheid (BVOD)', en: 'Involvement (BVOD)' }, source: { nl: 'Orchestration Register', en: 'Orchestration Register' } },
    policy: { label: { nl: 'Beleid Data Owner', en: 'Data Owner policy' }, source: { nl: 'Beleid van Atlas', en: 'Policy of Atlas' } },
  } satisfies Record<Layer, { label: LocaleText; source: LocaleText }>,
  lookups: {
    association: { nl: 'Association Register raadplegen', en: 'Consult Association Register' },
    orchestration: { nl: 'Orchestration Register raadplegen', en: 'Consult Orchestration Register' },
    policy: { nl: 'Beleid van Atlas toepassen', en: 'Apply policy of Atlas' },
  } satisfies Record<Lookup, LocaleText>,
  outcomes: {
    delivered: { nl: 'Geleverd', en: 'Delivered' },
    identity: { nl: 'Geweigerd: token', en: 'Refused: token' },
    membership: { nl: 'Geweigerd: lidmaatschap', en: 'Refused: membership' },
    involvement: { nl: 'Geweigerd: betrokkenheid', en: 'Refused: involvement' },
    policy: { nl: 'Geweigerd: beleid', en: 'Refused: policy' },
  } satisfies Record<Outcome, LocaleText>,
  rules: [
    {
      id: 'membership-no-read',
      shownBy: 'involvement' as Outcome,
      title: { nl: 'Lid zijn is geen leesrecht', en: 'Membership is not a read right' },
      text: {
        nl: 'Delta was lid en echt Delta, maar kreeg T-102 niet: het hoort niet bij die zending.',
        en: 'Delta was a member and really Delta, but did not get T-102: it is not part of that shipment.',
      },
    },
    {
      id: 'auth-every-request',
      shownBy: 'identity' as Outcome,
      title: { nl: 'Authenticatie bij elk verzoek', en: 'Authentication on every request' },
      text: {
        nl: 'Het token van gisteren werd geweigerd. Delta bleef gewoon lid; alleen dat verzoek telde niet.',
        en: "Yesterday's token was refused. Delta stayed a member; only that request did not count.",
      },
    },
    {
      id: 'fact-not-permission',
      shownBy: 'policy' as Outcome,
      title: { nl: 'Betrokkenheid is een feit; het beleid bepaalt wat', en: 'Involvement is a fact; policy decides what' },
      text: {
        nl: 'Delta was vervoerder van T-101, toch bepaalde het beleid van Atlas welke gegevens erbij hoorden.',
        en: 'Delta was the carrier of T-101, yet the policy of Atlas decided which data came with that.',
      },
    },
    {
      id: 'relation-ends',
      shownBy: null,
      title: { nl: 'Toegang stopt als de relatie stopt', en: 'Access stops when the relation stops' },
      text: {
        nl: 'Na de wijziging kreeg Delta T-101 niet meer en T-103 wel. Geen nieuwe toetreding, geen sleutelwissel.',
        en: 'After the change Delta no longer got T-101 but did get T-103. No new onboarding, no key change.',
      },
    },
    {
      id: 'suspension-everywhere',
      shownBy: 'membership' as Outcome,
      title: { nl: 'Schorsing werkt overal tegelijk', en: 'Suspension works everywhere at once' },
      text: {
        nl: 'Eén statuswijziging in het Association Register, en LogiData weigerde bij het volgende verzoek. Niemand hoefde te bellen.',
        en: 'One status change in the Association Register, and LogiData refused on the next request. Nobody had to call.',
      },
    },
    {
      id: 'no-center',
      shownBy: null,
      title: { nl: 'Niemand in het midden', en: 'Nobody in the middle' },
      text: {
        nl: 'Beide registers zagen geen zendingdata. LogiData haalde de bewijzen op en besliste lokaal; de data ging rechtstreeks naar Delta.',
        en: 'Neither registry saw shipment data. LogiData gathered the evidence and decided locally; data went straight to Delta.',
      },
    },
  ],
  debriefQuestions: [
    {
      nl: 'Welke informatie kwam van wie? Wat wist de Association, wat het Orchestration Register, wat Atlas, en wie besliste?',
      en: 'Which information came from whom? What did the Association know, the Orchestration Register, Atlas, and who decided?',
    },
    {
      nl: 'Toetreding gebeurde één keer, registratie per zending en controle bij elk verzoek. Waarom die drie ritmes?',
      en: 'Joining happened once, registration per shipment and checking on every request. Why those three rhythms?',
    },
    {
      nl: 'Wat gebeurt er in jullie keten als een vervoerder een charter inzet? Wie legt dat vast?',
      en: 'What happens in your chain when a carrier uses a subcontractor? Who records that?',
    },
    {
      nl: 'Welke van deze controles doet jullie eigen software al, en welke zou een BDI Connector overnemen?',
      en: 'Which of these checks does your own software already do, and which would a BDI Connector take over?',
    },
  ],
  termCards: [
    {
      term: 'Onboarding',
      nl: 'Eenmalige toelating van een organisatie: identiteit, mandaat en afsprakenstelsel. Daarna kent het Association Register identiteit, sleutelmateriaal en status. Geeft geen leesrecht op data.',
      en: 'One-time admission of an organisation: identity, mandate and trust framework. The Association Register then knows identity, key material and status. Grants no read right on data.',
    },
    {
      term: 'Authentication',
      nl: 'Bij elk verzoek aantonen wie je bent, hier met een token dat Delta ondertekent met het sleutelmateriaal uit de toetreding.',
      en: 'Proving who you are on every request, here with a token Delta signs with the key material from onboarding.',
    },
    {
      term: 'BVAD',
      nl: 'BDI Verifiable Association Data: controleerbaar bewijs van lidmaatschap en actuele status.',
      en: 'BDI Verifiable Association Data: verifiable proof of membership and current status.',
    },
    {
      term: 'BVOD',
      nl: 'BDI Verifiable Orchestration Data: controleerbaar bewijs van betrokkenheid en rol bij een zending. Een feit, geen toestemming.',
      en: 'BDI Verifiable Orchestration Data: verifiable proof of involvement and role in a shipment. A fact, not a permission.',
    },
    {
      term: 'Authorization',
      nl: 'De Data Service Provider beslist per verzoek, met lidmaatschap, betrokkenheid en het beleid van de Data Owner.',
      en: 'The Data Service Provider decides per request, using membership, involvement and the Data Owner policy.',
    },
    {
      term: 'BDI Connector',
      nl: 'Doet deze controles en dwingt het besluit af bij de Data Service Provider. Het beleid blijft van de Data Owner.',
      en: 'Performs these checks and enforces the decision at the Data Service Provider. The policy stays with the Data Owner.',
    },
  ],
} as const

export function requestCardsForStage(stage: Stage): RequestCardId[] {
  return (Object.keys(requestCards) as RequestCardId[]).filter((id) => requestCards[id].stage === stage)
}
