# Felhasználói Munkafolyamat: Adatok Szinkronizálása Vissza a ShopRenter-be

## 📋 Áttekintés

Ez a dokumentum elmagyarázza, **mikor és hogyan** szinkronizálódnak vissza az adatok a ShopRenter webshopba, amikor Ön módosítja őket a portálban.

---

## 🔄 Két Különböző Szinkronizálási Folyamat

### 1️⃣ **LEKÉRDEZÉS (Pull)**: ShopRenter → Portál Adatbázis
- **Mikor**: Teljes termék szinkronizálás (Connections oldal)
- **Mi történik**: Minden termék adata lekerül a ShopRenter-ből és mentődik az adatbázisba
- **Automatikus**: Igen, de Ön indítja el

### 2️⃣ **VISSZAKÜLDÉS (Push)**: Portál Adatbázis → ShopRenter
- **Mikor**: Termék szerkesztése után manuális szinkronizálás
- **Mi történik**: A portálban módosított adatok visszakerülnek a ShopRenter-be
- **Automatikus**: **NEM** - Önnek kell manuálisan elindítania

---

## 🎯 Fő Szabály: **Nincs Automatikus Visszaküldés**

⚠️ **FONTOS**: Amikor Ön módosít egy terméket a portálban, az adatok **NEM kerülnek automatikusan vissza** a ShopRenter-be!

### Mi történik amikor menti a változtatásokat?

1. **Adatok mentése az adatbázisba** ✅
   - A módosítások mentődnek a portál adatbázisába
   - Láthatja a változtatásokat a portálban
   - **DE**: A ShopRenter webshopban **NEM változnak meg** az adatok

2. **ShopRenter webshop állapota**
   - A webshopban továbbra is a **régi adatok** látszanak
   - A vásárlók a **régi információkat** látják

---

## 📤 Hogyan Küldi Vissza az Adatokat a ShopRenter-be?

### Lépés 1: Termék Szerkesztése

1. Nyissa meg a **Termékek** oldalt
2. Kattintson egy termékre a szerkesztéshez
3. Módosítsa az adatokat:
   - **Alapadatok**: SKU, cikkszám, ár, stb.
   - **Leírások**: Név, rövid leírás, hosszú leírás, meta adatok
   - **URL**: URL slug

### Lépés 2: Mentés

1. Kattintson a **"Mentés"** gombra
2. ✅ **Adatok mentve az adatbázisba**
3. ⚠️ **Még NEM kerültek vissza a ShopRenter-be**

### Lépés 3: Szinkronizálás Vissza a ShopRenter-be

1. Kattintson a **"Szinkronizálás"** gombra (🔄 ikon)
2. Erősítse meg a párbeszédablakban
3. Várjon, amíg a szinkronizálás befejeződik

---

## 🔄 Mi Történik a Szinkronizálás Során?

### 1. Alapadatok Frissítése
```
PUT /products/{shoprenter_id}
{
  "modelNumber": "503100",
  "gtin": "1234567890123",
  "price": "12217.00",
  "cost": "7545.03",
  "multiplier": "1.0",
  "multiplierLock": "0"
}
```

**Mit frissít**:
- Gyártói cikkszám (`model_number`)
- Vonalkód (`gtin`)
- Ár (`price`)
- Beszerzési ár (`cost`)
- Árazási szorzó (`multiplier`)
- Szorzó zárolás (`multiplier_lock`)

### 2. Leírások Frissítése
```
PUT /productDescriptions/{description_id}
{
  "name": "Termék neve",
  "metaTitle": "SEO cím",
  "metaDescription": "SEO leírás",
  "shortDescription": "Rövid leírás",
  "description": "Hosszú leírás (HTML)"
}
```

**Mit frissít**:
- Termék neve
- Meta cím (SEO)
- Meta leírás (SEO)
- Meta kulcsszavak
- Rövid leírás
- Hosszú leírás (HTML formátumban)

### 3. Ellenőrzés (Pull Back)
- A rendszer **visszahúzza** a terméket a ShopRenter-ből
- **Ellenőrzi**, hogy a változtatások sikeresen mentődtek-e
- **Frissíti** a helyi adatbázist, ha változás történt

---

## ⏰ Mikor Kell Szinkronizálni?

### ✅ Szinkronizáljon, amikor:

1. **Termék leírás módosítása**
   - Új AI-generált leírás
   - Manuális szerkesztés
   - Meta adatok frissítése

2. **Árazás módosítása**
   - Új ár beállítása
   - Beszerzési ár frissítése
   - Szorzó módosítása

3. **Alapadatok módosítása**
   - SKU változtatás
   - Cikkszám frissítése
   - Vonalkód hozzáadása

4. **URL slug módosítása** (ha szükséges)

### ❌ NEM kell szinkronizálni, amikor:

1. **Csak megtekinti** a terméket
2. **Csak keres** a termékek között

---

## 🎨 Felhasználói Felület

### Termék Szerkesztő Oldal

```
┌─────────────────────────────────────────┐
│  Termék Szerkesztése                    │
├─────────────────────────────────────────┤
│                                         │
│  [Alapadatok] [Leírások] [SEO]         │
│                                         │
│  ... termék adatok ...                  │
│                                         │
│  [Mentés]  [🔄 Szinkronizálás]         │
│                                         │
└─────────────────────────────────────────┘
```

### Szinkronizálás Gomb

