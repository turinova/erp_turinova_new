import type { ReactNode } from 'react'
import BrowserFrame from './BrowserFrame'

const SUCCESS = '#2E7D32'
const SUCCESS_HOVER = '#1B5E20'

function SectionDot({ n }: { n: number }) {
  return (
    <span
      className="mr-1.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: SUCCESS }}
    >
      {n}
    </span>
  )
}

function FakeField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'w-full' : 'flex-1 min-w-0'}>
      <div className="mb-0.5 text-[8px] font-medium text-slate-500">{label}</div>
      <div className="rounded border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-800">
        {value}
      </div>
    </div>
  )
}

function StudioChrome({
  children,
  payable = '250 000 Ft',
  quoteLabel = 'Új ajánlat'
}: {
  children: ReactNode
  payable?: string
  quoteLabel?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
        <div>
          <div className="text-[11px] font-medium text-slate-500">← Lista</div>
          <div className="text-[13px] font-bold text-slate-900">
            Ügyfélajánlat{' '}
            <span className="font-normal text-slate-500">{quoteLabel}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <div className="text-[8px] text-slate-500">Fizetendő bruttó</div>
            <div className="text-[14px] font-extrabold leading-tight" style={{ color: SUCCESS }}>
              {payable}
            </div>
          </div>
          <span className="rounded border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">
            Mentés
          </span>
          <span
            className="rounded px-3 py-1.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: SUCCESS }}
          >
            PDF letöltés
          </span>
        </div>
      </div>
      {children}
    </div>
  )
}

/** @deprecated alias — régi dialóg mockok */
function DialogChrome(props: {
  children: ReactNode
  payable?: string
}) {
  return <StudioChrome {...props} />
}

/** Step 1 — Ügyfélajánlat lista (hub) */
export function UgyfelajanlatStepDetailMock() {
  return (
    <BrowserFrame url="portal.turinova.hu/ugyfel-ajanlat">
      <div className="pointer-events-none select-none bg-[#f5f5f5] p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-extrabold text-slate-900">Ügyfélajánlat</div>
            <div className="text-[9px] text-slate-500">Saját ajánlataid az ügyfeleidnek</div>
          </div>
          <span
            className="relative rounded px-2.5 py-1.5 text-[10px] font-bold text-white"
            style={{
              backgroundColor: SUCCESS,
              boxShadow: `0 0 0 3px ${SUCCESS}40`
            }}
          >
            Új ügyfélajánlat
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.9fr] gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-[8px] font-bold text-slate-500">
            <span>Szám</span>
            <span>Vevő</span>
            <span>Bruttó</span>
            <span>Műveletek</span>
          </div>
          {[
            { n: 'UA-2026-001', v: 'Nagy Éva', a: '250 000 Ft' },
            { n: 'UA-2026-002', v: 'Kovács Bt.', a: '412 000 Ft' }
          ].map(row => (
            <div
              key={row.n}
              className="grid grid-cols-[1fr_1.2fr_0.8fr_0.9fr] gap-1 border-b border-slate-50 px-2 py-1.5 text-[9px]"
            >
              <span
                className="inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white"
                style={{ backgroundColor: SUCCESS }}
              >
                {row.n}
              </span>
              <span className="font-semibold text-slate-800">{row.v}</span>
              <span className="font-bold text-slate-900">{row.a}</span>
              <span className="text-[8px] text-slate-500">Megnyit · PDF · Törlés</span>
            </div>
          ))}
        </div>
        <div
          className="mt-2 inline-block rounded-md px-2 py-1 text-[9px] font-bold text-white"
          style={{ backgroundColor: SUCCESS_HOVER }}
        >
          Menü: Ügyfélajánlat → Új
        </div>
      </div>
    </BrowserFrame>
  )
}

