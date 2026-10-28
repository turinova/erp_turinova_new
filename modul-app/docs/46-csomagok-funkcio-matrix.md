# 46 — Csomagok × funkció mátrix (CloudERP-mélység)

**Állapot:** 2026-10-13 · **DB/platform implementálva** (`20260600_…`, `plan-bundles.ts`)  
**Minta:** [clouderp.hu/csomagok](https://clouderp.hu/csomagok/) — 18 kategória, ~273 funkciósor.  
**Forrásigazság árakhoz:** [33](33-packages-and-addons.md).  
**Ellenőrzés:** `src/app/(app)/**/page.tsx` (összes tenant app route) + domain docok 24–45.  
**Canvas:** `canvases/csomagok-funkcio-matrix.canvas.tsx`

### Jelölés

| Jel | Jelentés |
|---|---|
| `●` | A csomag része (szoftver) |
| `—` | Nincs / nem cél / tudatos hiány |
| `◐` | Usage, soft limit, feltételes, vagy részleges |
| `H` | Egyszeri hardver (listaár külön) |
| `※` | Kód / route létezik, publikus ígéret **jégelt** (`WEBSHOP_ENABLED = false`) |

### Csomagok (nettó Ft)

| | **Bolt** | **Bolt+** | **Pro** | **Műhely** |
|---|---|---|---|---|
| Havi | **39 990** | **59 900** | **94 900** | **49 990** |
| Éves (10×) | 399 900 | 599 000 | 949 000 | 499 900 |
| Egy mondat | Pult + készlet + beszerzés + ÜR + számla | Bolt + PDA + jelenlét + belépő (szoftver) | Bolt+ + webshop※ + soft limit + prioritás | Bolt + lapszabászat |
| Square | Plus mag | Plus „üzem” | Premium | Vertical SKU |

**Öröklés:** Bolt+ ⊃ Bolt · Pro ⊃ Bolt+ · Műhely ⊃ Bolt (**nem** ad PDA/jelenlét/foot — az Bolt+/Pro).  
**Próba:** 2 hónap → Bolt. **SMS:** 89 Ft/db (usage).  
**Egyszeri:** Kickstart 149–249 k · Go-live 490–790 k · jelenlét terminál **H** · belépőkamera **H**.

---

## A. Alapjellemzők / keretek (CloudERP „Alapjellemzők” pár)

| Tétel | Bolt | Bolt+ | Pro | Műhely | Edge / megjegyzés |
|---|---|---|---|---|---|
| Webes, modern felhő | ● | ● | ● | ● | 1 Vercel + 1 Supabase shared schema + RLS ([17](17-saas-architecture.md)) |
| Mobilos / tabletes UI | ● | ● | ● | ● | Responsive; PDA = dedicated PWA |
| Éves megrendelés hard limit | — | — | — | — | Soft; nincs CE-szerű 10k/35k/60k |
| Termék / SKU hard limit | — soft | soft | soft | soft | Lista default 25/oldal; lean RPC |
| Felhasználók hard 5/10/15 | — | — | soft magasabb | — | Support tier Pro-n, nem hard cap |
| Online értékesítési csatorna | — | — | ※ 1 saját | — | Nem Unas/Shoprenter slot |
| Fizikai üzlet / pult | 1 fókusz | 1–2 | 1–2+ | 1 (+ műhely) | Multi-franchise nem cél |
| Helyi raktárak | több OK | több OK | több OK | több OK | Nincs polc/bin MVP ([25](25-warehouses.md)) |
| Éves GMV hard limit | — | — | — | — | Nincs CE-szerű 400M/1Md/3Md |
| Több cég (tenant) | ● | ● | ● | ● | user↔tenant tagság; platform |
| 24/7 vészhelyzeti telefon | — | — | ◐ prioritás | — | Nem CE 24/7 vész |
| PDA vezérelt raktár / pult | — | ● | ● | — | `/pos/pda` — nem teljes WMS PDA |
| AI vezérelt pénzügyi modul | — | — | — | — | Tudatos hiány |
| Bevezetés | self / Kickstart | + hardver | prioritás | Opti onboarding | |
| Egyszeri bevezetés | 149–790 k | + **H** | + **H** | Opti | CE: 1,49–14 M — más ICP |

---

## B. Funkciómátrix — CloudERP 18 kategória → Optinova

Minden CE funkciósor leképezve. Ha nálunk nincs: `—` (nem felejtés).

### B1. Webáruházak kezelése (CE: 15)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Nálunk |
|---|---|---|---|---|---|
| WooCommerce kapcsolat | — | — | — | — | nincs |
| ShopRenter kapcsolat | — | — | — | — | nincs |
| Unas kapcsolat | — | — | — | — | nincs |
| Magento kapcsolat | — | — | — | — | nincs |
| Egyedi webáruházkapcsolat | — | — | ※ | — | saját storefront, nem 3rd-party sync |
| EDI kapcsolat | — | — | — | — | nincs |
| Több webáruház egyidejű | — | — | — | — | 1 site / tenant※ |
| Rendelések auto letöltés webshopból | — | — | ※ | — | saját bolt rendelés (ha él) |
| Vásárlói adatok auto letöltés | — | — | ※ | — | |
| Rendelés állapot sync ERP→webshop | — | — | ※ | — | |
| Készlet sync azonnali ERP→webshop | — | — | ※ | — | saját bolt |
| Termék adatlap sync | — | — | ※ | — | katalógus shop-ready |
| Termékkategória sync | — | — | ※ | — | `/webshop/kategoriak` |
| Termék ár sync | — | — | ※ | — | |
| Időzített akció sync | — | — | — | — | nincs |
| **Saját** webshop admin hub | — | — | ※ | — | `/webshop` |
| Katalógus / tulajdonságok / csatornák | — | — | ※ | — | `/webshop/*` |
| Jogi / elállás / értékelések | — | — | ※ | — | |
| Publikus storefront `/s/.../bolt` | — | — | ※ | — | jégelt |

**Edge:** `WEBSHOP_ENABLED = false` — Pro webshopot **ne** add el élő ígéretként ([39](39-webshop-addon.md)).

---

### B2. Számlázás (CE: 13)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Nálunk |
|---|---|---|---|---|---|
| Automatikus díjbekérő | ● | ● | ● | ● | utalás flow ([28](28-ertekesites-workflow.md), [36](36-szamlazas-workflow.md)) |
| Automatikus számla / előleg + kiküldés | ● | ● | ● | ● | Számlázz.hu Agent |
| E-számla | ● | ● | ● | ● | Agent |
| Számlázz.hu kapcsolat | ● | ● | ● | ● | `/beallitasok/szamlazas` |
| Fizetési módok kezelése | ● | ● | ● | ● | törzs + sale |
| Egyedi megjegyzés | ● | ● | ● | ● | |
| Webshop rendelésszám a számlán | — | — | ※ | — | ha él |
| Többnyelvű számla | — | — | — | — | HU fókusz |
| Pénznemek (multi-currency) | — | — | — | — | HUF |
| Számlatömbök | ◐ | ◐ | ◐ | ◐ | Agent oldalon |
| Számla helyesbítés | ◐ | ◐ | ◐ | ◐ | Agent / S3 folyamat |
| Visszáru → auto helyesbítő számla | — | — | — | — | visszáru ≠ storno ([30](30-visszaru-workflow.md)) |
| Stornózás | ◐ | ◐ | ◐ | ◐ | számla S3; sale return külön |
| Bizonylatok lista | ● | ● | ● | ● | `/szamlak` |
| Manuális / összevont számla | ● | ● | ● | ● | `/szamlak/uj` |
| Végszámla (fizetve + fulfilled) | ● | ● | ● | ● | edge: mindkét feltétel |

---

### B3. Szállítás (CE: 32) — nálunk szinte mind `—`

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| GLS / MPL / FoxPost / DPD / Packeta / Sprinter / Express One / Sameday / Fürgefutár / Csomagküldő / Kumi / Kova / UPS / DHL / egyéb | — | — | — | — |
| Saját kiszállítás (ERP modul) | — | — | — | — |
| Csomagpont / Postapont / PickPack | — | — | — | — |
| Utánvét auto párosítás | — | — | — | — |
| Közvetlen címkenyomtatás + futárrendelés | — | — | — | — |
| Kiszállítási állapot auto lekérdezés | — | — | — | — |
| Visszáru szállítás kezelése | — | — | — | — |
| Csomag valós idejű követés | — | — | — | — |
| Szállítólevél generálás (futár) | — | — | — | — |
| Részteljesítés futár nyomon | — | — | — | — |
| Csomag súly/ár/méret + árkalkulus | — | — | — | — |
| 3PL / fulfillment raktár | — | — | — | — |

**Nálunk helyette:** áru **átadás / fulfill** eladáson ([28](28-ertekesites-workflow.md)); lapszab **átvételi blokk** hőnyomtató ([43](43-atveteli-blokk.md)) = Műhely.

---

### B4. Bolti értékesítés (CE: 19) + Optinova POS bővítés

| Funkció | Bolt | Bolt+ | Pro | Műhely | Route / edge |
|---|---|---|---|---|---|
| POS felület, gyors bolti értékesítés | ● | ● | ● | ● | `/pos` |
| NAV kompatibilis e-pénztárgép | — | — | — | — | hivatalos nyugta külön AEE |
| Vonalkódos működés | ● | ● | ● | ● | wedge / typeahead |
| KP / bankkártya / átutalás | ● | ● | ● | ● | split is |
| Magyar 5 Ft KP kerekítés | ● | ● | ● | ● | csak KP; kártya nem |
| Blokknyomtatás (adóügyi) | — | — | — | — | |
| Áfás számla kiállítás POS-ból | ● | ● | ● | ● | Agent |
| Blokk/számla email | ◐ | ◐ | ◐ | ◐ | Agent email |
| Több raktár POS-on | ● | ● | ● | ● | ≥2 → választó; 1 → rejtett |
| Bolti készlet → webáruház | — | — | ※ | — | |
| Kassza / műszak nyitás-zárás | ● | ● | ● | ● | `/ertekesitesek/muszakok` |
| Napi egyeztetés (KP/kártya/utalás) | ● | ● | ● | ● | `/ertekesitesek/napi-egyeztetes` |
| Kezdeti KP mennyiség | ● | ● | ● | ● | |
| Záráskor KP számolás / audit | ● | ● | ● | ● | |
| Egyedi szolgáltatás / díj a kasszán | ● | ● | ● | ● | fee types |
| Kedvezmény termék / kosár (% / összeg) | ● | ● | ● | ● | |
| Több kassza / bolt kimutatás | ◐ | ◐ | ◐ | ◐ | műszak |
| Belső pénzmozgás (kassza) | ◐ | ◐ | ◐ | ◐ | műszak audit |
| Korábbi vásárlások | ● | ● | ● | ● | `/ertekesitesek` |
| Parkoltatás / foglalás | ● | ● | ● | ● | park + handoff kód |
| Gyors felvétel / barcode assign | ● | ● | ● | ● | miss dialog; `allow_pos_quick_create` |
| Gyors termékek (quick items) | ● | ● | ● | ● | |
| Teya / manuális terminál | ● | ● | ● | ● | |
| Visszajáró numpad | ● | ● | ● | ● | |
| POS beállítások | ● | ● | ● | ● | `/pos/beallitasok`, `?beallitasok` |
| POS adoption / használat | — | — | — | — | archiválva (redirect `/ertekesitesek`) |
| Visszáru POS-on | ● | ● | ● | ● | sale return + restock |
| **PDA hub** eladás / árellenőrzés | — | ● | ● | — | `/pos/pda` |
| PDA scan-first gombos eladás | — | ● | ● | — | |
| PDA árellenőrzés + bruttó mentés | — | ● | ● | — | `price_gross` |
| PDA → pult kosárátadás | — | ● | ● | — | |
| PDA PWA standalone | — | ● | ● | — | `/pda.webmanifest` |

**Edge:** Vegyes fizetésnél nincs order-level cash round ([29](29-pos-workflow.md)). Műhely **nem** ad PDA-t.

---

### B5. Megrendelések kezelése (CE: 20) — nálunk: eladás + ügyfélrendelés + (※) webshop

| Funkció | Bolt | Bolt+ | Pro | Műhely | Nálunk |
|---|---|---|---|---|---|
| Értékesítés több csatornán | ◐ pult | ◐ | ※ + web | ◐ | pult + manuális + ÜR |
| Automatizált rendeléskezelés (omni) | — | — | ※ | — | |
| Visszáru kezelése | ● | ● | ● | ● | [30](30-visszaru-workflow.md) |
| Részleges kiszállítás / fulfill | ● | ● | ● | ● | |
| Valós idejű állapotkövetés (futár) | — | — | — | — | |
| Webshop sync rendelés | — | — | ※ | — | |
| Megrendelés kifizetés figyelése | ● | ● | ● | ● | díjbekérő / AR |
| Több pénznem | — | — | — | — | |
| Offline bolti értékesítés | ● | ● | ● | ● | POS |
| Összeállítás kézzel / vonalkóddal | ◐ | ● PDA | ● | ◐ | |
| Csomagolóanyag modul | — | — | — | — | |
| Auto kommunikáció futárral | — | — | — | — | |
| Feketelistás vásárló | — | — | — | — | |
| Auto számlakészítés | ● | ● | ● | ● | |
| Részletes omni statisztika | — | — | ◐ | — | home KPI light |
| Árlisták (B2B multi) | — | — | — | — | egy polcár |
| Variáció / csomag / virtuális termék | — | — | — | — | |
| Kedvezmények (szabálymotor) | ◐ | ◐ | ◐ | ◐ | sor/kosár, nem motor |
| Megadott dátumú kiszállítás | — | — | — | — | |
| **Ügyfélrendelés (special order)** | ● | ● | ● | ● | `/ugyfelrendelesek` |
| ÜR státuszgép + PO + foglalás | ● | ● | ● | ● | [42](42-ugyfelrendeles.md) |
| ÜR várólista + SMS | ● | ● | ● | ● | usage 89 Ft |
| POS deep-link `?accessory=` | ● | ● | ● | ● | |
| Manuális eladás admin | ● | ● | ● | ● | `/ertekesitesek/uj` |
| Áru átadás / stock out | ● | ● | ● | ● | |

---

### B6. Árlisták / árak (CE: 9)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Nálunk |
|---|---|---|---|---|---|
| Árlista import/export Excel/CSV | ◐ | ◐ | ◐ | ◐ | termék Excel; nincs multi árlista |
| Tömeges árjavítás | ◐ | ◐ | ◐ | ◐ | Excel |
| Kedvezményes árlista | — | — | — | — | |
| Árlista érvényességi dátum | — | — | — | — | |
| Árlista → vásárló / csoport | — | — | — | — | |
| Árlista webshoponként | — | — | — | — | |
| Mennyiségi kedvezmény motor | — | — | — | — | |
| Dinamikus ár szabályrendszer | — | — | — | — | |
| **Polcár `price_gross` + VAT round-trip** | ● | ● | ● | ● | accessories |
| Beszerzési nettó + árrés szorzó | ● | ● | ● | ● | |
| PDA árellenőrzés → bruttó mentés | — | ● | ● | — | |

---

### B7. Termékek kezelése (CE: 17)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Route |
|---|---|---|---|---|---|
| Termék megnevezés / SKU | ● | ● | ● | ● | `/torzsadatok/.../termekek` |
| Vonalkód + belső EAN gen | ● | ● | ● | ● | |
| Rövid / hosszú leírás | ● | ● | ● | ● | |
| Egyedi attributumok | ◐ | ◐ | ※ shop props | ◐ | webshop tulajdonságok※ |
| Termékcsoport / kategória | ◐ | ◐ | ※ | ◐ | shop kategoriák※ |
| Készlet ME | ● | ● | ● | ● | egységek törzs |
| Képgaléria | ● | ● | ● | ● | média |
| Több beszállító / terméken | ◐ | ◐ | ◐ | ◐ | PO oldalon |
| Upsell / cross-sell | — | — | — | — | |
| Csomagtermék (BOM eladás) | — | — | — | — | |
| Variálható / konfigurálható | — | — | — | — | |
| Digitális / virtuális termék | — | — | — | — | |
| Akciós ár időtartam | — | — | — | — | |
| Forgási sebesség kimutatás | — | — | ◐ | — | |
| sellable_pos / vonalkód kapu | ● | ● | ● | ● | POS gate |
| Termék címke nyomtatás | ● | ● | ● | ● | `product_labels` |
| Excel import/export | ● | ● | ● | ● | |
| Gyártók törzs | ● | ● | ● | ● | `/.../gyartok` |
| Adónemek / egységek / díj típusok | ● | ● | ● | ● | rendszer törzs |
| Fizetési módok törzs | ● | ● | ● | ● | |
| Ügyfelek + adószám lookup | ● | ● | ● | ● | `/ugyfelek` |

---

### B8. Raktárak kezelése (CE: 13)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Edge |
|---|---|---|---|---|---|
| Több raktár | ● | ● | ● | ● | `/.../raktarak` |
| Polchely / lokáció | — | — | — | — | MVP nincs |
| Egy termék több polchely | — | — | — | — | |
| Raktár útvonaltervező / pick | — | — | — | — | |
| Raktár webshoponként | — | — | ※ | — | |
| Raktárközi mozgatás (azonnali) | ● | ● | ● | ● | `/keszlet/atadasok` |
| Raktárközi tervezett szállítás | — | — | — | — | |
| Áthelyezés raktáron belül | — | — | — | — | |
| Bizonylatok (transfer) | ● | ● | ● | ● | |
| Mobilos vonalkódos bevét/kivét | ◐ | ● PDA | ● | ◐ | PDA nem teljes WMS |
| Alapanyag / külső raktár | ◐ | ◐ | ◐ | ● | lapszab anyag |
| Beszállítói raktár + adatfeed | — | — | — | — | |
| Soft delete raktár tiltás élő PO-nál | ● | ● | ● | ● | [25](25-warehouses.md) |
| 1 raktár → UI választó rejtve | ● | ● | ● | ● | |

---

### B9. Készletkezelés (CE: 28)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Szabad / foglalt / kimenő / beérkező qty | ● | ● | ● | ● |
| Automatizált ki/bevételezés (sale/PO) | ● | ● | ● | ● |
| Termékazonosítók / barcode | ● | ● | ● | ● |
| Leltározás modul | — | — | — | — |
| Készletkorrekció (leltár) | — | — | — | — |
| PDA támogatott készlet (WMS) | — | ◐ eladás | ◐ | — |
| Összetett lokáció / töltőhely | — | — | — | — |
| Min/max készlet + prognózis | — | — | — | — |
| Raktárközi mozgás | ● | ● | ● | ● |
| Webshop készlet sync | — | — | ※ | — |
| Lejárat / LOT / sarzs / FIFO | — | — | — | — |
| Forgási sebesség figyelés | — | — | ◐ | — |
| ELÁBÉ pontos | ◐ | ◐ | ◐ | ◐ | beszerzési nettó alap |
| Készletérték raktáranként | ◐ | ◐ | ◐ | ◐ |
| Járulékos költség beszerzésben | — | — | — | — |
| Készletmozgások ledger | ● | ● | ● | ● | `/keszlet/mozgasok` |
| Nyitó készlet | ● | ● | ● | ● | `/keszlet/nyito` |
| on_hand termék / anyag RPC | ● | ● | ● | ● |
| Anyag eladás qty m²/m; stock out fulfillkor | — | — | — | ● | [28](28-ertekesites-workflow.md) |

---

### B10. Leltározás (CE: 7) — nálunk mind `—`

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Papír / digitális / mobil leltár | — | — | — | — |
| Részleges leltár | — | — | — | — |
| Eltérés auto számítás + korrekció | — | — | — | — |
| Leltár statisztika | — | — | — | — |

**Workaround:** nyitó készlet + mozgások audit; nincs dedicated inventory count UI.

---

### B11. Felhasználók és jogosultság (CE: 3+)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Egyedi felhasználó / munkatárs | ● | ● | ● | ● |
| Szerepkör / jogosultság | ● | ● | ● | ● | `/beallitasok/felhasznalok` |
| Elfelejtett jelszó email | ● | ● | ● | ● | auth |
| Tenant váltó (multi cég) | ● | ● | ● | ● | topbar |
| Session snapshot (gyors nav) | ● | ● | ● | ● | perf ([22](22-performance-playbook.md)) |
| Nincs hozzáférés üres állapot | ● | ● | ● | ● | `/nincs-hozzaferes` |
| Profil / cégadatok | ● | ● | ● | ● | beállítások |
| Előfizetés áttekintő | ● | ● | ● | ● | `/beallitasok/elofizetes` |
| SMS napló / beállítás | ◐ | ◐ | ◐ | ◐ | usage |

---

### B12. Beszállítók kezelése (CE: 18)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Nálunk |
|---|---|---|---|---|---|
| Partner megnevezés + alapadat | ● | ● | ● | ● | `/beszallitok` |
| Kapcsolattartók | ◐ | ◐ | ◐ | ◐ | |
| Pénznem / alap ÁFA / fiz. mód / határidő | ◐ | ◐ | ◐ | ◐ | HUF fókusz |
| Beszállítási idő default | ◐ | ◐ | ◐ | ◐ | |
| Megjegyzés | ● | ● | ● | ● | |
| Banki auto költség társítás | — | — | — | — | |
| Bónuszok / egyenleg / tartozás | — | — | — | — | |
| Kategorizálás / export-import | ◐ | ◐ | ◐ | ◐ | |
| Dokumentum feltöltés beszállítóhoz | — | — | — | — | nincs iktatás modul |
| Részletes beszállító analitika | — | — | — | — | |

---

### B13. Beszerzés (CE: 10)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Edge |
|---|---|---|---|---|---|
| Beszállítói megrendelés (PO) | ● | ● | ● | ● | `/beszallitoi-rendelesek` |
| Tömeges PO | ◐ | ◐ | ◐ | ◐ | |
| Min/optimális készlet → auto PO | — | — | — | — | |
| Intelligens auto PO | — | — | — | — | |
| Hiányból PO generálás (ÜR) | ● | ● | ● | ● | special order kötés |
| Beszállítási idők | ◐ | ◐ | ◐ | ◐ | |
| Szállítólevél / számla tárolás PO-hoz | — | — | — | — | nincs DMS |
| ELÁBÉ + járulékos | ◐ | ◐ | ◐ | ◐ | |
| Beérkezés + bevételezés | ● | ● | ● | ● | `/beerkezesek` |
| Részbeérkezés / partial | ● | ● | ● | ● | [24](24-beszerzes-workflow.md) |
| Irreverzibilis bevételezés | ● | ● | ● | ● | |
| „Úton” qty termékoldalon | ● | ● | ● | ● | |
| Automatikus beszállítói adatfeed | — | — | — | — | |
| EPR díj modul | — | — | — | — | |

---

### B14. Dokumentumok / iktatás (CE: 4) — nálunk `—`

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Számla / szállítólevél / szerződés iktatás | — | — | — | — |
| Egyéb dokumentum kategória | — | — | — | — |

**Helyette:** Számlázz.hu bizonylatok + média könyvtár (termékkép).

---

### B15. Ajánlatadás (CE: 8)

| Funkció | Bolt | Bolt+ | Pro | Műhely | Nálunk |
|---|---|---|---|---|---|
| **Termék** árajánlat | ● | ● | ● | ● | `/ertekesitesek/arajanlatok` |
| Árajánlat PDF / draft / számlázás | ● | ● | ● | ● | [32](32-arajanlat-workflow.md) |
| Ajánlat → megrendelés / eladás | ● | ● | ● | ● | |
| Egyedi design / logó | ◐ | ◐ | ◐ | ◐ | cégadatok |
| Feladatok ajánlathoz | — | — | — | — | |
| Email küldés | ◐ | ◐ | ◐ | ◐ | |
| Kép / leírás az ajánlaton | ◐ | ◐ | ◐ | ◐ | |
| **Lapszab** árajánlat / Opti | — | — | — | ● | `/ajanlatok`, `/opti` |
| Lapszab → megrendelés / gyártás | — | — | — | ● | `/megrendelesek` |
| Quote-ready SMS | — | — | — | ◐ | 89 Ft/db |

**Edge:** `/ertekesitesek/arajanlatok` ≠ `/ajanlatok` (lapszab).

---

### B16. Export / Import (CE: 10)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Excel / CSV termék | ● | ● | ● | ● |
| Készletmennyiség export | ◐ | ◐ | ◐ | ◐ |
| PO export/import | ◐ | ◐ | ◐ | ◐ |
| Partner / ügyfél export | ◐ | ◐ | ◐ | ◐ |
| Árlista export (multi) | — | — | — | — |
| Iktatott számla export | — | — | — | — |
| Megrendelés export | ◐ | ◐ | ◐ | ◐ |
| Bankkivonat import | — | — | — | — |
| Pénzügy exportok + soft-lock | ● | ● | ● | ● | `/penzugy/exportok` |
| Bevezetési adatáthozatal | ◐ Kickstart | ◐ | ◐ | ◐ | szolgáltatás, nem self-serve |

---

### B17. Jelentések, kimutatások (CE: 19)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Home KPI strip | ● | ● | ● | ● | `/home` |
| Belépő KPI blokk | — | ● | ● | — | entitlement |
| Árbevétel / forgalom light | ● | ● | ● | ● | |
| Kintlévőség kimutatás | ● | ● | ● | ● | `/penzugy/kintlevoseg` |
| ÁFA összesítő | ● | ● | ● | ● | `/penzugy/afa` |
| POS adoption riport | — | — | — | — | archiválva |
| Footcounter chart / heatmap | — | ● | ● | — | `/belepok` |
| Jelenlét naptár riport | — | ● | ● | — | |
| Cash-flow / eredménykimutatás suite | — | — | ◐ light | — | |
| Terv-tény / drilldown / mentett lekérdezés | — | — | — | — | |
| AI termék teljesítmény | — | — | — | — | |
| Jogosultsághoz kötött riport | ● | ● | ● | ● | RLS + role |

---

### B18. Pénzügy (CE: 28)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Pénzügy áttekintés | ● | ● | ● | ● | `/penzugy` |
| Bevétel / AR követés | ● | ● | ● | ● | |
| Kiadás / AP teljes modul | — | — | — | — | |
| Banki kapcsolat / kivonat auto | — | — | — | — | |
| Házipénztár korlátlan | ◐ | ◐ | ◐ | ◐ | műszak KP |
| Tartozás / követelés | ● | ● | ● | ● | kintlévőség |
| Deviza | — | — | — | — | |
| Pénzügyi tervező / terv-tény | — | — | — | — | |
| Könyvelő program kapcsolat | — | — | — | — | export soft-lock |
| Cash-flow tervezés | — | — | ◐ | — | |
| ÁFA kimutatás | ● | ● | ● | ● | |
| Agent kifizetés párosítás | ● | ● | ● | ● | |
| Díjbekérő **nem** ÁFA összesítőben | ● | ● | ● | ● | [44](44-penzugy-finance.md) |
| AI pénzügyi modul | — | — | — | — | |

---

## C. Optinova-only kategóriák (CloudERP-ben nincs / más)

### C1. Lapszabászat / Opti — csak **Műhely**

| Funkció | Bolt | Bolt+ | Pro | Műhely | Route |
|---|---|---|---|---|---|
| Táblás / szálas anyagok / élzárók | — | — | — | ● | törzs |
| Gyártógépek / berendezés | — | — | — | ● | |
| Opti beállítások | — | — | — | ● | `/beallitasok/opti` |
| Opti futtatás | — | — | — | ● | `/opti` |
| Lapszab árajánlatok | — | — | — | ● | `/ajanlatok` |
| Megrendelések / gyártás | — | — | — | ● | `/megrendelesek` |
| Scanner | — | — | — | ● | `/scanner` |
| Átvételi blokk (hőnyomtató) | — | — | — | ● | beállítás + print |
| Partner portal | — | — | — | ● | `/partner/...` |
| Partner beállítások | — | — | — | ● | `/beallitasok/partner` |
| Bizonylatok redirect | — | — | — | ● | `/ajanlatok/bizonylatok` → szamlak |

### C2. Jelenlét — **Bolt+ / Pro** (+ **H**)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Jelenlét naptár | — | ● | ● | — | `/jelenlet` |
| Munkarend naptár | — | ● | ● | — | `/jelenlet/naptar` |
| Dolgozók + típusok | — | ● | ● | — | `/dolgozok` |
| PIN / RFID | — | ● | ● | — | |
| Pi terminál sync | — | ● **H** | ● **H** | — | platform-only reg ([34](34-jelenlet-addon.md)) |
| Bérszámfejtés | — | — | — | — | |

### C3. Belépőszámláló — **Bolt+ / Pro** (+ **H**)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Belépők dashboard | — | ● | ● | — | `/belepok` |
| Be/Ki chart, heatmap | — | ● | ● | — | |
| Kamera eszköz sync | — | ● **H** | ● **H** | — | |
| Független a jelenléttől | — | ● | ● | — | külön entitlement |

### C4. Globális shell (minden plan)

| Funkció | Bolt | Bolt+ | Pro | Műhely |
|---|---|---|---|---|
| Kezdőlap | ● | ● | ● | ● | `/home` |
| Globális kereső | ● | ● | ● | ● | `/kereso` |
| Auth login / no-access | ● | ● | ● | ● | `(auth)` |

---

## D. Mi **nem** tenant csomagban (platform / marketing)

| Tétel | Hol |
|---|---|
| Tenant / plan / add-on kapcsolás | `/platform/*` |
| Impersonation | platform |
| Jelenlét terminál regisztráció | platform Cég detail only |
| Add-on katalógus admin | `/platform/add-onok`, `csomagok` |
| Marketing site / várólista | publikus `/arak`, `/hamarosan`, … |

---

## E. Ajánlott kosarak

| Ügyfél | Plan | Havi | + egyszeri |
|---|---|---|---|
| 1 pult barkács | Bolt | 39 990 | Kickstart opcionális |
| Pult + PDA + jelenlét + belépő | Bolt+ | 59 900 | Pi **H** + kamera **H** |
| Lapszab műhely | Műhely | 49 990 | Opti onboarding |
| Műhely + PDA | egyedi ~69 900 | — | hardver |
| Online is (élő webshop) | Pro | 94 900 | — (※ amíg jégelt: ne add) |

---

## F. Route coverage — 100% `(app)` page.tsx

Minden tenant app route besorolva:

| Route csoport | Szekció |
|---|---|
| `/home`, `/kereso`, `/nincs-hozzaferes` | C4 |
| `/beallitasok/cegadatok\|profil\|felhasznalok\|elofizetes\|sms\|szamlazas` | B11, B2 |
| `/beallitasok/opti\|partner\|atveteli-blokk` | C1 |
| `/torzsadatok/alapanyagok/termekek*` | B7 |
| `/torzsadatok/alapanyagok/{tablas,szalas,elzarok}*` | C1 |
| `/torzsadatok/rendszer/*` | B7, B8 |
| `/ugyfelek*` | B7 |
| `/keszlet/*` | B8, B9 |
| `/beszallitok*`, `/beszallitoi-rendelesek*`, `/beerkezesek*` | B12, B13 |
| `/ertekesitesek*`, `arajanlatok*`, `muszakok*`, `napi-egyeztetes*` | B4, B5, B15 |
| `/pos`, `/pos/beallitasok`, `/pos/pda` | B4 |
| `/ugyfelrendelesek*` | B5 |
| `/szamlak*`, `/penzugy*` | B2, B18 |
| `/ajanlatok*`, `/megrendelesek`, `/opti`, `/scanner` | C1 |
| `/jelenlet*`, `/dolgozok*` | C2 |
| `/belepok` | C3 |
| `/webshop*` | B1 ※ |
| Partner `(partner)/...` | C1 |
| Platform `(platform)/...` | D |

**Auth / marketing / storefront** nem előfizetés-mátrix sor (auth mindenkinek; storefront = Pro ※).

---

## G. Tudatos hiányok (CloudERP van → nálunk `—`)

1. 32+ futár + csomagpont + utánvét  
2. Unas / Shoprenter / Woo / Magento master sync  
3. Polchely / pick route / WMS PDA  
4. FIFO / sarzs / LOT / lejárat  
5. Dedicated leltár modul  
6. Multi árlista / dinamikus árszabály  
7. NAV adóügyi e-pénztárgép  
8. DMS iktatás  
9. Bankkivonat auto + teljes AP  
10. AI finance / cash-flow suite  
11. EPR díj  
12. Beszállítói automatikus adatfeed  
13. Bérszámfejtés  

Ezek **nem** felejtett sorok — SMB Square-pozíció.

---

## H. Kapcsolódó

- Árak / öröklés: [33](33-packages-and-addons.md)  
- Platform ops: [21](21-platform-ops.md)  
- Dominancia playbook: `canvases/smb-dominance-playbook.canvas.tsx`  
- CloudERP referencia: https://clouderp.hu/csomagok/
