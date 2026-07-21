/**
 * Static recreation of customer-portal FrontTypeSegmentRow.
 * Labels match FronttervezoClient / FrontTypeSegmentRow.tsx exactly.
 */
import { NfBrowserChrome, NfChip } from "./NettfrontMockupShared"

const COMING_SOON = ["Festett", "Fóliás", "Linea"] as const

export default function NettfrontFrontTypeMockup() {
  return (
    <div
      className="w-full rounded-2xl bg-white overflow-hidden"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
      }}
    >
      <NfBrowserChrome />

      <div className="px-4 pt-3 pb-2 border-b border-black/[0.08] bg-white">
        <p className="text-[10px] text-slate-500 mb-0.5">
          <span className="text-slate-400">Kezdőlap</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-slate-700 font-medium">Nettfront</span>
        </p>
        <p className="text-[13px] font-bold text-slate-900">Nettfront</p>
      </div>

      <div className="p-3 sm:p-4 bg-[#fafafa]">
        {/* Megrendelő + brand row hint */}
        <div className="grid grid-cols-12 gap-2 mb-3">
          <div className="col-span-8 rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-[9px] font-bold text-slate-800">Megrendelő adatai</p>
            <p className="text-[7.5px] text-slate-500 mt-0.5">
              Megrendelő adatok a vállalati adatbázisból — nem szerkeszthető
            </p>
          </div>
          <div className="col-span-4 rounded-lg border border-black/20 bg-black/[0.04] p-2 flex flex-col items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brands/nettfront-logo.svg"
              alt="Nettfront"
              className="h-4 w-auto max-w-full"
            />
            <p className="text-[8px] font-extrabold text-black mt-1">Nettfront frontok</p>
          </div>
        </div>

        {/* Front típus card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[12px] font-extrabold text-slate-900 leading-tight">
            Front típus
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5 mb-2.5 max-w-xs">
            Melyik Nettfront frontot szeretné?
          </p>

          <div className="flex flex-col md:flex-row gap-2">
            {/* Inomat hero tile — selected */}
            <div
              className="flex-[1.55] min-h-[120px] p-2.5 rounded-xl border-[3px] border-black bg-black/[0.06] flex flex-col gap-1.5 text-left"
              style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}
            >
              <div className="flex flex-wrap gap-1">
                <NfChip label="Elérhető most" tone="success" />
                <NfChip label="2 tétel" tone="error" />
              </div>
              <p className="text-[18px] sm:text-[20px] font-extrabold text-black leading-none tracking-tight">
                Inomat
              </p>
              <p className="text-[9px] text-slate-600 font-medium">
                Dekoratív front, több színben
              </p>
              <span className="mt-auto inline-flex items-center gap-1 self-start rounded border border-black px-2 py-1 text-[8px] font-bold text-black">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Katalógus megnyitása
              </span>
            </div>

            {/* Coming soon tiles */}
            <div className="flex flex-1 gap-2">
              {COMING_SOON.map((label) => (
                <div
                  key={label}
                  className="flex-1 min-h-[100px] p-2 rounded-xl border-2 border-slate-200 bg-slate-50/80 opacity-70 flex flex-col items-center justify-center gap-1 cursor-not-allowed"
                >
                  <p className="text-[13px] font-extrabold text-slate-800">{label}</p>
                  <NfChip label="Hamarosan" tone="warning" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
