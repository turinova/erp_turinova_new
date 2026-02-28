# ÁFA (VAT) Rendszer Tesztelési Útmutató

Ez az útmutató részletesen bemutatja, hogyan tesztelhető az ÁFA rendszer minden funkciója.

## 📋 Előfeltételek

1. **Adatbázis migrációk futtatása:**
   - `20250125_add_vat_support.sql` - ÁFA támogatás hozzáadása
   - `20250125_add_vat_page_to_permissions.sql` - ÁFA oldal jogosultságokhoz

2. **ShopRenter kapcsolat beállítva:**
   - Aktív ShopRenter kapcsolat a rendszerben
   - API hozzáférés működik

---

## 🧪 Tesztelési Lépések

### 1. ÁFA Kulcsok Kezelése

#### 1.1. ÁFA Kulcsok Megtekintése
1. Menj a **"Törzsadatok" → "Áfák"** menüpontra
2. Ellenőrizd, hogy megjelennek-e az alapértelmezett ÁFA kulcsok:
   - ÁFA mentes (0%)
   - ÁFA 5%
   - ÁFA 18%
   - ÁFA 27%

#### 1.2. Új ÁFA Kulcs Létrehozása
1. Kattints az **"Új ÁFA kulcs"** gombra
2. Töltsd ki az adatokat:
   - **Név:** "ÁFA 10%" (vagy bármilyen egyedi név)
   - **Kulcs értéke:** `10`
3. Kattints a **"Létrehozás"** gombra
4. Ellenőrizd, hogy:
   - Megjelenik a táblázatban
   - A példa számítás helyesen működik (10,000 Ft nettó = 11,000 Ft bruttó)

#### 1.3. ÁFA Kulcs Szerkesztése
1. Kattints a **Szerkesztés** ikonra (ceruza) egy meglévő ÁFA kulcs mellett
2. Módosítsd a nevet vagy a kulcs értékét
3. Kattints a **"Frissítés"** gombra
4. Ellenőrizd, hogy a változások mentődtek

#### 1.4. ÁFA Kulcs Törlése
1. Kattints a **Törlés** ikonra (kuka) egy ÁFA kulcs mellett
2. Erősítsd meg a törlést
3. Ellenőrizd, hogy eltűnt a listából

---

### 2. ÁFA Leképezés ShopRenter-hez

#### 2.1. ShopRenter Adóosztályok Betöltése
1. Menj a **"Beállítások" → "Kapcsolatok"** oldalra
2. Kattints az **ÁFA leképezés** ikonra (bizonylat ikon) egy ShopRenter kapcsolat mellett
3. Ellenőrizd, hogy:
   - Megjelenik a leképezési táblázat
   - A ShopRenter adóosztályok betöltődnek
   - Ha nincs adóosztály, figyelmeztetés jelenik meg

#### 2.2. ÁFA Kulcs Leképezése
1. A leképezési táblázatban válaszd ki egy ERP ÁFA kulcsot
2. A **"ShopRenter adóosztály"** oszlopban válassz egy adóosztályt a dropdown menüből
3. A leképezés automatikusan mentődik
4. Ellenőrizd, hogy:
   - A státusz zöld chip-re változik ("Leképezve")
   - A kiválasztott adóosztály neve megjelenik

#### 2.3. Leképezés Módosítása
1. Válassz egy másik adóosztályt a dropdown menüből
2. Ellenőrizd, hogy a változás mentődik

#### 2.4. Leképezés Törlése
1. Válaszd a **"Nincs leképezve"** opciót a dropdown menüből
2. Ellenőrizd, hogy a leképezés törlődik

---

### 3. Termék Árazás ÁFA-val

#### 3.1. Termék Megnyitása
1. Menj a **"Törzsadatok" → "Termékek"** oldalra
2. Válassz ki egy terméket (vagy hozz létre újat)
3. Nyisd meg a termék szerkesztő oldalt

#### 3.2. Árazás Tab Megnyitása
1. Kattints az **"Árazás"** tabra
2. Ellenőrizd, hogy megjelennek az árazási mezők:
   - Bruttó ár (szerkeszthető)
   - Nettó ár (szerkeszthető)
   - ÁFA kulcs (dropdown)
   - ÁFA összege (automatikusan számolva)
   - Beszerzési ár
   - Árazási szorzó

