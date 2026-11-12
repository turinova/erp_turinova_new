# 57 — Partner fizetés (átutalás + Teya kártya) + automatikus számlázás

**Státusz:** C1 kész · **P1 kész** (Embedded UI). Autokassza/IPN · Teya webhook · auto előleg/végszámla = **hátralévő**.  
**Kapcsolódó:** [20-partner-portal.md](20-partner-portal.md), [36-szamlazas-workflow.md](36-szamlazas-workflow.md), [44-penzugy-finance.md](44-penzugy-finance.md), [29-pos-workflow.md](29-pos-workflow.md) (POSLink ≠ ecommerce), [48-fizetesi-modok-default.md](48-fizetesi-modok-default.md).  
**Migráció (C1):** `20261013_tenant_teya_online_settings.sql`.  
**UI:** `/beallitasok/partner` → Teya online · **Tenant útmutató:** `/penzugy/utmutato`.

> **Nem adótanácsadás.** Az alábbi magyar Áfa-logika publikus szabályok + konzervatív termékdöntés. Tenant ÁSZF + könyvelő erősíti meg. A doc a **fejlesztői forrásigazság** a flow-ra.

---

## 0. Egy mondat

> Partner **átutalás** → opcionális **díjbekérő** → pénz → **előlegszámla** → átadás → **végszámla**. Partner **bankkártya (Teya Embedded)** → pénz azonnal (webhook) → **előlegszámla** (soha díjbekérő) → átadás → **végszámla**. A számla **kelte** csúszhat; a **teljesítés dátuma** mindig a pénz / átadás napja (`Europe/Budapest`).

---

## 1. Fogalmak (zárolt)

| Bizonylat | DB / Számlázz | Mikor | Pénz | Áfa esemény |
|-----------|---------------|-------|------|-------------|
| **Díjbekérő** | `dijbekero` / `kind: 'proforma'` | Utalás **előtt** | Még nincs | Nincs |
| **Előlegszámla** | `elolegszamla` / `kind: 'advance'` | Pénz megvan, áru/szolgáltatás **még nincs** átadva | Megvan | Áfa a kézhezvételkor (Áfa tv. 59. §) |
| **Végszámla** | `szamla` / `kind: 'normal'` | Teljesítés / átadás | Előleg levonva (akár 0 Ft hátralék) | Teljesítéskor |
| **Sztornó** | `sztorno` | Hibás / visszatérített bizonylat | — | — |

### Tilos / kötelező

| Szabály | |
|---------|--|
| Kártyás sikeres fizetés után **tilos** díjbekérő | A pénz már megvan |
| 100% kártya előre → 100% előlegszámla, később végszámla (akár 0 Ft) | Konzervatív partner modell |
| Végszámla **teljesítés előtt** (gyártás/szállítás előtt) | Kerülendő — adóidőpont |
| POS Teya credential ≠ online ecommerce credential | Külön tábla / UI |

---

## 2. Magyar szabályok — fejlesztői összefoglaló

| Eset | Következmény a termékben |
|------|---------------------------|
| Teljesítés **előtt** kapott ellenérték (előleg) | Adófizetés a jóváírás / kézhezvételkor |
| Előleg **bankkártyával** (készpénz-helyettesítő) | Számla **haladéktalanul** a fizetéssel; ha a kiállítás technikailag csúszik, a **teljesítés dátuma = fizetés napja** |
| Előleg **átutalással** | Általában jóváírástól **15 napon** belüli számlázás |
| Előleg után mindig | **Végszámla** a teljesítéskor (akár nullás hátralék) |
| Díjbekérő | Nem számla, nem NAV adóesemény |
| B2B partner (adóalany) | Előlegszámla tipikusan kötelező → nálunk **mindig** állítunk (egy kódút) |

**ÁSZF javaslat tenantoknak:** kártyás / előre utalt partner rendelés = előleg a teljesítésig; átadáskor végszámla.

---

## 3. Teya — két világ (ne keverd)

