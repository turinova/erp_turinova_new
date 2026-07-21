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

function DialogChrome({
  children,
  payable = '250 000 Ft'
}: {
  children: ReactNode
  payable?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg">
      {/* Dialog title — matches CustomerFacingPdfDialog */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
        <div>
          <div className="text-[13px] font-bold text-slate-900">
            Ügyfélajánlat <span className="font-normal text-slate-500">OPTI-1042</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[8px] text-slate-500">Fizetendő bruttó</div>
          <div className="text-[14px] font-extrabold leading-tight" style={{ color: SUCCESS }}>
            {payable}
          </div>
        </div>
      </div>
      {children}
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <span className="rounded px-2.5 py-1.5 text-[10px] font-medium text-slate-600">Mégse</span>
        <span
          className="rounded px-3 py-1.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: SUCCESS }}
        >
          PDF letöltés
        </span>
      </div>
    </div>
  )
}

/** Step 1 — valódi mentett ajánlat detail: bal tartalom + jobb műveletek */
export function UgyfelajanlatStepDetailMock() {
  return (
    <BrowserFrame url="portal.turinova.hu/saved/a1b2c3…">
      <div className="pointer-events-none select-none bg-[#f5f5f5] p-2.5">
        <div className="grid grid-cols-[1.4fr_0.9fr] gap-2">
          {/* Left — quote summary like detail page */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-900">OPTI-1042</div>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600">
                Mentett
              </span>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[9px] text-slate-600">
              <div className="font-semibold text-slate-800">Anyagok</div>
              <div>EGGER W980 · 18 mm · 4,2 m²</div>
              <div className="mt-1 font-semibold text-slate-800">Szolgáltatások</div>
              <div>Szabás · Élzárás</div>
            </div>
            <div className="border-t border-slate-100 pt-1.5 text-[10px]">
              <div className="flex justify-between text-slate-500">
                <span>Bruttó</span>
                <span className="font-bold text-slate-900">148 000 Ft</span>
              </div>
            </div>
          </div>

          {/* Right — action card exactly like PortalQuoteDetailClient */}
          <div className="relative rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              Műveletek
            </div>
            <div className="space-y-1.5">
              <div className="rounded border border-slate-300 bg-white py-2 text-center text-[10px] font-semibold text-slate-700">
                Kapott árajánlat
              </div>
              <div
                className="relative rounded py-2 text-center text-[10px] font-bold text-white"
                style={{
                  backgroundColor: SUCCESS,
                  boxShadow: `0 0 0 3px ${SUCCESS}40`
                }}
              >
                Ajánlat az ügyfelemnek
              </div>
              <div className="rounded bg-[#1976d2] py-2 text-center text-[10px] font-bold text-white opacity-80">
                Megrendelés
              </div>
            </div>
            {/* Callout */}
            <div
              className="absolute -left-1 top-[52px] z-10 max-w-[120px] -translate-x-full rounded-md px-2 py-1 text-[9px] font-bold text-white"
              style={{ backgroundColor: SUCCESS_HOVER }}
            >
              Ide kattints →
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[9px] text-slate-500">
          Mentett / megrendelt ajánlat oldal · jobb oldali gombok
        </p>
      </div>
    </BrowserFrame>
  )
}

/** Step 2 — dialóg: ajánlat adó chip + ① Vevő + ② Árazás (valódi szekciók) */
export function UgyfelajanlatStepBuyerMock() {
  return (
    <BrowserFrame url="portal…/saved/… · Ügyfélajánlat">
      <div className="pointer-events-none select-none bg-slate-100/80 p-2">
        <DialogChrome payable="185 000 Ft">
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
                <SectionDot n={1} /> Vevő
              </div>
              <div className="space-y-1.5">
                <FakeField label="Név / cégnév *" value="Nagy Éva" wide />
                <div className="flex gap-1.5">
                  <FakeField label="Telefon" value="06 30 123 4567" />
                  <FakeField label="E-mail" value="eva@pelda.hu" />
                </div>
                <div className="text-[9px] font-medium" style={{ color: SUCCESS }}>
                  Cím és adószám ▾
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center text-[11px] font-bold text-slate-900">
                <SectionDot n={2} /> Lapszabászat árazás
              </div>
              <div
                className="mb-2 flex items-baseline gap-3 rounded-lg px-2.5 py-2"
                style={{ backgroundColor: 'rgba(46,125,50,0.06)' }}
              >
                <div>
                  <div className="text-[8px] text-slate-500">Portal</div>
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
              <div className="text-[8px] text-slate-500">Árrés: 25%</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/4 rounded-full" style={{ backgroundColor: SUCCESS }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {['Nincs kerekítés', '100 Ft-ra', '1000 Ft-ra'].map((t, i) => (
                  <span
                    key={t}
                    className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                      i === 0 ? 'text-white' : 'border border-slate-300 text-slate-600'
                    }`}
                    style={i === 0 ? { backgroundColor: SUCCESS } : undefined}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-[9px] text-slate-700">
                <label className="flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border-2"
                    style={{ borderColor: SUCCESS, backgroundColor: SUCCESS }}
                  />
                  Egy sor: Lapszabászat
                </label>
                <label className="flex items-center gap-1 opacity-50">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-400" />
                  Részletes
                </label>
              </div>
            </div>
          </div>
        </DialogChrome>
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

/** Step 5 — PDF letöltés + eredmény (valódi PDF fejléc / felek) */
export function UgyfelajanlatStepPdfMock() {
  return (
    <BrowserFrame url="Ugyfelajanlat-OPTI-1042.pdf">
      <div className="pointer-events-none select-none bg-slate-100 p-2">
        {/* Mini dialog footer moment */}
        <div className="mb-2 flex items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <span className="text-[9px] text-slate-500">Mégse</span>
          <span
            className="rounded px-3 py-1.5 text-[10px] font-bold text-white ring-2 ring-offset-1"
            style={{ backgroundColor: SUCCESS, boxShadow: `0 0 0 2px ${SUCCESS}55` }}
          >
            ↓ PDF letöltés ← utolsó lépés
          </span>
        </div>

        {/* Resulting PDF page 1 */}
        <div className="mx-auto max-w-[340px] rounded bg-white p-3 shadow-lg">
          <div className="mb-3 flex justify-end border-b border-black pb-2">
            <div className="text-right">
              <div className="text-[14px] font-bold tracking-wide">AJÁNLAT</div>
              <div className="text-[11px] font-semibold text-slate-700">OPTI-1042</div>
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
    title: '1. lépés — Nyisd meg az ajánlatot',
    caption:
      'Menj a Mentésekhez, nyiss meg egy árajánlatot. Jobb oldalon látod a gombokat. A zöld gomb: „Ajánlat az ügyfelemnek”.',
    Mock: UgyfelajanlatStepDetailMock
  },
  {
    title: '2. lépés — Vevő és ár',
    caption:
      'Megnyílik az Ügyfélajánlat ablak. Add meg az ügyfél nevét (és ha van, telefont). Állítsd az árrést — a Portal ár mellett látod, mit fizet az ügyfél.',
    Mock: UgyfelajanlatStepBuyerMock
  },
  {
    title: '3. lépés — Plusz tételek',
    caption:
      'Ha kell szállítás vagy szerelés, kattints a sablonokra (+ Szállítás, + Szerelés…). Beírhatod az árat. Nem kötelező.',
    Mock: UgyfelajanlatStepLinesMock
  },
  {
    title: '4. lépés — Élő előnézet',
    caption:
      'Az ablak jobb oldalán azonnal látod a PDF kinézetét. Nagyíthatod (− / +), és húzással mozgathatod, ha közelebbről akarod nézni.',
    Mock: UgyfelajanlatStepPreviewMock
  },
  {
    title: '5. lépés — PDF letöltés',
    caption:
      'Alul a zöld „PDF letöltés” gombbal mented a fájlt. Az ajánlatodon te vagy az ajánlat adó, az ügyfeled a vevő.',
    Mock: UgyfelajanlatStepPdfMock
  }
] as const
