/**
 * Jelenletkezelo CoreFeatures (v3)
 *
 * v3 changes vs v2:
 *   1. F1 mocks now match the real Pi system:
 *      - Card screen: solid green #33CC33 with white "ERKEZES" + name,
 *        NO timestamp, NO checkmark, NO RFID code on screen.
 *      - PIN screen: white bg, big black dots, white 3x4 keypad with
 *        thick black borders, no green check button (matches Kivy UI).
 *   2. F2 replaced: AttendanceMonthView table mock -> Jelenleti iv PDF
 *      preview (the actual deliverable; what the bookkeeper sees).
 *   3. Em/en-dashes removed from every visible string.
 *   4. "Nincs helyett-lyukasztas" sentence rewritten.
 */

// ---------------------------------------------------------------------------
// F1 mock, Card + PIN kiosk (matches actual Pi GUI)
// ---------------------------------------------------------------------------
function KioskCardAndPinMock() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5">
      {/* Card screen, solid green + big white text (matches result_screen.py) */}
      <div
        className="rounded-2xl p-3.5 sm:p-4"
        style={{
          background: 'linear-gradient(160deg, #3f2a1b 0%, #271a10 55%, #3a2718 100%)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div className="text-[9px] uppercase tracking-widest text-amber-100/40 mb-2 font-semibold">
          Kártyás belépés
        </div>
        <div
          className="relative overflow-hidden rounded-md flex flex-col items-center justify-center text-white"
          style={{ aspectRatio: '4 / 5', background: '#33CC33' }}
        >
          <span className="text-white text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-wider leading-none">
            ÉRKEZÉS
          </span>
          <span className="text-white text-sm sm:text-base lg:text-lg font-bold mt-2 px-2 text-center leading-tight">
            Kovács Péter
          </span>
        </div>
        <div className="mt-2 text-[9px] text-amber-100/40 text-center">Kártya érintésekor</div>
      </div>

      {/* PIN screen, white bg + big black dots + black-bordered keypad (matches keypad_screen_simplified.py) */}
      <div
        className="rounded-2xl p-3.5 sm:p-4"
        style={{
          background: 'linear-gradient(160deg, #3f2a1b 0%, #271a10 55%, #3a2718 100%)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div className="text-[9px] uppercase tracking-widest text-amber-100/40 mb-2 font-semibold">
          PIN kód
        </div>
        <div
          className="relative overflow-hidden rounded-md flex flex-col items-center bg-white p-3"
          style={{ aspectRatio: '4 / 5' }}
        >
          {/* Big black masked dots */}
          <div className="flex items-center gap-3 mb-3 mt-1 text-black" style={{ fontSize: '28px', lineHeight: 1, fontWeight: 700 }}>
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
          {/* 3x4 keypad (1-9, then [backspace, 0, empty]) */}
          <div className="grid grid-cols-3 gap-1 w-full flex-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''].map((k, i) => (
              <div
                key={i}
                className="rounded-sm flex items-center justify-center bg-white font-extrabold"
                style={{
                  border: k === '' ? 'none' : '2px solid #000',
                  color: k === '⌫' ? '#333' : '#000',
                  fontSize: k === '⌫' ? '14px' : '18px',
                }}
                aria-hidden
              >
                {k}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 text-[9px] text-amber-100/40 text-center">4 jegyű PIN</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// F2 mock: Jelenléti ív PDF preview (matches pdf-template.ts)
// ---------------------------------------------------------------------------
type PdfRow = {
  date: string
  day: string
  arrival: string
  lunch: string
  departure: string
  status: string
  hours: string
}

const pdfRows: PdfRow[] = [
  { date: '04.13', day: 'Hétfő',      arrival: '07:58', lunch: '12:00 - 12:30', departure: '16:32', status: 'MUNKA',     hours: '8.07 óra' },
  { date: '04.14', day: 'Kedd',       arrival: '08:05', lunch: '12:00 - 12:30', departure: '16:28', status: 'MUNKA',     hours: '7.88 óra' },
  { date: '04.15', day: 'Szerda',     arrival: '07:55', lunch: '12:00 - 12:30', departure: '17:12', status: 'MUNKA',     hours: '8.78 óra' },
  { date: '04.16', day: 'Csütörtök',  arrival: '-',     lunch: '-',             departure: '-',     status: 'SZABADSÁG', hours: 'SZABADSÁG' },
  { date: '04.17', day: 'Péntek',     arrival: '08:02', lunch: '12:00 - 12:30', departure: '16:30', status: 'MUNKA',     hours: '8.00 óra' },
  { date: '04.20', day: 'Hétfő',      arrival: '08:01', lunch: '12:00 - 12:30', departure: '16:34', status: 'MUNKA',     hours: '8.07 óra' },
  { date: '04.21', day: 'Kedd',       arrival: '07:56', lunch: '12:00 - 12:30', departure: '16:30', status: 'MUNKA',     hours: '8.07 óra' },
]

function AttendancePdfMock() {
  return (
    <div
      className="relative bg-white mx-auto"
      style={{
        border: '1px solid #E4E4E7',
        borderRadius: '4px',
        boxShadow: '0 30px 60px rgba(24,24,27,0.18), 0 4px 12px rgba(24,24,27,0.06)',
        aspectRatio: '210 / 297',
        maxWidth: '480px',
      }}
    >
      {/* Subtle "paper" stacking shadow behind */}
      <div
        aria-hidden
        className="absolute -z-10 bg-white"
        style={{
          inset: '-6px -8px 4px -4px',
          borderRadius: '4px',
          border: '1px solid #E4E4E7',
          boxShadow: '0 12px 24px rgba(24,24,27,0.06)',
          opacity: 0.55,
        }}
      />

      <div className="h-full p-4 sm:p-5 flex flex-col" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#212121' }}>
        {/* Header */}
        <div className="text-center">
          <p className="text-[14px] sm:text-[16px] font-bold">Jelenléti ív</p>
          <p className="text-[11px] sm:text-[12px] font-semibold mt-0.5" style={{ color: '#424242' }}>
            2026 Április
          </p>
        </div>

        {/* Employee info box */}
        <div className="mt-3 px-2.5 py-1.5" style={{ border: '1px solid #000', background: '#f9f9f9' }}>
          <div className="text-[10px] leading-tight">
            <span className="font-semibold inline-block w-[86px]">Munkavállaló:</span>
            <span>Kovács Péter</span>
          </div>
          <div className="text-[10px] leading-tight mt-0.5">
            <span className="font-semibold inline-block w-[86px]">Nézet:</span>
            <span>Papír nézet</span>
          </div>
        </div>

        {/* Attendance table */}
        <table className="w-full mt-3 border-collapse" style={{ fontSize: '8px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['Dátum', 'Érk.', 'Ebédszünet', 'Táv.', 'Státusz', 'Ledolg. óra'].map(h => (
                <th key={h} style={{ border: '1px solid #000', padding: '3px 3px', textAlign: 'left', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pdfRows.map(r => (
              <tr key={r.date}>
                <td style={{ border: '1px solid #000', padding: '3px 3px' }}>
                  {r.date} {r.day}
                </td>
                <td style={{ border: '1px solid #000', padding: '3px 3px' }}>{r.arrival}</td>
                <td style={{ border: '1px solid #000', padding: '3px 3px' }}>{r.lunch}</td>
                <td style={{ border: '1px solid #000', padding: '3px 3px' }}>{r.departure}</td>
                <td style={{ border: '1px solid #000', padding: '3px 3px', fontWeight: r.status === 'SZABADSÁG' ? 700 : 400 }}>
                  {r.status}
                </td>
                <td style={{ border: '1px solid #000', padding: '3px 3px', textAlign: 'right', fontWeight: r.status === 'SZABADSÁG' ? 700 : 400 }}>
                  {r.hours}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary box */}
        <div className="mt-3 px-2.5 py-1.5" style={{ border: '1px solid #000', background: '#f9f9f9', fontSize: '10px' }}>
          <div>
            <span className="font-semibold inline-block w-[110px]">Összes dolgozott óra:</span>
            <span>56.94 óra</span>
          </div>
          <div className="mt-0.5">
            <span className="font-semibold inline-block w-[110px]">Dolgozott napok:</span>
            <span>7 nap</span>
          </div>
          <div className="mt-0.5">
            <span className="font-semibold inline-block w-[110px]">Távollét:</span>
            <span>1 nap</span>
          </div>
        </div>

        {/* Signature block (pushed to bottom) */}
        <div className="mt-auto pt-3 flex justify-end">
          <div className="text-center" style={{ width: '140px' }}>
            <div style={{ borderBottom: '1px dotted #000', height: '20px' }} />
            <div className="text-[9px] mt-0.5" style={{ fontWeight: 500 }}>
              Engedélyező aláírása
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-1.5 mt-2"
          style={{ borderTop: '1px solid #000', fontSize: '7px', color: '#666' }}
        >
          <span>Ez a dokumentum a Turinova belső irányítási rendszerrel készült.</span>
          <span style={{ fontWeight: 700, color: '#111' }}>Turinova</span>
        </div>
      </div>

      {/* Overlay label: "PDF" chip top-right */}
      <div
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold"
        style={{ background: '#DC2626', color: '#fff', letterSpacing: '0.06em' }}
      >
        PDF
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature block
// ---------------------------------------------------------------------------
type Feature = {
  id: string
  eyebrow: string
  title: string
  kpi: string
  kpiLabel: string
  copy: string
  bullets: string[]
  mock: React.FC
  reverse?: boolean
}

const features: Feature[] = [
  {
    id: 'card-pin',
    eyebrow: 'Belépés',
    title: 'Egy kártya vagy egy PIN. Semmi más.',
    kpi: '1 mp',
    kpiLabel: 'alatt kész a belépés',
    copy:
      'Érkezéskor és távozáskor a dolgozó a kártyáját tartja a leolvasóhoz, vagy beüti a 4 jegyű PIN kódját. A rendszer automatikusan felismeri, hogy érkezés vagy távozás történt, és minden bejegyzés naplózva van.',
    bullets: [
      'RFID kártya vagy 4 jegyű PIN kód, dolgozónként beállítható.',
      'Teljes képernyős zöld ÉRKEZÉS vagy piros TÁVOZÁS visszajelzés, hogy a dolgozó is biztosan lássa.',
      'Offline módban is fut. A net visszatéréskor a belépések automatikusan szinkronizálnak.',
    ],
    mock: KioskCardAndPinMock,
  },
  {
    id: 'pdf-export',
    eyebrow: 'Havi jelenléti ív',
    title: 'A hónap végén egy kattintás, és kész a PDF.',
    kpi: '1 kattintás',
    kpiLabel: 'alatt letöltöd a teljes jelenléti ívet',
    copy:
      'A dolgozó teljes havi jelenléti ívét egy gombbal letöltöd PDF-ben. Aláírható, auditálható, a könyvelőnek rögtön továbbadható. Nem kell Excelben körmölni, nem kell órákat számolgatni.',
    bullets: [
      'Automatikus számítás minden napra: érkezés, ebédszünet, távozás, ledolgozott óra.',
      'Papír nézet és tényleges nézet, külön PDF-ben. Előbbit a könyvelőnek, utóbbit a tényleges elszámoláshoz.',
      'Dolgozónként egyedi szabályok: műszakkezdés, ebédszünet, túlóra, türelmi idő, kerekítés, napi maximum.',
    ],
    mock: AttendancePdfMock,
    reverse: true,
  },
]

function FeatureBlock({ f }: { f: Feature }) {
  const Mock = f.mock


  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-8 lg:gap-14 xl:gap-16 items-center ${
        f.reverse ? 'lg:[&>div:first-child]:order-2' : ''
      }`}
    >
      <div>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest border"
          style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
        >
          {f.eyebrow}
        </span>
        <h3
          className="mt-4 text-[1.75rem] sm:text-[2rem] lg:text-[2.125rem] xl:text-[2.375rem] font-extrabold leading-[1.1] tracking-tight"
          style={{ color: '#18181B' }}
        >
          {f.title}
        </h3>
        <div
          className="mt-4 inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border"
          style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}
        >
          <span className="text-lg font-extrabold leading-none" style={{ color: '#1D4ED8' }}>
            {f.kpi}
          </span>
          <span className="text-[12px] font-medium leading-none" style={{ color: '#52525B' }}>
            {f.kpiLabel}
          </span>
        </div>

        <p className="mt-6 text-base sm:text-lg leading-relaxed" style={{ color: '#52525B' }}>
          {f.copy}
        </p>

        <ul className="mt-6 space-y-3">
          {f.bullets.map(b => (
            <li key={b} className="flex gap-3 text-sm sm:text-[15px] leading-snug" style={{ color: '#3F3F46' }}>
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                aria-hidden
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Mock />
      </div>
    </div>
  )
}

export default function CoreFeatures() {
  return (
    <section id="features" className="relative py-14 sm:py-20" style={{ background: '#F9F8F4' }}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14">
        <div className="text-center max-w-5xl mx-auto mb-10 sm:mb-14">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
            style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
          >
            Fő funkciók
          </span>
          <h2
            className="mt-4 text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.1]"
            style={{ color: '#18181B' }}
          >
            Belépés a terminálon, jelenléti ív a hónap végén.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: '#52525B' }}>
            Két dolog kell, hogy ne a vezető kézzel vezesse a dolgozók óráit: gyors belépés és egy letölthető PDF a hónap végén. Ennyi.
          </p>
        </div>

        <div className="flex flex-col gap-14 sm:gap-20">
          {features.map(f => (
            <FeatureBlock key={f.id} f={f} />
          ))}
        </div>
      </div>
    </section>
  )
}