| | POS (pult) | Online (partner kártya) |
|--|------------|-------------------------|
| Tábla | `tenant_pos_settings` | `tenant_teya_online_settings` |
| UI | POS beállítások → Kártyagép | `/beallitasok/partner` → Teya online kártya |
| API | POSLink payment-requests | Ecommerce checkout sessions |
| Scope példa | `payment_requests`, `stores/id/terminals` | `checkout/sessions/create`, `checkout/sessions/id/get` |
| Credential | store + terminal + epos + client | store_id + client_id + client_secret |
| Token host staging | `id.teya.xyz` | `id.teya.xyz` |
| Token host production | `id.teya.com` | `id.teya.com` |
| Kód | `lib/pos/teya/` | `lib/teya-online/` |
| HUF `amount` | whole Ft (POS) | **Ft × 100** (ecommerce minor unit) |

### Környezet párosítás (C1 tapasztalat)

- Credential a **`business.teya.com`**-on → modul-appban **Éles** (`production`).
- Credential a **`business.teya.xyz`**-on → modul-appban **Teszt** (`staging`).
- Keverés → OAuth: `Client or client authentication not configured on profile` (`invalid_client`).
- Régi RPG / SecurePay (VendorID, MerchantID, `_pu`/`_pr` kulcsok) **nem** használható az új ecommerce API-hoz.

### C1 — ami már kész

- Tábla: `tenant_teya_online_settings` (RLS: tenant tag olvashat / writer ír; **nincs** partner SELECT — secret védelme).
- Mezők: `enabled`, `teya_env`, `teya_store_id`, `teya_client_id`, `teya_client_secret`, `teya_webhook_public_key`.
- Actions: `saveTeyaOnlineSettingsAction`, `testTeyaOnlineConnectionAction` (OAuth + checkout session GET smoke).
- Secret: üres mentés = megtartás; kliensnek csak `hasClientSecret`.

### Staging hozzáférés

Ha a tenantnak nincs `business.teya.xyz` joga: Teya kapcsolattartótól **development store + ecommerce subscription** kell. Éles kulccsal ne futtass éles checkout tesztet partnernek.

---

## 4. Flow A — Átutalás (partner)

### Célállapot

```
Beküldés (kind=transfer)
  → [opcionális] auto díjbekérő (már megvan: auto_proforma_*)
  → Banki jóváírás / staff befizetés rögzítés
       immutable: credited_at (= tax_event_at) Europe/Budapest
  → Előlegszámla (fulfillmentDate = credited_at napja)
  → Gyártás / szállítás
  → Teljesítés jelölés
  → Végszámla (fulfillmentDate = átadás napja; előleg beszámítva)
```

### Ami ma él

- Auto díjbekérő: `shouldAutoProforma` csak `transfer` + kapcsoló + Agent kulcs.
- `quotes.auto_proforma_*` + cron `/api/cron/auto-proforma`.
- Számlázási kapu: hiányos cím/e-mail → beküldés tiltva auto díjbekérőnél.
- Díjbekérő portal quote-on **order nélkül** is mehet (`canProformaBeforeOrder`).

### Ami még kell (utalás auto előleg / végszámla)

- Befizetés → auto `advance` job (mint auto-proforma minta).
- Átadás / fulfill → auto végszámla.
- SLA: `credited_at` + 15 nap hard; 10 nap warning, 14 danger.
- Autokassza + Számlázz IPN (lásd §4b).

### 4b. Autokassza + IPN — zárolt döntés **A**

| Döntés | Tartalom |
|--------|----------|
| **A (zárolt)** | Autokassza párosít → IPN/poll → **Turinova** állít ERP paid + **előlegszámlát**. Számlázz „díjbekérő automatikus számlázása” = **KI**. |
| B (tiltott partnerhez) | Számlázz auto számla a díjbekérőből — dual/rossz típus kockázat |
| C | Autokassza OFF — csak staff kézi befizetés |

**IPN kontrakt (hátralévő):** `POST /api/webhooks/szamlazz-ipn?token=…` · form fields `szlahu_*` · verify `action-szamla_agent_xml` · idempotens state overwrite · nincs aláírás → secret token az URL-ben · HTTP ≠200 = nincs retry.

**Közlemény:** díjbekérőszám és/vagy `order_number` / `quote_number` teljes hosszon, szeparálva.

---

## 4c. Fejlesztői flowchart (részletes)