/** Step 2 — szerkesztő: forrás + vevő + árrés */
export function UgyfelajanlatStepBuyerMock() {
  return (
    <BrowserFrame url="portal.turinova.hu/ugyfel-ajanlat/uj">
      <div className="pointer-events-none select-none bg-slate-100/80 p-2">
        <StudioChrome payable="185 000 Ft" quoteLabel="OPTI-1042">
          <div className="max-h-[320px] space-y-3 overflow-hidden p-3">
            <div>
              <div className="mb-1 text-[8px] text-slate-500">Ajánlat adó (profilodból)</div>
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: 'rgba(46,125,50,0.08)', color: SUCCESS }}
              >
                Asztalos Műhely Kft.
              </span>
            </div>

            <div>
              <div className="mb-1.5 flex items-center text-[11px] font-bold text-slate-900">
                <SectionDot n={3} /> Forrás
              </div>
              <div
                className="rounded-lg border px-2.5 py-2"
                style={{
                  borderColor: 'rgba(46,125,50,0.35)',
                  backgroundColor: 'rgba(46,125,50,0.06)'
                }}
              >
                <span
                  className="mb-1 inline-block rounded-full px-2 py-0.5 text-[8px] font-bold text-white"
                  style={{ backgroundColor: SUCCESS }}
                >
                  Lapszabászat
                </span>
                <div className="text-[10px] font-bold text-slate-900">OPTI-1042</div>
                <div className="mt-1 flex gap-1">
                  <span
                    className="rounded-full px-2 py-0.5 text-[8px] font-semibold text-white"
                    style={{ backgroundColor: SUCCESS }}
                  >
                    Összesen
                  </span>
                  <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[8px] text-slate-600">
                    Részletes
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center text-[11px] font-bold text-slate-900">
                <SectionDot n={1} /> Vevő
              </div>
              <div className="space-y-1.5">
                <FakeField label="Név / cégnév *" value="Nagy Éva" wide />
                <div className="flex gap-1.5">
                  <FakeField label="Telefon" value="06 30 123 4567" />
                  <FakeField label="E-mail" value="eva@pelda.hu" />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[8px] text-slate-500">Árrés: 25%</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/4 rounded-full" style={{ backgroundColor: SUCCESS }} />
              </div>
              <div
                className="mt-2 flex items-baseline gap-3 rounded-lg px-2.5 py-2"
                style={{ backgroundColor: 'rgba(46,125,50,0.06)' }}
              >
                <div>
                  <div className="text-[8px] text-slate-500">Beszerzés</div>
                  <div className="text-[10px] text-slate-400 line-through">148 000 Ft</div>
                </div>
                <span className="text-slate-400">→</span>
                <div>
                  <div className="text-[8px] text-slate-500">Ügyfélnek</div>
                  <div className="text-[14px] font-bold" style={{ color: SUCCESS }}>
                    185 000 Ft
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StudioChrome>
      </div>
    </BrowserFrame>
  )
}

/** Step 3 — ③ Egyéb tételek: sablonok + tábla mint a valódi dialóg */
export function UgyfelajanlatStepLinesMock() {
  return (
    <BrowserFrame url="portal… · Ügyfélajánlat · tételek">
      <div className="pointer-events-none select-none bg-slate-100/80 p-2">
        <DialogChrome payable="250 000 Ft">
          <div className="p-3">
            <div className="mb-2 flex items-center text-[11px] font-bold text-slate-900">
              <SectionDot n={3} /> Egyéb tételek
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {['+ Szállítás', '+ Szerelés', '+ Vasalat összesen', '+ Felár / kezelési díj'].map(
                t => (
                  <span
                    key={t}
                    className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[8px] font-semibold text-slate-700"
                  >
                    {t}
                  </span>
                )
              )}
              <span className="ml-1 text-[9px] font-medium text-slate-600">+ Üres sor</span>
            </div>
            <div className="overflow-hidden rounded border border-slate-200 text-[9px]">
              <div className="grid grid-cols-[72px_1fr_40px_40px_70px] gap-1 bg-slate-50 px-1.5 py-1.5 font-bold text-slate-500">
                <span>Típus</span>
                <span>Megnevezés</span>
                <span>Menny.</span>
                <span>Egys.</span>
                <span>Ár (br.)</span>
              </div>
              <div className="grid grid-cols-[72px_1fr_40px_40px_70px] gap-1 border-t border-slate-100 px-1.5 py-1.5">
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5">Szállítás</span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 font-medium">
                  Szállítás
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-center">
                  1
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-center">
                  db
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-right">
                  25 000
                </span>
              </div>
              <div className="grid grid-cols-[72px_1fr_40px_40px_70px] gap-1 border-t border-slate-100 px-1.5 py-1.5">
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5">Szerelés</span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 font-medium">
                  Szerelés
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-center">
                  1
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-center">
                  nap
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-right">
                  40 000
                </span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-700">
              Egyéb: <strong>65 000 Ft</strong>
            </div>
          </div>
        </DialogChrome>
      </div>
    </BrowserFrame>
  )
}

