# 07 — Fejlesztői / PR checklist

Minden UI-s PR és minden új képernyő előtt. Ha bármelyik **nem**, javíts vagy indokolj a PR-ban.

## Szeparáció

- [ ] Nincs import / copy a `main-app`, `customer-portal`, `b2b-portal` mappákból
- [ ] Új kód csak `modul-app/` alatt; legacy csak ötletként volt használva

## Stack

- [ ] Nincs új MUI / Ant / Emotion UI függőség
- [ ] shadcn/ui + Tailwind + Lucide
- [ ] Nehéz lib csak dynamic importtal, ahol kell

## Flat 2.0

- [ ] Színek a tokenekből (egy primary: charcoal `#18181B`; nav monokróm; meta chip neutral)
- [ ] Radius: 4 / 6 / 8 (avatar 50%) — nincs 12/16 keverék
- [ ] Tipó: ~13.5–14px body, H1 ~18–20/600, max 400+600 súly (`18` sűrűség)
- [ ] Nincs linagyolt padding / 44px default gomb listákon
- [ ] Inputnak látható kerete van alapból
- [ ] Max egy primary gomb a képernyőn
- [ ] Nincs uppercase gomb, glow, gradiens gomb, glass

## Certainty-first UX

- [ ] 5 mp alatt érthető a teendő
- [ ] Gyakori akció látható (nem csak kebab/hover)
- [ ] Gombfelirat ige+tárgy
- [ ] Destruktív: egyértelmű következmény + védelem
- [ ] Üres / loading / error állapot megvan
- [ ] Comfortable density default
- [ ] Primary action jobbra van; toast jobb alul; destruktív dialog default fókusz `Mégse`

## Form

- [ ] Label a mező felett
- [ ] Placeholder ≠ címke
- [ ] Kötelező `*` + opcionális jelölés
- [ ] Hiba a mező alatt, konkrét magyar szöveg
- [ ] Hintet a hiba felváltja
- [ ] Kritikus adatbevitelnél billentyűzetes flow végiggondolt (`09-keyboard-and-data-entry.md`)

## Tábla

- [ ] Szerveroldali lapozás, default ≤25
- [ ] URL-ben page/szűrő
- [ ] Sticky header, látható sorakciók
- [ ] `X / Y elem` + számozott lapozó
- [ ] Számok `tabular-nums`, jobbra
- [ ] Státusz: szín + szöveg
- [ ] Nagy adatnál szükség szerint virtualizáció vagy egyértelmű page limit

## SaaS specifikus

- [ ] Jogosultság / tenancy állapotok átgondolva (`10-permissions-and-tenancy.md`)
- [ ] Tenant-scoped adat + platform szabályok (`17-saas-architecture.md`), ha tenancy / auth / billing érintett
- [ ] Empty tenant / onboarding út tiszta (`11-empty-tenant-and-onboarding.md`)
- [ ] Offline / mentési hiba / konfliktus viselkedés definiált (`12-offline-conflict-and-recovery.md`)
- [ ] Számok és mértékegységek konzisztensen jelennek meg (`13-numbers-units-formats.md`)
- [ ] Képernyő eszköztámogatása kimondott (`14-responsive-and-devices.md`)
- [ ] Print/PDF igény esetén van kijelölt stratégia (`15-print-and-documents.md`)

## A11y

- [ ] focus-visible ring minden interaktívon
- [ ] Ikon-only: aria-label (+ tooltip)
- [ ] Kontraszt OK (szöveg 4.5:1)
- [ ] Esc zárja a modalt

## Copy

- [ ] Magyar UI szöveg, nincs nyers enum
- [ ] Hiba: mi + miért + mit tegyen

## Teljesítmény

- [ ] Nincs `select('*')` listán
- [ ] Nincs 100+ sor default betöltés
- [ ] Nincs új több ezer soros monolit Client fájl

---

**Dokumentumok:** [INDEX.md](INDEX.md) · ha a checklist és a részletes doc ütközik, a részletes nyer, majd frissítsd a checklistet.
