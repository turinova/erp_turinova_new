# Credit System Testing Guide

## ✅ Implementált funkciók

1. **Credit árazás**: 1 credit = 15 HUF
2. **Token statisztikák eltávolítva**: Csak credit statisztikák jelennek meg
3. **Test Mode Panel**: Development módban elérhető tesztelési eszközök

## 🧪 Tesztelési útmutató

### 1. Előfeltételek

- Development módban fut az alkalmazás (`NODE_ENV=development`)
- Be vagy jelentkezve
- Van aktív előfizetésed (Pro vagy Enterprise)

### 2. Subscription Page tesztelése

#### 2.1. Credit statisztikák megjelenítése
1. Menj a `/subscription` oldalra
2. Ellenőrizd, hogy:
   - ✅ **Nincs** "Token használati statisztikák" szekció
   - ✅ **Van** "AI Credits használat" szekció
   - ✅ Látható: Használt credits / Credit limit
   - ✅ Látható: Maradék credits
   - ✅ Progress bar mutatja a credit használatot

#### 2.2. Test Mode Panel (Development Only)
1. A subscription page tetején látnod kell egy sárga "🧪 Test Mode" panelt
2. Ha **NEM** látod:
   - Ellenőrizd, hogy `NODE_ENV=development` be van-e állítva
   - Restart-eld a Next.js dev servert

### 3. Credit Limit Override tesztelése

#### 3.1. Quick Test Scenarios használata
1. A Test Mode Panel-ben kattints egy quick test gombra:
   - **"No Credits (0)"** → 0 credit limit
   - **"Low Credits (1)"** → 1 credit limit
   - **"One Description (5)"** → 5 credit limit (pontosan 1 description generálás)
   - **"Edge Case (10)"** → 10 credit limit
   - **"Reset to Plan Default"** → Visszaállítja az eredeti limitet

2. Kattints az **"Apply"** gombra
3. Ellenőrizd, hogy:
   - ✅ Toast üzenet: "Test credit limit applied!"
   - ✅ A credit statisztikák frissülnek
   - ✅ Az új limit látható a "Credit limit" mezőben

#### 3.2. Manuális limit beállítása
1. Írd be a "Override Credit Limit" mezőbe a kívánt értéket (pl. `3`)
2. Kattints az **"Apply"** gombra
3. Ellenőrizd, hogy az új limit érvényesül

### 4. Credit Usage Reset tesztelése

1. Kattints a **"Reset Credit Usage (This Month)"** gombra
2. Erősítsd meg a dialógusban
3. Ellenőrizd, hogy:
   - ✅ Toast üzenet: "Credit usage reset!"
   - ✅ A "Használt credits" 0-ra áll
   - ✅ A "Maradék credits" egyenlő a limit-tel

### 5. AI Generálás tesztelése különböző credit limit-ekkel

#### 5.1. Nincs elég credit (0 limit)
1. Állítsd a credit limit-et **0**-ra
2. Menj egy termék oldalra (`/products/[id]`)
3. Próbálj meg AI generálást indítani:
   - Meta cím generálás
   - Részletes leírás generálás
4. Ellenőrizd, hogy:
   - ✅ Hibaüzenet jelenik meg: "Nincs elég credit! Szükséges: X, Elérhető: 0 / 0"
   - ✅ A generálás nem történik meg

#### 5.2. Pontosan 1 generálás (1 credit limit)
1. Állítsd a credit limit-et **1**-re
2. Generálj egy meta mezőt (pl. meta cím - 1 credit)
3. Ellenőrizd, hogy:
   - ✅ A generálás sikeres
   - ✅ A credit usage 1-re nő
   - ✅ A maradék credit 0
4. Próbálj meg egy második generálást:
   - ✅ Hibaüzenet jelenik meg
   - ✅ A generálás nem történik meg

#### 5.3. Pontosan 1 description (5 credit limit)
1. Állítsd a credit limit-et **5**-re
2. Generálj egy részletes leírást (5 credits)
3. Ellenőrizd, hogy:
   - ✅ A generálás sikeres
   - ✅ A credit usage 5-re nő
   - ✅ A maradék credit 0
4. Próbálj meg egy második generálást:
   - ✅ Hibaüzenet jelenik meg

