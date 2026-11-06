# Nov 9 cutover checklist — partner → `turinova.hu`

**Staff:** marad `app.optinova.hu` (nem mozgatjuk).  
**Archívum:** `archiv.turinova.hu` = customer-portal.  
**Partner:** `turinova.hu` = modul-app.

Előkészítés: [01-archiv-phase1.md](01-archiv-phase1.md) · modul-app [52-partner-turinova-host-prep.md](../../modul-app/docs/52-partner-turinova-host-prep.md)

---

## Előtte (ma / hétvége)

- [ ] modul-app partner host kód deployolva (`turinova.hu` → partner surface)
- [ ] SaaS Supabase Redirect URLs: `https://turinova.hu/**` (+ www); optinova **marad**
- [ ] Régi Supabase Redirect URLs: `https://archiv.turinova.hu/**`
- [ ] Smoke: `archiv.turinova.hu/login` + régi jelszó
- [ ] Smoke: partner jelszó-flow az **optinova.hu**-n (2–3 migráns)
- [ ] Write-lock kód a customer-portalon (deadline után 403) — deployolva
- [ ] Kommunikáció draft kiküldésre kész ([03-nov9-comms-draft.md](03-nov9-comms-draft.md))

---

## Nov 9 sorrend (éles)

1. [ ] Utolsó smoke optinova partner + archiv
2. [ ] **Vercel customer-portal:** `turinova.hu` + `www` eltávolítása (archiv marad)
3. [ ] **Vercel modul-app:** `turinova.hu` + `www` hozzáadása
4. [ ] DNS (ha kell): apex / www → modul-app Vercel
5. [ ] Régi Supabase **Site URL** → `https://archiv.turinova.hu`
6. [ ] SaaS Supabase **Site URL** → `https://turinova.hu` (opcionális, ha eddig optinova volt)
7. [ ] Smoke:
   - [ ] `https://turinova.hu/login` = **partner** (nem staff)
   - [ ] Migráns: jelszó beállítás
   - [ ] `https://archiv.turinova.hu/login` = régi portal; mentés/submit **403**
   - [ ] `https://app.optinova.hu/login` = staff OK
8. [ ] Kommunikáció kiküldése

---

## Rollback (ha partner baj)

1. Vercel: `turinova.hu` vissza customer-portalra  
2. modul-appról le a turinova domain  
3. Site URL-ek vissza  
4. `archiv.` hagyható

---

## Explicit NEM Nov 9-en

- `app.turinova.hu` / staff domain csere  
- Optinova staff lekapcsolás  
- Régi DB törlés  
