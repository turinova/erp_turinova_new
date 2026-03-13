# Webhook URL Beállítási Útmutató

## Hol kell beállítani?

A `NEXT_PUBLIC_WEBHOOK_URL` environment változót a **`shop-portal/.env.local`** fájlban kell beállítani.

## Fájl helye

```
shop-portal/
├── .env.local          ← ITT kell lennie!
├── package.json
├── src/
└── ...
```

## Beállítás

### 1. Hozd létre vagy nyisd meg a `.env.local` fájlt

```bash
cd shop-portal
nano .env.local
# vagy
code .env.local
```

### 2. Add hozzá a webhook URL-t

**Production (valós domain):**
```env
NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.com/api/webhooks/shoprenter
```

**Development (localhost teszteléshez ngrok-kal):**
```env
NEXT_PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/shoprenter
```

**Példa:**
```env
# Ha a domain: erp.turinova.hu
NEXT_PUBLIC_WEBHOOK_URL=https://erp.turinova.hu/api/webhooks/shoprenter
```

### 3. Indítsd újra a Next.js szervert

A `.env.local` fájl csak akkor töltődik be, amikor a Next.js szerver elindul.

```bash
# Állítsd le a szervert (Ctrl+C)
# Majd indítsd újra:
cd shop-portal
npm run dev
```

## Fontos megjegyzések

1. **HTTPS kötelező**: A ShopRenter csak HTTPS URL-eket fogad el webhook-okhoz
2. **Localhost nem működik**: Localhost teszteléshez használj **ngrok**-ot vagy hasonló tunnel szolgáltatást
3. **NEXT_PUBLIC_ prefix**: A `NEXT_PUBLIC_` prefix **kötelező**, hogy a változó elérhető legyen a kliens oldalon is

## Ngrok használata (Development)

Ha localhost-on tesztelsz:

1. **Telepítsd az ngrok-ot**:
   ```bash
   brew install ngrok  # macOS
   # vagy
   npm install -g ngrok
   ```

2. **Indítsd el az ngrok tunnel-t**:
   ```bash
   ngrok http 3000
   ```

3. **Másold ki a HTTPS URL-t** (pl. `https://abc123.ngrok.io`)

4. **Add hozzá a `.env.local` fájlhoz**:
   ```env
   NEXT_PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/shoprenter
   ```

5. **Indítsd újra a Next.js szervert**

## Vercel Production beállítás

Ha Vercel-en van a production környezet:

1. Menj a Vercel projekt beállításokhoz
2. **Settings** → **Environment Variables**
3. Add hozzá:
   - **Name**: `NEXT_PUBLIC_WEBHOOK_URL`
   - **Value**: `https://your-domain.com/api/webhooks/shoprenter`
   - **Environment**: Production (és Preview/Development, ha szükséges)

4. **Redeploy** a projektet, hogy az új változó érvénybe lépjen

## Ellenőrzés

A webhook URL beállítását a következőképpen ellenőrizheted:

1. **Terminal log**: Amikor létrehozol egy connection-t, a terminal-ban látnod kellene:
   ```
   [WEBHOOK SETUP] Creating webhook for connection...
   ```

2. **Hibaüzenet**: Ha nincs beállítva, a "Webhook-ok beállítása" gomb hibát fog mutatni:
   ```
   Webhook URL not configured. Set NEXT_PUBLIC_WEBHOOK_URL environment variable.
   ```

3. **ShopRenter API**: A webhook létrehozása után ellenőrizheted a ShopRenter API-ban:
   ```bash
   GET http://shopname.api.myshoprenter.hu/webHooks
   ```

## Teljes .env.local példa

```env
# Tenant Database
NEXT_PUBLIC_SUPABASE_URL=https://your-tenant-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-tenant-anon-key

# Admin Database
ADMIN_SUPABASE_URL=https://your-admin-project.supabase.co
ADMIN_SUPABASE_SERVICE_ROLE_KEY=your-admin-service-role-key

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Webhook URL (ShopRenter order webhooks)
NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.com/api/webhooks/shoprenter

# AI Features (optional)
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Hibaelhárítás

### "Webhook URL not configured" hiba

1. Ellenőrizd, hogy a `.env.local` fájl a `shop-portal` mappában van-e
2. Ellenőrizd, hogy a változó neve pontosan `NEXT_PUBLIC_WEBHOOK_URL` (nagybetű, aláhúzás)
3. Indítsd újra a Next.js szervert
4. Ellenőrizd a fájl tartalmát: `cat shop-portal/.env.local | grep WEBHOOK`

### Webhook létrehozás sikertelen

1. Ellenőrizd, hogy HTTPS URL-t használsz-e (ShopRenter követelmény)
2. Ellenőrizd, hogy a connection API credentials helyesek-e
3. Nézd meg a terminal log-okat a részletes hibaüzenetért
