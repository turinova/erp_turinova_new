# Environment Variables Setup - Hibaelhárítás

## Hiba: "Your project's URL and Key are required"

Ez a hiba akkor jelentkezik, amikor a Next.js nem találja a Supabase környezeti változókat.

## Megoldás lépései:

### 1. Ellenőrizd a .env.local fájl helyét

A `.env.local` fájlnak **közvetlenül a `shop-portal` mappában** kell lennie:

```
shop-portal/
├── .env.local          ← ITT kell lennie!
├── package.json
├── src/
└── ...
```

**NEM** a `src/` mappában, hanem a projekt gyökerében!

### 2. Ellenőrizd a .env.local fájl formátumát

A fájlnak így kell kinéznie (nincs szóköz az `=` jel körül):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**FONTOS:**
- Nincs szóköz az `=` jel körül
- Nincs idézőjel az értékek körül
- Mindkét változó megvan
- A `NEXT_PUBLIC_` prefix megvan mindkettőnél

### 3. Állítsd le és indítsd újra a dev szervert

A `.env.local` fájl csak akkor töltődik be, amikor a Next.js szerver elindul.

```bash
# Állítsd le a szervert (Ctrl+C)
# Majd indítsd újra:
cd shop-portal
npm run dev
```

### 4. Ellenőrizd, hogy a változók be vannak-e töltve

A middleware most már kiírja a konzolra, ha hiányoznak a változók. Nézd meg a terminált, amikor elindítod a szervert.

### 5. Ha még mindig nem működik

**Opció A: Ellenőrizd a fájl nevét**
```bash
cd shop-portal
ls -la | grep env
```
Látnod kellene: `.env.local`

**Opció B: Hozd létre újra a fájlt**
```bash
cd shop-portal
rm .env.local  # Ha létezik
touch .env.local
# Majd nyisd meg és add hozzá a változókat
```

**Opció C: Ellenőrizd a fájl tartalmát**
```bash
cd shop-portal
cat .env.local
```

Látnod kellene valami ilyesmit:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Ha még mindig nem működik - Next.js cache törlése

```bash
cd shop-portal
rm -rf .next
npm run dev
```

## Gyors ellenőrző lista:

- [ ] A `.env.local` fájl a `shop-portal/` mappában van (nem a `src/`-ben)
- [ ] A fájl neve pontosan `.env.local` (nem `.env.local.txt` vagy más)
- [ ] Mindkét változó megvan: `NEXT_PUBLIC_SUPABASE_URL` és `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Nincs szóköz az `=` jel körül
- [ ] A dev szervert újraindítottad a `.env.local` létrehozása után
- [ ] A Supabase URL és Key értékei helyesek

## Példa helyes .env.local fájl:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890
```

**NEM így:**
```env
# ❌ ROSSZ - szóközök az = körül
NEXT_PUBLIC_SUPABASE_URL = https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...

# ❌ ROSSZ - idézőjelek
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# ❌ ROSSZ - hiányzik a NEXT_PUBLIC_ prefix
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
```
