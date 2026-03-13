# Localhost Webhook Tesztelési Útmutató

## Miért kell ngrok?

A ShopRenter **csak HTTPS URL-eket fogad el** webhook-okhoz. A `http://localhost:3000` nem működik, mert:
- ❌ HTTP, nem HTTPS
- ❌ Localhost nem elérhető külső rendszerekből

**Megoldás**: Használj **ngrok**-ot, ami egy HTTPS tunnel-t hoz létre a localhost-hoz.

---

## Lépésről lépésre

### 1. Telepítsd az ngrok-ot

**macOS (Homebrew):**
```bash
brew install ngrok
```

**Windows:**
- Töltsd le: https://ngrok.com/download
- Vagy: `choco install ngrok` (ha Chocolatey van)

**Linux:**
```bash
# Download and install
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
sudo apt update && sudo apt install ngrok
```

### 2. Regisztrálj az ngrok-ra (ingyenes)

1. Menj a https://ngrok.com oldalra
2. Regisztrálj egy ingyenes fiókot
3. Másold ki az **authtoken**-t a dashboard-ból

### 3. Konfiguráld az ngrok-ot

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 4. Indítsd el a Next.js szervert

```bash
cd shop-portal
npm run dev
```

A szerver fut a `http://localhost:3000` címen.

### 5. Indítsd el az ngrok tunnel-t

**Új terminál ablakban:**
```bash
ngrok http 3000
```

**Kimenet:**
```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        Europe (eu)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123-def456.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Fontos**: Másold ki a **Forwarding URL-t** (pl. `https://abc123-def456.ngrok-free.app`)

### 6. Állítsd be a `.env.local` fájlt

**Fájl helye**: `shop-portal/.env.local`

```env
# ... egyéb változók ...

# Webhook URL (ngrok URL + /api/webhooks/shoprenter)
NEXT_PUBLIC_WEBHOOK_URL=https://abc123-def456.ngrok-free.app/api/webhooks/shoprenter
```

**Fontos**: 
- Használd a **HTTPS** URL-t (nem HTTP-t)
- Add hozzá a `/api/webhooks/shoprenter` végződést

### 7. Indítsd újra a Next.js szervert

```bash
# Állítsd le (Ctrl+C)
# Majd indítsd újra:
cd shop-portal
npm run dev
```

### 8. Teszteld a webhook beállítást

1. Menj a `/connections` oldalra
2. Kattints a **"Webhook-ok beállítása"** gombra
3. A rendszer létrehozza a webhook-ot a ShopRenter-ben az ngrok URL-lel

### 9. Teszteld a webhook-ot

1. Hozz létre egy teszt rendelést a ShopRenter webshopban
2. Az ngrok web interface-en (`http://127.0.0.1:4040`) láthatod a beérkező webhook-okat
3. Az ERP `/orders/buffer` oldalán megjelenik a rendelés

---

## Ngrok Web Interface

Az ngrok egy web interface-t is indít: `http://127.0.0.1:4040`

Itt láthatod:
- ✅ Minden beérkező HTTP kérést
- ✅ Request/Response adatokat
- ✅ Webhook payload-okat
- ✅ Replay funkciót (újraküldés)

**Hasznos debugoláshoz!**

---

## Ngrok URL változás

**Fontos**: Az ingyenes ngrok URL **minden indításkor változik**!

Ha újraindítod az ngrok-ot:
1. Új URL-t kapsz (pl. `https://xyz789.ngrok-free.app`)
2. Frissítsd a `.env.local` fájlban: `NEXT_PUBLIC_WEBHOOK_URL`
3. Indítsd újra a Next.js szervert
4. Futtasd újra a "Webhook-ok beállítása" gombot

**Alternatíva**: Fizetős ngrok plan-nel fix domain-t kaphatsz.

---

## Teljes példa workflow

### Terminal 1 (Next.js):
```bash
cd shop-portal
npm run dev
# Fut: http://localhost:3000
```

### Terminal 2 (ngrok):
```bash
ngrok http 3000
# Forwarding: https://abc123.ngrok-free.app -> http://localhost:3000
```

### `.env.local`:
```env
NEXT_PUBLIC_WEBHOOK_URL=https://abc123.ngrok-free.app/api/webhooks/shoprenter
```

### Browser:
1. `http://localhost:3000/connections`
2. Kattints: **"Webhook-ok beállítása"**
3. ✅ Webhook létrehozva a ShopRenter-ben

### Tesztelés:
1. Hozz létre egy rendelést a ShopRenter webshopban
2. Nézd meg az ngrok web interface-t: `http://127.0.0.1:4040`
3. Nézd meg az ERP buffer oldalt: `http://localhost:3000/orders/buffer`

---

## Hibaelhárítás

### "ngrok: command not found"
- Telepítsd az ngrok-ot (lásd fent)
- Ellenőrizd, hogy a PATH-ban van-e: `which ngrok`

### "authtoken required"
- Regisztrálj az ngrok-ra: https://ngrok.com
- Add hozzá az authtoken-t: `ngrok config add-authtoken YOUR_TOKEN`

### "Webhook URL not configured"
- Ellenőrizd, hogy a `.env.local` fájl a `shop-portal` mappában van-e
- Ellenőrizd, hogy a változó neve pontosan `NEXT_PUBLIC_WEBHOOK_URL`
- Indítsd újra a Next.js szervert

### "Failed to create webhook in ShopRenter"
- Ellenőrizd, hogy HTTPS URL-t használsz-e (nem HTTP-t)
- Ellenőrizd, hogy a connection API credentials helyesek-e
- Nézd meg a terminal log-okat

### Ngrok URL változott
- Ha újraindítod az ngrok-ot, új URL-t kapsz
- Frissítsd a `.env.local` fájlban
- Indítsd újra a Next.js szervert
- Futtasd újra a "Webhook-ok beállítása" gombot

---

## Alternatív megoldások

### 1. **Localtunnel** (ingyenes, fix URL)
```bash
npm install -g localtunnel
lt --port 3000 --subdomain yourname
# URL: https://yourname.loca.lt
```

### 2. **Cloudflare Tunnel** (ingyenes, fix domain)
- Regisztrálj Cloudflare-re
- Telepítsd: `cloudflared tunnel --url http://localhost:3000`
- Fix domain-t kaphatsz

### 3. **Vercel Preview Deployment** (legjobb production-hoz közel)
- Push a git-be
- Vercel automatikusan létrehoz egy preview URL-t
- Használd ezt a webhook URL-ként

---

## Összefoglalás

1. ✅ Telepítsd az ngrok-ot: `brew install ngrok`
2. ✅ Regisztrálj: https://ngrok.com
3. ✅ Konfiguráld: `ngrok config add-authtoken YOUR_TOKEN`
4. ✅ Indítsd: `ngrok http 3000`
5. ✅ Másold ki az HTTPS URL-t
6. ✅ Add hozzá a `.env.local`-hoz: `NEXT_PUBLIC_WEBHOOK_URL=https://xxx.ngrok-free.app/api/webhooks/shoprenter`
7. ✅ Indítsd újra a Next.js szervert
8. ✅ Kattints a "Webhook-ok beállítása" gombra
9. ✅ Teszteld egy rendeléssel

**Kész!** 🎉