```mermaid
flowchart TB
  START([Partner: Beküldés a cégnek]) --> KIND{Milyen fizetést választott?}

  KIND -->|Átutalás| TGATE{Számlázási adat OK?<br/>+ Agent kulcs?<br/>+ auto díjbekérő BE?}
  TGATE -->|Nem / kapcsoló KI| TWAIT[Beküldve · unpaid<br/>Nincs díjbekérő]
  TGATE -->|Igen| TPRO[Auto díjbekérő · Számlázz Agent]
  TPRO -->|Hiba| TPROERR[auto_proforma failed · cron]
  TPRO -->|OK| TMAIL[E-mail: összeg + közlemény szám]
  TMAIL --> TPAY[Partner utal]
  TPAY --> TDETECT{Paid észlelés}
  TDETECT -->|Staff| TSTAFF[ERP befizetés rögzítés]
  TDETECT -->|Autokassza| TBANK[Bank párosít · akár 24ó]
  TBANK --> TIPN[Számlázz IPN → modul]
  TDETECT -->|Cron| TPOLL[agent_xml poll]
  TSTAFF --> TLEDGER
  TIPN --> TLEDGER
  TPOLL --> TLEDGER
  TLEDGER[ledger credited_at = tax_event]
  TLEDGER --> TIDEM{Dupla ref?}
  TIDEM -->|Igen| TSKIP[Stop]
  TIDEM -->|Nem| TADV[Auto előlegszámla]
  TADV --> TPROD[Gyártás / átadás]
  TPROD --> TFIN[Auto végszámla]

  KIND -->|Bankkártya| CGATE{Teya ready + számlázás?}
  CGATE -->|Nem| CBLOCK[Tilt / más mód]
  CGATE -->|Igen| CSUB[Beküldve · NINCS díjbekérő]
  CSUB --> CPI[/fizetes Embedded]
  CPI -->|fail| CFAIL[unpaid · újra]
  CPI -->|onSuccess| CHINT[Toast · NEM ERP paid]
  CHINT --> CWH[Teya webhook]
  CWH --> CLEDGER[ledger paid_at = tax_event]
  CLEDGER --> CADV[Auto előlegszámla]
  CADV --> CPROD[Gyártás / átadás]
  CPROD --> CFIN[Auto végszámla]

  NOTE_OFF[[Számlázz auto számla díjbekérőből: TENANT OFF]]
  NOTE_OFF -.-> TADV
```

**Tenant UI:** ugyanez emberi nyelven → `/penzugy/utmutato` (nem nyers Mermaid).

### 4d. Tenant szótár (certainty)

| Belső | Tenant szöveg |
|-------|----------------|
| Díjbekérő | Fizetési felszólító — még nem számla |
| Előlegszámla | Számla a beérkezett pénzről (ÁFA indul) |
| Végszámla | Záró számla, amikor a munka / áru kész |
| Autokassza | Bank és Számlázz összekapcsolása |
| IPN / webhook | Automatikus üzenet: megérkezett a pénz |
| Embedded | Kártyaablak a partner oldalon (Teya) |

---

## 5. Flow B — Bankkártya / Teya Embedded (partner)

### Célállapot

```
Beküldés (kind=card)
  → Kapu: Teya online ready + számlázási adat + Agent kulcs
  → Embedded Checkout (session create szerveren)
  → Partner fizet
  → Teya webhook payment.succeeded  ← forrásigazság (NEM a böngésző redirect)
       1) Mentés: paid_at, teya_session_id / payment ref (immutable tax_event_at)
       2) ERP: total_paid / payment_status
       3) Ha nincs order_number: auto convert VAGY előleg engedélyezése portal quote-on
       4) Előlegszámla azonnal (fulfillmentDate = paid_at napja)
  → Partner e-mail (Számlázz)
  → Gyártás / szállítás
  → Teljesítés → Végszámla
```

### Kudarc ágak

| Esemény | Viselkedés |
|---------|------------|
| Checkout fail / cancel | Nincs paid, nincs számla |
| Webhook duplikátum | Idempotens: ugyanarra a payment ref-re max 1 előleg |
| Számlázz timeout este | Job pending → cron; teljesítés dátum **marad** paid_at nap |
| Refund | Külön PR: sztornó / helyesbítés + ERP paid vissza |

