# Shop Portal - Lépésről lépésre telepítési útmutató

## ✅ 1. lépés: Függőségek telepítése

```bash
cd shop-portal
npm install
```

## ✅ 2. lépés: Supabase projekt létrehozása

1. Menj a [Supabase Dashboard](https://app.supabase.com)-ra
2. Kattints a "New Project" gombra
3. Töltsd ki az adatokat:
   - **Name**: `shop-portal` (vagy bármilyen név)
   - **Database Password**: Jegyezd meg!
   - **Region**: Válaszd ki a legközelebbit
4. Várj, amíg a projekt létrejön (1-2 perc)

## ✅ 3. lépés: Supabase URL és Key másolása

1. A projekt dashboard-on menj a **Settings** → **API** menüpontra
2. Másold ki:
   - **Project URL** (pl. `https://xxxxx.supabase.co`)
   - **anon public** key (hosszú string)

## ✅ 4. lépés: Környezeti változók beállítása

1. Hozz létre egy `.env.local` fájlt a `shop-portal` mappában:
   ```bash
   touch .env.local
   ```

2. Nyisd meg a `.env.local` fájlt és add hozzá:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   (Cseréld ki a tényleges értékekre!)

## ✅ 5. lépés: Adatbázis beállítása (SQL futtatása)

1. Menj a Supabase Dashboard → **SQL Editor**
2. Kattints az **"New query"** gombra
3. Nyisd meg a `shop-portal/supabase/database-setup.sql` fájlt
4. Másold be az egész SQL kódot a SQL Editor-be
5. Kattints a **"Run"** gombra
6. Ellenőrizd, hogy nincs hibaüzenet

## ✅ 6. lépés: Felhasználó létrehozása

1. Menj a Supabase Dashboard → **Authentication** → **Users**
2. Kattints az **"Add user"** → **"Create new user"** gombra
3. Töltsd ki:
   - **Email**: pl. `admin@shop.turinova.hu`
   - **Password**: válassz egy erős jelszót
   - **Auto Confirm User**: ✅ (bejelölve)
4. Kattints a **"Create user"** gombra
5. **FONTOS**: Másold ki a **User UID**-t (UUID formátumú, pl. `123e4567-e89b-12d3-a456-426614174000`)

## ✅ 7. lépés: Jogosultságok beállítása

1. Menj vissza a **SQL Editor**-be
2. Futtasd le ezt az SQL-t (cseréld ki a `USER_ID`-t a 6. lépésben másolt User UID-re):

```sql
-- Adj hozzá jogosultságot a home oldalhoz
INSERT INTO user_permissions (user_id, page_id, can_access)
SELECT 
  'USER_ID'::uuid,  -- Cseréld ki a tényleges user ID-re!
  p.id,
  true
FROM pages p
WHERE p.path = '/home'
ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = true;
```

**Példa:**
```sql
INSERT INTO user_permissions (user_id, page_id, can_access)
SELECT 
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  p.id,
  true
FROM pages p
WHERE p.path = '/home'
ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = true;
```

3. Ellenőrizd, hogy sikeres volt:
   ```sql
   SELECT up.*, p.path, p.name 
   FROM user_permissions up
   JOIN pages p ON p.id = up.page_id;
   ```
   Ennek vissza kell adnia legalább 1 sort.

## ✅ 8. lépés: Fejlesztői szerver indítása

```bash
cd shop-portal
npm run dev
```

A szerver elindul és a következő üzenetet látod:
```
  ▲ Next.js 15.1.9
  - Local:        http://localhost:3000
```

## ✅ 9. lépés: Tesztelés

1. Nyisd meg a böngészőt: `http://localhost:3000`
2. Automatikusan a `/login` oldalra kell irányítania
3. Jelentkezz be a 6. lépésben létrehozott felhasználóval:
   - **Email**: pl. `admin@shop.turinova.hu`
   - **Password**: a beállított jelszó
4. Sikeres bejelentkezés után a `/home` oldalra kell irányítania
5. A home oldalon látnod kell: "Üdvözöljük a Shop Portal-ban!"

## ✅ 10. lépés: További oldalak hozzáadása (opcionális)

Ha új oldalt szeretnél hozzáadni:

1. **Hozz létre egy új oldalt** a `src/app/(dashboard)/` mappában
   Például: `src/app/(dashboard)/products/page.tsx`

2. **Add hozzá az adatbázishoz**:
   ```sql
   INSERT INTO pages (path, name, category) 
   VALUES ('/products', 'Termékek', 'Products');
   ```

3. **Adj jogosultságot**:
   ```sql
   INSERT INTO user_permissions (user_id, page_id, can_access)
   SELECT 'USER_ID'::uuid, p.id, true
   FROM pages p
   WHERE p.path = '/products';
   ```

## 🔧 Hibaelhárítás

### "Supabase not configured" hiba
- Ellenőrizd, hogy a `.env.local` fájl létezik és helyes értékeket tartalmaz
- Indítsd újra a dev szervert (`npm run dev`)

### "Permission denied" hiba
- Ellenőrizd, hogy a 7. lépésben helyesen adtad hozzá a jogosultságokat
- Futtasd le újra a jogosultság SQL-t

### "Cannot find module" hibák
- Futtasd le újra: `npm install`
- Töröld a `node_modules` mappát és a `.next` mappát, majd futtasd újra: `npm install`

### Login után nem irányít át
- Ellenőrizd a böngésző konzolt (F12) hibákért
- Ellenőrizd, hogy a middleware.ts fájl létezik és helyes

## 📝 Következő lépések

Most, hogy az alapvető autentikáció és jogosultságkezelés működik, folytathatod:

1. **ShopRenter API integráció** hozzáadása
2. **Termékek szinkronizálása** a ShopRenter-ből
3. **SEO generátor** funkció implementálása
4. **Dashboard** oldalak bővítése

## 🚀 Production deployment

Amikor készen állsz a production deployment-re:

1. **Build**:
   ```bash
   npm run build
   ```

2. **Deploy** (Vercel példa):
   ```bash
   vercel --prod
   ```

3. **Környezeti változók beállítása** a deployment platformon:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Domain konfigurálása**: `shop.turinova.hu` → deployment URL
