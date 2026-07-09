# Ajánlatkészítéstől a kivitelezésig — teljes workflow dokumentáció

> **Alkalmazás:** `epito-artukor/site` (Next.js, magyar építőipari ajánlatkészítő ERP)
> **Készült:** 2026. július 7. · **Frissítve:** 2026. július 8. (0. fázis takarítás + bugfixek — lásd 17. fejezet)
> **Hatókör:** projekt → költségvetés → RFQ (alvállalkozói bekérés) → ügyfélajánlat → kivitelezés → TIG → lezárás — minden státusszal, funkcióval és edge case-szel.

---

# Tartalomjegyzék

1. [Architektúra és adattárolás](#1-architektúra-és-adattárolás)
2. [Adatmodell — entitások és mezők](#2-adatmodell--entitások-és-mezők)
3. [Státusz enum-ok teljes katalógusa](#3-státusz-enum-ok-teljes-katalógusa)
4. [Projekt életciklus és fázisok](#4-projekt-életciklus-és-fázisok)
5. [Költségvetés (quote) életciklus](#5-költségvetés-quote-életciklus)
6. [Árazás, fedezet, ÁFA, küldhetőség](#6-árazás-fedezet-áfa-küldhetőség)
7. [RFQ — alvállalkozói ajánlatbekérés](#7-rfq--alvállalkozói-ajánlatbekérés)
8. [Ügyfélcsomag — ügyfélnek küldött árajánlat](#8-ügyfélcsomag--ügyfélnek-küldött-árajánlat)
9. [Kivitelezés és TIG (teljesítésigazolás)](#9-kivitelezés-és-tig-teljesítésigazolás)
10. [Pótmunka / kiegészítő ajánlat](#10-pótmunka--kiegészítő-ajánlat)
11. [Projekt lezárás és archiválás](#11-projekt-lezárás-és-archiválás)
12. [A teljes folyamat döntési fája](#12-a-teljes-folyamat-döntési-fája)
13. [Edge case katalógus](#13-edge-case-katalógus)
14. [Ismert hiányosságok / nem implementált funkciók](#14-ismert-hiányosságok--nem-implementált-funkciók)
15. [Audit napló akciók](#15-audit-napló-akciók)
16. [Kulcsfájl-referencia](#16-kulcsfájl-referencia)
17. [Változásnapló és DB-migrációs döntések (0. fázis)](#17-változásnapló-és-db-migrációs-döntések-0-fázis)

---

# 1. Architektúra és adattárolás

## 1.1 Entitás-hierarchia

```
Project (projekt)
 ├── Quote[] (költségvetés / szakági árajánlat)
 │    └── QuoteLine[] (tételek)
 ├── SubcontractorRfq[] (bekérés csomagok)
 │    ├── SubcontractorRfqLine[] (bekért tételek — pillanatkép)
 │    ├── RfqInvitation[] (alvállalkozói meghívók: token + PIN)
 │    └── SubcontractorRfqSubmission[] (beérkezett ajánlatok)
 ├── RfqCampaign[] (batch bekérés meta: üzenet, mellékelt mappák)
 ├── RfqDecisionLogEntry[] (döntésnapló fedezet before/after értékekkel)
 ├── ProjectComposition (mely szakági ajánlatok számítanak a projektbe)
 ├── CustomerPackage[] (ügyfélnek küldött csomag — befagyott pillanatkép)
 ├── PerformanceCertificate[] (TIG dokumentumok)
 └── ProjectAuditEntry[] (belső tevékenységnapló)
```

## 1.2 Tárolás és szinkron

| Réteg | Hely | Szerep |
|---|---|---|
| Belső UI | `localStorage` (`epito-artukor:projects:v1`) | Minden belső olvasás/írás a `projects-store`-on át |
| Szerver | `.data/projects-bundle.json` | Publikus linkek (RFQ, ajánlat) adatforrása |
| Mentés | `saveBundle()` → `PUT /api/projects-bundle` | Belső változás → szerver fájl |
| Betöltés | `syncBundleFromServer()` → `GET /api/projects-bundle` | App induláskor szerver felülírja a localStorage-t |

**KRITIKUS szinkron-tudnivaló:** a publikus API-k (`/api/rfq/[token]`, `/api/offer/[token]`) **közvetlenül a szerver fájlt írják**. Az alvállalkozói beküldés vagy az ügyfél válasza a belső UI-ban csak **oldal-újratöltés / `syncBundleFromServer()` után** jelenik meg.

## 1.3 Migrációk (minden betöltéskor lefutnak)

- **`normalizeProjectBundle`** — láncolja az összes normalizálást, üres tömböket biztosít (`auditLog`, `rfqCampaigns`, `performanceCertificates`).
- **`normalizeQuoteLine`** — legacy `materialUnitPrice`/`laborUnitPrice` → `costMaterialUnitPrice`/`costLaborUnitPrice`; hiányzó `costSource`/`pricingStatus` kikövetkeztetése.
- **`migrateQuoteScope`** — legacy `full` scope vagy hiányzó → `version` ha van `supersedesQuoteId`, különben `trade`; `primaryTrade` kikövetkeztetése a sorok többségi szakágából.
- **`normalizeRfqBundle`** — v1 csomag-szintű token/kód → szintetikus `RfqInvitation`; legacy `draft`/`sent`/`received` csomag-státusz → `open`; legacy bid `unitPrice` → `laborUnitPrice`.
- **`migrateProjectClientId`** — `clientName` fuzzy match az ügyfél törzsre → `clientId` beállítás.

---

# 2. Adatmodell — entitások és mezők

## 2.1 `Project`

| Mező | Típus | Megjegyzés |
|---|---|---|
| `id` | string | `proj-{timestamp}-{random}` |
| `orgId` | string | Default `org-1` |
| `code` | string | Pl. `HYUN-2026-01` — TIG sorszámban is szerepel |
| `name`, `siteAddress`, `description` | string | |
| `clientId?` | string | Ügyfél törzs hivatkozás (migráció tölti névből) |
| `clientName` | string | Pillanatkép, ha nincs `clientId` |
| `status` | `ProjectStatus` | Lásd 3.1 |
| `createdAt` / `updatedAt` | ISO string | |

## 2.2 `Quote` (költségvetés)

| Mező | Típus | Megjegyzés |
|---|---|---|
| `id` | string | `quote-...` |
| `projectId`, `title`, `notes` | string | |
| `status` | `QuoteStatus` | Lásd 3.2 |
| `version` | number | Duplikálásnál növekszik |
| `quoteScope?` | `trade` \| `version` | Migráció után mindig kitöltött |
| `primaryTrade?` | `Trade` | Szakági ajánlatnál kötelező — csak ilyen szakágú tétel adható hozzá |
| `supersedesQuoteId?` | string | `version` scope-nál: melyik ajánlatot váltja fel |
| `tradeMarkups` | `Partial<Record<Trade, number>>` | Szakági alap fedezet % |
| `vatMode?` | `QuoteVatMode` | Default: szervezeti profil / `standard` |

## 2.3 `QuoteLine` (tétel)

| Mező | Típus | Megjegyzés |
|---|---|---|
| `id` | string | `ql-...` |
| `quoteId` | string | |
| `sortOrder` | number | 1-alapú, törlés után újraszámozódik |
| `costItemId` | string \| null | Ártükör hivatkozás |
| `identifierSnapshot`, `textSnapshot` | string | Tételszám + leírás pillanatkép |
| `trade` | `Trade` | Szakág |
| `unitId`, `quantity` | | Mértékegység, mennyiség |
| `costMaterialUnitPrice` | number | Bekerülés — anyag egységár |
| `costLaborUnitPrice` | number | Bekerülés — díj egységár |
| `markupPercent` | number \| null | Sor-felülírás; `null` = szakági alap öröklése |
| `costSource` | `QuoteLineCostSource` | Lásd 3.6 |
| `costSourceSubcontractor` | string \| null | Alvállalkozó neve |
| `costSourceRfqSubmissionId` | string \| null | Melyik RFQ beküldésből jött az ár |
| `pricingStatus` | `QuoteLinePricingStatus` | Lásd 3.5 |
| `executionStatus?` | `pending` \| `done` | Kivitelezési készültség (hiányzó = `pending`) |
| `tigDocumentId?` | string | Ha kitöltött: a tétel rögzített TIG-ben van, készültsége nem vonható vissza |

## 2.4 RFQ entitások

**`SubcontractorRfq` (bekérés csomag):** `id`, `projectId`, `quoteId`, `trade`, `title`, `status`, `expiresAt`, `lines[]` (tétel-pillanatképek: `quoteLineId`, `text`, `unitId`, `quantity`), `campaignId?`. *(A v1-es csomag-szintű `accessToken`/`accessCode` mezők a fő típusból törölve — csak a migráció `LegacyRfqPackage` típusa olvassa őket.)*

**`RfqCampaign`:** `id`, `projectId`, `message?`, `expiresAt`, `attachedFolderIds[]`, `attachedFolderSnapshots[]` (`{folderId, name, fileCount}`).

**`RfqInvitation`:** `id`, `packageId`, `subcontractorId?`, `subcontractorName`, `contactPhone`, **`accessToken`** (32 hex), **`accessCode`** (6 számjegyű PIN), `status`.

**`SubcontractorRfqSubmission`:** `id`, `rfqId`, `invitationId`, `subcontractorName`, `contactEmail/Phone`, `notes`, `lineBids[]` (`{rfqLineId, materialUnitPrice, laborUnitPrice, declined}`), `totalAmount`, `submittedAt`, `updatedAt`, `revisionHistory?`.

**`RfqDecisionLogEntry`:** `packageId`, `quoteId`, `invitationId`, `quoteLineId` (nullable), `action`, `subcontractorName`, `marginPercentBefore/After`, döntéshozó adatai.

## 2.5 Ügyfélcsomag entitások

**`CustomerPackage`:** `id`, `projectId`, `type` (`full`/`supplement`), `status`, `title`, **`snapshots[]`** (befagyott szakági pillanatképek), `sellNetTotal`, `grossTotal` (a **küldött** teljes összeg), `sentAt`, `notes?`, `respondedAt?`, `clientNotes?`, `respondedByName?`, **`acceptedSnapshots?`** (részleges elfogadásnál), **`acceptedSellNetTotal?` / `acceptedGrossTotal?`** (elfogadáskor számolt elfogadott összegek), **`accessToken?`**, **`accessCode?`**, **`expiresAt?`**.

**`CustomerPackageSnapshot`:** `trade`, `quoteId`, `quoteTitle`, `sellNetTotal`, `grossTotal`, `vatMode?`, `vatLabel?`, `lineIds?`, `lines?` (soronkénti befagyott eladási árak — régi csomagoknál hiányozhat).

**`CustomerPackageSnapshotLine`:** `lineId`, `identifier`, `text`, `unitLabel`, `quantity`, `sellNetUnitPrice`, `sellNetTotal`.

## 2.6 TIG entitás

**`PerformanceCertificate`:** `documentNumber` (pl. `TIG-IRO-2026-03-2026-001`), `issuedAt`, `periodFrom?`/`periodTo`, `performanceLocation`, `contractPackageTitle?`, `lines[]` (befagyott: azonosító, szöveg, mennyiség, **szerződött** eladási árak), `sellNetTotal`, `grossTotal`, `vatMode`, `vatLabel`, `vatAmount`.

---

# 3. Státusz enum-ok teljes katalógusa

## 3.1 `ProjectStatus`

| Érték | Magyar címke | Lista fázis |
|---|---|---|
| `prospect` | Lehetőség | Árajánlatok (`/ajanlatok`) |
| `quoting` | Ajánlatkészítés | Árajánlatok |
| `won` | Megnyert | Kivitelezés (`/kivitelezes`) |
| `in_progress` | Kivitelezés | Kivitelezés |
| `done` | Kész | Archív (`/archiv`) |
| `archived` | Archivált | Archív |

## 3.2 `QuoteStatus`

| Érték | Magyar címke | Jelentés |
|---|---|---|
| `draft` | Piszkozat | Belső munka — nem számít a projekt bruttóba |
| `sent` | Elküldve | Ügyfélcsomagban kiment — beszámít a bruttóba |
| `accepted` | Elfogadva | Szerződött — kivitelezés mód elérhető |
| `rejected` | Elutasítva | Ügyfél nem választotta |
| `archived` | Archivált | **Hard lock** — nem szerkeszthető |

## 3.3 `QuoteScope` és `QuotePriceSide`

| `QuoteScope` | Jelentés |
|---|---|
| `trade` | Első szakági költségvetés |
| `version` | Új verzió (`supersedesQuoteId` mutat az előzőre) |

| `QuotePriceSide` | Szerkesztő fül |
|---|---|
| `cost` | Bekerülés |
| `markup` | Fedezet |
| `sell` | Ügyfél |
| — (`execution`) | Kivitelezés (csak elfogadott quote + kivitelezési fázis) |

## 3.4 `QuoteVatMode`

| Érték | Magyar címke | Bruttó számítás |
|---|---|---|
| `standard` | Általános (27%) | nettó + 27% |
| `reduced` | Csökkentett (5%) | nettó + 5% |
| `aam` | ÁFA mentes (AAM) | bruttó = nettó |
| `reverse_charge` | Fordított adózás (EU) | bruttó = nettó, ÁFA-t a vevő fizeti |

## 3.5 `QuoteLinePricingStatus`

| Érték | Magyar címke |
|---|---|
| `unpriced` | Nincs árazva |
| `estimated` | Becsült |
| `rfq_pending` | Várakozik alvállalkozóra |
| `costed` | Bekerülés kész |

## 3.6 `QuoteLineCostSource`

| Érték | Magyar címke |
|---|---|
| `unpriced` | — |
| `catalog` | Ártükör |
| `manual` | Kézi |
| `subcontractor` | Alvállalkozó |

## 3.7 `SubcontractorRfqStatus`

| Érték | Magyar címke | Megjegyzés |
|---|---|---|
| `open` | Nyitott | Új csomag alapértelmezett |
| `decided` | Döntés megszületett | Nyertes kiválasztva |

Legacy értékek (`draft`/`sent`/`received` → `open`, `closed` → `decided`) csak a migrációban (`rfq-migration.ts`, `LegacyRfqPackage`) léteznek — a fő típusból törölve.

## 3.8 `RfqInvitationStatus`

| Érték | Magyar címke | Mikor áll be |
|---|---|---|
| `invited` | Meghívva | Csomag létrehozásakor |
| `submitted` | Beküldve | Alvállalkozó beküldött |
| `accepted` | Elfogadva | Csomag-nyertes kiválasztásakor |
| `rejected` | Elutasítva | Nem nyertes a döntésnél |

*(A korábbi `reserve` státusz törölve — sosem volt beállítva. Az alvállalkozó törzs `tier: "reserve"` szintje ettől független, megmaradt.)*

## 3.9 `RfqDecisionAction`

| Érték | Magyar címke | Implementálva |
|---|---|---|
| `accept_package` | Nyertes kiválasztva | Igen (fő UI út) |
| `change_package_winner` | Nyertes módosítva | Igen |

*(A korábbi `accept_line` és `reject_invitation` akciók a hozzájuk tartozó nem használt store-függvényekkel — `applyRfqLineDecisions`, `applyRfqSubmissionToQuote` — együtt törölve.)*

## 3.10 `CustomerPackageStatus` és `CustomerPackageType`

| Státusz | Magyar címke | Jelentés |
|---|---|---|
| `draft` | Piszkozat | Nincs token/kód/lejárat |
| `sent` | Elküldve | Aktív, döntésre vár |
| `accepted` | Elfogadva | Szerződésbe kerül |
| `rejected` | Elutasítva | |
| `superseded` | Felülírva | Újabb küldés inaktiválta — link csak megtekinthető |

| Típus | Magyar címke | Jelentés |
|---|---|---|
| `full` | Teljes ajánlat | Alap szerződés |
| `supplement` | Kiegészítő | Pótmunka — kivitelezés alatt |

## 3.11 `QuoteLineExecutionStatus` és `CustomerPackageResponseType`

| Execution | Jelentés |
|---|---|
| `pending` | Nem kész (hiányzó mező is `pending`) |
| `done` | Fizikailag elkészült |

| Válasz típus | Publikus szöveg | Belső szöveg |
|---|---|---|
| `accept_all` | Elfogadom minden szakágot | Mindet elfogadja |
| `partial` | Csak kiválasztott szakágokat | Csak kiválasztott költségvetések |
| `reject_all` | Elutasítom az ajánlatot | Elutasítja |

---

# 4. Projekt életciklus és fázisok

## 4.1 Fázis-leképezés (`project-phase.ts`)

| Fázis | Route | Státuszok | Új projekt létrehozható? |
|---|---|---|---|
| `quotes` (Árajánlatok) | `/ajanlatok` | `prospect`, `quoting` | **Igen** (csak itt) |
| `execution` (Kivitelezés) | `/kivitelezes` | `won`, `in_progress` | Nem |
| `archive` (Archív) | `/archiv` | `done`, `archived` | Nem |

## 4.2 Státusz-átmenetek — mi vált mit?

```
prospect ──(kézi szerkesztés, projekt dialógus)──► quoting
   │
   │  (ügyfélcsomag elfogadás: prospect VAGY quoting állapotból)
   ▼
  won ──(„Kivitelezés indítása" gomb az elfogadott csomagon)──► in_progress
   │                                                                │
   │  (Lezárás dialógus — closeProject)                             │
   ▼                                                                ▼
  done ◄────────────────────────────────────────────────────────────┘
   │
   │  (kézi szerkesztés — nincs automatikus út)
   ▼
 archived
```

| Átmenet | Trigger | Kód |
|---|---|---|
| → `prospect` | `createProject` alapértelmezés | `projects-page-client.tsx` |
| → `quoting` | **Csak kézi** (projekt szerkesztő dialógus) | `project-edit-dialog.tsx` |
| → `won` | Ügyfélcsomag elfogadás (teljes vagy részleges) | `applyCustomerPackageResponse` |
| → `in_progress` | „Kivitelezés indítása" gomb | `project-offer-detail-dialog.tsx` |
| → `done` | Lezárás dialógus | `closeProject()` |
| → `archived` | **Csak kézi** | projekt szerkesztő |

**Fontos:** ha a projekt már `won`/`in_progress`/`done`, egy kiegészítő csomag elfogadása **nem változtatja** a projekt státuszt.

## 4.3 Projekt store-műveletek

| Függvény | Viselkedés |
|---|---|
| `createProject(input)` | `proj-...` ID, audit „Projekt létrehozva" |
| `updateProject(id, patch)` | Touch + audit „Projekt adatok módosítva" |
| `closeProject(projectId)` | **Csak** `won`/`in_progress` → `done`; egyébként `undefined`. Audit „Projekt lezárva" |
| `listProjects()` | `updatedAt` szerint csökkenő |

---

# 5. Költségvetés (quote) életciklus

## 5.1 Létrehozási utak

1. **Új szakági ajánlat:** `createQuote(projectId, title, { primaryTrade })` → `quoteScope: "trade"`, `version: 1`, `status: "draft"`, **üres tétellista**, default `tradeMarkups` + `vatMode`.
2. **Új verzió (UI checkbox):** `createQuote(..., { primaryTrade, supersedesQuoteId })` → `quoteScope: "version"`, üres tétellista.
3. **Duplikálás:** `duplicateQuote(sourceId)` → `version = max(összes projektbeli verzió)+1`, cím `... (vN)`, `quoteScope: "version"`, `supersedesQuoteId = sourceId`, minden sor másolva új ID-kkal.

### Duplikáláskor törlődő RFQ-referenciák

- `pricingStatus: "rfq_pending"` → `"unpriced"`
- `costSource: "subcontractor"` → `"manual"` ha van ár, különben `"unpriced"`
- `costSourceSubcontractor`, `costSourceRfqSubmissionId`, `executionStatus`, `tigDocumentId` → törölve
- **A forrás quote érintetlen marad.**

## 5.2 Verziófejek feloldása (`resolveVersionHeads`) és auto-archiválás

- Minden `supersedesQuoteId` cél **nem fej**.
- Láncok csoportosítása gyökér szerint; csoportonként a legjobb: `accepted(4) > sent(3) > draft(2) > rejected(1) > archived(0)`, döntetlennél `updatedAt`.
- `listActiveQuoteHeads()` kizárja az archivált + elutasított quote-okat.
- Az aggregáció (projekt bruttó, szakági áttekintés) **csak a fejeket** számolja.
- **ÚJ (0. fázis):** ügyfélcsomag **publikálásakor** a küldött quote-ok verzió-láncának régi verziói **automatikusan archiválódnak** (`archiveSupersededVersionsInBundle`). Kivétel: `accepted` státuszú vagy más aktív (sent/accepted) csomagban lévő verzió. Audit: „Régi verzió automatikusan archiválva". A fej-feloldás emellett biztonsági hálóként megmarad.

## 5.3 Quote státusz-átmenetek

```
draft ──(ügyfélcsomag publikálás)──► sent
                                       ├──(csomag elfogadás)──► accepted
                                       ├──(csomag elutasítás / részlegesnél kimaradt)──► rejected
                                       └──(csomag felülírás, ha nincs más aktív csomagban)──► draft
bármi ──(archiveQuote)──► archived   [hard lock]
```

- A quote **soha nem lesz kézzel `sent`** — csak csomag-publikáláskor.
- **Elfogadott quote szerkeszthető marad** (soft lock) — az élő bekerülés-követés miatt; de ha szerződött (`contractPriceLocked`), a Fedezet fül és az ÁFA **read-only**.
- **Archivált quote:** `updateQuoteLine` nem fut le, `addQuoteLineFromCostItem` és `addManualQuoteLine` kivételt dob, és `deleteQuoteLine` is védett (0. fázis javítás).

## 5.4 Tétel-műveletek

| Függvény | Viselkedés + mellékhatás |
|---|---|
| `addQuoteLineFromCostItem(quoteId, item)` | Ártükör-tétel felvétele. Dob, ha archivált vagy `item.trade !== primaryTrade`. Új sor: qty=1, árak=0, `unpriced`. |
| `addManualQuoteLine(quoteId, { text, unitId, quantity? })` | **ÚJ (0. fázis)** — szabad tétel ártükör-hivatkozás nélkül: `costItemId: null`, azonosító `EGYEDI`, szakág = a quote `primaryTrade`-je, `unpriced`. |
| `updateQuoteLine(id, patch)` | Ár-mellékhatás: ha anyag/díj módosul és van ár → `costSource: "manual"`, `pricingStatus: "estimated"`; ha nincs ár → vissza `unpriced` + alvállalkozói referenciák törlése. |
| `applyCatalogPricesToLine(lineId, mat, díj)` | `costSource: "catalog"`, `pricingStatus: "estimated"` |
| `applyCatalogToUnpricedLines(quoteId, trade?)` | Csak `costItemId`-s, nulla árú sorok; ártükörből tölt |
| `convertQuoteLineToManualCost(lineId)` | Alvállalkozói forrás törlés, árak maradnak; `rfq_pending` → `unpriced` ha nincs ár, `costed` ha van |
| `deleteQuoteLine(id)` | Sor törlés + `sortOrder` újraszámozás 1..n. Archivált quote-on védett (0. fázis javítás). |
| `deleteQuote(quoteId)` | **`false`, ha bármely RFQ hivatkozik rá.** Egyébként quote + sorok törlése (nincs audit). |
| `archiveQuote(quoteId)` | `status → archived` |

## 5.5 A szerkesztő (quote editor) felépítése

| Fül | Tartalom |
|---|---|
| **Bekerülés** (`cost`) | Tétel-táblázat, ártükör hozzáadás dialógus, RFQ panel, forrás-szűrők (`all` / `subcontractor` / `estimated` / `rfq_pending` / `unpriced`) |
| **Fedezet** (`markup`) | Szakági alap % + soronkénti felülírás, bulk műveletek |
| **Ügyfél** (`sell`) | Összesítő / Tételek al-nézetek, ÁFA választó, ügyfél-readiness |
| **Kivitelezés** (`execution`) | Csak `accepted` quote + `won`/`in_progress` projekt — automatikusan erre a fülre nyílik |

- Árazatlan sorok borostyán háttérrel, ártükör-kitöltő ikonnal.
- A „Tétel" dialógusban ártükör-kereső **és** „Szabad tétel" blokk (leírás + mértékegység) — utóbbi `addManualQuoteLine`-t hív (0. fázis).

---

# 6. Árazás, fedezet, ÁFA, küldhetőség

## 6.1 Sor-szintű képletek

```
isLineCosted = costMaterialUnitPrice > 0 VAGY costLaborUnitPrice > 0

fedezet% = line.markupPercent ?? quote.tradeMarkups[trade] ?? appSettings.defaultTradeMarkups[trade]

sellMaterialUnit = round(costMaterial × (1 + fedezet%/100))
sellLaborUnit    = round(costLabor   × (1 + fedezet%/100))
lineSellTotal    = round((sellMaterial + sellLabor) × quantity)
lineCostTotal    = round((costMaterial + costLabor) × quantity)
```

**Seed szakági fedezetek:** építőmester 18%, nyílászáró 12%, gépészet 12%, elektromos 15%, riasztó 15%.

## 6.2 Fedezet öröklési lánc és bulk műveletek

```
sor.markupPercent (explicit) → quote.tradeMarkups[szakág] → app beállítás default
```

- Ha a sor fedezetét a szakági alappal **egyenlőre** állítod → `null` tárolódik (visszaáll öröklésre).
- **Alap fedezet (szakág):** `updateQuoteTradeMarkup` + `applyMarkupToTradeLines` — quote-szint + minden szakági sor egyszerre.
- **Kijelöltek:** soronkénti felülírás.
- ↺ gomb: sor visszaállítása szakági alapra (`clearLineMarkupsForTrade` bulk változat).

## 6.3 Quote-összesítők

- `quoteCostTotals` / `quoteSellTotals` — minden sor összege (árazatlan 0-val).
- `marginTotal = sellTotal − costTotal`; `marginPercent = round(marginTotal / costTotal × 100)` (költség-bázis).
- **Figyelem:** a lista UI **eladás-bázisú** százalékot mutat (`marginTotal / sellTotal × 100`) — a két érték eltér!
- `isPartialTotal = van árazatlan sor` — ilyenkor a fedezet-blokkoló **kikapcsol** (nem ítélhető meg a teljes fedezet).

## 6.4 ÁFA (`calcQuoteVatTotals`)

- `standard`/`reduced`: `bruttó = nettó + round(nettó × kulcs%)`
- `aam`/`reverse_charge`: `bruttó = nettó`, ÁFA = 0
- Projekt-aggregáció quote-onkénti bruttót összegez saját ÁFA-móddal; eltérő módok → `mixedVat: true` („Vegyes ÁFA" címke).

## 6.5 Küldhetőség (`buildReadiness` — blokkolók)

`canSend = blockers.length === 0` (és `canExportPdf = canSend`):

1. `lineCount === 0` → „Nincs tétel az árajánlatban"
2. `unpricedCount > 0` → „N tétel még árazatlan"
3. `unappliedSubmissionCount > 0` → „N alvállalkozói válasz még nincs beírva" (beküldés van, de a sor `costSourceRfqSubmissionId`-ja nem arra mutat)
4. Alacsony fedezet: `marginPercent < minAcceptableMarginPercent` (default **12%**, app beállítás) — **csak teljesen árazott** quote-nál

Az ügyfél-előnézeti readiness (`buildClientQuoteReadiness`) ugyanez, **a 3-as RFQ-blokkoló nélkül**.

---

# 7. RFQ — alvállalkozói ajánlatbekérés

## 7.1 Folyamat-áttekintés

```
Wizard (4 lépés) → Kampány + csomag(ok) + meghívók → linkek kiküldése
→ alvállalkozó: /rfq/{token} + PIN → árak beküldése → szerver fájl
→ belső sync → összehasonlítás → csomag-döntés → árak beírása a quote sorokba
```

## 7.2 Bekérés létrehozása — `RfqCreateWizard` (4 lépés)

| Lépés | Tartalom |
|---|---|
| 1. Mit? | Szakág(ak) + tétel-kijelölés. Default kijelölés: `!isLineCosted` VAGY `rfq_pending` sorok. Preset gombok: „Csak árazatlan" / „Teljes szakág" / „Egyik sem". |
| 2. Dokumentumok | Projekt mappák csatolása (snapshot) + opcionális üzenet |
| 3. Kik? | Partner × szakág mátrix. Szűrés: `status !== "inactive" && !== "blocked"`, és a partner `trades` listája tartalmazza a szakágot. |
| 4. Küldés | Összefoglaló + határidő napokban (1–90, default **14** — app beállítás `rfqDefaultValidityDays`) |

**Figyelmeztetések (nem blokkolnak):**
- **Átfedés:** ugyanaz a quote-sor már nyitott csomagban van.
- **Kézi ár:** már bekerült (kézi árú) sorok is bekérhetők.

**`createRfqCampaign` → `createRfqPackageWithInvitations`** csomagonként:
- Csomag `status: "open"`, sorok pillanatképként.
- Partnerenként `RfqInvitation` (`invited`, saját token + 6 jegyű PIN).
- Quote-sor mellékhatás: ha `!isLineCosted` → `pricingStatus: "rfq_pending"` (**már bekerült sor érintetlen**).
- Üres (partner vagy tétel nélküli) csomagok kimaradnak; ha 0 csomag marad → hiba.
- Audit: „Bekérés indítva".

Létrehozás után **`RfqLinksPanel`** — link + PIN másolás partnerenként (kiküldés manuális).

## 7.3 Publikus oldal (`/rfq/[token]`)

1. `GET /api/rfq/{token}` → `{invitation, rfq, project, submission, campaign}`. Ismeretlen token → „Érvénytelen link".
2. Lejárt (`expiresAt < now`) → „Lejárt ajánlatkérés" (PIN előtt is).
3. **PIN gate** — kliens oldali összehasonlítás; siker `sessionStorage`-be.
4. Űrlap: soronként anyag + díj egységár, „Nem vállalom" checkbox; **részleges ajánlat engedélyezett**. Cégnév kötelező.
5. `POST /api/rfq/{token}` — validáció: 404 / **410 lejárt** / **409 a csomag már `decided`** (0. fázis javítás) / **409 már döntött meghívás** (`accepted`/`rejected`) / **400 nincs egyetlen árazott sor**.
6. Siker: submission upsert, meghívás → `submitted`, szerver fájl írás.
7. **Módosítás:** engedélyezett, amíg a csomag nem `decided`, a meghívás nem `accepted`/`rejected` és nem járt le — az API felülír és **`revisionHistory`-t ír** (0. fázis javítás, a belső store-ral azonos viselkedés).

## 7.4 Döntés — belső UI

**Belépési pontok:** projekt „Alvállalkozók" fül (`RfqProjectTab`), quote szerkesztő `QuoteRfqPanel` (döntésre váró / nyertes-cserélhető csomagok).

**Összehasonlítás:** `RfqPackageWorkspace` (KPI-k: legolcsóbb, spread, árazott sorok) + `RfqLineComparisonTable` mátrix (szűrők: mind / eltér / hiányzik / ártükörtől >10% eltérés).

**`applyRfqPackageDecision(packageId, winningInvitationId)` — a fő út:**
1. Alapértelmezett nyertes a UI-ban: teljes csomag legolcsóbbja.
2. Fedezet-előnézet: < 12% → borostyán figyelmeztetés.
3. Minden csomag-sorhoz a nyertes bid → quote-sor:
   ```
   costMaterial/LaborUnitPrice ← bid
   costSource = "subcontractor"
   costSourceSubcontractor = nyertes neve
   costSourceRfqSubmissionId = submission id
   pricingStatus = "costed"
   ```
   (Kihagyva: `declined` bid, mindkét ár ≤ 0 — az ilyen sor `rfq_pending` maradhat!)
4. Meghívások: nyertes → `accepted`, többiek → `rejected`.
5. Csomag → `decided`; döntésnapló `accept_package` (vagy `change_package_winner`, ha már `decided` volt) fedezet before/after értékekkel.

**Nyertes csere:** csak `decided` csomagon, ≥2 beküldéssel — a régi nyertes árai **felülíródnak**, régi meghívás → `rejected`.

**Sor-szintű nézet:** `QuoteLineBidExpandRow` — csak megtekintés; „A nyertes kiválasztása a teljes bekérésre vonatkozik". A döntés **kizárólag csomag-szintű** — a korábbi, sosem használt tételenkénti döntés-függvények törölve (0. fázis).

## 7.5 Quote-sor RFQ állapotgép

```
unpriced/estimated ──(bekérés indítás, ha nincs bekerülés)──► rfq_pending
rfq_pending ──(csomag-döntés, bid beírva)──► costed + costSource=subcontractor
rfq_pending ──(convertQuoteLineToManualCost, nincs ár)──► unpriced
costed/subcontractor ──(convertQuoteLineToManualCost)──► costed/manual (árak maradnak)
```

---

# 8. Ügyfélcsomag — ügyfélnek küldött árajánlat

## 8.1 Folyamat-áttekintés

```
Piszkozat (quote-k kiválasztása, snapshot) → Küldés (token + PIN + lejárat,
korábbi sent csomagok felülírása) → Ügyfél: /ajanlat/{token} → döntés
(elfogad / részleges / elutasít) → quote + projekt státusz frissítés → szerződés-bázis
```

## 8.2 Piszkozat létrehozás — `createCustomerPackageDraft`

**UI:** projekt Árajánlat fül → „Új árajánlat" dialógus (név → típus: Teljes/Kiegészítő → költségvetés-választás szakágonként csoportosítva).

**Quote kiválasztható, ha:**
- `readiness.canSend` (lásd 6.5)
- Nincs másik **piszkozatban** (`listQuoteIdsInDraftPackages`)
- Nincs **elküldött** csomagban (`listQuoteIdsInSentPackages`)
- Kiegészítőnél: nincs már **szerződésben** (`listContractedQuoteIds`)

**Eredmény:** `status: "draft"`, `snapshots` befagyítva (soronkénti eladási árakkal), default megjegyzés-szöveg, **nincs** token/kód/lejárat. Audit: „Árajánlat piszkozat létrehozva". Csak piszkozat törölhető (`deleteCustomerPackageDraft`).

## 8.3 Küldés — `publishCustomerPackageDraft`

1. Újra-validálás (`buildPackagePreviewFromQuoteIds`) — ha nem küldhető, hiba.
2. `expiresAt = most + offerValidityDays` (app beállítás, default **30 nap**).
3. **Supersede:** minden más `sent` csomag → `superseded`; a felülírt csomag quote-jai `sent → draft`, **ha** nincsenek más aktív (sent/accepted) csomagban. → Projektenként **legfeljebb egy aktív `sent`** csomag.
4. `status: "sent"`, `accessToken` (32 hex), `accessCode` (6 számjegy), friss snapshot-ok.
5. Snapshot quote-ok: `draft` → **`sent`**.
6. Audit: „Árajánlat elküldve ügyfélnek".

Belső UI-ból link + kód másolható (`project-offer-link-block.tsx`: `{origin}/ajanlat/{token}`).

## 8.4 Publikus oldal (`/ajanlat/[token]`)

- **GET** visszaadja a csomagot + projektet (404, ha ismeretlen). PIN-ellenőrzés **kliens oldali**.
- Fejléc: cím, ügyfél, helyszín, státusz, küldés dátuma, érvényesség, megjegyzés, bruttó + nettó összesítő.
- PIN feloldás után szakági blokkok: bruttó/nettó/ÁFA címke + tételtábla (nettó egységár, sorösszeg). Régi, `lines[]` nélküli snapshot-nál: „Összesített szakág-ajánlat (részletes tétellista nem érhető el)."
- **Döntés űrlap** (`sent` + nem lejárt + feloldott): elfogad mindent / csak kiválasztott szakágokat (checkbox) / elutasít. Kötelező: **név** + megerősítő checkbox.
- **POST validáció sorrendje:** 404 → **410 Superseded** → **403 hibás PIN** → **400 nincs megerősítés** → `applyCustomerPackageResponse` (**410 lejárt**, **409 már döntött**, **400 üres részleges**).

## 8.5 Válasz feldolgozása — `applyCustomerPackageResponse`

**Előfeltétel:** csomag `sent` és nem lejárt.

| Válasz | Hatás |
|---|---|
| `reject_all` | Csomag → `rejected`; snapshot quote-ok `sent` → `rejected`; **projekt státusz nem változik** |
| `accept_all` | Csomag → `accepted`; minden quote → `accepted`; projekt `prospect`/`quoting` → **`won`** |
| `partial` | Csomag → `accepted` (**nincs külön partial státusz**); `acceptedSnapshots` = kiválasztott szakágok; elfogadott quote-ok → `accepted`, kimaradók `sent` → `rejected`; projekt → `won` |

- A csomag `grossTotal`/`sellNetTotal` a **küldött** teljes összeget őrzi; elfogadáskor emellett kitöltődik az **`acceptedGrossTotal`/`acceptedSellNetTotal`** az elfogadott snapshotok összegével (0. fázis javítás). A belső UI elfogadott csomagnál az elfogadott összeget mutatja; a szerződés továbbra is az `acceptedSnapshots`-ból számol.
- Belső kézi rögzítés (`project-offer-response-dialog`): ugyanaz a 3 válasz, PIN/checkbox nélkül, `viaLink: false`. **A lejárat-ellenőrzés itt is él** — lejárt csomagra kézzel sem rögzíthető válasz.
- Audit: „Ügyfél elfogadta / elutasította az ajánlatot" / „Részleges elfogadás (N/M szakág)" (+ „(linken)" jelölés).

## 8.6 Szerződés-bázis — `buildContractBaseline`

Minden `accepted` csomag `acceptedSnapshots ?? snapshots` pillanatképeiből:

- `baseGrossTotal` — `full` csomagok bruttója
- `supplementGrossTotal` — `supplement` csomagok bruttója
- `grossTotal` = alap + pótmunka; `hasContract = tradeRows.length > 0`
- `listContractedQuoteIds` — a szerződött quote ID-k (TIG-árak, quote-zárás, execution alapja)

---

# 9. Kivitelezés és TIG (teljesítésigazolás)

## 9.1 Belépés a kivitelezésbe

```
Ügyfélcsomag elfogadás → quote: accepted, projekt: won
→ (opcionális) „Kivitelezés indítása" → projekt: in_progress
→ quote szerkesztő automatikusan a Kivitelezés fülre nyílik
```

- `isQuoteInExecutionMode = quote.status === "accepted" && projekt ∈ {won, in_progress}`
- Az összesítők (`buildExecutionSummary`, `buildOverviewKpis`) **`done`-nál is** execution módban számolnak, de a szerkesztő Kivitelezés fül lezárt projekten már nem elérhető.

## 9.2 Készültség követés (`QuoteExecutionPanel`)

- Tételenként pipa: `toggleQuoteLineExecution` (`done` ↔ `pending`) — **TIG-ben lévő tételnél no-op** + toast.
- Bulk: „Mind kész" / „Visszaállítás" (`setAllQuoteLinesExecution`) — a TIG-ben rögzített sorokat **kihagyja** (0. fázis javítás).
- Szűrők: Még nem kész / Kész / Mind.
- Készültség: `percent = round(done/total × 100)` — minden tétel számít.
- Pénzügy soronként: **szerződött ár** (elfogadott csomag snapshot-jából, `buildContractedSellMap`; snapshot híján élő `lineSellTotal`) vs **élő bekerülés** → fedezet.

## 9.3 TIG létrehozás (`tig-create-dialog.tsx`)

**TIG-be vehető tétel:** `executionStatus === "done"` **és** nincs `tigDocumentId`. Egy TIG **egy quote-hoz** kötött (több szakág = külön TIG-ek).

**Sorszám:** `{TIG-prefix}-{projektkód}-{kiállítás éve}-{NNN}` — prefix app beállítás (default `TIG`), az év az `issuedAt`-ból képződik (0. fázis javítás), sorszám a projekt TIG-jeinek száma + 1.

**Folyamat:**
1. „TIG (N)" gomb (csak ha van igazolható tétel) → dialógus, minden jogosult tétel előre kijelölve.
2. Teljesítés kezdete/vége, megjegyzés; jobb oldalt élő előnézet (`buildTigPreview`).
3. **TIG rögzítése** → `createPerformanceCertificate`: validálás (projekt/quote/sorok léteznek, minden sor `done` + TIG-mentes; hibánál `null`), dokumentum mentés `contractPackageId`-val (0. fázis javítás — eddig csak a cím mentődött), kiválasztott sorokra `tigDocumentId` bélyegzés, audit „Teljesítésigazolás rögzítve (sorszám)".
4. **Nyomtatás:** HTML előnézet `window.print()` — **nincs PDF-generálás**.

**Árak:** a TIG a **szerződött** (snapshot) eladási árakat használja — a küldés utáni élő árváltozás nem érinti. Ha a régi snapshot-ban nincs `lines[]`, a TIG-sor eladási ára **0** lesz.

**TIG történet:** projekt Áttekintés fül → táblázat (sorszám, kelte, időszak, tételszám, bruttó) + read-only előnézet. **TIG törlés/módosítás nincs implementálva.**

---

# 10. Pótmunka / kiegészítő ajánlat

## 10.1 Mikor és hogyan

Projekt már `won`/`in_progress`: új szakági költségvetés (pl. „Gépészet — pótmunka") → új ügyfélcsomag **`supplement`** típussal → küldés → elfogadás.

## 10.2 Eltérések a `full` csomagtól

| Szempont | `full` | `supplement` |
|---|---|---|
| Default cím | `{projekt} — teljes projektajánlat` | `{projekt} — kiegészítő ajánlat` |
| Quote-választás | Szabad (ha nincs zárolva) | Szerződött quote **nem** tehető bele |
| Elfogadás hatása a szerződésre | `baseGrossTotal` | `supplementGrossTotal` |
| Projekt státusz elfogadáskor | `prospect`/`quoting` → `won` | `in_progress`-nél **nem változik** |

## 10.3 Elfogadás után

- Szerződés-bázis automatikusan bővül (nincs külön „szerződés frissítés" lépés).
- Az új `accepted` quote tételei bekerülnek a projekt készültség-számításba, pipálhatók, TIG-elhetők.
- Ha ugyanarra a szakágra két elfogadott quote van (alap + pótmunka), **mindkettő** megjelenik és számít.

## 10.4 Függő pótmunkák jelzése

`pendingSupplements` (Áttekintés callout): `draft`/`sent` quote, amely supplement csomagban van **vagy** a címe tartalmazza a „pótmunka" szót, és nincs a szerződés-bázisban. A lezárás-dialógus figyelmeztet rájuk.

---

# 11. Projekt lezárás és archiválás

## 11.1 Lezárás — `closeProject` + `buildProjectCloseReadiness`

**Lezárás gomb:** csak `won`/`in_progress` projekten.

**Blokkolók (`canClose = false`):**
- Projekt nem található; már `done`/`archived`; státusz nem `won`/`in_progress`.

**Figyelmeztetések (NEM blokkolnak — lezárható mellettük):**
- „N kész tétel még nincs TIG-ben"
- „Készültség X% — nem minden tétel kész"
- Elküldött, el nem fogadott kiegészítő ajánlat
- Piszkozat pótmunka költségvetés(ek)

**Siker:** `status → "done"`, audit „Projekt lezárva" → a projekt az **Archív** listába kerül (a `done` is archív fázis).

## 11.2 Archiválás

- `archived` státusz létezik, de **nincs automatikus út** — csak kézi szerkesztéssel állítható.
- Lezárt projekten: Lezárás gomb rejtve, Kivitelezés fül nem elérhető, de az áttekintés execution KPI-jai megmaradnak.
- Az ügyfél-statisztika `activeProjectCount`-ja kizárja a `done`/`archived` projekteket.

---

# 12. A teljes folyamat döntési fája

```
[1] PROJEKT LÉTREHOZÁS (/ajanlatok, csak quotes fázisban)
 │   status: prospect  (kézzel átállítható: quoting)
 ▼
[2] KÖLTSÉGVETÉS(EK) SZAKÁGANKÉNT
 │   createQuote (üres) / duplicateQuote (verzió, sorok másolva)
 │   tétel: ártükörből (primaryTrade egyezés) VAGY szabad tétel
 │   (addManualQuoteLine — costItemId nélkül, quote szakágával)
 ▼
[3] ÁRAZÁS — minden tételnél döntés:
 ├─► Ártükörből tölt (catalog, estimated)
 ├─► Kézi ár (manual, estimated)
 └─► RFQ-ba küld ──────────────────────────────┐
                                               ▼
                          [3a] RFQ WIZARD (szakág + tételek + partnerek + határidő)
                           │   sorok: rfq_pending; meghívók: invited (token+PIN)
                           ▼
                          [3b] ALVÁLLALKOZÓ /rfq/{token}
                           ├─ lejárt? ──► „Lejárt ajánlatkérés" (410)
                           ├─ nem küld be ──► sor rfq_pending marad (blokkoló)
                           └─ beküld (részleges is lehet) ──► submitted
                                (módosíthat, amíg nincs döntés / lejárat)
                           ▼
                          [3c] DÖNTÉS (csomag-szintű, teljes csomagra egy nyertes)
                           ├─ nyertes → accepted; többiek → rejected; csomag → decided
                           ├─ bid-ek → quote sorok (costed, subcontractor)
                           ├─ declined/0 árú sor → rfq_pending MARAD
                           └─ később: nyertes csere (árak felülírása)
 ▼
[4] KÜLDHETŐSÉG (readiness): van tétel? mind árazott? RFQ-válaszok beírva?
 │   fedezet ≥ 12%? ── nem → blokkoló (csak teljesen árazottnál)
 ▼
[5] ÜGYFÉLCSOMAG PISZKOZAT (full / supplement)
 │   quote-zárolás: más piszkozat / elküldött / szerződött quote nem választható
 │   snapshot befagyasztás (soronkénti eladási árak)
 │   ├─► törlés (csak piszkozat)
 ▼
[6] KÜLDÉS (publish)
 │   token + 6 jegyű PIN + lejárat (default 30 nap)
 │   korábbi sent csomagok → superseded (quote-jaik vissza draft-ba, ha szabadok)
 │   quote-ok: draft → sent
 │   a küldött quote-ok RÉGI VERZIÓI automatikusan archiválódnak
 ▼
[7] ÜGYFÉL DÖNTÉSE /ajanlat/{token} (vagy belső kézi rögzítés)
 ├─ superseded link ──► megtekinthető, POST 410
 ├─ lejárt ──► űrlap rejtve, POST/kézi rögzítés 410 → új csomag kell
 ├─ ELUTASÍT ──► csomag rejected, quote-ok rejected, projekt marad
 ├─ RÉSZLEGES ──► csomag accepted + acceptedSnapshots;
 │                 kiválasztott quote-ok accepted, kimaradók rejected;
 │                 projekt → won
 └─ ELFOGAD MINDENT ──► csomag accepted, quote-ok accepted, projekt → won
 ▼
[8] SZERZŐDÉS-BÁZIS (accepted csomagok acceptedSnapshots-ai)
 │   baseGross + supplementGross
 ▼
[9] KIVITELEZÉS (won → „Kivitelezés indítása" → in_progress)
 │   quote szerkesztő Kivitelezés fül
 ├─► tételek pipálása (done) — élő bekerülés módosítható, szerződött ár fix
 ├─► PÓTMUNKA ág: új quote + supplement csomag → vissza [5]-höz
 │     (elfogadás: szerződés bővül, projekt státusz nem változik)
 └─► TIG (kész, még nem igazolt tételekből, quote-onként)
       sorszám: TIG-{kód}-{év}-{NNN}; szerződött árakkal; nyomtatás HTML-ből
       tétel tigDocumentId-t kap → készültsége visszavonhatatlan
 ▼
[10] LEZÁRÁS (won/in_progress → done)
 │   figyelmeztetések (nem blokkolnak): TIG-eletlen kész tételek,
 │   készültség < 100%, függő pótmunkák
 ▼
[11] ARCHÍV (/archiv: done + archived)
      archived: csak kézzel
```

---

# 13. Edge case katalógus

## 13.1 Költségvetés és árazás

| Eset | Viselkedés |
|---|---|
| 0 tétel | `canSend = false`, „Nincs tétel"; összegek 0, fedezet null |
| Árazatlan sorok | `isPartialTotal = true`; fedezet-blokkoló **kikapcsol**; küldés blokkolva |
| Quote törlés RFQ-val | `deleteQuote` → `false`, hiba-toast |
| Quote törlés RFQ nélkül | Quote + sorok törlődnek, **nincs audit** |
| Sor törlés archivált quote-on | **Blokkolt** (0. fázis javítás — `deleteQuoteLine` guard) |
| Archivált quote szerkesztés | `updateQuoteLine` nem fut, `addQuoteLineFromCostItem` / `addManualQuoteLine` dob |
| Szabad tétel | `costItemId: null`, azonosító `EGYEDI` — az ártükör-kitöltés (`applyCatalogToUnpricedLines`) kihagyja, mert nincs `costItemId` |
| Duplikálás | RFQ/alvállalkozói referenciák + execution/TIG mezők törölve; `rfq_pending` → `unpriced` |
| Fedezet % kijelzés | Összesítő: költség-bázis; lista UI: eladás-bázis — **eltérő számok** |
| Több `sent` quote azonos szakágra | Aggregációs figyelmeztetés: „N kész ajánlat — ellenőrizd" |

## 13.2 RFQ

| Eset | Viselkedés |
|---|---|
| Lejárt határidő | Publikus: nincs űrlap; POST 410; belső workspace-ben döntés **továbbra is lehetséges**, ha van beküldés |
| Beküldés döntött csomagra | Csomag `decided` → **409** (0. fázis javítás), meghívás `accepted`/`rejected` → 409 |
| Újra-beküldés | Nyitott meghívásnál engedélyezett; API felülír és `revisionHistory`-t ír (0. fázis javítás) |
| Nyertes csere | Régi nyertes árai felülíródnak; régi → `rejected` |
| RFQ már árazott sorokra | Bekérhető (warning); `rfq_pending` nem áll be; döntés felülírja az árat |
| Átfedő bekérések | Csak figyelmeztetés — létrehozás nem blokkolt |
| `declined` / 0 árú bid a nyertesnél | A sor **nem** kap árat → `rfq_pending` marad → readiness-blokkoló él |
| Blokkolt alvállalkozó | Wizard-mátrixból kiszűrve; utólagos blokkolásra nincs runtime figyelmeztetés |
| PIN biztonság | GET/POST nem validál PIN-t (csak kliens-oldali kapu); a token a tényleges védelem |
| Kézi árra váltás | `convertQuoteLineToManualCost` — bekérés/submission nem módosul, csak a quote-sor |

## 13.3 Ügyfélcsomag

| Eset | Viselkedés |
|---|---|
| Felülírt (superseded) link | GET + megtekintés működik, POST 410; belső: „Az ügyfél linkje már nem aktív." |
| Lejárt ajánlat | Publikus űrlap rejtve; POST 410; **kézi belső rögzítés is blokkolt** → új csomag kell |
| Ismételt döntés | Nem-`sent` csomagra POST → 409 |
| Részleges elfogadás | Csomag `accepted` (nincs külön státusz); `grossTotal` a küldött összeget őrzi, az **`acceptedGrossTotal`** az elfogadott összeg (0. fázis) — UI elfogadottnál ez utóbbit mutatja; kimaradó quote-ok `rejected`; projekt → `won` |
| Üres részleges kiválasztás | 400 „Legalább egy szakágot ki kell választani" |
| Quote két piszkozatban | Tiltott |
| Quote elküldött csomagban | Új csomagba nem választható |
| Szerződött quote kiegészítőbe | Tiltott |
| Snapshot-drift | Élő quote bruttó ≠ snapshot (>1 Ft) → `hasDrift` figyelmeztetés, **nem blokkol** |
| Régi csomag `lines[]` nélkül | Csak összesítő látszik; TIG-sor eladási ára 0 lenne |
| Tétel-szintű csomag-összeállítás | Adatmodellben támogatott (`lineIds`), de a UI csak **teljes költségvetést** választ |
| Link-szinkron | Ügyfél POST → szerver fájl; belül csak `syncBundleFromServer` után látszik |
| PIN a GET-válaszban | A token-GET a kódot is visszaadja JSON-ben — a kapu kliens-oldali |
| „Link újragenerálás" | Nincs — újraküldéshez új piszkozat + publish kell |

## 13.4 Kivitelezés és TIG

| Eset | Viselkedés |
|---|---|
| TIG 0 kész tétellel | Gomb nem jelenik meg; store `null`-t ad |
| Lezárás befejezetlen tételekkel | Engedélyezett — csak figyelmeztetés |
| TIG-es tétel visszavonása | Egyedi pipa: no-op + toast; bulk „Visszaállítás" is **kihagyja** a TIG-es sorokat (0. fázis javítás) |
| Több TIG | Támogatott, sorszám nő; egy tétel csak egy TIG-ben |
| TIG törlés/szerkesztés | **Nincs implementálva** |
| TIG sorszám éve | Az `issuedAt` évéből képződik (0. fázis javítás) |
| `contractPackageId` a TIG-en | Rögzítéskor kitöltődik az elfogadott csomag ID-jával (0. fázis javítás) |
| Elfogadott quote szerkesztése kivitelezés alatt | Engedélyezett (élő bekerülés-követés); Fedezet/ÁFA lockolt, szerződött ár snapshot-ból |
| Duplikált quote execution mezői | `executionStatus` + `tigDocumentId` nem másolódik |

---

# 14. Ismert hiányosságok / nem implementált funkciók

*(A 2026-07-08-i 0. fázisban megoldott tételek átkerültek a 17. fejezetbe.)*

| Terület | Hiányzó | Terv |
|---|---|---|
| TIG | Törlés / módosítás; PDF-generálás (csak HTML print) | PDF: DB-migráció utáni fázis |
| Projekt | `archived` státuszra nincs automatikus/dedikált út | Későbbi döntés |
| Szinkron | Publikus válaszok belső megjelenéséhez manuális frissítés kell | DB + Realtime oldja meg (1. hullám után) |
| Biztonság | PIN a publikus GET-válaszban (offer + RFQ) — a kapu kliens-oldali | **Rögzített döntés:** szerveroldali PIN-validáció a DB-s API-kkal együtt (013/014 hullám) — lásd 17.3 |
| Számlázás | Fizetési ütemterv, számla, kintlévőség, visszatartás | 2. fázis (pénz-kör) — lásd 17.4 |

---

# 15. Audit napló akciók

Napló-típusok (`kind`): `project`, `quote`, `rfq`, `file`, `decision`.

| Akció szöveg | Trigger |
|---|---|
| „Projekt létrehozva" / „Projekt adatok módosítva" / „Projekt lezárva" | project CRUD + close |
| „Költségvetés létrehozva / másolva / módosítva / archiválva" | quote CRUD |
| „Bekérés indítva" | RFQ csomag létrehozás |
| „Nyertes kiválasztva / Nyertes módosítva" | RFQ döntés (decision log) |
| „Árajánlat piszkozat létrehozva / törölve" | ügyfélcsomag piszkozat |
| „Árajánlat elküldve ügyfélnek" | publish |
| „Ügyfél elfogadta / elutasította az ajánlatot" / „Részleges elfogadás (N/M szakág)" | válasz (+ „(linken)" ha publikus) |
| „Teljesítésigazolás rögzítve (sorszám)" | TIG |
| „Projekt összeállítás mentve" | composition |

---

# 16. Kulcsfájl-referencia

Minden útvonal: `epito-artukor/site/src/` alatt.

| Terület | Fájl |
|---|---|
| **Típusok** | `types/projects.ts` |
| **Store (minden CRUD)** | `lib/data/projects-store.ts` |
| Projekt fázisok | `lib/project-phase.ts` |
| Árazás | `lib/quote-pricing.ts`, `lib/quote-summary.ts`, `lib/quote-client-summary.ts` |
| Verziók / aggregáció | `lib/project-quote-aggregation.ts` |
| Migrációk | `lib/quote-migration.ts`, `lib/rfq-migration.ts` |
| RFQ segédek | `lib/rfq-package-utils.ts`, `lib/quote-rfq-context.ts`, `lib/rfq-line-comparison.ts`, `lib/trade-rfq-summary.ts`, `lib/subcontractor-queries.ts` |
| Ügyfélcsomag | `lib/customer-package.ts`, `lib/customer-package-response.ts` |
| Szerződés | `lib/contract-baseline.ts`, `lib/quote-contract-context.ts` |
| Kivitelezés | `lib/quote-execution.ts`, `lib/execution-summary.ts` |
| TIG | `lib/tig-document.ts`, `lib/tig-preview-build.ts` |
| Áttekintés | `lib/project-overview-summary.ts`, `lib/project-overview-dashboard.ts`, `lib/project-overview-activity.ts` |
| Beállítások | `lib/app-settings.ts` (fedezet minimumok, érvényességi napok, TIG prefix) |
| **Publikus API-k** | `app/api/offer/[token]/route.ts`, `app/api/rfq/[token]/route.ts`, `app/api/projects-bundle/route.ts` |
| Publikus oldalak | `app/ajanlat/[token]/page.tsx` (+ `components/offer/offer-public-client.tsx`), `app/rfq/[token]/page.tsx` (+ `components/rfq/rfq-public-client.tsx`) |
| Quote szerkesztő | `components/projektek/quote-editor-client.tsx`, `quote-markup-panel.tsx`, `quote-execution-panel.tsx` |
| RFQ UI | `components/projektek/rfq-create-wizard.tsx`, `rfq-package-workspace.tsx`, `quote-rfq-decision-dialog.tsx`, `rfq-project-tab.tsx`, `rfq-line-comparison-table.tsx` |
| Ügyfélcsomag UI | `components/projektek/project-offer-tab.tsx`, `project-offer-create-dialog.tsx`, `project-offer-detail-dialog.tsx`, `project-offer-response-dialog.tsx`, `project-offer-link-block.tsx` |
| TIG UI | `components/projektek/tig-create-dialog.tsx`, `project-tig-history-panel.tsx` |
| Lezárás UI | `components/projektek/project-close-dialog.tsx` |
| Demo adatok | `data/mock-projects.ts`, `data/mock-won-demo.ts`, `data/mock-customer-packages.ts` |

---

# 17. Változásnapló és DB-migrációs döntések (0. fázis)

> **Dátum:** 2026. július 8. · **Cél:** a kódbázis kitakarítása és a szemantikai hibák javítása **a Supabase-migráció megkezdése előtt**, hogy a DB-séma már a letisztult modellt képezze le.

## 17.1 Törölt halott kód

| Törölve | Indok |
|---|---|
| `RfqInvitationStatus.reserve` | Semmi nem állította be — csak címke volt. (Az alvállalkozó törzs `tier: "reserve"` független, maradt.) |
| `RfqDecisionAction.accept_line` + `applyRfqLineDecisions` | Tételenkénti RFQ-döntés — store kész volt, UI soha nem hívta. Döntés: a döntés **csomag-szintű** marad. |
| `RfqDecisionAction.reject_invitation` | Csak címke volt, store-függvény sosem létezett. |
| `applyRfqSubmissionToQuote` | Importálva volt, de sehol nem hívódott. |
| `createRfqFromQuoteLines`, `submitRfqBid` | v1 (egy link a csomagon) legacy wrapper-ek. |
| `createCustomerPackage` (egy-lépéses küldés) | A draft → publish kétlépéses út váltotta ki; UI nem hívta. |
| `SubcontractorRfqStatus`: `closed`, `draft`, `sent`, `received` | Fő típus: csak `open` / `decided`. Legacy értékeket a migráció normalizálja (`closed` → `decided`). |
| `SubcontractorRfq.accessToken` / `accessCode` (csomag-szintű) | v1 mezők — csak a migráció `LegacyRfqPackage` típusa olvassa őket import-normalizáláskor. |

## 17.2 Javított hibák

| Javítás | Fájl |
|---|---|
| Részleges elfogadásnál `acceptedSellNetTotal` / `acceptedGrossTotal` számítás + UI kijelzés | `customer-package-response.ts`, `types/projects.ts`, `project-offer-tab.tsx`, `project-offer-detail-dialog.tsx` |
| Bulk „Visszaállítás" kihagyja a TIG-ben rögzített sorokat | `projects-store.ts` (`setAllQuoteLinesExecution`) |
| `deleteQuoteLine` archivált quote-on blokkolt | `projects-store.ts` |
| TIG sorszám éve az `issuedAt`-ból | `tig-preview-build.ts` (`formatTigDocumentNumber`) |
| `PerformanceCertificate.contractPackageId` kitöltése rögzítéskor | `projects-store.ts`, `tig-preview-build.ts`, `tig-document.ts` |
| RFQ POST `decided` csomagra → 409 | `app/api/rfq/[token]/route.ts` |
| RFQ publikus újra-beküldés `revisionHistory`-t ír | `app/api/rfq/[token]/route.ts` |

## 17.3 Új viselkedések (rögzített döntések, implementálva)

| Döntés | Implementáció |
|---|---|
| **Verziózás:** új verzió ügyfélnek küldésekor a lánc régi verziói automatikusan archiválódnak (elfogadott / más aktív csomagban lévő kivételével). A `resolveVersionHeads` rangsor biztonsági hálóként megmarad. | `archiveSupersededVersionsInBundle` a `publishCustomerPackageDraft`-ban; audit: „Régi verzió automatikusan archiválva" |
| **Szabad tétel:** költségvetésbe ártükör-hivatkozás nélkül is vehető fel sor (`costItemId: null`, azonosító `EGYEDI`, szakág = quote szakága). Az ártükör-kényszer megszűnt, a soronkénti szakág kötelező marad. | `addManualQuoteLine` + „Szabad tétel" blokk a tétel-hozzáadó dialógusban |

## 17.4 Rögzített döntések a DB-migrációhoz (még nem implementálva)

1. **Szerveroldali PIN-validáció** — a publikus GET nem adhatja vissza az `accessCode`-ot; a feloldás szerveren történik (POST verify vagy `?code=` paraméter), 3 hibás PIN → lockout. A DB-s publikus API-kkal (offer/RFQ végpont-hullám) együtt készül, mert az API-szerződést érinti.
2. **Snapshot tárolás:** a `CustomerPackage.snapshots` / `acceptedSnapshots` és a TIG `lines[]` **JSONB-ben** marad (dokumentum jellegű, befagyott pillanatképek) — nem normalizáljuk sorokra.
3. **Fizetési ütemterv (2. fázis, pénz-kör):** `PaymentSchedule` a csomaghoz kötve, elfogadáskor aktiválódik; részleges elfogadásnál az ütemterv az `acceptedGrossTotal`-ból számolódik újra. Új entitások: `Invoice`, `PaymentReminder`, `ProjectCost`, `RetentionEntry`, `Notification` (lásd az Anthropic-javaslat 2. táblázata — elfogadva).
4. **Lezárás-blokkoló** (nyitott számla / számlázatlan TIG) a pénz-körrel együtt kerül be — addig a jelenlegi figyelmeztetéses lezárás él.
5. **Import (AI kiírás-felismerés)** a DB-migráció **utáni** fázis — minden importsor „javaslat" státuszú, kötelező emberi jóváhagyással.

## 17.5 Migrációs megjegyzés

A localStorage/JSON-bundle → Supabase importnál a `normalizeProjectBundle` + `normalizeRfqBundle` migrációk **egyszer** futnak le az import-szkriptben; utána a migrációs kód (`quote-migration.ts`, `rfq-migration.ts` legacy ágai) törölhető.

---

## 17.6 DB-séma — 011–015 migrációk (2026-07-08, **lefuttatva élesben**)

> Fájlok: `site/supabase/migrations/011_projects.sql` … `015_execution_tig.sql`. Futtatási sorrend kötelező (FK-függés). Konvenciók a 001–010-ből öröklődnek: org-izoláció + RLS, `set_updated_at` trigger, HUF `int` egységárak.

### Tábla-térkép

| Migráció | Táblák |
|---|---|
| 011 | `projects`, `project_audit_log` + `is_org_member` / `is_project_member` RLS-helper |
| 012 | `quotes`, `quote_trade_markups`, `quote_lines` + `is_quote_member` helper + archivált-guard |
| 013 | `rfq_campaigns`, `rfqs`, `rfq_lines`, `rfq_invitations`, `rfq_submissions`, `rfq_submission_bids`, `rfq_decision_logs` + `is_rfq_member` helper |
| 014 | `customer_packages`, `project_composition_selections` |
| 015 | `performance_certificates` + TIG-guard + `quote_lines.tig_document_id` FK |

### Kulcs FK-döntések

| Kapcsolat | Szabály | Indok |
|---|---|---|
| `rfqs.quote_id` → quotes | **RESTRICT** | A „quote nem törölhető, ha van bekérése" app-szabály DB-szinten is él |
| `quote_lines.cost_item_id` | SET NULL | Ártükör-törlés után a sor él (snapshot); `NULL` = szabad tétel |
| `rfq_lines.quote_line_id` | SET NULL | Bekérés-sor snapshot szövege megmarad |
| `quote_lines.cost_source_submission_id` | SET NULL | Beküldés törlése nem nullázza az árat |
| `quote_lines.tig_document_id` | SET NULL | Jövőbeli TIG-storno: cert törlésekor a sorok felszabadulnak |
| csomag ↔ quote | **nincs FK** (JSONB snapshot) | A szerződés pillanatkép — szándékos denormalizáció |
| `projects.client_id` | SET NULL | `client_name` snapshot marad |

### DB-szinten kikényszerített invariánsok

1. Projektenként **legfeljebb egy `sent` ügyfélcsomag** — partial unique index. *API-implementációs következmény:* küldéskor előbb a régi `sent` → `superseded` UPDATE, utána az új → `sent` (az index statementenként érvényesül).
2. **Egy beküldés / meghívás** — `rfq_submissions.invitation_id` unique; újra-beküldés = UPDATE + `revision_history`.
3. **TIG-sorszám ütközés** — unique `(project_id, document_number)`.
4. **TIG-guard trigger** (`quote_lines`): TIG-es sor készültsége nem állítható vissza, nem csatolható át másik cert-re, nem törölhető. A **bekerülési árak szándékosan NEM zároltak** (élő tényköltség-követés elfogadott quote-on engedélyezett — a TIG eladási árat snapshotból visz). *Mellékhatás (szándékos, teszttel igazolt — T13):* TIG-es sorokat tartalmazó projekt hard-delete-je is elhasal a guardon — szerződött/teljesített projektet archiválni kell, nem törölni. (Az app amúgy is csak `prospect`/`quoting` projektet enged törölni.)
5. **Archivált-guard trigger** (`quote_lines`): archivált quote sora nem UPDATE-elhető. **Csak UPDATE** — DELETE-re szándékosan nem fut, különben a `project → quotes → quote_lines` CASCADE törlés elhasalna archivált quote-ot tartalmazó projekten; a közvetlen sortörlést az app guardja fedi.
6. `project_audit_log` és `rfq_decision_logs`: **INSERT-only** policy (tagok nem írhatják át a történetet). `performance_certificates`: update/delete policy nincs → DB-szinten immutábilis.

### Biztonsági modell (rögzített)

- Publikus végpontok (`/ajanlat/[token]`, `/rfq/[token]`) **nem anon RLS-en** mennek: a Next.js route handler **service-role** klienssel fut, szerveroldali token+PIN validációval. Anon policy egyik táblán sincs.
- `access_code` (PIN) **plain textben** tárolt — a belső UI-nak látnia kell másoláshoz; a publikus GET-válaszból szerveroldalon szűrjük ki. A PIN megosztott belépőkód, nem jelszó.

### Séma-verifikáció

A `site/supabase/tests/projects-schema-edge-cases.sql` szkript 14 edge-case tesztet futtat a sémán (lokális Postgres 15-ön mind PASS, 2026-07-08): RESTRICT quote-törlés, partial unique `sent` csomag + supersede-sorrend, archivált-guard + SET NULL átjárás, TIG-guardok (készültség / átcsatolás / törlés / élő bekerülési ár), TIG-sorszám ütközés, 1 beküldés/meghívás, cert-törlés SET NULL, rfq_line snapshot. A szkript tranzakcióban fut és rollback-el zár — éles Supabase-en is biztonságosan futtatható ellenőrzésként a 011–015 után.

### Import-szkript teendői (következő lépés)

1. A legacy ID-k **nem UUID-k** (`proj-1720…-abc` formátum) → old→new UUID map kell, és a **JSONB snapshotok belsejében is remap** (`snapshots[].quoteId`, `lines[].lineId`, TIG `lines[]` stb.).
2. Trade **code** → `trade_id`, unit id → `unit_id` feloldás org-onként.
3. Insert-sorrend: projects → quotes → quote_lines (`tig_document_id = NULL`) → RFQ-lánc → packages → certs → végül `quote_lines.tig_document_id` UPDATE (a guardok INSERT-et és NULL→érték átmenetet nem blokkolnak — ezért tölthető be archivált quote sora és TIG-es sor is).
4. `normalizeProjectBundle` + `normalizeRfqBundle` egyszer lefut az import előtt (17.5).

---

## 17.7 Frontend-átállás DB-re + teljes mock/localStorage takarítás (2026-07-08, implementálva)

> A 011–016 migrációk éles futtatása után a teljes frontend átállt: **a Supabase az egyetlen adatforrás**, a kliens csak in-memory cache-t használ. Minden mock adatfájl és minden adat-perzisztáló localStorage/IndexedDB használat törölve.

### Architektúra

- **Projekt-domain** (`projects-store.ts`): in-memory `bundleCache`, betöltés `GET /api/projects-bundle`-ből (`syncBundleFromServer`), minden mutáció után teljes bundle-PUT vissza a DB-be. A szerveroldali diff-sync a `lib/server/projects-bundle-db.ts`-ben él (upsert + törlés táblánként, FK-sorrendben; legacy nem-UUID id-k remapje a JSONB snapshotok belsejében is).
- **Törzsadatok** (ártükör, ügyfelek, alvállalkozók, mértékegységek, kategóriák, szakágak, app-beállítások, cégprofil): `master-data-primer.ts` egyszer betölti az API-król az in-memory cache-ekbe; a `useProjectsBundleReady` hook a bundle + fájlok + törzsadat betöltését együtt várja be. A cache-írás **csak** a `set*Cache` függvényeken át történik — a store-okból az összes lokális mutáció-helper (create/update/delete) törölve, mutáció csak API-n keresztül megy.
- **Projekt-fájlok** (016): metaadat a `project_folders` / `project_files` táblákban, blob a `project-files` Storage bucketben (`<org>/<projekt>/<fájl-uuid>` út, org-tag RLS). Új API-k: `GET/PUT /api/project-files` (állapot-sync), `POST /api/project-files/upload` (multipart, max 15 MB), `GET/DELETE /api/project-files/[id]` (aláírt letöltő-URL / törlés Storage-ból is). Az IndexedDB blob-tár (`project-files-blob-db.ts`) törölve.
- **Egyszeri legacy-import**: `POST /api/projects-bundle/import` — a `.data/projects-bundle.json`-t (vagy a request bodyt) normalizálja és beszinkronizálja a DB-be.

### Mock mód megszüntetve

- A mock bejelentkezés (`demo` jelszó, `mock-users`) törölve — Supabase nélkül a login 503-at ad. Az API-oldali `mode === "mock"` guardok (503) konfigurációs védelemként megmaradtak.
- Minden kliens-komponensből kikerültek az `authMode === "mock"` ágak (ügyfelek, alvállalkozók, tételek, kategóriák, mértékegységek, szakágak, cégadatok, app-beállítások, import oldal, login) — mindenhol csak az API-út maradt.
- Törölt fájlok: a teljes `src/data/mock-*.ts` készlet (14 fájl, köztük `mock-projects`, `mock-won-demo`, `mock-hyundai-expanded`, `mock-customer-packages`), `lib/auth/mock-auth.ts`, `lib/project-files-blob-db.ts`.
- Áthelyezett, nem-mock tartalmak: `DEFAULT_APP_SETTINGS` → `lib/app-settings/default-app-settings.ts`; `DEFAULT_ORG_PROFILE` (üres kezdőprofil) → `lib/organizations/default-org-profile.ts`; `DEFAULT_FOLDER_NAMES` → `lib/project-file-folders.ts`.

### Megmaradt localStorage (szándékosan — csak UI-preferencia, nem adat)

`column-config` (oszlop-láthatóság), `cost-item-views` (mentett nézetek), `cost-item-recent` (legutóbbi tételek), sidebar összecsukott állapot, `client-user` (bejelentkezett user gyorsítótár a fejlécnek).

### Publikus végpontok

`/api/offer/[token]` és `/api/rfq/[token]`: service-role kliens + szerveroldali PIN-validáció (`pin-lockout.ts`: 3 hibás PIN → 15 perc zár tokenenként), az `accessCode` sosem megy le a válaszban. **Üzemeltetési előfeltétel: `SUPABASE_SERVICE_ROLE_KEY` a `.env.local`-ban.**