### P1 — ami kész

| Darab | Hol |
|-------|-----|
| Session create (API) | `lib/teya-online/client.ts` → `createTeyaCheckoutSession` |
| Partner gate + service-role secret | `lib/teya-online/partner-checkout.ts` → `createPartnerTeyaCheckoutSession` |
| Embedded UI | `PartnerTeyaCheckout` + `/megrendelesek/[id]/fizetes` |
| SDK | `@teyaproduct/teya-blocks-js` (`developmentMode` csak staging) |
| Beküldés → pay | `submitPartnerQuote` `payWithCard` → detail/list redirect `/fizetes` |
| Rendelés CTA | „Fizetés bankkártyával” ha unpaid + card preferred |
| Submit kapu | `PartnerSubmitDialog` card + `teyaOnlineReady` |

**Fontos:** böngésző `onSuccess` **nem** állít `paid` státuszt — az P2 webhook.

### Hátralévő kapuk

| Kapu | Hol | Teendő |
|------|-----|--------|
| Előleg csak `order_number` mellett | `canProformaBeforeOrder` / `issue-quote` | Fizetéskor order létrehozás **vagy** portal submitted + paid esetén advance engedély |
| Nincs Teya webhook | — | Route + signature verify (`teya_webhook_public_key`) → `paid_at` + ERP |
| Auto csak díjbekérő transferre | `auto-proforma-rules` | Új auto-advance card path |

---

## 6. Napcsúszás / bombabiztos dátumok (kritikus)

### Szabály

| Fogalom | Forrás | Számlázz XML |
|---------|--------|--------------|
| **Adóesemény** (`tax_event_at`) | Kártya: webhook `paid_at` · Utalás: banki `credited_at` · Végszámla: átadás ideje | `<teljesitesDatum>` |
| **Kiállítás** | Amikor a Számlázz hívás sikerül (csúszhat holnapra) | `<keltDatum>` |

**Soha** ne legyen cron `fulfillmentDate = today`, ha a fizetés tegnap volt.

Meglévő XML builder: `szamlazz-xml.ts` — `keltDatum` = kiállítás napja, `teljesitesDatum` = `input.fulfillmentDate`. Az automata job **mindig** adjon explicit `fulfillmentDate`-et a ledger `tax_event_at` napjából (`Europe/Budapest`).

### Példa

| Idő | Esemény | Számlán |
|-----|---------|---------|
| Márc 31. 23:50 | Teya paid | — |
| Márc 31. 23:51 | Webhook OK, Számlázz timeout | job pending, `tax_event=03-31` |
| Ápr 1. 00:05 | Cron kiállít | **kelt** 04-01 · **teljesítés** 03-31 |

### Figyelem (UTC)

Ma a `keltDatum` sok helyen `new Date().toISOString().split('T')[0]` (**UTC**). Éjfél körül Budapest vs UTC eltérés lehet. Automata pathon a kelte/teljesítés napját **`Europe/Budapest`** szerint számold (javítandó a közös helperben).

### Rescue minta (mint auto-proforma)

| Állapot | Viselkedés |
|---------|------------|
| pending ~2 perc | Cron maga indítja |
| processing ~10 perc stuck | `failed` + staff látható |
| Kártya: >24 óra nincs előleg | Piros feladat (Áfa kockázat) |
| Utalás: credited_at + 14 nap | Danger |

---

## 7. Közös automata motor (ajánlott architektúra)

Egy motor mindkét fizetési módra:

1. **Payment ledger** (vagy meglévő `quote_payments` / finance payment bővítve)  
   - `amount`, `method` (`card`|`transfer`), `tax_event_at`, `external_ref` (Teya session / bank ref), `tenant_id`, `quote_id`
2. **Invoice job**  
   - `kind` (`advance`|`final`), `fulfillment_date`, `status` (`pending`→`processing`→`issued`|`failed`), idempotency key
3. Kiállítás: `issueInvoiceFromQuote` / meglévő path + **explicit** `fulfillmentDate`
4. Unique constraint: `(tenant_id, external_ref, invoice_type)` vagy ekvivalens — dupla előleg tilos
5. Végszámla trigger: „átadva / teljesítve” esemény — `fulfillment_date` = átadás napja, **nem** a régi `paid_at`

