# Shop Portal

Webshop kezelő portál a `shop.turinova.hu` domain alatt.

## Lépésről lépésre telepítés

### 1. Függőségek telepítése

```bash
cd shop-portal
npm install
```

### 2. Supabase projekt létrehozása

1. Menj a [Supabase Dashboard](https://app.supabase.com)-ra
2. Hozz létre egy új projektet (pl. "shop-portal")
3. Jegyezd meg a projekt URL-t és az anon key-t

### 3. Adatbázis beállítása

1. Nyisd meg a Supabase SQL Editor-t
2. Másold be és futtasd le a `supabase/database-setup.sql` fájl tartalmát
3. Ez létrehozza a szükséges táblákat és funkciókat

### 4. Környezeti változók beállítása

1. Másold a `.env.local.example` fájlt `.env.local` névre:
   ```bash
   cp .env.local.example .env.local
   ```

2. Nyisd meg a `.env.local` fájlt és töltsd ki:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_shop_portal_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_shop_portal_anon_key
   ```

### 5. Felhasználó létrehozása

1. Menj a Supabase Dashboard → Authentication → Users
2. Kattints az "Add user" gombra
3. Add meg az emailt és jelszót
4. Jegyezd meg a user ID-t (UUID)

### 6. Jogosultságok beállítása

Futtasd le ezt az SQL-t a Supabase SQL Editor-ben (cseréld ki a `USER_ID`-t a tényleges user ID-re):

```sql
-- Adj hozzá jogosultságot a home oldalhoz
INSERT INTO user_permissions (user_id, page_id, can_access)
SELECT 
  'USER_ID'::uuid,  -- Cseréld ki a tényleges user ID-re
  p.id,
  true
FROM pages p
WHERE p.path = '/home'
ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = true;
```

### 7. Fejlesztői szerver indítása

```bash
npm run dev
```

A szerver a `http://localhost:3000` címen lesz elérhető.

### 8. Tesztelés

1. Nyisd meg a böngészőt: `http://localhost:3000`
2. Be kell irányítania a `/login` oldalra
3. Jelentkezz be a létrehozott felhasználóval
4. Sikeres bejelentkezés után a `/home` oldalra kell irányítania

## Projekt struktúra

```
shop-portal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (blank-layout-pages)/  # Publikus oldalak (login)
│   │   ├── (dashboard)/           # Védett oldalak
│   │   └── layout.tsx            # Root layout
│   ├── contexts/                 # React Context providers
│   │   ├── AuthContext.tsx      # Authentication context
│   │   └── PermissionContext.tsx # Permission context
│   ├── lib/                      # Utility functions
│   │   ├── supabase.ts          # Client-side Supabase
│   │   ├── supabase-server.ts   # Server-side Supabase
│   │   ├── permissions.ts       # Permission utilities
│   │   ├── permissions-server.ts # Server-side permissions
│   │   └── auth-redirect.ts     # Auth redirect utilities
│   ├── components/              # React components
│   │   └── Providers.tsx        # Context providers wrapper
│   └── views/                    # Page views
│       └── Login.tsx            # Login page component
├── supabase/
│   └── database-setup.sql       # Database setup SQL
├── package.json
├── tsconfig.json
└── README.md
```

## További oldalak hozzáadása

1. Hozz létre egy új oldalt a `src/app/(dashboard)/` mappában
2. Add hozzá a `pages` táblához az SQL Editor-ben:
   ```sql
   INSERT INTO pages (path, name, category) 
   VALUES ('/your-page', 'Your Page Name', 'Category');
   ```
3. Adj jogosultságot a felhasználóknak:
   ```sql
   INSERT INTO user_permissions (user_id, page_id, can_access)
   SELECT 'USER_ID'::uuid, p.id, true
   FROM pages p
   WHERE p.path = '/your-page';
   ```

## Production deployment

A `shop.turinova.hu` domain alatt történő telepítéshez:

1. Build:
   ```bash
   npm run build
   ```

2. Állítsd be a környezeti változókat a deployment platformon (Vercel, etc.)

3. Konfiguráld a domain-t a deployment platform beállításaiban
