# ShopRenter Sync Flow - Részletes Leírás

## 📋 Áttekintés

A ShopRenter szinkronizálás egy háromfázisú folyamat, amely:
1. **Termékek letöltése** a ShopRenter API-ból
2. **Adatbázisba mentés** és kapcsolatok frissítése
3. **Szülő-gyerek kapcsolatok frissítése** (parent_product_id)

---

## 🔄 1. FÁZIS: Termékek Letöltése

### 1.1. Kapcsolat Ellenőrzése
- Ellenőrzi, hogy a kapcsolat létezik és `shoprenter` típusú
- Kinyeri a shop nevet az API URL-ből (pl. `vasalatmester` a `vasalatmester.api.myshoprenter.hu`-ból)
- Létrehozza a Basic Auth headert (`username:password` base64)

### 1.2. Termék ID-k Gyűjtése (Pagináció)
```
GET /products?full=1&limit=200&page=0
GET /products?full=1&limit=200&page=1
...
```
- **Oldalanként 200 termék** (ShopRenter ajánlás)
- **Pagináció** addig, amíg van több oldal
- **ID kinyerése** két módon:
  - Közvetlenül: `item.id`
  - Href-ből: `/products/cHJvZHVjdC1wcm9kdWN0X2lkPTI0NTE=` → `cHJvZHVjdC1wcm9kdWN0X2lkPTI0NTE=`

### 1.3. Batch API Használata (Hatékonyság)
```
POST /batch
{
  "data": {
    "requests": [
      { "method": "GET", "uri": "/productExtend/{id}?full=1" },
      { "method": "GET", "uri": "/productExtend/{id}?full=1" },
      ... (max 200 kérés/batch)
    ]
  }
}
```
- **200 termék/batch** (ShopRenter limit)
- **Párhuzamos feldolgozás** a Batch API-val
- **Timeout**: 5 perc/batch

---

## 💾 2. FÁZIS: Adatbázisba Mentés

### 2.1. Termék Adatok Feldolgozása (`syncProductToDatabase`)

Minden termék esetén:

#### A. Alapadatok Kinyerése
- **SKU, név, ár, stb.**
- **URL információk**:
  - `urlAliases.urlAlias` → `url_slug`
  - `urlAliases.id` → `url_alias_id`
  - Teljes URL: `https://{shopname}.shoprenter.hu/{url_slug}` → `product_url`

#### B. Szülő-Gyerek Kapcsolat (`parent_product_id`)
```typescript
// 1. Kinyeri a szülő ShopRenter ID-t
parentShopRenterId = extractParentProductId(product)
// Formátumok:
// - product.parentProduct.id
// - product.parentProduct.href → /products/{id}

// 2. Megkeresi az adatbázisban a szülő terméket
parentProduct = await supabase
  .from('shoprenter_products')
  .where('shoprenter_id', parentShopRenterId)
  .single()

// 3. Beállítja a parent_product_id-t (UUID)
parent_product_id = parentProduct.id
```

**⚠️ VÉDELEM**: Ha `parentProduct.id === product.id` (saját magára mutat), akkor:
- **NULL-ra állítja** a `parent_product_id`-t
- **Figyelmeztetést** ír a konzolra

#### C. Termék Attribútumok (`product_attributes`)
```json
{
  "name": "meret",
  "type": "LIST",
  "value": [{"value": "450", ...}]
}
```
- **JSONB formátumban** tárolva
- **GIN index** a gyors kereséshez

#### D. Leírások (`shoprenter_product_descriptions`)
- **Nyelvek szerint** (hu, en, de, stb.)
- **Név, leírás, meta cím, meta leírás**
- **Magyar nyelvű név** → `shoprenter_products.name`

### 2.2. Upsert Logika
```sql
-- Ha létezik (shoprenter_id alapján):
UPDATE shoprenter_products SET ...

-- Ha nem létezik:
INSERT INTO shoprenter_products ...
```

- **Azonnal frissül** a sync során
- **Nem vár** a post-sync fázisra

---

## 🔗 3. FÁZIS: Post-Sync Optimalizálás

### 3.1. Szülő-Gyerek Kapcsolatok Frissítése

**Probléma**: A gyerek termékek szinkronizálása **előbb** történhet, mint a szülő termékek.

**Megoldás**: Post-sync lépésben újra ellenőrzi:

