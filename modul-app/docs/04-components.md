# 04 — Kötelező komponensminták

Új UI-t **ne** ad-hoc `div`+Tailwind-dal oldj meg, ha van pattern. Először ezeket használd / bővítsd.

Hely: `src/components/patterns/` (shadcn primitives: `src/components/ui/`).

## 1. `PageHeader`

Minden listás / űrlapos oldal tetején.

```
[ H1 cím                    ] [ Primary gomb? ]
[ opcionális 1 sor hint     ]
```

- H1: 24px / 600
- Primary **jobbra**, max egy
- Secondary akciók a primary bal oldalán, secondary/ghost stílusban

## 2. `Button`

shadcn Button, Flat 2.0 variánsok:

`primary | secondary | ghost | danger`  
`sm (28) | md (32) | lg (36)` — default **md** (Linear light sűrűség).

Loading: `disabled` + spinner, szélesség fix (min-width vagy invisible szöveg placeholder).

## 3. `FormField`

Összeköt: Label + Control + Hint **vagy** Error.

```
Label *                    vagy  Label (opcionális)
[========== input ==========]
Hint / hiba (egyszerre csak az egyik)
```

API elv:

```ts
type FormFieldProps = {
  label: string
  required?: boolean
  optionalLabel?: boolean // mutatja: (opcionális)
  hint?: string
  error?: string
  htmlFor: string
  children: React.ReactNode
}
```

## 4. `StatusBadge`

`tone`: `active | success | warning | danger | info | neutral`  
`variant`: `soft` (default) | `solid` | `outline`

| Variáns | Mikor |
|---|---|
| `solid` | Fizetve / Fizetetlen / kritikus glance — max 1–2 / képernyő |
| `soft` | Listasor státusz |
| `outline` | Meta (raktár, SKU, csatorna, díj) — keret + sötét szöveg, nem pasztell |

Mindig van **szöveges** label (pl. „Aktív”, „Függőben”). Tokenek: `src/lib/tokens.css`.

## 5. `DataTable`

ERP magkomponens. Kötelező képességek:

| Képesség | Követelmény |
|---|---|
| Sticky header | igen |
| Látható sorakciók | Szerkeszt / Töröl (vagy domain szerinti), nem kebab |
| Pagination | számozott + `X / Y elem` |
| Empty | ikon + mondat + primary CTA |
| Loading | skeleton rows |
| Selection | checkbox + bulk bar |
| Column priority | max 7–8 látható; többi picker |
| Numbers | `tabular-nums`, jobbra |

Alatt: TanStack Table. Virtual: csak ha egy nézetben sok DOM sor kell (általában **lapozás elég**).

## 6. `ConfirmDialog`

- Max szélesség ~560px
- Cím = következmény
- Primary / Danger gomb felirata = ige (Törlés), nem Igen
- Esc zár; destruktív dialógusban a default fókusz a biztonságos `Mégse` gombon van

## 7. `EmptyState`

```
[ikon]
Cím / egy mondat
[Primary CTA]
```

## 8. `Toast`

Egy pozíció az egész appban: **jobb alul**.  
Siker: 4–5 mp. Hiba: manuális zárás. Undo: 8 mp ahol releváns.

## 9. `AppShell`

- Sidebar 240–260px, ikon+szöveg
- Aktív: 3px sáv + subtle + bold
- Topbar: breadcrumb, search, user
- Content: Flat bg-app

## 10. shadcn primitives — mit szabjunk

| Primitive | Flat 2.0 igazítás |
|---|---|
| Button | 4 variáns, nincs uppercase, elev hover |
| Input | mindig border, h-11, focus ring primary |
| Select | natív viselkedés / Radix + keresés 10+ opciónál |
| Dialog | elev-3, radius 8 |
| Table | saját DataTable-re építünk, ne nyers shadcn table alone |
| Badge | StatusBadge soft / solid / outline |
| Checkbox | min 20×20, label kattintható |

## Ne találj ki újat

Új „kártya a kártyában”, új radius (12/16), új gombvariáns (gradient, soft-primary-outline-…) → **PR blokkoló**, hacsak a docs nem frissül előbb.

## Referencia elsőbbség

Ha egy szabályt nehéz értelmezni pusztán szövegből, a jövőbeli referencia-lista és referencia-űrlap lesz az etalon. Addig a `16-reference-screen.md` szerkezetét kell követni.
