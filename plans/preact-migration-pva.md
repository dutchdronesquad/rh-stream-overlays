# PVA: Preact migratie voor Stream Overlays

Dit document beschrijft een gefaseerde aanpak om de overlay-frontend van de plugin te moderniseren met Preact, Vite en TypeScript. Het doel is niet alleen een ander framework gebruiken, maar vooral het ontwikkelproces verbeteren: gedeelde socket-integratie, herbruikbare overlay-componenten, betere testbaarheid en minder duplicatie tussen themes en overlaytypes.

## Aanleiding

De huidige plugin bestaat uit RotorHazard templates met losse JavaScript- en CSS-bestanden per overlay of theme. Dat werkt goed voor eenvoudige overlays, maar naarmate er meer overlaytypes bijkomen ontstaan een paar terugkerende problemen:

- socket-event handling wordt per overlay opnieuw opgezet;
- rendering, animaties en state updates zitten vaak in dezelfde bestanden;
- themes delen gedrag, maar niet altijd dezelfde implementatie;
- DOM-manipulatie maakt regressies lastig te testen;
- grote bestanden zoals live maps en shared node overlays worden moeilijker te wijzigen zonder neveneffecten.

Preact is een goede kandidaat omdat het een React-achtig componentmodel biedt met een kleine runtime. Dat past beter bij OBS browser sources dan een zware frontend-app, terwijl we wel componenten, hooks, state management en een moderne build pipeline krijgen.

## Doelen

- Een gedeelde frontend-laag maken voor alle overlays.
- RotorHazard socket-events centraal afhandelen en typed/stateful beschikbaar maken.
- Overlay rendering opdelen in kleine, herbruikbare componenten.
- Theme-verschillen expliciet maken via theme-configuratie en CSS variables.
- Build output statisch houden, zodat RotorHazard alleen gebundelde assets hoeft te serveren.
- Migratie per overlaytype mogelijk maken zonder big-bang rewrite.
- TrackDraw core-logica framework-onafhankelijk houden.

## Niet-doelen

- Geen volledige RotorHazard plugin rewrite.
- Geen backend/API-wijzigingen tenzij een frontend-migratie dat echt afdwingt.
- Geen single-page app voor alle overlays samen; OBS laadt nog steeds losse overlay-URLs.
- Geen verplichte React-migratie. Preact blijft de voorkeursrichting.
- Geen visuele redesigns tijdens de technische migratie, behalve waar nodig om regressies te voorkomen.

## Huidige situatie

De plugin heeft meerdere overlayfamilies:

| Overlayfamilie | Huidige kenmerken | Migratiewaarde |
|----------------|-------------------|----------------|
| Topbars | race status, klok, leaderboards, labels | Hoog: veel socket-state en herbruikbare statusweergave |
| Node overlays | per-node pilot/lap info, theme-specifieke animatie | Hoog: gedeelde componenten met theme variants |
| Upcoming heat | heat, pilot, class, format en frequency data | Hoog: veel herbruikbare data-normalisatie |
| Leaderboards | lijsten, ranking, pagination/animation | Hoog: componenten en list rendering passen goed |
| TrackDraw overview | map plus race/pilot context | Middel/hoog: kan profiteren van gedeelde race state |
| TrackDraw map | SVG rendering, timing, progress/interpolatie | Hoog risico: core eerst isoleren, Preact pas later |

De belangrijkste technische bottleneck is niet alleen rendering, maar vooral dat iedere overlay zelf moet weten hoe RotorHazard events verwerkt worden.

Dit is de beginsituatie voor de migratie: alle overlays draaien nog als vanilla JavaScript, er is geen build pipeline en geen gedeelde code. De `preact/` map bestaat en heeft `node_modules` van een eerdere setup, maar bevat geen broncode.

## Voorgestelde architectuur

