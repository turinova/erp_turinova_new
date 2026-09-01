# Merchant súgó — tartalomterv (jóváhagyásra vár)

**Státusz:** infrastruktura kész (`/tudasbazis`, markdown, keresés)  
**Workflow:** alább minden cikk **vázlat** → te jóváhagyod a szöveget → `.md` fájl + `catalog.ts` status `published`

**Egyetlen publikált cikk:** `udvozlo.md` (át kell nézned)

---

## 1. Üdv a Tudásbázisban (`udvozlo`) — **PUBLISHED, ellenőrizd**

Fájl: `src/content/help/articles/udvozlo.md`

**Jelenlegi szöveg röviden:**
- Bemutatkozás, fokozatos bővítés
- Hivatkozás: Áttekintés, Widget, Beállítások, Árazás útmutató
- Kapcsolat: hello@progate.hu

**Kérdés neked:** Maradjon így, vagy máshogy fogalmazzuk?

---

## 2. Bolt összekötése (`bolt-osszekotes`) — DRAFT

**Cél:** Shoprenter API első beállítás  
**Célközönség:** Új merchant, demo

**Javasolt vázlat (jóváhagyás előtt):**

1. Hova menj: Beállítások
2. Mit írj be: API felhasználónév + jelszó (Shoprenter admin)
3. „Működik?” gomb — mit jelent a zöld/piros
4. Gyakori hiba: rossz jelszó, whitespace
5. Következő lépés: termék szinkron cikk

**Screenshots:** később (igen/nem?)

---

## 3. Termékek szinkronizálása (`termek-szinkron`) — DRAFT

**Javasolt vázlat:**

1. Sync automatikusan indul API után
2. Állapotok: pending / syncing / ready — mit látsz a portálon
3. Mennyi ideig tart (nincs fix SLA — őszintén)
4. Miért fontos: widget kereső csak ready után teljes
5. Ha órákig tart: ping + support email

---

## 4. Gyors rendelés bekapcsolása (`widget-bekapcsolas`) — DRAFT

**Javasolt vázlat:**

1. Portálon: Widget menü → kapcsoló
2. Boltban: script még kell (link script cikkre)
3. Bejelentkezett B2B vevő látja
4. Demo checklist 30 mp

---

## 5. Script telepítése (`script-telepites`) — DRAFT

**Javasolt vázlat:**

1. Snippet másolása a Widget oldalról
2. Shoprenter: footer_scripts / egyedi sablon — **pontos hely?** (egyeztetés)
3. apiBase mit csinál
4. Hard refresh / cache
5. Preview vs éles bolt

---

## 6. Excel és CSV (`excel-csv-import`) — DRAFT

**Javasolt vázlat:**

1. Oszlopok: cikkszám + db (pontos fejléc?)
2. Mi NEM megy: EAN-only? (termék spec)
3. Hibás sorok kezelése
4. Példa 3 soros CSV (dummy SKU)

---

## 7. Partnerárak — hol kezdd? (`partnerarak-attekintes`) — DRAFT

**Fontos:** ne duplikáljuk az `/arak/utmutato` tartalmát

**Javasolt vázlat:**

1. Rövid precedencia mondat
2. Link: [Árazás útmutató](/arak/utmutato)
3. Link: [Árazás](/arak)
4. Mikor elég csoport % vs fix ár (1 bekezdés)

---

## 8. Vevők és automatizmus (`vevok-es-szintlepes`) — DRAFT

**Javasolt vázlat:**

1. Vevő lista = Shoprenter partnerek
2. Csoport áthelyezés
3. Automatizmus: szabály + dry-run + létra sorrend
4. Widget FOMO kapcsoló (ha kell említés)

---

## 9. Próba és csomag (`proba-es-csomag`) — DRAFT

**Forrás:** PRICING_V6_CURRENT.md — user nyelven

**Javasolt vázlat:**

1. 14 nap próba, teljes termék
2. 7 500 / 9 999 bruttó, mailto aktiválás
3. Widget lejárat után is megy
4. Soft cap 500 — említjük-e merchantnek?

---

## 10. Widget nem látszik (`widget-nem-latszik`) — DRAFT

**Ellenőrzőlista formátum** (Shoper-szerű):

- [ ] Widget bekapcsolva portálon
- [ ] Script a footerben
- [ ] Bejelentkezett vevő
- [ ] Hard refresh
- [ ] Nincs JS hiba konzolon

---

## 11. Sync nem készül (`sync-nem-kesz`) — DRAFT

**Ellenőrzőlista:**

- [ ] Ping OK?
- [ ] API jogosultság
- [ ] Katalógus állapot
- [ ] Support email mit küldj (shop név, screenshot)

---

## Következő lépés

**Válaszolj cikk-számonként** (pl. „2. OK, de ne említsd a …” vagy „5. írd meg, jóváhagyom”).

Agent módban az jóváhagyott cikkhez:
1. `src/content/help/articles/{slug}.md`
2. `catalog.ts` → `status: "published"`