#### 3.3. Bruttó Ár Beállítása
1. Írd be a **Bruttó ár** mezőbe: `12700`
2. Válassz ki egy **ÁFA kulcsot**: "ÁFA 27%"
3. Ellenőrizd, hogy:
   - A **Nettó ár** automatikusan kiszámolódik: `10000` Ft
   - Az **ÁFA összege** megjelenik: `2700` Ft
   - A példa számítás helyes: "10,000 Ft nettó + 27% ÁFA = 12,700 Ft bruttó"

#### 3.4. Nettó Ár Beállítása
1. Töröld a bruttó árat
2. Írd be a **Nettó ár** mezőbe: `10000`
3. Válassz ki az **ÁFA kulcsot**: "ÁFA 27%"
4. Ellenőrizd, hogy:
   - A **Bruttó ár** automatikusan kiszámolódik: `12700` Ft
   - Az **ÁFA összege** megjelenik: `2700` Ft

#### 3.5. ÁFA Kulcs Változtatása
1. Változtasd meg az **ÁFA kulcsot** "ÁFA 18%"-ra
2. Ellenőrizd, hogy:
   - A bruttó ár újraszámolódik: `11800` Ft (ha nettó 10,000 Ft volt)
   - Az ÁFA összege frissül: `1800` Ft

#### 3.6. Termék Mentése
1. Kattints a **"Mentés"** gombra
2. Ellenőrizd, hogy:
   - A mentés sikeres
   - A termék adatai frissülnek az adatbázisban

---

### 4. Termék Szinkronizálás ShopRenter-hez

#### 4.1. Termék Szinkronizálása (Push - ERP → ShopRenter)
1. Nyisd meg egy termék szerkesztő oldalt
2. Állítsd be:
   - Nettó ár: `10000` Ft
   - ÁFA kulcs: "ÁFA 27%"
3. Mentsd el a terméket
4. Kattints a **"Szinkronizálás ShopRenter-hez"** gombra
5. Ellenőrizd a ShopRenter admin felületen, hogy:
   - A termék **nettó ára** helyes: `10000`
   - A termék **adóosztálya** megfelelő (az ÁFA leképezés alapján)
   - A ShopRenter automatikusan kiszámolja a bruttó árat

#### 4.2. Termékek Tömeges Szinkronizálása
1. Menj a **"Beállítások" → "Kapcsolatok"** oldalra
2. Kattints a **"Szinkronizálás"** gombra egy ShopRenter kapcsolat mellett
3. Válaszd ki a **"Termékek szinkronizálása"** opciót
4. Ellenőrizd, hogy:
   - A szinkronizálás elindul
   - A termékek ÁFA adatai helyesen szinkronizálódnak

---

### 5. Termék Szinkronizálás ShopRenter-ből (Pull)

#### 5.1. Termékek Betöltése ShopRenter-ből
1. Menj a **"Beállítások" → "Kapcsolatok"** oldalra
2. Kattints a **"Szinkronizálás"** gombra
3. Válaszd ki a **"Termékek szinkronizálása ShopRenter-ből"** opciót
4. Várj, amíg a szinkronizálás befejeződik

#### 5.2. Szinkronizált Termék Ellenőrzése
1. Menj a **"Törzsadatok" → "Termékek"** oldalra
2. Nyisd meg egy szinkronizált terméket
3. Ellenőrizd az **"Árazás"** tabon, hogy:
   - A **Nettó ár** helyesen betöltődött
   - Az **ÁFA kulcs** helyesen leképeződött (ShopRenter adóosztály → ERP ÁFA kulcs)
   - A **Bruttó ár** automatikusan kiszámolódik
   - A **ShopRenter adóosztály ID** mentve van

---

### 6. Tesztelési Forgatókönyvek

#### 6.1. Teljes Körű Tesztelési Forgatókönyv

**Lépés 1: ÁFA Kulcsok Beállítása**
- Hozz létre 3 ÁFA kulcsot: 0%, 18%, 27%

**Lépés 2: ÁFA Leképezés**
- Menj a Kapcsolatok oldalra
- Állítsd be az ÁFA leképezéseket:
  - ERP "ÁFA 27%" → ShopRenter "27% ÁFA" adóosztály
  - ERP "ÁFA 18%" → ShopRenter "18% ÁFA" adóosztály
  - ERP "ÁFA mentes" → ShopRenter "ÁFA mentes" adóosztály