---

## 8. Partner UX / kapuk

| Kapu | Átutalás | Kártya |
|------|----------|--------|
| Beküldéskor számlázási adat | Auto díjbekérő ON esetén kötelező | Checkout előtt **mindig** kötelező |
| Teya online `ready` | — | Checkout előtt kötelező |
| Agent kulcs | Díjbekérő / előleg | Előleg |
| Partner szöveg | `auto_proforma_*` copy | Új: „Fizetve” + előlegszámla állapot (belső hiba nélkül) |

P1 UI él, ha a tenant Teya online `ready`. Éles fizetéshez kell P2 webhook — addig a partner „sikeres” toast **nem** jelent ERP „kifizetve”-t.

---

## 9. Implementációs PR-sorrend

| PR | Tartalom | Done when |
|----|----------|-----------|
| **C1** | Credential tábla + UI + OAuth/API teszt | Kész |
| **C2** | Staging/webhook public key mentés UI (ha kell); docs ÁSZF hint | Optional |
| **P1** | Checkout session create + partner Embedded UI | **Kész** |
| **T0** | Tenant útmutató `/penzugy/utmutato` | **Kész** (lépések + színes edge case-ek) |
| **T1** | Számlázz IPN + Autokassza bridge (döntés A) | IPN → ledger → advance job |
| **P2** | Teya webhook + payment ledger + idempotencia | Dupla webhook nem dupla paid |
| **P3** | Auto előlegszámla + Budapest fulfillmentDate + cron | Este fizet → holnap kelte, tegnap teljesítés |
| **P4** | Order kapu (auto convert vagy advance portal quote-on) | Előleg mindig kiállítható paid után |
| **P5** | Teljesítés → auto végszámla | 100% előleg után 0 Ft végszámla |
| **P6** | Refund / sztornó | Documentált happy + sad path |
| **P7** | Partner copy + staff inbox jelzés | Certainty-first |

---

## 10. Teszt checklist (implementáció után)

- [ ] Éles credential + Éles env → Kapcsolat ellenőrzése zöld
- [ ] Teszt credential + Teszt env → zöld (ha van staging)
- [ ] Env keverés → `invalid_client` / egyértelmű hiba
- [ ] Kártya success → 1 paid + 1 előleg; webhook újra → nincs második előleg
- [ ] Fizetés 23:50 → cron 00:05 → teljesítés tegnapi nap
- [ ] Utalás: díjbekérő után befizetés → előleg; átadás → végszámla
- [ ] Hiányos számlázási adat → kártya checkout nem indul
- [ ] Refund path (ha P6 kész)

---

## 11. Out of scope (most)

- POS SoftPOS / pulti Teya átírása
- Régi RPG / SecurePay integráció
- Apple Pay domain (később, Embedded + well-known)
- Webshop Stripe / más gateway összekötése Teyával
- Részletfizetés / több előleg részlet (későbbi modell)

---

## 12. Gyors referencia — fájlok

| Terület | Path |
|---------|------|
| Online Teya client | `src/lib/teya-online/client.ts` (HUF `amount.value` = Ft × 100) |
| Partner checkout session | `src/lib/teya-online/partner-checkout.ts` |
| Embedded pay UI | `src/components/partner/partner-teya-checkout.tsx` |
| Pay page | `src/app/(partner)/partner/(app)/megrendelesek/[id]/fizetes/page.tsx` |
| Online settings actions | `src/lib/teya-online/actions.ts` |
| Online queries | `src/lib/teya-online/queries.ts` |
| Partner settings UI | `src/components/partner-settings/partner-settings-form.tsx` |
| Auto díjbekérő | `src/lib/partner/auto-proforma.ts` |
| Quote számla kiállítás | `src/lib/invoicing/issue-quote.ts` |
| Számlázz XML dátumok | `src/lib/invoicing/szamlazz-xml.ts` |
| Invoice kind rules | `src/lib/invoicing/invoice-rules.ts` |
| POS Teya (ne keverd) | `src/lib/pos/teya/client.ts` |
| Tenant útmutató | `src/app/(app)/penzugy/utmutato/` + `partner-payment-guide.tsx` |
