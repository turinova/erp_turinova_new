# Production Webhook Beállítási Útmutató

## 🎯 Miért production?

✅ **Fix HTTPS URL** - nem változik  
✅ **Nincs ngrok** - nem kell tunnel  
✅ **Egyszerűbb** - csak beállítod és kész  
✅ **Valós tesztelés** - production környezetben

---

## 📋 Lépések

### 1. Határozd meg a production URL-t

A `shop-portal` production URL-je lehet:
- `https://erp.turinova.hu` (ha van dedikált subdomain)
- `https://shop.turinova.hu` (ha van dedikált subdomain)
- `https://your-project.vercel.app` (Vercel default URL)

**Példa**: Ha a production URL `https://erp.turinova.hu`, akkor a webhook URL:
```
https://erp.turinova.hu/api/webhooks/shoprenter
```

---

### 2. Vercel Environment Variables beállítása

#### A. Menj a Vercel Dashboard-ra

1. Nyisd meg: https://vercel.com/dashboard
2. Válaszd ki a **shop-portal** projektet
3. Menj a **Settings** → **Environment Variables** menüpontra

#### B. Add hozzá a webhook URL-t

**Name:**
```
NEXT_PUBLIC_WEBHOOK_URL
```

**Value:**
```
https://erp.turinova.hu/api/webhooks/shoprenter
```
*(Cseréld ki a saját domain-re!)*

**Environment:**
- ✅ **Production** (kötelező)
- ✅ **Preview** (opcionális, ha preview környezetben is tesztelsz)
- ❌ **Development** (nem kell, ott localhost van)

#### C. Mentsd el

Kattints a **Save** gombra.

---

### 3. Redeploy a projektet

A Vercel **automatikusan újra deploy-ol**, amikor hozzáadsz egy új environment változót, DE ha nem történik meg:

1. Menj a **Deployments** fülre
2. Kattints a legutóbbi deployment-re
3. Kattints a **...** menüre
4. Válaszd a **Redeploy** opciót

**Vagy** push-olj egy új commit-ot:
```bash
git commit --allow-empty -m "Trigger redeploy for webhook URL"
git push origin main
```

---

### 4. Ellenőrzés

#### A. Vercel Log-okban

1. Menj a **Deployments** fülre
2. Kattints a legutóbbi deployment-re
3. Nézd meg a **Build Logs**-ot
4. Keress rá: `NEXT_PUBLIC_WEBHOOK_URL`

Látnod kellene valami ilyesmit:
```
> Build environment variables:
  NEXT_PUBLIC_WEBHOOK_URL=https://erp.turinova.hu/api/webhooks/shoprenter
```

#### B. Browser Console-ban

1. Nyisd meg a production oldalt: `https://erp.turinova.hu`
2. Nyisd meg a **Developer Tools** (F12)
3. Menj a **Console** fülre
4. Írd be:
```javascript
console.log(process.env.NEXT_PUBLIC_WEBHOOK_URL)
```

**Fontos**: Ez csak akkor működik, ha a változó build-time-ban be van töltve. Ha `undefined`-ot látsz, akkor a build után adtad hozzá, és újra kell deploy-olni.

#### C. API Route-ban

Létrehozhatsz egy teszt endpoint-ot:

**Fájl**: `shop-portal/src/app/api/test-webhook-url/route.ts`
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    webhookUrl: process.env.NEXT_PUBLIC_WEBHOOK_URL || 'NOT SET'
  })
}
```

Majd nyisd meg: `https://erp.turinova.hu/api/test-webhook-url`

---

### 5. Webhook beállítása ShopRenter-ben

#### A. Automatikus beállítás (ajánlott)

1. Menj a production ERP-re: `https://erp.turinova.hu/connections`
2. Kattints a **"Webhook-ok beállítása"** gombra
3. A rendszer automatikusan létrehozza a webhook-ot a ShopRenter-ben

#### B. Manuális ellenőrzés

1. Menj a ShopRenter Admin API-hoz:
   ```
   GET https://shopname.api.myshoprenter.hu/webHooks
   ```
2. Ellenőrizd, hogy a webhook URL helyes-e:
   ```json
   {
     "url": "https://erp.turinova.hu/api/webhooks/shoprenter",
     "event": "order.create"
   }
   ```

---

### 6. Tesztelés

#### A. Hozz létre egy teszt rendelést

1. Menj a ShopRenter webshopba
2. Add a kosárhoz egy terméket
3. Végezd el a checkout-ot
4. A rendelés automatikusan megjelenik az ERP-ben

#### B. Ellenőrizd az ERP-ben

1. Menj a production ERP-re: `https://erp.turinova.hu/orders/buffer`
2. Látnod kellene az új rendelést a buffer-ben
3. Kattints rá, hogy megnézd a részleteket

#### C. Vercel Function Logs

1. Menj a Vercel Dashboard-ra
2. **Deployments** → Legutóbbi deployment
3. **Functions** → `/api/webhooks/shoprenter`
4. Nézd meg a **Logs**-ot

Látnod kellene valami ilyesmit:
```
[WEBHOOK] Received webhook from ShopRenter
[WEBHOOK] Store: shopname
[WEBHOOK] Event: order.create
[WEBHOOK] Stored in buffer: abc-123-def-456
```

---

## 🔍 Hibaelhárítás

### "Webhook URL not configured" hiba

**Ok**: A `NEXT_PUBLIC_WEBHOOK_URL` nincs beállítva Vercel-en.

**Megoldás**:
1. Ellenőrizd a Vercel Environment Variables-t
2. Győződj meg róla, hogy a **Production** environment-ben van
3. Redeploy a projektet

---

### Webhook nem érkezik meg

**Ok 1**: A webhook URL rossz a ShopRenter-ben.

**Megoldás**:
1. Futtasd újra a "Webhook-ok beállítása" gombot
2. Ellenőrizd a ShopRenter API-ban: `GET /webHooks`

**Ok 2**: A Vercel Function timeout-ol.

**Megoldás**:
1. Nézd meg a Vercel Function Logs-ot
2. Ha timeout van, növeld a function timeout-ot (Vercel Pro plan szükséges)

**Ok 3**: A webhook endpoint hibát dob.

**Megoldás**:
1. Nézd meg a Vercel Function Logs-ot
2. Keress rá a hibaüzenetre
3. Javítsd a hibát

---

### "Failed to create webhook" hiba

**Ok**: A ShopRenter API credentials rosszak, vagy a connection inaktív.

**Megoldás**:
1. Ellenőrizd a connection API credentials-ét
2. Ellenőrizd, hogy a connection aktív-e
3. Próbáld meg manuálisan létrehozni a webhook-ot a ShopRenter API-ban

---

## ✅ Ellenőrző lista

- [ ] A production URL megvan (pl. `https://erp.turinova.hu`)
- [ ] A `NEXT_PUBLIC_WEBHOOK_URL` be van állítva Vercel-en
- [ ] A változó a **Production** environment-ben van
- [ ] A projekt újra deploy-olva lett
- [ ] A webhook URL helyes formátumú: `https://domain.com/api/webhooks/shoprenter`
- [ ] A "Webhook-ok beállítása" gomb sikeresen lefutott
- [ ] A ShopRenter API-ban látható a webhook
- [ ] Teszt rendelés létrehozva
- [ ] A rendelés megjelenik az ERP buffer-ben

---

## 🎉 Kész!

Ha minden lépést követettél, a webhook-ok automatikusan működni fognak production-ban!

**Következő lépés**: Teszteld egy valós rendeléssel a ShopRenter webshopban.