```text
preact/
  package.json
  vite.config.ts
  tsconfig.json
  src/
    core/
      rotorhazardSocket.ts
      overlayRuntime.ts
      raceStore.ts
      formatting.ts
      timing.ts
    components/
      ConnectionWarning.tsx
      StatusBadge.tsx
      PilotName.tsx
      LapList.tsx
      HeatSlot.tsx
      LeaderboardList.tsx
    overlays/
      topbar/
        topbar.entry.tsx
        TopbarOverlay.tsx
      node/
        node.entry.tsx
        NodeOverlay.tsx
      heat/
        heat.entry.tsx
        HeatOverlay.tsx
      leaderboard/
        overall.entry.tsx
        class.entry.tsx
        LeaderboardOverlay.tsx
      trackdraw/
        overview.entry.tsx
        map.entry.tsx
        trackCore/
    themes/
      apex.ts
      dds.ts
      lcdr.ts
```

Build output:

```text
custom_plugins/stream_overlays/static/dist/
  topbar.js
  node.js
  heat.js
  leaderboard-overall.js
  leaderboard-class.js
  trackdraw-overview.js
  trackdraw-map.js
```

RotorHazard templates blijven klein. Ze zetten globale configuratie of data-attributen klaar en laden daarna een gebundelde entrypoint.

```html
<main id="overlay-root" data-theme="{{ theme_name }}" data-node="{{ node_index }}"></main>
<script src="{{ url_for('stream_overlays.static', filename='dist/node.js') }}"></script>
```

## RotorHazard socket-laag

De grootste winst zit waarschijnlijk in een gedeelde socket-adapter. Die adapter vertaalt raw RotorHazard events naar voorspelbare frontend state.

Voorbeeldconcept:

```ts
type RotorHazardEvent =
  | "language"
  | "frequency_data"
  | "heat_data"
  | "pilot_data"
  | "class_data"
  | "format_data"
  | "current_heat"
  | "race_status"
  | "current_laps"
  | "leaderboard"
  | "result_data"
  | "pi_time";

type OverlaySubscription = {
  events: RotorHazardEvent[];
  onReady?: () => void;
  onDisconnect?: () => void;
};
```

De socket-laag moet drie dingen doen:

1. Verbinding en disconnects centraal beheren.
2. Binnenkomende payloads normaliseren naar een gedeelde store.
3. Per overlay alleen de events activeren die nodig zijn.

Daarmee hoeft een overlaycomponent niet meer zelf `socket.on("leaderboard", ...)` te registreren. Een component leest bijvoorbeeld `race.currentHeat`, `race.leaderboard`, `race.nodes` en `connection.isConnected`.

Gekozen implementatie:

- eigen kleine custom store met Preact hooks (geen `@preact/signals`);
- socket.io zelf buiten componenten houden;
- payload-normalizers apart testbaar maken.

## Theme-aanpak

Themes moeten niet verdwijnen in componentforks. Het voorstel:

- gedeelde componenten renderen dezelfde DOM-structuur;
- theme-specifieke stijl blijft in CSS, bij voorkeur via CSS variables;
- theme-specifiek gedrag komt in kleine theme-configs;
- uitzonderingen blijven mogelijk, maar expliciet.

Voorbeeld:

```ts
type OverlayTheme = {
  name: "apex" | "dds" | "lcdr";
  nodeAnimation: "slide" | "zoom" | "minimal";
  showFastestLapHighlight: boolean;
  leaderboardPageSize: number;
};
```

Zo blijft het mogelijk dat Apex, DDS en LCDR anders aanvoelen, zonder dezelfde overlay drie keer te implementeren.

## CSS-migratiestrategie

De bestaande CSS-bestanden in `custom_plugins/stream_overlays/static/css/` blijven tijdens de migratie op hun huidige plek en worden geladen via `<link>` tags in de RotorHazard templates. Dit voorkomt dat CSS-migratie en componentmigratie door elkaar lopen.

Wanneer een overlay volledig gemigreerd en stabiel is, kan de bijbehorende CSS worden verplaatst naar `preact/src/` en geïmporteerd via Vite. Op dat moment valt het CSS-bestand samen met de gebundelde JS en verdwijnt de losse `<link>` tag uit het template.