/** Step 4 — valódi split: bal szerkesztő + jobb élő előnézet (bézs, zoom) */
export function UgyfelajanlatStepPreviewMock() {
  return (
    <BrowserFrame url="portal… · Ügyfélajánlat · élő előnézet">
      <div className="pointer-events-none select-none bg-slate-100/80 p-1.5 sm:p-2">
        <DialogChrome payable="250 000 Ft">
          <div className="grid grid-cols-2 gap-0 border-b border-slate-200" style={{ minHeight: 280 }}>
            {/* Left editor — condensed real sections */}
            <div className="space-y-2 overflow-hidden border-r border-slate-200 p-2.5">
              <div className="text-[8px] text-slate-500">Ajánlat adó</div>
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ backgroundColor: 'rgba(46,125,50,0.08)', color: SUCCESS }}
              >
                Asztalos Műhely Kft.
              </span>
              <div className="flex items-center text-[10px] font-bold">
                <SectionDot n={1} /> Vevő
              </div>
              <FakeField label="Név / cégnév *" value="Nagy Éva" wide />
              <div className="flex items-center text-[10px] font-bold">
                <SectionDot n={2} /> Árazás
              </div>
              <div
                className="rounded px-2 py-1.5 text-[9px]"
                style={{ backgroundColor: 'rgba(46,125,50,0.06)' }}
              >
                <span className="text-slate-400 line-through">148 000</span>
                <span className="mx-1">→</span>
                <span className="font-bold" style={{ color: SUCCESS }}>
                  185 000 Ft
                </span>
                <span className="ml-1 text-slate-500">(+25%)</span>
              </div>
              <div className="flex items-center text-[10px] font-bold">
                <SectionDot n={3} /> Egyéb
              </div>
              <div className="text-[9px] text-slate-600">Szállítás 25 000 · Szerelés 40 000</div>
              <div className="flex items-center text-[10px] font-bold">
                <SectionDot n={4} /> Készítette
              </div>
              <FakeField label="Készítette *" value="Kovács János" wide />
            </div>

            {/* Right preview — matches dialog preview pane */}
            <div className="flex flex-col bg-[#E8E4DC]">
              <div className="flex items-center justify-between border-b border-slate-300/60 bg-white/75 px-2 py-1">
                <span className="text-[8px] font-semibold text-slate-500">
                  Élő előnézet · húzd a mozgatáshoz
                </span>
                <span className="text-[8px] font-bold text-slate-700">78%</span>
              </div>
              <div className="flex flex-1 justify-center overflow-hidden p-2">
                <div className="w-full max-w-[160px] rounded bg-white p-2 shadow-md">
                  <div className="mb-1.5 border-b border-black pb-1 text-right">
                    <div className="text-[9px] font-bold">AJÁNLAT</div>
                    <div className="text-[7px] text-slate-600">OPTI-1042</div>
                    <div className="text-[6px] text-slate-500">Érvényesség: 2026.08.04.</div>
                  </div>
                  <div className="mb-1.5 grid grid-cols-2 gap-1 text-[6px]">
                    <div>
                      <div className="font-bold">Ajánlat adó:</div>
                      <div className="font-semibold">Asztalos Műhely Kft.</div>
                      <div className="text-slate-500">Készítette: Kovács János</div>
                    </div>
                    <div>
                      <div className="font-bold">Vevő adatok</div>
                      <div className="font-semibold">Nagy Éva</div>
                      <div className="text-slate-500">06 30 123 4567</div>
                    </div>
                  </div>
                  <div className="mb-1 border border-black text-[6px]">
                    <div className="border-b border-black bg-slate-100 px-1 py-0.5 font-bold">
                      Megnevezés · Bruttó
                    </div>
                    <div className="flex justify-between border-b border-slate-200 px-1 py-0.5">
                      <span>Lapszabászat</span>
                      <span>185 000</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 px-1 py-0.5">
                      <span>Szállítás</span>
                      <span>25 000</span>
                    </div>
                    <div className="flex justify-between px-1 py-0.5">
                      <span>Szerelés</span>
                      <span>40 000</span>
                    </div>
                  </div>
                  <div className="bg-black px-1 py-1 text-center text-[7px] font-bold text-white">
                    Bruttó összesen: 250 000 Ft
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogChrome>
      </div>
    </BrowserFrame>
  )
}

