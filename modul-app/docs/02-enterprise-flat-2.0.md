# 02 — Enterprise Flat 2.0 (teljes stílusspecifikáció)

Ez a modul-app **vizuális forrásigazsága**. Amit itt nincs tokenként, azt **ne építsd meg**.

## 1. Stílus definíciója

- Lapos alapfelület (nincs textúra, gradiens-játék, skeuomorf díszítés).
- Minden interaktív elemnek explicit jelölője van: kitöltés, keret, vagy finom árnyék.
- Mélység = információ, nem dekoráció. Ami feljebb van (árnyékosabb), az interaktív vagy magasabb prioritású réteg.
- Vizuális zaj minimalizálva, funkcionális jelzések maximalizálva.
- Referencia: Linear **light** (sűrűség), Midday shell-ritmus, Stripe empty state — **megjelenés**, nem lib / nem AGPL kódmásolat.
- **Primer north star:** `18-midday-visual-reference.md` (Linear light + Midday ritmus, saját kód, license fee nélkül).
- Flat 2.0 továbbra is: egy primary, tiltott glow/glass, tokenek `src/lib/tokens.css`.

## 2. Színrendszer

### Semleges (a felület ~90%-a)

| Token | Érték | Használat |
|---|---|---|
| `--bg-app` | `#F4F4F5` | Alkalmazás háttér |
| `--bg-surface` | `#FFFFFF` | Kártya, tábla, modal |
| `--bg-subtle` | `#EEEFF2` | Fejléc, disabled, hover sor |
| `--border` | `#D4D4D8` | Kártya / mező keret |
| `--border-strong` | `#A1A1AA` | Input, hangsúlyos elválasztó |
| `--text-primary` | `#09090B` | Fő szöveg (soha `#000`) |
| `--text-secondary` | `#3F3F46` | Segéd, oszlopfejléc |
| `--text-disabled` | `#A1A1AA` | Inaktív |
| `--text-muted` | `#71717A` | Hint |

### Szemantikus (fő / soft háttér / ink)

| Jelentés | Fő (solid) | Soft háttér | Ink |
|---|---|---|---|
| Primary (Midday charcoal) | `#18181B` | `#F4F4F5` | `#18181B` |
| Success | `#16A34A` | `#DCFCE7` | `#14532D` |
| Warning | `#EA580C` | `#FFEDD5` | `#9A3412` |
| Danger | `#DC2626` | `#FEE2E2` | `#7F1D1D` |
| Info | `#2563EB` | `#DBEAFE` | `#1E3A8A` |
| Neutral / meta | — | `#EEEFF2` / outline | `#09090B` |

**Chip hierarchia (kötelező):**

| Variáns | Használat |
|---|---|
| `solid` | Glance státusz: Fizetve / Fizetetlen / Élő / kritikus hiba — max 1–2 / képernyő |
| `soft` | Listasor státusz, másodlagos |
| `outline` | Meta: raktár, SKU, csatorna, díj, fizetési mód neve — **nem** soft pasztell |

**Szabályok:**

- Pontosan **egy** primary: **charcoal** (`#18181B`) — CTA, focus, kijelölés. **Nincs** kék brand.
- Nav **monokróm** (slate) — tilos modulonkénti hue.
- Meta = **outline**, nem success/info színjáték.
- Szín soha nem az egyetlen információhordozó.
- Telített (`solid`) szín csak státuszra. Nagy felületek nem színesek.
- Sötét mód: opcionális, későbbi. Ha jön: külön tokenkészlet (ne invertálj).

## 3. Elevation

```css
--elev-0: none;
--elev-1: 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10);
--elev-2: 0 4px 8px -2px rgba(16, 24, 40, 0.10), 0 2px 4px -2px rgba(16, 24, 40, 0.06);
--elev-3: 0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03);
```

- Hideg szürke-kék árnyék, sosem tiszta fekete `rgba(0,0,0,.5)`.
- Kártya: elev-1 **vagy** 1px keret. Mindkettő csak ha kattintható.
- Hoverre elev +1, ha kattintható.

## 4. Keret és lekerekítés

| Elem | Radius |
|---|---|
| Input / gomb / badge | `6px` |
| Kártya / modal | `8px` |
| Chip / tag | `4px` |
| Avatar | `50%` |

- Keretvastagság alap: `1px`. Fókusz: `2px` vagy `1px` + `3px` offset ring.
- Minden input/select **látható kerettel** alapállapotban.
- Tilos: Material underline-only; keret nélküli, csak hoverre látszó mező.

## 5. Tipográfia

- Család: **Inter** vagy rendszerstack / IBM Plex Sans / Public Sans. **Egy** család.
- Adminban max. **2 súly: 400 és 600**.
- Alap: **13.5–14px** body (Linear light sűrűség — `18`). Régi „15–16px comfortable” helyett a **tokenek** az igazság.
- Adminban max. **2 súly: 400 és 600**.

| Szerep | Méret | Súly | Sortáv |
|---|---|---|---|
| H1 oldalcím | 18–20px | 600 | 1.3 |
| H2 szekció | 15px | 600 | 1.35 |
| H3 kártya | 13.5px | 600 | 1.4 |
| Body / cella | 13.5–14px | 400 | 1.45 |
| Label | 12.5px | 500 | 1.35 |
| Hint | 12px | 400 | 1.4 |

- Számoknál kötelező: `font-variant-numeric: tabular-nums`.
- Nincs `text-transform: uppercase` gombokon.
- Szövegblokk max. ~75 karakter / sor.

## 6. Térköz és sűrűség

