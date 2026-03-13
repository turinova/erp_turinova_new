# Webhook Tesztelési Útmutató

## Hogyan működik a rendszer?

1. **Webhook-ok automatikusan érkeznek**: Amikor egy új rendelés jön létre a ShopRenter webshopban, a ShopRenter automatikusan küld egy webhook-ot az ERP webhook endpoint-jára.

2. **A "Frissítés" gomb**: Csak frissíti a buffer listát, **nem húzza le** a rendeléseket. A rendelések automatikusan érkeznek webhook-ok formájában.

3. **Buffer rendelések**: A webhook-ok az `order_buffer` táblába kerülnek, ahol áttekinthetők és feldolgozhatók.

---

## Tesztelési lehetőségek

### 1. Gyors teszt: "Teszt rendelés" gomb

A legegyszerűbb módszer a teszteléshez:

1. Menj a `/orders/buffer` oldalra
2. Kattints a **"Teszt rendelés"** gombra
3. A rendszer létrehoz egy teszt ShopRenter formátumú rendelést a bufferben
4. Megjelenik a táblázatban
5. Kattints rá a részletekhez
6. A részletek oldalon kattints a **"Feldolgozás"** gombra, hogy létrejöjjön a rendelés

**Előnyök:**
- ✅ Azonnal működik
- ✅ Nincs szükség ShopRenter konfigurációra
- ✅ Tesztelheted a teljes workflow-t

---

### 2. Valós webhook tesztelés ShopRenter-rel

Ha valós webhook-ot szeretnél tesztelni egy ShopRenter webshopból:

#### Lépés 1: Szinkronizáld a connection mapping-et

A webhook handler-nek tudnia kell, hogy melyik tenant adatbázishoz tartozik egy adott ShopRenter connection. Ehhez szinkronizálni kell a `tenant_connection_mappings` táblát az admin adatbázisban.

**API endpoint**: `POST /api/admin/sync-connection-mappings`

Ez az endpoint:
- Lekéri az összes aktív tenant-ot
- Minden tenant-hoz lekéri a `webshop_connections` táblát
- Feltölti az admin adatbázis `tenant_connection_mappings` táblájába

**Futtatás:**
```bash
# Terminal-ben vagy Postman-ben
curl -X POST http://localhost:3000/api/admin/sync-connection-mappings \
  -H "Content-Type: application/json"
```

Vagy böngészőben: `http://localhost:3000/api/admin/sync-connection-mappings` (POST request)

#### Lépés 2: Állítsd be a webhook URL-t a ShopRenter-ben

Két módszer van a webhook beállítására:

##### Módszer A: ShopRenter Admin felületen (egyszerűbb)

1. **ShopRenter Admin felület** → **Automatizmusok** → **Webhook-ok**

2. **Új webhook létrehozása**:
   - **Event**: `order_confirm` (rendelés megerősítése)
   - **Status**: `1` (aktív)
   - **Label**: "ERP Order Webhook"
   - **Webhook URL**: 
     ```
     https://your-domain.com/api/webhooks/shoprenter
     ```
     Vagy localhost teszteléshez (ngrok vagy hasonló tunnel szükséges):
     ```
     https://your-ngrok-url.ngrok.io/api/webhooks/shoprenter
     ```

3. **Mentés**

##### Módszer B: API-n keresztül (programozott)

1. **API hozzáférés beszerzése**:
   - ShopRenter Admin → **Beállítások** → **Webshop beállítások** → **API beállítások**
   - Jegyezd fel az **API kulcsot** és **felhasználónevet**

2. **Webhook létrehozása API hívással**:
   
   **Endpoint**: `POST https://[shopnév].myshoprenter.hu/admin/api/webhooks`
   
   Vagy az API endpoint használatával:
   `POST http://[shopnév].api.myshoprenter.hu/webHooks`
   
   **Headers**:
   ```
   Accept: application/json
   Content-Type: application/json
   Authorization: Basic [base64(username:password)]
   ```
   
   **Request Body**:
   ```json
   {
     "event": "order_confirm",
     "status": "1",
     "label": "ERP Order Webhook",
     "webHookParameters": [
       {
         "type": "json",
         "url": "https://your-domain.com/api/webhooks/shoprenter"
       }
     ]
   }
   ```

3. **Válasz ellenőrzése**: A válasz tartalmazza a létrehozott webhook ID-ját és részleteit.

#### Lépés 3: Tesztelés

1. Menj a ShopRenter webshopba
2. Hozz létre egy **teszt rendelést** (teszt termék, teszt vásárló)
3. **Végezd el a rendelést**
4. A ShopRenter automatikusan küld egy webhook-ot az ERP endpoint-jára
5. Menj az ERP `/orders/buffer` oldalára
6. Kattints a **"Frissítés"** gombra (vagy várj pár másodpercet)
7. A rendelés megjelenik a bufferben

---

## Webhook URL formátum

### Production:
```
https://your-domain.com/api/webhooks/shoprenter
```

### Development (ngrok):
```
https://abc123.ngrok.io/api/webhooks/shoprenter
```

### Localhost (csak teszteléshez, nem működik valós webhook-okkal):
```
http://localhost:3000/api/webhooks/shoprenter
```

**Fontos**: A ShopRenter csak HTTPS URL-eket fogad el webhook-okhoz. Localhost teszteléshez használj **ngrok**-ot vagy hasonló tunnel szolgáltatást.

