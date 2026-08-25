# Árak — S0 kapu (demo shop mérés)

**Cél:** implementáció előtt rögzíteni, hogyan viselkedik a Shoprenter bolt a csoportár / % / sáv esetén.  
**Ha ez a jegyzőkönyv üres vagy ellentmond a kódnak → ne szállíts S1 UI-t.**

Teljes partnerár-stratégia terv: [`B2B_PRICING_STRATEGIES.md`](./B2B_PRICING_STRATEGIES.md).

Shop: `________________` · Dátum: `____-__-__` · Auth: OAuth / Basic

---

## S0.1 — Dupla POST ugyanarra a termék×csoport párra

1. `POST /customerGroupProductPrices` `{ price, customerGroup, product }`
2. Ugyanaz újra más `price`-szal

| Eredmény | Megfigyelés |
|----------|-------------|
| Egy rekord, ár frissült (idempotens modify) | ☐ |
| Két rekord | ☐ |
| Más (írd le) | |

**Kód szabály:** ________________________________

---

## S0.2 — Csoport 15% + saját ár ugyanarra a SKU-ra (bolt)

Bejelentkezett vevő a csoportban. Termékoldal / kosár.

| Árforrás | Boltban látszik |
|----------|-----------------|
| Csak listaár | |
| Csoport 15%, nincs saját ár | |
| Csoport 15% + saját ár (olcsóbb) | |
| Csoport 15% + saját ár (drágább, mint a %) | |

**Győztes szabály (rögzítsd):** ________________________________

Alapértelmezett termék-igazság (terv): saját ár > % > lista.  
Ha a bolt mást csinál → widget + UI szöveg a bolthoz igazítandó.

---

## S0.3 — Csak kedvezmény %, nincs saját ár

Listaár × (1 − percent/100)? Mikor (katalógus / kosár)?

Jegyzet: ________________________________

---

## S0.4 — productSpecial minQuantity (S2 előkészítő)

`minQuantity=10`, kosár 5 vs 10 db.

| qty | Bolt ára |
|-----|----------|
| 5 | |
| 10 | |

Dátum mezők a válaszban: `dateFrom`/`dateTo` / más: ________

---

## S0.5 — OAuth app write

`POST /customerGroupProductPrices` az app tokennel:

| HTTP | ☐ 200/201 · ☐ 403 · ☐ egyéb: ____ |

---

## S0.6 — Special dátum mezőnevek

API válaszban: `dateFrom` / `dateTo` / `dateStart` / `dateEnd`: ________

---

## S0.7 — Parent vs child product

Saját árat melyik `product.id`-re kell írni? Inner id: ________

---

## S0 döntés (pipáld)

- [ ] S0.1–S0.5 zöld → **GO S1**
- [ ] Eltérés a „saját ár győz” szabálytól → engine + copy frissítve
- [ ] OAuth 403 → scope / app jogosultság javítandó, UI NO-GO