```typescript
// 1. Összes termék újra lekérdezése
allProducts = await supabase.from('shoprenter_products').select(...)

// 2. Batch API-val újra lekérdezi a parentProduct adatokat
for (batch of products) {
  batchResponse = await fetch('/batch', {
    requests: products.map(p => `/productExtend/${p.shoprenter_id}?full=1`)
  })
  
  // 3. Frissíti a parent_product_id-t, ha változott
  if (newParentId !== currentParentId) {
    await supabase.update({ parent_product_id: newParentId })
  }
}
```

**⚠️ VÉDELEM**: Ha `parentProduct.id === product.id`, akkor:
- **NULL-ra állítja** a `parent_product_id`-t
- **Figyelmeztetést** ír

### 3.2. Szülő-Gyerek Kapcsolatok Frissítése

A szinkronizálás során a `parent_product_id` mező automatikusan frissül, hogy a termékek közötti szülő-gyerek kapcsolatokat pontosan tükrözze.

---

## 📊 Progress Tracking

### Real-time Frissítés
```typescript
updateProgress(connectionId, {
  total: 1000,
  synced: 450,
  current: 450,
  status: 'syncing',
  errors: 5
})
```

**Frontend polling**: `/api/sync-progress/[connectionId]`
- **1 másodpercenként** lekérdezi a progress-t
- **Progress bar** mutatja az állapotot

---

## ⚠️ Hibakezelés

### Non-Fatal Hibák (Folytatódik)
- **Parent update hiba** → log, de folytatódik

### Fatal Hibák (Megáll)
- **API hiba** (401, 403, 500) → megáll
- **Batch timeout** → megáll
- **Adatbázis hiba** → megáll

---

## 🔄 Teljes Folyamat Diagram

```
1. KAPCSOLAT ELLENŐRZÉS
   ↓
2. TERMÉK ID-K GYŰJTÉSE (Pagináció)
   GET /products?page=0,1,2...
   ↓
3. BATCH API VAL HÍVÁSOK
   POST /batch (200 termék/batch)
   ↓
4. MINDEN TERMÉK FELDOLGOZÁSA
   ├─ Alapadatok mentése
   ├─ URL információk (url_slug, product_url)
   ├─ Szülő-gyerek kapcsolat (parent_product_id)
   ├─ Attribútumok (product_attributes JSONB)
   ├─ Leírások (shoprenter_product_descriptions)
   ↓
5. POST-SYNC: SZÜLŐ-GYEREK KAPCSOLATOK FRISSÍTÉSE
   ├─ Újra lekérdezi a parentProduct adatokat
   ├─ Frissíti a parent_product_id-t, ha változott
   └─ Javítja a saját magára mutató parent_product_id-ket
   ↓
6. POST-SYNC: Szülő-gyerek kapcsolatok frissítése
   ↓
7. KÉSZ ✅
```

---

## 🎯 Főbb Pontok

1. **Batch API**: 200 termék/batch a hatékonyságért
2. **Pagináció**: Automatikus, amíg van több oldal
3. **Parent-Child**: Két lépésben frissül (sync + post-sync)
4. **Szülő-gyerek kapcsolatok**: Automatikus frissítés
5. **Védelem**: Saját magára mutató `parent_product_id` automatikusan javítva
6. **Progress Tracking**: Real-time frissítés a frontend-en

---

## 📝 Log Példák

```
[SYNC] Total product IDs collected: 1234
[SYNC] Processing batch 1/7 (200 products)
[SYNC] Product ABC123 is a child of parent XYZ789 (uuid-here)
[SYNC] Updated 45 parent-child relationships
[SYNC] Completed: 1234/1234 synced, 0 errors
```

---

## 🔧 Manuális Műveletek

### Bulk Structured Data Generálás
```
POST /api/products/bulk-structured-data
{ "productIds": ["uuid1", "uuid2", ...] }
```

### Canonical URL Javítás
```
POST /api/products/fix-canonical-urls
```

### Egyedi Termék Sync
```
POST /api/connections/[id]/sync-products
{ "product_id": "cHJvZHVjdC1wcm9kdWN0X2lkPTE3MDc=" }
```

---

## ✅ Ellenőrzési SQL Lekérdezések

```sql
-- Szülő-gyerek kapcsolatok ellenőrzése
SELECT 
  parent.sku as parent_sku,
  COUNT(child.id) as child_count
FROM shoprenter_products parent
LEFT JOIN shoprenter_products child ON child.parent_product_id = parent.id::text
WHERE parent.parent_product_id IS NULL
GROUP BY parent.id, parent.sku
HAVING COUNT(child.id) > 0
ORDER BY child_count DESC;
```
