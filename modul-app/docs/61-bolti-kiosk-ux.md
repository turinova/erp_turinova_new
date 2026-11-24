# 61 — Bolti kiosk: UX, layout, wireframe

**Állapot:** 2026-11-20 — layout zárolva UX mockhoz.  
**Termék:** [60-bolti-kiosk.md](60-bolti-kiosk.md) · Certainty: [03](03-ux-certainty-first.md) · Copy: [06](06-copy-hungarian.md) · Számok: [13](13-numbers-units-formats.md) · Vizuál north star: [18](18-midday-visual-reference.md) (**kiosk eltérés:** nagyobb tipó/CTA, mint staff Linear-sűrűség).

---

## 0. Egy mondat

> Hétköznapi bolti vásárló: *lap → méret → megmunkálás → tap-él → kosár → név+telefon → rendelésszám a pultnak* — egy döntés / képernyő, nem tud Opti-szinten hibázni.

---

## 1. Persona + pszichológia

| Aggodalom | UI válasz |
|---|---|
| Szakszavak | Szál × kereszt **vizuálisan** a previewn (nem Opti-űrlap) |
| Rossz méret | Hard max = Opti `maxGrainMm`/`maxCrossMm` (tábla − szélezés) + clamp; soft warn &lt;150 mm („centi volt?”) |
| Melyik oldalra él | Preview oldal tap, nem A/B/C/D |
| Mennyi lesz? | Kosárban **Ár kiszámítása** → alsó sáv nagy Ft |
| Mi lesz utána? | „Fizetés a pultnál” |
| Benne ragadok | Vissza + Újrakezdés + idle → Attract |

---

## 2. Flow

```
[0 Attract] → [1 Anyag] → [2 Méret] → [3 Megmunkálás] → [4 Él]
     → [5 Kosár] ⇄ szerkeszt → [6 Adatok] → [7 Kész]
                                      ↓ idle 90s → [0]
```

Progress label: **Anyag · Méret · Megmunkálás · Él · Kosár · Adatok** (Kész külön success).

---

## 3. Design tokenek (kiosk)

| Token | Érték |
|---|---|
| Primary / CTA | `#18181B` |
| Háttér | `#FAFAFA` |
| Top chrome | 72px |
| Bottom chrome | ~96px (ár kártyával) |
| Body | 18–20px |
| Cím | 28–32px / 600 |
| CTA magasság | 56–64px |
| Touch min | 48px (él-sáv 56px) |
| 1 primary / képernyő | kötelező |

**Tilos:** staff 32px default gomb, 13.5px body, hover-only, glow/gradiens, emoji ikon, több primary.

---

## 4. Brand hierarchia

| Hely | Tenant | Turinova |
|---|---|---|
| Attract | **Nagy logo** (vagy cégnév fallback) | Footer „Powered by” |
| Wizard topbar | Kis logo | — |
| Help sheet | — | Footer compact |
| Kész | Közepes logo | Footer |

Tenant mindig nagyobb / feljebb, mint Turinova. Flat Midday charcoal CTA — nincs glow.

---

## 5. Globális shell

```
TOP 72: [Tenant logo]  progress (zöld kész ✓)  [Kosár] [?]
STAGE: egy fókusz · bg-app token
BOTTOM ~96: [← Vissza]  [ Végösszeg kártya: success-soft + nagy Ft ]  [ PRIMARY · Ft ]
```

- Topbar: csak tenant logo (nincs „Lapméretre vágás” eyebrow).  
- Progress: lépés **ikon** (Anyag Layers · Méret Ruler · Megmunkálás Drill · Él Frame · Kosár Cart · Adatok UserRound); kész = `bg-success` + Check; aktív = charcoal + ikon; upcoming = border + muted ikon. Label megmarad. Connector zöld a kész szakaszon. Nem klikkelhető (csak ← Vissza).  
- Kosár ikon + badge = panel-sorok. Összeg **nem** a topbaron — alsó sáv középen.  
- `?` → help bottom sheet + Turinova footer.
- Idle: 75s figyelmeztetés, 90s clear → Attract.

---

## 6. Képernyők (rövid wire)