- **Helye**: Termék szerkesztő oldal jobb felső sarkában
- **Ikon**: 🔄 (Szinkronizálás)
- **Szöveg**: "Szinkronizálás"
- **Működés**: 
  1. Kattintás → megerősítő párbeszédablak
  2. Megerősítés → szinkronizálás indítása
  3. Várakozás → "Szinkronizálás..." állapot
  4. Kész → "Termék sikeresen szinkronizálva" üzenet

---

## 📊 Szinkronizálási Állapotok

### 1. **"Mentve"** (Csak adatbázisban)
- ✅ Adatok mentve a portál adatbázisába
- ❌ Adatok **NEM** a ShopRenter-ben
- 🔄 Szükséges: Szinkronizálás gombra kattintás

### 2. **"Szinkronizálás..."** (Folyamatban)
- ⏳ Adatok küldése a ShopRenter-be
- ⏳ Várakozás a válaszra
- ⏳ Ellenőrzés

### 3. **"Szinkronizálva"** (Kész)
- ✅ Adatok a ShopRenter-ben
- ✅ Webshopban látható a változás
- ✅ Vásárlók látják az új adatokat

### 4. **"Hiba"** (Sikertelen)
- ❌ Szinkronizálás sikertelen
- ⚠️ Hibaüzenet megjelenik
- 🔄 Próbálja meg újra

---

## 🔍 Hogyan Ellenőrizheti?

### 1. Portálban
- **Termék szerkesztő oldal**: "Szinkronizálva" állapot
- **Utolsó szinkronizálás**: Dátum/idő megjelenik

### 2. ShopRenter Webshopban
1. Nyissa meg a webshopot böngészőben
2. Keresse meg a terméket
3. Ellenőrizze, hogy a módosított adatok látszanak-e

---

## ⚠️ Fontos Megjegyzések

### 1. **Nincs Automatikus Szinkronizálás**
- A portálban végzett módosítások **NEM kerülnek automatikusan** vissza
- **Mindig manuálisan** kell szinkronizálni

### 2. **Csak Módosított Adatok**
- Csak azok az adatok kerülnek vissza, amelyeket **módosított**
- Ha nem változtat semmit, a szinkronizálás nem csinál semmit

### 3. **Leírások Kötelezőek**
- Szinkronizálás előtt **mentse el a leírást**
- Ha nincs leírás, a szinkronizálás **sikertelen** lesz

### 4. **ShopRenter Automatikusan Kezeli**
- **Structured data** (JSON-LD) → ShopRenter automatikusan generálja
- **Canonical URL** → ShopRenter automatikusan kezeli (gyerek termékek → szülő URL)
- Ezek **NEM** a ShopRenter API részei

---

## 📝 Példa Munkafolyamat

### Példa: AI-Generált Leírás Hozzáadása

1. **Termék megnyitása**
   - Termékek oldal → Termék kiválasztása

2. **AI leírás generálása**
   - "AI Leírás Generálása" gomb
   - Várakozás (30-60 másodperc)
   - Leírás megjelenik

3. **Leírás szerkesztése** (opcionális)
   - Szerkesztés a HTML szerkesztőben
   - Módosítások

4. **Mentés**
   - "Mentés" gomb
   - ✅ "Termék sikeresen mentve!"

5. **Szinkronizálás**
   - "Szinkronizálás" gomb (🔄)
   - Megerősítés
   - Várakozás (5-10 másodperc)
   - ✅ "Termék sikeresen szinkronizálva a webshopba!"

6. **Ellenőrzés**
   - Webshop megnyitása
   - Termék keresése
   - ✅ Új leírás látható!

---

## 🚀 Gyors Referencia

| Művelet | Mentés | Szinkronizálás |
|---------|--------|----------------|
| Leírás módosítása | ✅ Szükséges | ✅ Szükséges |
| Ár módosítása | ✅ Szükséges | ✅ Szükséges |
| SKU módosítása | ✅ Szükséges | ✅ Szükséges |
| Structured data generálás | ✅ ShopRenter automatikus | ✅ ShopRenter automatikus |
| Canonical URL beállítás | ✅ ShopRenter automatikus | ✅ ShopRenter automatikus |
| Termék megtekintése | ❌ Nincs | ❌ Nincs |

---

## 💡 Tippek

1. **Mindig szinkronizáljon** leírás módosítás után
2. **Ellenőrizze a webshopot** szinkronizálás után
3. **Ne felejtse el** a szinkronizálást - a vásárlók csak akkor látják a változásokat
4. **Használja a megerősítő párbeszédablakot** - elkerüli a véletlen szinkronizálást

---

## ❓ Gyakori Kérdések

### Q: Miért nem automatikus a szinkronizálás?
**A**: Biztonsági okokból - így Ön kontrollálja, mikor kerülnek vissza az adatok a webshopba.

### Q: Mi történik, ha nem szinkronizálok?
**A**: A módosítások csak a portálban lesznek láthatóak, de **NEM** a webshopban.

### Q: Szinkronizálhatok több terméket egyszerre?
**A**: Jelenleg **nem** - minden terméket külön kell szinkronizálni.

### Q: Mi történik, ha a szinkronizálás sikertelen?
**A**: Hibaüzenet jelenik meg. Próbálja meg újra, vagy ellenőrizze a kapcsolat beállításait.

---

## 📞 Segítség

Ha problémája van a szinkronizálással:
1. Ellenőrizze a kapcsolat beállításait (Connections oldal)
2. Ellenőrizze, hogy van-e leírás a termékhez
3. Próbálja meg újra a szinkronizálást
4. Ha továbbra is probléma van, nézze meg a konzol hibáit (F12)