**Lépés 3: Termék Létrehozása/Szerkesztése**
- Nyiss meg egy terméket
- Állíts be bruttó árat: 12,700 Ft
- Válassz ÁFA kulcsot: "ÁFA 27%"
- Ellenőrizd, hogy nettó ár: 10,000 Ft
- Mentsd el

**Lépés 4: Szinkronizálás ShopRenter-hez**
- Kattints a "Szinkronizálás ShopRenter-hez" gombra
- Ellenőrizd ShopRenter-ben:
  - Nettó ár: 10,000 Ft
  - Adóosztály: "27% ÁFA"
  - Bruttó ár: 12,700 Ft (ShopRenter számolja)

**Lépés 5: Visszaszámlálás Teszt**
- Módosítsd a terméket ShopRenter-ben (változtasd meg az adóosztályt)
- Szinkronizáld vissza ShopRenter-ből
- Ellenőrizd, hogy az ERP-ben is frissült az ÁFA kulcs

#### 6.2. Hibakezelési Tesztek

**Teszt 1: Hiányzó ÁFA Leképezés**
- Töröld egy ÁFA leképezést
- Próbáld meg szinkronizálni egy terméket
- Ellenőrizd, hogy figyelmeztetés jelenik meg

**Teszt 2: Érvénytelen ÁFA Kulcs**
- Próbáld meg 0-nál kisebb vagy 100-nál nagyobb ÁFA kulcsot beállítani
- Ellenőrizd, hogy hibaüzenet jelenik meg

**Teszt 3: Hiányzó ShopRenter Adóosztály**
- Állíts be egy olyan ÁFA leképezést, ami nem létezik ShopRenter-ben
- Próbáld meg szinkronizálni
- Ellenőrizd a hibakezelést

---

### 7. Ellenőrzési Checklist

- [ ] ÁFA kulcsok létrehozása/szerkesztése/törlése működik
- [ ] ÁFA leképezés beállítása működik
- [ ] Bruttó ár szerkesztése → Nettó ár automatikus számolása
- [ ] Nettó ár szerkesztése → Bruttó ár automatikus számolása
- [ ] ÁFA kulcs változtatása → Árak újraszámolása
- [ ] Termék mentése ÁFA adatokkal működik
- [ ] Szinkronizálás ShopRenter-hez (push) működik
- [ ] Szinkronizálás ShopRenter-ből (pull) működik
- [ ] ÁFA leképezés helyesen működik szinkronizálásnál
- [ ] ShopRenter-ben a termékek helyes adóosztályt kapnak
- [ ] Visszaszámlálás (ShopRenter → ERP) helyesen működik

---

### 8. Gyakori Problémák és Megoldások

#### Probléma: "Nincs ÁFA kulcs létrehozva" hiba
**Megoldás:** Menj az "Áfák" oldalra és hozz létre ÁFA kulcsokat

#### Probléma: "Nem sikerült betölteni a ShopRenter adóosztályokat"
**Megoldás:** 
- Ellenőrizd a ShopRenter kapcsolat beállításait
- Teszteld a kapcsolatot a "Kapcsolat tesztelése" gombbal

#### Probléma: "No taxClass mapping found" figyelmeztetés
**Megoldás:** 
- Menj a Kapcsolatok oldalra
- Állítsd be az ÁFA leképezéseket

#### Probléma: Szinkronizálás nem működik
**Megoldás:**
- Ellenőrizd, hogy a ShopRenter API hozzáférés működik
- Nézd meg a böngésző konzolt hibákért
- Ellenőrizd a szinkronizálási logokat

---

### 9. Várható Eredmények

**Sikeres Tesztelés Esetén:**
- ✅ ÁFA kulcsok kezelése zökkenőmentesen működik
- ✅ Árazás automatikus számolása helyes
- ✅ Szinkronizálás mindkét irányban működik
- ✅ ShopRenter-ben a termékek helyes adóosztályt kapnak
- ✅ Az ERP mindig a forrás az ÁFA kulcsokhoz

---

## 📝 Megjegyzések

- Az ERP rendszer **mindig a forrás** az ÁFA kulcsokhoz
- A ShopRenter adóosztályok csak leképezésként működnek
- A bruttó ár mindig automatikusan számolódik
- A szinkronizálás során csak a nettó ár és az adóosztály kerül átvitelre
- A ShopRenter automatikusan kiszámolja a bruttó árat az adóosztály alapján

---

**Jó tesztelést! 🚀**