### 0 Attract (asztali PC, fekvő · 24″ FHD)
Kutatás: attract = cégtábla, „mi ez, mit kapok” ≤10 szóban, 1 domináns gomb; „Touch to start” önmagában rossz; valódi termék, nem díszkép (Square le is vette a marketing hátteret); termék-rövidítés a nyitóról.

- Layout: `max-w-[1440px]` (ne 1200 — kevesebb felesleges wrap széles monitoron).
- Topbar: tenant logo + **Segítség** (saját súgó: mit rendelhetek, mi van ha elrontom, mikor fizetek).
- Bal: nagy logo · H1 **Bútorlap szabás méretre, élzárással** · supporting `max-w-2xl` · primary **Rendelés indítása** (64px, autofocus, Enter).
- Jobb: fehér kártyák **Így működik** + **Ezekre lesz szükséged**.
- Alul: **Népszerű lapok** (featured, max 6) → Méret.
- Lábléc: „Különleges kérésed van? Kérdezd a pultot.” + Powered by Turinova.
- Tilos: egész képernyős gomb, dísz gradiens, nem kattintható pill chip. Kód: `components/kiosk/attract/kiosk-attract.tsx`.

### 1 Anyag
**Kereső = hős** (sticky, nincs autofocus). Üres query: **Gyakori** max 8 — `quote_panels` használat (90 nap, `ordered_at`, Σ quantity), **metszet** a kiosk `catalog_mode` / kedvencek listával; ha nincs elég quote → raktári + név fallback. Nem 100 csempe. Gépelésre találati grid + highlight.  
Csempe: kép, `Raktáron` / `Rendelésre` (neutral), **vastagság badge**, `L×W×T`, gyártó · Ft/m², halvány `machine_code`. Tap = Méret.

### 2 Méret (LTR split, 21″ / 24″ FHD, fix stage)
**Bal:** **fix** preview stage (`h-[360px]`) — belső panel fit-contain (anyagkép). Szálas lapnál: vonal overlay + danger-soft sáv (+ külső !): „Csak a vonalak mutatják a szálat. A kép iránya félrevezető lehet.” **Jobb:** Szálirány / Keresztirány / Db. Belépéskor **autofocus Szálirány**; Enter → Keresztirány; Enter (ha valid) → **Tovább** (Megmunkálás). Mezőhint: `Max: N mm` — Opti parity. Soft &lt;150 mm. Footer primary: **Tovább →**.

### 3 Megmunkálás (multi, Opti-align + preview)
- LTR: **bal fix stage preview** (`KioskMachiningPreview`) · jobb toggle-ök.  
- Preview Opti helperökkel: pánthely pontok (`panthelyPositionsMm`), szög clip/poligon (`szogvagasPolygonPoints`), sarok tap (1–4).  
- **Default = nincs megmunkálás** — nincs külön „nélkül” gomb; primary mindig aktív, ha nincs félkész pánthely/szög. Duplung/Pánthely/Szög **több egyszerre**, opcionális. Progressive param a jobbon.  
- Sub copy: „Ha nem kell semmi, nyomj Entert vagy Tovább.” · **Enter** = primary (**Élzárás megadása →**); select/menü nyitva hagyva.  
- Copy glossary: `lib/kiosk/machining-copy.ts` — **csak szál / kereszt / ferde**; tilos fent/lent/felső/alsó. Szög: sarok **csak a rajzon** (1–4 tap), formban nincs sarokgomb — csak marad mm. Kosár-összegző: `Duplung, Pánthely 3 hosszú, Szögvágás` (nincs Sarok N, nincs duplikált címkesor a form alján).  
- Duplung ON → db ×2 + magyarázat („2 lap összeragasztva”). Primary: **Élzárás megadása →**.

### 4 Él (kompakt tábla + A/B badge + collapsed summary)
- Glossary: `lib/kiosk/edge-slots.ts` — **Szál A/B**, **Kereszt A/B**, **Ferde** (badge A/B/F).  
- LTR: compact preview (kontúr stroke színes/vastag) + **A/B/F badge** az éleken · tábla: badge + label | `select`.  
- Summary összevont: `Körbe: ABS 1…` / `ABS 1 (3 él), Élfólia… (Szál B)` — nincs él×teljes név lista.  
- Típus-szín: 0.4 kék · ABS1 zöld · ABS2 narancs · 42/1 lila · 42/2 piros.  
- **Enter** = primary (**Kosárba →**); combobox/listbox Enterje nem lopódik el.  
- Footer: outline **Él nélkül a kosárba** · primary **Kosárba →**.