---

## Webhook endpoint működése

1. **Webhook érkezik** → `POST /api/webhooks/shoprenter`
2. **Payload elemzése** → Kinyeri a `storeName` vagy `api_url`-t
3. **Tenant azonosítás** → Keresi az admin adatbázisban a `tenant_connection_mappings` táblában
4. **Tenant adatbázis kapcsolat** → Kapcsolódik a megfelelő tenant Supabase adatbázisához
5. **Buffer mentés** → Beszúrja az `order_buffer` táblába `pending` státusszal
6. **Válasz** → 200 OK visszaadása a ShopRenter-nek

---

## Hibakeresés

### Webhook nem érkezik meg

1. **Ellenőrizd a ShopRenter webhook konfigurációt**:
   - Aktív-e a webhook?
   - Helyes-e az URL?
   - HTTPS-e az URL? (ShopRenter csak HTTPS-t fogad el)

2. **Ellenőrizd a connection mapping-et**:
   ```sql
   -- Admin adatbázisban
   SELECT * FROM tenant_connection_mappings;
   ```
   - Van-e bejegyzés a connection-ödhöz?
   - Helyes-e az `api_url`?

3. **Ellenőrizd a terminált**:
   - Nézd meg a Next.js terminált webhook érkezésekor
   - Keress `[WEBHOOK]` log üzeneteket

4. **Tesztelj a "Teszt rendelés" gombbal**:
   - Ha ez működik, a buffer rendszer rendben van
   - A probléma valószínűleg a webhook konfigurációban van

### Webhook érkezik, de nem jelenik meg

1. **Ellenőrizd a buffer oldalt**:
   - Kattints a **"Frissítés"** gombra
   - Ellenőrizd a státusz szűrőt (`pending` legyen kiválasztva)

2. **Ellenőrizd az adatbázist**:
   ```sql
   -- Tenant adatbázisban
   SELECT * FROM order_buffer 
   WHERE status = 'pending' 
   ORDER BY received_at DESC;
   ```

3. **Ellenőrizd a terminált**:
   - Nézd meg, hogy volt-e hiba a webhook feldolgozásakor

---

## ShopRenter Webhook API dokumentáció

A ShopRenter webhook API dokumentációja:
- `shop-portal/sr-api-docs-master/development/api/07_webhook.md`
- `shop-portal/sr-api-docs-master/api/webhook.md`

---

## Automatikus webhook beállítás

Az ERP **automatikusan** beállítja a webhook-ot a ShopRenter-ben, amikor:

1. ✅ **Új ShopRenter connection létrejön** és `is_active = true`
2. ✅ **Egy meglévő ShopRenter connection aktiválódik** (`is_active` false-ról true-ra változik)

### Environment változó beállítása

A webhook URL-t az environment változóból olvassa be. Állítsd be a `.env.local` fájlban:

```bash
NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.com/api/webhooks/shoprenter
```

**Fontos**: 
- Production-ben HTTPS URL-t használj (ShopRenter követelmény)
- Localhost teszteléshez használj ngrok-ot: `NEXT_PUBLIC_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/webhooks/shoprenter`

### Manuális webhook beállítás (ha szükséges)

Ha az automatikus beállítás nem működik, vagy manuálisan szeretnéd beállítani:

**Endpoint**: `POST /api/connections/[connection_id]/setup-webhook`

**Request Body**:
```json
{
  "webhook_url": "https://your-domain.com/api/webhooks/shoprenter"
}
```

**Példa használat**:
```bash
curl -X POST http://localhost:3000/api/connections/[connection-id]/setup-webhook \
  -H "Content-Type: application/json" \
  -d '{"webhook_url": "https://your-domain.com/api/webhooks/shoprenter"}'
```

**Webhook listázása**: `GET /api/connections/[connection_id]/setup-webhook`

### Webhook API dokumentáció

A ShopRenter webhook API hivatalos dokumentációja:
- **Endpoint**: `POST http://shopname.api.myshoprenter.hu/webHooks`
- **Dokumentáció**: https://doc.shoprenter.hu/api/webhook.html#properties
- **Event**: `order_confirm` (rendelés megerősítése)
- **Status**: `1` (aktív)

---

## Összefoglalás

**Gyors teszteléshez**: Használd a **"Teszt rendelés"** gombot a buffer oldalon.

**Valós webhook teszteléshez**:
1. **Állítsd be a webhook URL-t** (environment változó):
   ```bash
   NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.com/api/webhooks/shoprenter
   ```
2. **Hozz létre vagy aktiválj egy ShopRenter connection-t** az ERP-ben
   - A webhook **automatikusan** létrejön a ShopRenter-ben
3. **Szinkronizáld a connection mapping-et**: `POST /api/admin/sync-connection-mappings`
   - Body: `{ "tenant_id": "your-tenant-id" }`
4. **Hozz létre egy teszt rendelést** a webshopban
5. **A rendelés automatikusan megjelenik** a bufferben (`/orders/buffer`)

**Fontos**: 
- A "Frissítés" gomb **nem húzza le** a rendeléseket, csak frissíti a listát
- A rendelések automatikusan érkeznek webhook-ok formájában
- A webhook URL-nek **HTTPS**-nek kell lennie (ShopRenter követelmény)
- Localhost teszteléshez használj **ngrok**-ot vagy hasonló tunnel szolgáltatást