/** Step 5 — Mentés / PDF */
export function UgyfelajanlatStepPdfMock() {
  return (
    <BrowserFrame url="portal.turinova.hu/ugyfel-ajanlat/uj · Mentés / PDF">
      <div className="pointer-events-none select-none bg-slate-100 p-2">
        <div className="mb-2 flex items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="mr-auto text-[9px] text-slate-500">Fizetendő: 250 000 Ft</div>
          <span className="rounded border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">
            Mentés
          </span>
          <span
            className="rounded px-3 py-1.5 text-[10px] font-bold text-white ring-2 ring-offset-1"
            style={{ backgroundColor: SUCCESS, boxShadow: `0 0 0 2px ${SUCCESS}55` }}
          >
            PDF letöltés
          </span>
        </div>

        {/* Resulting PDF page 1 */}
        <div className="mx-auto max-w-[340px] rounded bg-white p-3 shadow-lg">
          <div className="mb-3 flex justify-end border-b border-black pb-2">
            <div className="text-right">
              <div className="text-[14px] font-bold tracking-wide">AJÁNLAT</div>
              <div className="text-[11px] font-semibold text-slate-700">UA-2026-001</div>
              <div className="text-[8px] text-slate-600">Kelt.: 2026.07.21.</div>
              <div className="text-[8px] text-slate-600">Érvényesség: 2026.08.04.</div>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-4 text-[9px]">
            <div>
              <div className="mb-1 font-bold">Ajánlat adó:</div>
              <div className="text-[11px] font-bold">Asztalos Műhely Kft.</div>
              <div className="text-slate-600">9700 Szombathely, Példa u. 1.</div>
              <div className="text-slate-600">Telefon: 06 94 000 000</div>
              <div className="mt-1 font-bold">Készítette: Kovács János</div>
            </div>
            <div>
              <div className="mb-1 font-bold">Vevő adatok</div>
              <div className="font-bold">Nagy Éva</div>
              <div className="text-slate-600">9700 Szombathely, Fő tér 2.</div>
              <div className="text-slate-600">E-mail: eva@pelda.hu</div>
              <div className="text-slate-600">Telefon: 06 30 123 4567</div>
            </div>
          </div>
          <table className="mb-2 w-full border-collapse text-[8px]">
            <thead>
              <tr className="border-y border-black bg-slate-100">
                <th className="px-1 py-1 text-left">Megnevezés</th>
                <th className="px-1 py-1 text-right">Bruttó</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-1 py-1">
                  <div className="font-medium">Lapszabászat</div>
                  <div className="text-slate-500">Lapszabászat és kapcsolódó díjak</div>
                </td>
                <td className="px-1 py-1 text-right font-medium">185 000 Ft</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="px-1 py-1 font-medium">Szállítás</td>
                <td className="px-1 py-1 text-right font-medium">25 000 Ft</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="px-1 py-1 font-medium">Szerelés</td>
                <td className="px-1 py-1 text-right font-medium">40 000 Ft</td>
              </tr>
            </tbody>
          </table>
          <div className="bg-black px-2 py-1.5 text-[10px] font-bold text-white">
            <div className="flex justify-between">
              <span>Bruttó összesen:</span>
              <span>250 000 Ft</span>
            </div>
          </div>
          <div className="mt-2 text-[7px] text-slate-400">
            Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

export const UGYFELAJANLAT_TUTORIAL_STEPS = [
  {
    title: '1. lépés — Ügyfélajánlat menü',
    caption:
      'A bal menüben nyisd meg az „Ügyfélajánlat” pontot. Itt látod a mentett ajánlataid listáját. Új ajánlathoz: „Új ügyfélajánlat”.',
    Mock: UgyfelajanlatStepDetailMock
  },
  {
    title: '2. lépés — Forrás, vevő, árrés',
    caption:
      'Add hozzá a forrást (Mentett / Megrendelt Lapszabászat vagy Nettfront). Írd be a vevő nevét, állítsd az árrést, és válaszd: Összesen vagy Részletes.',
    Mock: UgyfelajanlatStepBuyerMock
  },
  {
    title: '3. lépés — Plusz tételek',
    caption:
      'Ha kell szállítás vagy szerelés, használd a sablonokat (+ Szállítás, + Szerelés…). Beírhatod az árat. Nem kötelező.',
    Mock: UgyfelajanlatStepLinesMock
  },
  {
    title: '4. lépés — Élő előnézet',
    caption:
      'A szerkesztő jobb oldalán azonnal látod a PDF kinézetét. Nagyíthatod (− / +), és húzással mozgathatod.',
    Mock: UgyfelajanlatStepPreviewMock
  },
  {
    title: '5. lépés — Mentés vagy PDF',
    caption:
      '„Mentés”: elmented a listára PDF nélkül. „PDF letöltés”: fájlt kapsz, és szintén mentődik. Később a listáról újra megnyithatod vagy letöltheted.',
    Mock: UgyfelajanlatStepPdfMock
  }
] as const