### 5 Kosár (Opti-szerű anyag-csoportolt tábla)
- Group: `sheetId` — header swatch + név + vastagság + `N panel · M db` + **anyag összesen Ft** + **Hogyan jött ki…** + **+ Ugyanebből még** + **Dekor csere** + **Másolás** + **Szín törlése**.  
- **Dekor csere** / **Másolás:** külön gombok, nincs módválasztó modal → egyből Anyag (azonos vastagság). Csere = áthelyezés; Másolás = új csoport. Méret/él/megmunkálás megmarad; max ellenőrzés; él sanitize; ár `stale`. Logika: `lib/kiosk/recolor-cart.ts`.  
- Tábla oszlopok: Szálirány · Keresztirány · Darab · Megmunkálás · **Élzárás** · sor törlés. Méretcellák `nowrap`. Sor tap = szerkesztés.  
- Globális: **+ Másik anyag** · **Kosár ürítése** (megerősítés). Meta: `panel · db · anyag`.  
- Footer primary: **Ár kiszámítása** → siker után **Tovább · {Ft} →** (összeg a gombon is). Loading: Optimalizálás / Számítás.  
- Ár megjelenés: alsó sáv **success-soft kártya** + `success-ink` ~40px Ft + rövid reveal animáció; stale/hiba → warning sáv. Anyagcsoport Ft ugyanez a soft badge.

### Árazás (manuális, Opti-parity)
- Nincs élő auto-price / draft nesting.  
- Egy gomb: **Ár kiszámítása** → `/api/kiosk/.../price` (nest + quote; **egy** Opti futás, mint `/opti`).  
- Kosár változás → `stale`, újra kell számolni. Alsó navbar nagy Ft csak `ok` után.  
- Nincs külön „Végösszeg” kártya / **nincs soronkénti Ft** (zavaró arányos allokáció). Ár = anyag fejléc.  
- **Hogyan jött ki ez az ár?** — anyag-csoport header → széles dialog (Opti/Square-szerű szekciótáblák). Oszlopok: **Tétel · Menny. · Egységár · Összeg**. Szekciók: Lap / Élzárás / Vágás / Megmunkálás + **Összesen (bruttó)**. Lap 2 eset: teljes tábla (kihasználtság) | m² × hulladékszorzó. Forrás: Opti `MaterialPricing` → `materials[]`.

### 6 Adatok — asztali PC, egér + billentyűzet · **24″ FHD no-scroll** (tipikus út)
Kutatás: Square Kiosk (név/telefon prompt), GRUBBRR, Baymard, Stripe, időskori SOK-tanulmány (sorpánik, zsúfoltság → félrenyomás), Reddit (kicsi szürke szöveg, szétszórt gombok, nincs segítség).

- **Egy oldal**, Square „grouped section” + **accordion**: egyszerre csak az **aktív** szekció body nyitva (`todo`/`done` = csak fejléc, kattintható). `forceOpen` az összegzőn.
- Kompakt: H1 ~24–26px, input `h-12`, szekció `compact`, rövid copy — cél: nincs oldal-scroll „nincs számla” úton.
- Számlamezők nyitva: **belső** scroll a 2. szekció body-n (`max-h`), nem az egész oldal.
- Fejléc: **Add meg az adataidat** · „Leadás itt · fizetés a pultnál.”
- **1 Elérhetőség:** Név · **Telefon** · E-mail opcionális → „Tovább a számlához”.
- **2 Számla** (2 radio egymás mellett): Nem kell · Kérek számlát (mezők) → „Tovább az ellenőrzéshez”.
- **3 Ellenőrzés:** rövid pipa-copy.
- Jobb: kompakt **Rendelésed** (max 3 tétel + „további”); tétel alatt opcionális chip-sáv: él összefoglaló (`edgeSummaryLabel`, ha nem „Nincs él”) + megmunkálás chipek; üres = nincs 3. sor. + „Elakadtál?”.
- Footer CTA **Leadom a pultnak · {Ft}**; tiltva → konkrét hiány.
- **Közös gép:** `autoComplete="off"`; idle reset; Adatokon idle warn ≥120 mp.
- Kód: `components/kiosk/details/*`, validáció `lib/kiosk/guest.ts`.

