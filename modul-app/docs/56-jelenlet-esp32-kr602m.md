# 56 — Jelenlét terminál: ESP32 + KR602M (hardver terv)

**Státusz:** elnapolva — hardver megvan / részben megérkezett, összeszerelés és firmware később.  
**Cél:** a Pi 4 + 10″ touch kioszk helyett olcsóbb, robosztusabb falra szerelhető node: **NFC + fizikai PIN → Wi‑Fi → attendance API**.  
Kapcsolódó: [34-jelenlet-addon.md](34-jelenlet-addon.md), [53-jelenlet-pi-modul-atallas.md](53-jelenlet-pi-modul-atallas.md), [jelenlet-pi.md](jelenlet-pi.md), `docs/raspberry-pi-attendance.md`, `raspberry-pi-attendance/`.

---

## Miért nem Pi + nagy touch?

| Elem | ~ár | Jelenléthez |
|---|---|---|
| Pi 4 + 10″ Touch Display 2 + PN532 I2C | ~120–170 € | Overkill, törékeny, boot/DSI/I2C gondok |
| **KR602M + ESP32** | ~50–65 € | NFC + keypad + LED + buzzer, IP65 |

Tanulságok (Reddit / gyakorlat):

- NFC + PIN + beep = **MCU feladat**, nem teljes Linux kioszk.
- PN532-t **SPI**-n (vagy HSU), **ne I2C**-n (clock stretching → bus lock). A mostani Pi I2C PN532 ugyanezért flaky.
- Wiegandot **ne** közvetlenül 3.3 V GPIO-ra level shifter nélkül.

API szerződés változatlan: `POST …/attendance/terminal/scan` (ma main-app; később modul-app `jelenlet` tokennel — lásd `53`).

---

## Ajánlott architektúra

```text
[ KR602M IP65: kártya VAGY PIN ]
        │ Wiegand D0/D1 (5 V)
        ▼
[ TXS0108 level shifter ]
        │ 3.3 V
        ▼
[ ESP32 ] --HTTPS--> terminal/scan
   │
   └─ 2N2222: lila buzzer + szürke zöld LED (active LOW → GND)

12V adapter ─┬─ KR602M (+12 V)
             └─ LM2596 12→5 V ─ (később ESP VIN; prototípusban ESP USB)
```

**Nem kell:** külön PN532, 4×4 keypad, KY-012 buzzer, RGB LED panel, nagy ház a frontnak — a KR602M mindezt tartalmazza.

---

## KR602M vezetékek

