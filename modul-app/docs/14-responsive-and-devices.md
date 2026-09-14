# 14 — Reszponzivitás és eszközök

A modul-app desktop-first, de nem desktop-only.

## 1. Eszközmátrix

Nem minden képernyőnek kell ugyanúgy működnie minden eszközön.

Ajánlott kategóriák:

- **Desktop required:** összetett rendelésfelvitel, nagy táblák, konfigurátorok
- **Tablet optimized:** műhelyfolyamatok, ellenőrzés, státuszváltás, bevételezés
- **Phone safe:** keresés, részletmegtekintés, gyors státusz, scan-jellegű feladatok

## 2. Desktop szabály

- Nincs hamburger desktopon
- Sidebar fix
- Táblák elsődleges munkafelületként használhatók

## 3. Tablet szabály

- A fő flow-k működjenek érintéssel is
- Gombok és célterületek maradjanak 44px körül
- A kritikus információk ne csak hoverrel legyenek elérhetők

## 4. Telefon szabály

- Telefonon csak azokat a flow-kat támogasd teljes értékűen, amelyek valóban használhatók
- Ha egy modul desktopot igényel, ezt mondd ki tisztán
- Jobb egy korrekt korlátozás, mint egy rosszul használható félkész mobil UI

## 5. Táblák kis kijelzőn

- Ne próbáld ugyanazt a 8 oszlopos desktop táblát telefonra zsúfolni
- Használj prioritást:
  - elsődleges mezők
  - részletnézet
  - akciók továbbra is láthatók

## 6. Hover, pointer, input módok

- Hoverre támaszkodó UX mobilon nem működik
- Mindig legyen tap-elérhető megfelelője
- Billentyűzet + érintés kombinált használat tableten valós forgatókönyv

## 7. Kamera és scan

Telefonon / tableten a scan vagy fotós workflow külön előny lehet, de:

- csak akkor tervezz rá elsődleges utat, ha tényleg támogatott
- a fallback mindig legyen manuális bevitel

## 8. DoD

Képernyőnként legyen kimondva:

- támogatott eszközök
- elfogadott degradáció
- mi az, ami desktopot igényel
