# Merchant súgó — írási szabályok

**Hang:** tegezés. Mintha telefonon mondanád egy boltosnak. Rövid mondat, aztán hosszabb, aztán megint rövid.

**Forrás az AI-jelek listájához:** Reddit r/ChatGPT, r/Teachers + [unslop-ai-text](https://github.com/JCarterJohnson/vibecoded-design-tells/tree/main/unslop-ai-text) (2025–2026).

---

## Igen

- Portál **pontos feliratai** (Kapcsolat tesztelése, Megjelenik a boltban).
- Egy konkrét teendő mondatonként.
- Belső link: `[szöveg](/tudasbazis/slug)` vagy `/widget`.

## Nem — angol / Reddit top jelek

| Jel | Példa | Mit csinálj |
|-----|--------|-------------|
| Em dash (—) | „jó — mehet tovább” | vessző, pont, kettőspont |
| „Nem csak X, hanem Y” | antitézis | csak Y-t mondd |
| dive / deep dive | „merüljünk el” | töröld |
| delve, seamless, leverage, robust | corporate szó | sima magyar |
| In conclusion / Összegzés | záró blokk | nincs recap |
| **Címke:** mondat | minden sor elején félkövér | sima szöveg |
| 5 ways / 7 signs lista | listicle | csak ha tényleg lépés |
| Would you like / Remélem segített | chat vége | töröld |
| Egyforma mondat hossz | robot ritmus | változtasd |
| Minden bekezdés „Menj / Nyomd / Kattints” | sablon | keverd |

## Nem — magyar AI-jelek

- Fontos megjegyezni, összességében, érdemes megfontolni
- Lépésről lépésre, zökkenőmentes, hatékony megoldás
- Ebben a cikkben megmutatjuk…
- Nem csupán X, hanem Y
- Optimalizálás, implementálás (ha nem tech doc)
- Checklist (használd: „nézd végig”, „sorban”)

## Publikálás

1. `src/content/help/articles/{slug}.md`
2. `catalog.ts` → `published`
3. Futtasd: `node scripts/help-unslop-check.mjs` (0 hiba)