Aanpak per stap:

1. Bestaande CSS blijft in `static/css/` en werkt via `<link>` tag.
2. Na stabiele migratie van een overlay: CSS verplaatsen naar `preact/src/overlays/<naam>/`.
3. CSS importeren in de entry file, Vite bundelt het mee.
4. `<link>` tag verwijderen uit het template.
5. Losse CSS-bestanden in `static/css/` verwijderen zodra alle themes voor die overlay zijn gemigreerd.

## Migratiestrategie

### Fase 0: Voorbereiding

Doel: build pipeline toevoegen zonder bestaande overlays te breken.

Taken:

- `package.json`, Vite en Preact toevoegen.
- Output naar `custom_plugins/stream_overlays/static/dist/` configureren.
- Development scripts toevoegen, bijvoorbeeld `npm run dev` en `npm run build`.
- Basis `overlayRuntime` maken die theme, node en root element uitleest.
- CI of lokale check toevoegen die frontend build uitvoert.

Acceptatie:

- bestaande overlays blijven werken;
- een lege Preact test-entry kan via RotorHazard template geladen worden;
- distributiebestanden worden reproduceerbaar gebouwd.

Checklist:

- [ ] `preact/package.json` toevoegen met build-, dev- en check-scripts.
- [ ] Vite configureren met meerdere overlay entrypoints.
- [ ] Preact dependency toevoegen.
- [ ] Outputpad configureren naar `custom_plugins/stream_overlays/static/dist/`.
- [ ] Basis `preact/src/` structuur aanmaken.
- [ ] `overlayRuntime` maken voor root element, theme, node en page config.
- [ ] Test-entrypoint maken dat in een RotorHazard template kan laden.
- [ ] Bestaande overlays handmatig controleren na toevoeging van de build pipeline.
- [ ] Lokale build uitvoeren en output controleren.
- [ ] `dist/` toevoegen aan `.gitignore`.
- [ ] CI-check toevoegen die `npm run build` uitvoert op elke PR.
- [ ] Release-workflow uitbreiden: frontend builden en plugin bundelen als GitHub release asset.

### Fase 1: Gedeelde socket- en state-laag

Doel: RH socket-koppeling een vaste API geven voordat overlays worden gemigreerd.

Taken:

- inventariseren welke events iedere overlay gebruikt;
- `rotorhazardSocket.ts` maken;
- payload-normalizers toevoegen voor heat, pilot, frequency, race status, laps en leaderboard;
- `timing.ts` maken voor gedeelde timing- en interpolatielogica;
- connection warning als gedeeld component bouwen;
- unit tests schrijven voor normalizers en race-store updates.

Acceptatie:

- socket-events kunnen buiten componenten worden geregistreerd;
- overlaycomponenten kunnen state lezen zonder directe socket.io kennis;
- disconnect/connect gedrag werkt consistent.

Checklist:

- [ ] Per bestaande overlay inventariseren welke RH events worden gebruikt.
- [ ] Eventmatrix vastleggen voor topbar, node, heat, leaderboards en TrackDraw.
- [ ] `rotorhazardSocket.ts` implementeren als enige plek met directe `socket.on(...)` registratie.
- [ ] Connection state modelleren, inclusief connect, disconnect en reconnect.
- [ ] Race status normalizer toevoegen.
- [ ] Current heat normalizer toevoegen.
- [ ] Leaderboard normalizer toevoegen.
- [ ] Current laps normalizer toevoegen.
- [ ] Pilot, class, format en frequency normalizers toevoegen.
- [ ] `timing.ts` implementeren met gedeelde timing- en interpolatiehulpfuncties.
- [ ] Gedeelde selectors/helpers maken voor veelgebruikte overlay state.
- [ ] `ConnectionWarning` component bouwen op basis van gedeelde connection state.
- [ ] Unit tests toevoegen voor normalizers. Uitgesteld; eerst overlays migreren.
- [ ] Unit tests toevoegen voor race-store updates. Uitgesteld; eerst overlays migreren.
- [ ] Test fixture payloads toevoegen voor relevante RH events. Uitgesteld; eerst overlays migreren.