### 7 Kész (peak-end)
„**Köszönjük!**” + **nagy név** (hero) + „Mondd ezt a nevet a pultnál” + következő lépések (pult / fizetés / SMS). Nincs „írd fel”. Auto-újraindítás 30 mp.

---

## 7. Guardrail mátrix

| Szabály | Hol |
|---|---|
| 1 döntés / képernyő | wizard (Adatok: 1 oldal, 3 számozott szekció) |
| CTA disabled + ok szöveg | shell |
| Méret ≤ anyag max | Méret |
| Él on ⇒ chip kell | Él |
| Consent kell submithoz | Adatok |
| Speciális vágás kívül | Help / Attract |

---

## 8. Copy (HU)

- Attract CTA: **Rendelés indítása** (ige + tárgy; nem „Kezdem”, nem „Méretre vágok”)
- Válaszd ki a lapot  
- Mekkora legyen a lap? (+ preview tanít szálat)  
- Hol legyen élzáró? A táblában élenként választ; sáv: „Nézd meg az élzáró mintákat a kiosk mellett” (fizikai minták a kiosk mellett)  
- Él nélkül a kosárba (text-link a Méreten)  
- Nézd át a rendelésed  
- Leadom a pultnak  
- Köszönjük! + nagy {név} · Mondd a neved a pultnál.

Kerülendő: Opti, nesting, grain, quote, draft, panel, **fent / lent / felső / alsó** (bútorlap orientáció), „hulladékszorzó”, gondolatjel a mondatokban, érintős igék („érintsd”, „koppints”): a kiosk **asztali PC, egér + billentyűzet**.

### 8.1 Bizonyosság (a vevőnek ne kelljen kérdeznie)

| Kérdés | Hol válaszolunk |
|---|---|
| Elronthatom? | Lábléc minden lépésen: „Nem végleges. A pultnál még mindent átnézünk veled.” + Súgó „Hibáztam, mi lesz?” |
| Melyik darab melyik? | Méret lépés: **Megnevezés** (nem kötelező, max 40) → kosár, Adatok összegzés, `quote_panels.label` |
| Felcseréltem a méretet? | Szálirányos lapnál majdnem négyzet (≤10% eltérés) → figyelmeztetés |
| Mikor lesz kész? | Kosár „Mikor lesz kész?” doboz + Kész képernyő. **Nincs pontos nap**; rendelésre lapnál: be kell szereznünk, a pultnál megmondjuk |
| Melyik élzáró? | Fizikai minták a kiosk mellett (sáv az Élzárás lépésen) |
| Miért ennyi az ár? | Ár magyarázó: „Darabjaid X m², a vágás miatt Y m² lapot használunk fel” |
| Kész vagy vágási méret? | Méret lépés + Súgó: **kész méret, élzáróval együtt**. A vágásnál mi számolunk az élzáróval |
| Mi lesz a maradékkal? | Ha teljes táblát számolunk, a maradék a megrendelőé (kosár, ármagyarázat, Kész, Súgó; pult + PDF minden ajánlatnál) |

Az ár gomb (**Ár kiszámítása**) marad kézi.

---

## 9. Mock kód helye

| Path | Szerep |
|---|---|
| `src/app/k/[slug]/` | Publikus route, no auth |
| `src/components/kiosk/` | Shell + brand + wizard |
| `src/components/kiosk/kiosk-brand.tsx` | Tenant + Turinova logo |
| `src/lib/kiosk/mock-data.ts` | Fake anyag / él / ár / logo |

**Persist tilos** amíg a UX el nem fogadott — lásd [60](60-bolti-kiosk.md) §4.

---

## 10. Landscape / portrait

| | Landscape | Portrait |
|---|---|---|
| Méret/Él | 45/55 split | stack preview → form |
| Anyag grid | 3–4 col | 2 col |
| CTA | jobb bottom | full width |