- 4px rács. Engedélyezett: **4 / 8 / 12 / 16 / 24 / 32 / 40 / 48**. Semmi 7, 15, 22.
- Density:
- Comfortable (default / Linear light): sor ~40px, input **32px**, gomb default **md**
- Compact (power): sor 32px, input 28px
- Kártya padding: **16px** (nem 24). Gap: 12–16px.
- Űrlap max. szélesség: **640px**. Tábla: teljes szélesség.

## 7. Gombok — pontosan 4 variáns

| Variáns | Kinézet | Használat |
|---|---|---|
| Primary | Kitöltött primary, fehér szöveg | **Képernyőnként egy** |
| Secondary | Fehér + border-strong + sötét szöveg | Egyéb akciók |
| Ghost | Csak szöveg, hoverre subtle háttér | Sorakció, tömeges |
| Danger | Piros kitöltés vagy piros keret+szöveg | Törlés / visszavonás |

Méretek: small 32 / medium 40 / **large 44 (default célközönségnél)**.

Állapotok kötelezők: hover, active, focus-visible (ring), disabled (≥0.5 opacity), loading (spinner, szélesség nem ugrik).

Gombsorrend: primary **jobbra** modalban és űrlap alján is. Ez zárolt döntés az egész appban.

## 8. Űrlap

- Egyhasábos. Kéthasáb csak logikai párnál (irányítószám + város).
- Label **felett**, balra. Floating label / placeholder-as-label **tilos**.
- Placeholder csak példa: `pl. 2510`.
- Input: 44px, padding 12px, 15px font (16px mobilon).
- Kötelező: piros `*` **és** az opcionálisaknál `(opcionális)`.
- Hiba a mező alatt, konkrétan. Hintet a hiba **felváltja**.
- Validáció: először on blur, utána on change.
- Dátum: gépelhető szöveg is; formátum `2026.09.09.`; hint mutatja.
- Nem mentett változás: figyelmeztetés navigációkor.

## 9. Táblázat / adatrács (ERP mag)

- Fejléc: `bg-subtle`, 13–14px, 600, `text-secondary`, sticky.
- Sorelválasztó 1px. Nincs zebrázás + hover együtt.
- Sor hover: `bg-subtle`. Pointer ha kattintható.
- **Sorakciók mindig láthatók** (Szerkeszt / Töröl) — nem kebab, nem hover-only.
- Szám jobbra, szöveg/dátum balra. Pénznem az oszlopfejlécben.
- Max. 7–8 látható oszlop; többi oszlopválasztóba.
- Lapozás: számozott + `X / Y elem`. Végtelen scroll **tilos**.
- Üres: ikon + mondat + primary CTA.
- Betöltés: skeleton sorok.
- Kijelölés: checkbox + bulk akciósáv felül.

## 10. Navigáció

- Bal sidebar fix, **240–260px**. Desktopon nincs hamburger.
- Menüpont = **ikon + szöveg** mindig. Összecsukva: tooltip.
- Max. ~7±2 főelem. Egy szint almenü.
- Aktív: 3px bal sáv + subtle háttér + vastagabb szöveg (**három jel együtt**).
- Topbar 56–64px: breadcrumb (2+ szint), kereső, user menü.
- Oldalfejléc: H1 balra, primary jobbra — **minden oldalon ugyanott**.
- URL tükrözze az állapotot (szűrő, page).

## 11–15. Kártya, ikon, feedback, mozgás, a11y

- Kártya: fehér, 8px, keret vagy elev-1, 20–24px padding. Nincs kártya-a-kártyában → `bg-subtle` blokk.
- Ikon: Lucide outline, 16 / 20 / 24. Szöveg mellett; ikon-only csak X / keresés / ismert sorakció + aria-label + tooltip.
- Toast: **jobb alul**. Siker 4–5 mp; hiba nem auto-dismiss.
- Modal max 560px; cím = következmény.
- Mozgás: 150 / 200 / 250–300 ms; `cubic-bezier(0.2,0,0,1)` be. Nincs bounce, parallax. `prefers-reduced-motion`.
- Kontraszt: szöveg 4.5:1; UI 3:1. Célterület 40–44px. Látható fókusz. Teljes billentyűzet.

## 16. Tiltólista

- Láthatatlan / text-only primary
- Hover-only sorakció
- Placeholder mint címke
- Csak ikonos nav
- Gradiens gomb, üveg, neumorf, glow
- 13px alatti szöveg (kivéve jogi lábjegyzet)
- >1 primary / képernyő
- Szín-only státusz
- Egyedi date/select natív fallback nélkül
- Végtelen scroll
- Kebab mint egyetlen út gyakori akcióhoz

## 17. Token budget (~50)

8 semleges + 5×3 szemantikus + 4 elevation + 3 radius + 7 térköz + 7 szövegstílus + 3 magasság.  
**Ami nem fér bele, azt nem építjük.**

## Tailwind mapping (iránymutatás)

```js
// tailwind theme.extend.colors (példa)
app: '#F5F6F8',
surface: '#FFFFFF',
subtle: '#F0F1F3',
border: { DEFAULT: '#E3E5E8', strong: '#C9CDD2' },
ink: { DEFAULT: '#1A1D21', secondary: '#5C636B', disabled: '#9AA0A6' },
primary: { DEFAULT: '#18181B', hover: '#27272A', soft: '#F4F4F5', ink: '#18181B' },
// success / warning / danger ugyanígy
```

A kanonikus értékek CSS változókban (`src/lib/tokens.css`) éljenek; a Tailwind ezekre hivatkozzon.