### Fase 2: Leaderboard en topbar migreren

Doel: bewijzen dat Preact goed samenwerkt met RotorHazard, OBS en bestaande templates.

Eerste kandidaat: DDS overall leaderboard.

Reden:

- minder complex dan TrackDraw map;
- wel representatief door live data en animaties;
- goed zichtbaar of layout/regressies optreden.

Scope: DDS overall leaderboard, DDS class leaderboard en alle topbar-themes (DDS, Apex, LCDR). LCDR en Apex leaderboards zijn geen aparte overlay maar hergebruiken dezelfde `LeaderboardOverlay.tsx` met theme-config; die worden in deze fase meegenomen als de theme-aanpak uitgewerkt is.

Taken:

- een nieuwe Preact entrypoint maken;
- bestaande template via aparte test-route naast de oude JS laten werken;
- bestaande CSS hergebruiken via `<link>` tag (zie CSS-migratiestrategie);
- visuele vergelijking doen in browser en OBS;
- fallback naar oude JS behouden totdat de overlay stabiel is.

Acceptatie:

- overlay toont dezelfde data als de oude variant;
- reconnects werken;
- geen zichtbare layout shift bij updates;
- OBS browser source kan de overlay langdurig tonen zonder memory leak-indicatie.

Checklist:

- [ ] Bestaande HTML, JS en CSS van de DDS overall leaderboard analyseren.
- [ ] `LeaderboardOverlay.tsx` component implementeren.
- [ ] Preact entrypoint aanmaken voor DDS overall leaderboard.
- [ ] Test-route toevoegen naast bestaande productie-URL.
- [ ] Pilot-overlay aansluiten op gedeelde socket/store laag.
- [ ] DDS class leaderboard als Preact overlay toevoegen.
- [ ] LCDR en Apex leaderboards toevoegen via theme-config op `LeaderboardOverlay.tsx`.
- [ ] Bestaande DDS leaderboard URLs naar Preact templates laten wijzen.
- [ ] `TopbarOverlay.tsx` component implementeren.
- [ ] Topbar entrypoint aanmaken.
- [ ] Bestaande topbar URLs (DDS, Apex, LCDR) naar Preact templates laten wijzen.
- [ ] Oude en nieuwe overlay visueel naast elkaar vergelijken.
- [ ] Reconnectscenario testen.
- [ ] Race start, race stop en idle state testen.
- [ ] OBS browser source testen op 1920x1080 en 60 FPS.
- [ ] Lange sessie draaien om memory/performanceproblemen te signaleren.
- [ ] Beslissen of de pilot-overlay de oude implementatie mag vervangen.
- [ ] Bevindingen vastleggen voor volgende migratiefases.

### Fase 3: Node en heat overlays migreren

Doel: hergebruik tussen theme-varianten realiseren.

Taken:

- `NodeOverlay`, `LapList`, `PilotCard`, `HeatSlot` en `FrequencyBadge` componenten maken;
- theme-configs introduceren voor animaties en visuele opties;
- gedeelde lap/ranking formatting gebruiken;
- huidige DDS/Apex/LCDR varianten een voor een overzetten.

Acceptatie:

- alle bestaande node URLs blijven functioneel;
- theme-specifieke animaties blijven behouden;
- code duplicatie tussen node variants neemt af;
- lap updates blijven vloeiend bij live races.

Checklist:

- [ ] Gedeelde node componenten ontwerpen.
- [ ] `NodeOverlay` component implementeren.
- [ ] `LapList` component implementeren.
- [ ] `PilotCard` of vergelijkbaar pilot-info component implementeren.
- [ ] Theme-configs voor DDS, Apex en LCDR aanmaken.
- [ ] Theme-specifieke node animaties expliciet configureren in theme-branches.
- [ ] DDS node overlay migreren.
- [ ] Apex node overlay migreren.
- [ ] LCDR node overlay migreren.
- [ ] Heat overlay datamodel afstemmen op gedeelde store.
- [ ] `HeatSlot` component implementeren.
- [ ] `FrequencyBadge` component implementeren als bestaande `channel-block` markup met `freq.updateBlocks()`.
- [ ] Upcoming heat overlay migreren.
- [ ] Alle bestaande node URLs controleren in RotorHazard/OBS.
- [ ] Alle bestaande heat URLs controleren in RotorHazard/OBS.
- [ ] Lap updates testen tijdens live of fixture-race.
- [ ] Theme screenshots vergelijken met de oude implementatie.
- [ ] Oude node/heat JS pas verwijderen nadat alle themes stabiel zijn.

### Fase 4: TrackDraw overview migreren

Doel: TrackDraw context combineren met de gedeelde race-store.

Taken:

- TrackDraw data loader apart maken;
- pilot list en leader card als componenten bouwen;
- map rendering nog niet volledig herschrijven als dat niet nodig is;
- shared race state gebruiken voor leaderboard en laps.

Acceptatie:

- overview blijft visueel gelijkwaardig;
- TrackDraw readiness/cache status blijft zichtbaar;
- leader en pilot list volgen race state zonder eigen socket duplicatie.

Checklist:

- [ ] Bestaande TrackDraw overview datastroom documenteren.
- [ ] TrackDraw API/cache loader isoleren voor overview title.
- [ ] Readiness/status mapping apart houden in bestaande map renderer.
- [ ] `TrackDrawOverview` component implementeren.
- [ ] Leader card component implementeren.
- [ ] Pilot list component hergebruiken of implementeren.
- [ ] Overview aansluiten op gedeelde race-store.
- [ ] Map-rendering hergebruiken zolang volledige migratie geen voordeel geeft.
- [ ] Loading, error en disconnected states testen.
- [ ] Overview testen met alle themes.
- [ ] Overview testen zonder TrackDraw configuratie.
- [ ] Overview testen met incomplete TrackDraw data.
- [ ] Oude overview JS pas verwijderen nadat visuele regressiecheck akkoord is.

### Fase 5: TrackDraw map migreren

Doel: de meest complexe overlay pas migreren nadat de infrastructuur bewezen is.

Taken:

- progress-, segment- en interpolatielogica isoleren in `trackCore`;
- renderer scheiden van race-state updates;
- SVG rendering eventueel imperatief houden binnen een Preact component;
- alleen React/Preact state gebruiken voor overlay-shell, status en lifecycle;
- performance meten bij 60 FPS OBS-instellingen.

Acceptatie:

- positie-interpolatie blijft gelijk of beter;
- geen merkbare frame drops in OBS;
- reconnect en race reset blijven correct;
- core-functies zijn los testbaar.

Checklist:

- [ ] Huidige TrackDraw map functies categoriseren: core, socket, renderer, DOM/status.
- [ ] Progress math isoleren in `trackCore`.
- [ ] Segment/interpolatielogica isoleren in `trackCore`.
- [ ] Pilot state machine isoleren van DOM-manipulatie.
- [ ] Unit tests toevoegen voor progress, segmenten en interpolatie. Uitgesteld; eerst migratie afronden.
- [ ] SVG renderer API ontwerpen.
- [ ] Beslissen welke SVG rendering imperatief blijft.
- [ ] Preact shell maken voor lifecycle, status en root mounting.
- [ ] Renderer aansluiten op gedeelde race-store.
- [ ] TrackDraw data loader aansluiten op nieuwe structuur.
- [ ] Race reset scenario testen.
- [ ] Reconnect scenario testen.
- [ ] Full-lap en split-marker scenario's testen.
- [ ] OBS performance testen op 1920x1080 en 60 FPS.
- [ ] Frame timing of render-loop controleren op onnodige rerenders.
- [ ] Oude TrackDraw map implementatie pas vervangen na vergelijking met fixture-runs.

## Teststrategie

Uitgesteld zolang de prioriteit volledige Preact-migratie is. Later alsnog toevoegen:

- unit tests voor payload-normalizers;
- unit tests voor formatting, timing en TrackDraw progress math;
- component smoke tests voor belangrijkste overlays;
- browser test of handmatige checklist voor OBS-afmetingen;
- regressiecheck met bestaande demo/race states.

Voor live overlays kan later alsnog een eenvoudige fixture-aanpak worden toegevoegd, maar die hoort niet op het kritieke pad voor de migratie.

## Deployment en distributie

De `dist/` map wordt niet in git gecommit. Bij een release bouwt de CI-workflow de frontend (`npm run build`) en bundelt daarna de hele plugin als downloadbaar release asset. Eindgebruikers installeren de plugin via dat release asset en hebben geen Node.js nodig.

- `dist/` staat in `.gitignore`.
- CI controleert bij elke PR dat `npm run build` schoon draait.
- Release-workflow bouwt `dist/`, pakt de volledige plugin in en voegt het toe als GitHub release asset.

## Risico's

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| OBS browser source gedraagt zich anders dan lokale browser | Hoog | Iedere gemigreerde overlay testen in OBS-instellingen |
| Build pipeline maakt installatie lastiger | Middel | Plugin als gebundeld release asset distribueren via GitHub releases |
| Big-bang rewrite veroorzaakt regressies | Hoog | Overlay per overlay migreren |
| TrackDraw performance wordt slechter | Hoog | TrackDraw als laatste, core los testbaar, imperatieve SVG toegestaan |
| Theme-verschillen verdwijnen per ongeluk | Middel | Theme-configs en visuele checklist per theme |
| Socket-state abstrahering wordt te generiek | Middel | Begin met events die overlays nu echt gebruiken |

## Beslismomenten

Genomen besluiten (voor start):

- **TypeScript verplicht**: ja, alle broncode in `preact/src/` is TypeScript.
- **`dist` assets in git**: nee, `dist/` staat in `.gitignore`. De hele plugin wordt als release asset gebundeld via een CI-workflow.
- **Pilot overlay**: DDS overall leaderboard.
- **State management**: eigen kleine custom store met Preact hooks, geen `@preact/signals`.

Na Fase 2:

- Levert Preact genoeg onderhoudswinst op?
- Is OBS performance acceptabel?
- Is de build/deploy workflow niet te zwaar?

Na Fase 3:

- Is de theme-aanpak flexibel genoeg?
- Kunnen oude JS-bestanden worden verwijderd?
- Moeten docs en customization guides worden aangepast?

## Aanbevolen eerste implementatiepad

1. Voeg Vite, Preact en TypeScript toe in een geïsoleerde `preact/` map zonder bestaande overlays te wijzigen.
2. Bouw een kleine socket/store proof of concept met `race_status`, `current_heat` en `leaderboard`.
3. Migreer de DDS overall leaderboard als eerste echte overlay.
4. Meet gedrag in browser en OBS.
5. Migreer topbar en node overlays zodra de socket-store goed voelt.
6. Laat TrackDraw map staan tot de gedeelde infrastructuur stabiel is.

## Definition of done

De migratie is geslaagd wanneer:

- alle bestaande overlay URLs blijven werken;
- overlays draaien zonder Node.js op een productie-installatie (gebundeld via release asset);
- socket-event handling op een centrale plek zit;
- overlaycomponenten geen directe kennis meer nodig hebben van raw RH payloads;
- themes nog steeds zelfstandig herkenbaar zijn;
- TrackDraw core-logica los testbaar is;
- documentatie uitlegt hoe nieuwe overlays toegevoegd worden.

## Conclusie

Preact heeft zin voor de hele plugin, vooral omdat de plugin meerdere overlayfamilies heeft die dezelfde RotorHazard data gebruiken. De grootste winst zit niet in JSX op zichzelf, maar in een gedeelde runtime rond socket-events, state, themes en componenten. De migratie moet gefaseerd gebeuren, met een kleine overlay als pilot en TrackDraw map pas als laatste onderdeel.
