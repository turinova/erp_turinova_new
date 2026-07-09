# Építő Ártükör — Admin

Építőipari tétel-adatbázis kezelő (MVP, mock adatokkal).

Adatmodell a BauGenerál / Hyundai Excel ártükör mintájára (saját adatbázis, nincs külső norma-rendszer integráció):
- **Tételszám** (`identifier`) — pl. `71-000-K`, `BURK-1000`, vagy ajánlatban `K-tétel`
- **Tétel szövege** (`text`) — teljes leírás, ahogy az ajánlatban
- **Szakág** (`trade`) — építőmester, nyílászáró, gépészet, elektromos, riasztó
- **Anyag egységár** + **Díj egységre** — két ármező (mint az Excelben)

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Mock adat + localStorage (nincs Supabase még)

## Fejlesztés

```bash
cd epito-artukor/site
npm install
npm run dev
```

App: http://localhost:3010

## Menüpontok

- `/alvalalkozok` — alvállalkozó partner törzs (elérhetőség, referenciák, RFQ történet)
- `/alvalalkozok/[id]` — partner részletek
- `/projektek` — projektek, árajánlatok, alvállalkozói bekérések
- `/projektek/[id]/ajanlat/[quoteId]` — árajánlat szerkesztő (szakág / sorszámos nézet)
- `/rfq/[token]` — nyilvános alvállalkozói beküldő (PIN kóddal)
- `/tetelek` — tétel lista, szakág szűrő, drawer szerkesztés
- `/kategoriak` — kategória fa CRUD (szakágonként)
- `/mertekegysegek` — referencia ME lista (klt, m2, db…)
- `/import` — CSV import → localStorage

## Billentyűparancsok (Tételek)

- `/` — keresés fókusz
- `n` — új tétel
- `⌘S` — mentés (drawerben)

## Branch

Fejlesztés: `feature/epito-artukor-admin` (nem main)