Forrás: [LaskaKit KR602M](https://www.laskakit.cz/en/kr602m-rfid-pristupovy-system-s-klavesnici-13-56mhz-wiegand-ip65/).

| Szín | Jel | Bekötés |
|---|---|---|
| Piros | +12 V | Adapter +12 V |
| Fekete | GND | Adapter GND + **közös GND az ESP-vel** |
| Zöld | Wiegand D0 | TXS **B1** |
| Fehér | Wiegand D1 | TXS **B2** |
| Lila | Buzzer (active LOW) | 2N2222 kollektor → GND húzás |
| Szürke | Zöld LED (active LOW) | 2N2222 kollektor → GND húzás |
| Sárga | Bitformátum | **Lebeg** = 34 bit (MIFARE default); GND = 26 bit |

Kézi teszt (ESP nélkül): lila vagy szürke **pillanatra GND**-re → beep / zöld.

---

## Beszerzett / ajánlott BOM (1 db)

### A) Ajánlott stack (KR602M útvonal)

| # | Tétel | Hol | ~ár |
|---|---|---|---|
| 1 | KR602M 13.56 MHz + keypad + LED + buzzer, Wiegand, IP65 | LaskaKit ~28 € | ~11–12 000 Ft |
| 2 | ESP32-DEVKIT-32UE-4M (U.FL) | HESTORE [100.495.37](https://www.hestore.hu/prod_10049537.html) | ~2 930 Ft |
| 3 | uFL-SMA + Wi‑Fi antenna 3 dBi | HESTORE [100.364.22](https://www.hestore.hu/prod_10036422.html) | ~1 050 Ft |
| 4 | TXS0108E-M szintillesztő (HW-221: VA/VB) | HESTORE [100.479.17](https://www.hestore.hu/prod_10047917.html) | ~430 Ft |
| 5 | LM2596-5V-M buck 12→5 V | HESTORE [100.519.07](https://www.hestore.hu/prod_10051907.html) | ~1 400 Ft |
| 6 | KS 12V/1A adapter | HESTORE [100.358.14](https://www.hestore.hu/prod_10035814.html) | ~2 700 Ft |
| 7 | G 311 IP65 doboz 90×115×55 (ESP + buck + shifter) | HESTORE [100.329.12](https://www.hestore.hu/prod_10032912.html) | ~2 410 Ft |
| 8 | 2N2222A ×2 (+ tartalék) | HESTORE [100.394.10](https://www.hestore.hu/prod_10039410.html) | ~220 Ft / 10 db |
| 9 | 10kΩ ellenállás ×2 | HESTORE [100.204.46](https://www.hestore.hu/prod_10020446.html) | ~70 Ft / db |
| 10 | SJ-140 vezetékkészlet | HESTORE [100.243.07](https://www.hestore.hu/prod_10024307.html) | ~1 760 Ft |
| 11 | micro-USB kábel (programozás) | HESTORE [100.345.35](https://www.hestore.hu/prod_10034535.html) | ~900 Ft |

**Becsült összesen / egység:** ~20–25 000 Ft (KR602M-mel).

### B) HESTORE-only DIY (ha nincs KR602M)

ESP32 + PN532-V4 (**SPI**) + 4×4 keypad + buzzer + RGB LED + G311 ≈ **10–12 000 Ft**, de ház/IP/keypad/NFC saját munka. HESTORE-n nincs kész IP65 Wiegand keypad-reader.

### Hiányzó prototípus-anyag (előkészítendő folytatáshoz)

Az SJ-140 **breadboard jumperek** (merev, csupasz vég). Az ESP-en **hím** tüskesor van → a jumperek **nem** húzhatók rá közvetlenül.

Vegyél még egyet:

- **830 / 400 lyukas breadboard**, *vagy*
- **nőstény–nőstény Dupont** kábelcsomag,

és a **TXS0108**-ra forraszd fel a tüskesorokat (VA…OE és VB…GND oldal).

---

## Összeszerelés — lépések (ahol abbahagytuk)

### 1. Csak a KR602M

Piros → +12 V, fekete → GND. Világít / standby LED?

### 2. LM2596

- `IN+` / `IN−` ← 12 V adapter (piros / fekete).
- Multiméter: **`OUT+` ↔ `OUT−` ≈ 4.9–5.2 V**. Ha ~12 V → ne kösd az ESP-re.
- 12 V **párhuzamosan** a readerrel: ugyanaz az adapter táplálja a KR602M-et is.

### 3. ESP + antenna

- U.FL pigtail az ESP-en → SMA botantenna rácsavarva.
- Prototípus: ESP **csak micro-USB**-ről (laptop). Ne egyszerre USB + buck VIN.

### 4. TXS0108 (HW-221 feliratok: VA / VB)

```text
              BAL (5 V)          JOBB (3.3 V)
                 GND ●───────────● OE  ← ESP 3V3
                  B8 ●           ● A8
                  …              …
                  B2 ●◄ FEHÉR    ● A2 → ESP GPIO 35
                  B1 ●◄ ZÖLD     ● A1 → ESP GPIO 34
                  VB ●◄ 5V OUT+  ● VA → ESP 3V3
```

| TXS | Hova |
|---|---|
| VB | buck OUT+ (5 V) |
| VA | ESP 3V3 |
| OE | ESP 3V3 (kötelező) |
| GND | közös GND |
| B1 | KR602M zöld D0 |
| B2 | KR602M fehér D1 |
| A1 | ESP GPIO **34** |
| A2 | ESP GPIO **35** |

**Kritikus:** reader GND + ESP GND + buck GND **közös**. Enélkül nincs Wiegand adat.

### 5. LED + buzzer (2N2222) — később, Wiegand után

Active LOW: GPIO HIGH → tranzisztor vezet → vezeték GND-re.

| Csatorna | ESP | 10k | 2N2222 | Reader |
|---|---|---|---|---|
| Buzzer | GPIO **26** | GPIO → bázis | E→GND, C→lila | LILA |
| Zöld LED | GPIO **27** | GPIO → bázis | E→GND, C→szürke | SZÜRKE |

TO-92 2N2222A tipikus (lapos oldal feléd): **E – B – C**.

---

## Biztonság / tilos

- **12 V soha ne menjen** az ESP-re (csak VIN/5V a buck 5 V-járól, vagy USB).
- D0/D1 ne közvetlenül ESP GPIO-ra (level shifter kell).
- Lila/szürke ne 3.3 V-ra „bekapcsoláshoz” — GND-re kell húzni.
- Merev SJ-140-et ne erőltess az ESP hím tüskéire.

---

## Firmware (még nincs a repóban)

Következő munka, amikor folytatjuk:

1. Minimális sketch: Wiegand 34/26 → Serial log (kártya UID / PIN).
2. Sikerre: GPIO 26/27 pulzus (beep + zöld).
3. Wi‑Fi + `POST` ugyanazzal a JSON-nal, mint a Pi (`cardId` / `pin` + secret).
4. Offline sor (NVS) opcionális.
5. Később: modul-app `jelenlet` Bearer token (`53`).

Referencia libek / projektek: [esprfid/esp-rfid](https://github.com/esprfid/esp-rfid), ESPHome `wiegand`, Arduino Wiegand.

---

## Összehasonlítás

| | Pi 4 + 10″ + PN532 | KR602M + ESP32 |
|---|---|---|
| Hardver / db | ~120–170 € | ~50–65 € |
| PIN | touch | fizikai keypad |
| NFC | PN532 I2C (flaky) | readerben |
| Ház | nagy üveg | IP65 reader + kis ESP box |
| Szoftver | Kivy / Linux | ESP firmware |
| API | `terminal/scan` | ugyanaz |

---

## Folytatás checklist

- [ ] Breadboard vagy nőstény Dupont
- [ ] TXS tüskesor forrasztva
- [ ] 4. lépés bekötés + közös GND
- [ ] Teszt-firmware (Serial Wiegand)
- [ ] 5. lépés tranzisztorok
- [ ] HTTPS → API + secret/env
- [ ] G 311 dobozolás, falra KR602M
