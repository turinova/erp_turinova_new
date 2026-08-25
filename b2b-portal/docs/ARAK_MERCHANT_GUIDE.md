# Hogyan árazz B2B partnereket

**Felület:** `/arak/utmutato` + `/arak`  
**UI:** kártyagrid + győztes-lépcső + accordion GYIK

---

## Lead

**Cím:** Partnerárak — melyiket válaszd?  
**Alá:** Amit beállítasz, a vevő a boltban ezt fizeti.

---

## Melyik ár győz?

**Fix Ft** → **Mennyiség** → **Csoport −%** → Bolti ár  

*Ha adtál fix árat, a −15% és a sáv már nem számít.*

---

## Kártyák (élő)

1. **Csoport −%** — bal csúszka  
2. **Fix Ft** — Partner ár cella  
3. **Kijelöltek −%** — Több / márka −10/15/20%  
4. **Beszer + %** — bulk Beszer+15/20/25% vagy szerkesztő +20/+25%  
5. **Bolti ár** — referencia  
6. **Mennyiség** — sor **Sáv** gomb → `productSpecials`

## Árrés figyelmeztetés (P-11)

Árazás toolbar: **Min. árrés %** (localStorage). Alatta sárga `!`.

---

## GYIK

Lásd `PricingGuideView.tsx`.