#### 5.4. Edge case tesztelés (10 credit limit)
1. Állítsd a credit limit-et **10**-re
2. Generálj több különböző mezőt:
   - Meta cím (1 credit)
   - Meta kulcsszavak (1 credit)
   - Meta leírás (1 credit)
   - URL slug (1 credit)
   - Termék címkék (1 credit)
   - Részletes leírás (5 credits)
3. Ellenőrizd, hogy:
   - ✅ Minden generálás működik
   - ✅ A credit usage helyesen számolódik (összesen 10)
   - ✅ A 11. generálás már hibát dob

### 6. Competitor Scraping tesztelése

1. Menj egy termék oldalra, ahol van competitor link
2. Állítsd a credit limit-et **2**-re (egy price scrape költsége)
3. Kattints az "Ár ellenőrzése" gombra
4. Ellenőrizd, hogy:
   - ✅ A scraping működik
   - ✅ 2 credit levonódik
   - ✅ A maradék credit 0
5. Próbálj meg egy második scraping-et:
   - ✅ Hibaüzenet jelenik meg

### 7. Navbar Credit Balance tesztelése

1. Ellenőrizd a navbar jobb felső sarkát
2. Látnod kell egy credit balance chip-et (pl. "150 credits")
3. Hover-elj rá:
   - ✅ Tooltip jelenik meg: "X / Y credits used this month"
4. Teszteld különböző credit limit-ekkel:
   - ✅ A chip színe változik (error/warning/default) a maradék credit alapján
   - ✅ < 10 credit: piros
   - ✅ < 50 credit: sárga
   - ✅ >= 50 credit: szürke

### 8. Credit költségek ellenőrzése

Ellenőrizd, hogy minden AI funkció a helyes credit költséggel rendelkezik:

- ✅ Meta cím: **1 credit** (tooltip: "AI generálás (1 credit)")
- ✅ Meta kulcsszavak: **1 credit**
- ✅ Meta leírás: **1 credit**
- ✅ URL slug: **1 credit**
- ✅ Termék címkék: **1 credit**
- ✅ Részletes leírás: **5 credits** (tooltip: "AI generálás (5 credits)")
- ✅ Competitor price scrape: **2 credits** (tooltip: "Ár ellenőrzése (AI) - 2 credits")

### 9. SQL alapú tesztelés (alternatíva)

Ha a Test Mode Panel nem elérhető, használhatod közvetlenül az SQL-t:

```sql
-- 1. Credit limit módosítása
UPDATE subscription_plans 
SET ai_credits_per_month = 10 
WHERE slug = 'pro';

-- 2. Credit usage reset (aktuális hónap)
DELETE FROM ai_usage_logs 
WHERE user_id = 'YOUR_USER_ID' 
  AND created_at >= DATE_TRUNC('month', NOW())
  AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';

-- 3. Credit usage ellenőrzése
SELECT 
  SUM(credits_used) as total_credits_used,
  COUNT(*) as usage_count
FROM ai_usage_logs
WHERE user_id = 'YOUR_USER_ID'
  AND created_at >= DATE_TRUNC('month', NOW());
```

## 📋 Checklist

- [ ] Token statisztikák eltávolítva a subscription page-ről
- [ ] Test Mode Panel látható (development módban)
- [ ] Credit limit override működik
- [ ] Credit usage reset működik
- [ ] AI generálás credit check működik (0, 1, 5, 10 limit)
- [ ] Competitor scraping credit check működik
- [ ] Navbar credit balance megjelenik
- [ ] Tooltip-ek megjelennek az AI gombokon
- [ ] Hibaüzenetek megjelennek, ha nincs elég credit
- [ ] Credit usage helyesen számolódik

## 🐛 Ismert korlátok

1. **Test Override**: A credit limit override az egész plan-t módosítja, nem csak a te fiókodat. Development módban ez rendben van, de production-ben user-specific override kellene.

2. **Credit árazás**: A 15 HUF/credit árazás jelenleg csak dokumentálva van, nem tárolódik kódban. Ez business logic, nem technikai implementáció.

## 💡 Tippek

- Használd a "Quick Test Scenarios" gombokat a gyors teszteléshez
- Reset-eld a credit usage-t minden teszt előtt, hogy tiszta lappal indulj
- Teszteld minden AI funkciót különböző credit limit-ekkel
- Figyeld a navbar credit balance-t, hogy valós időben láthasd a változásokat
