/**
 * Static recreation of FronttervezoInomatSection — Hungarian labels 1:1 with portal.
 */
import {
  NfBrowserChrome,
  NfChip,
  NfField,
  NfGlossBadge,
  NfMattBadge,
} from "./NettfrontMockupShared"

const MATT_COLORS = [
  { name: "Pure White", hex: "#F4F2EC", price: "18 450" },
  { name: "Lava Black", hex: "#1A1A1A", price: "19 200" },
  { name: "Bronze", hex: "#8B7355", price: "18 900" },
  { name: "Storm Grey", hex: "#6B7280", price: "18 750" },
] as const

const HG_COLORS = [
  { name: "HG Pure White", hex: "#FAFAFA", price: "22 100" },
  { name: "HG Dune Beige", hex: "#D4C4A8", price: "22 350" },
] as const

function ColorChip({
  name,
  hex,
  price,
  selected = false,
}: {
  name: string
  hex: string
  price: string
  selected?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-1.5 py-1 ${
        selected ? "border-black bg-black/[0.06]" : "border-slate-200 bg-white"
      }`}
    >
      <span
        className="w-5 h-5 rounded shrink-0 border border-black/10"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[8px] font-semibold text-slate-800 truncate">{name}</p>
        <p className="text-[7px] text-slate-500">{price} Ft/m²</p>
      </div>
    </div>
  )
}

export default function NettfrontInomatFormMockup() {
  return (
    <div
      className="w-full rounded-2xl bg-white overflow-hidden"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
      }}
    >
      <NfBrowserChrome />

      <div className="p-3 sm:p-4 bg-[#fafafa] space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-bold text-slate-900">INOMAT FRONT – részletek</p>
          <p className="text-[8.5px] text-slate-500 mt-1 leading-snug">
            Magasság: 120–2780 mm, szélesség: 120–1280 mm. Enter a méret/db mezőkben: hozzáadás.
            A pánthelyfúrás opcionális.
          </p>

          <p className="text-[9px] font-bold text-slate-800 mt-2.5 mb-1.5">Szín</p>
          <p className="text-[8px] font-semibold text-slate-600 mb-1">Matt felület</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {MATT_COLORS.map((c, i) => (
              <ColorChip key={c.name} {...c} selected={i === 0} />
            ))}
          </div>
          <p className="text-[8px] font-semibold text-slate-600 mb-1">
            Fényes felület (High Gloss)
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {HG_COLORS.map((c) => (
              <ColorChip key={c.name} {...c} />
            ))}
          </div>
          <p className="text-[8.5px] text-slate-700 font-semibold flex flex-wrap items-center gap-1">
            Kiválasztva: <strong>Pure White</strong> <NfMattBadge /> · 18 450 Ft/m²
          </p>

          <div className="grid grid-cols-3 gap-2 mt-2.5">
            <NfField label="Magasság (mm)" value="720" helper="120–2780 mm" />
            <NfField label="Szélesség (mm)" value="396" helper="120–1280 mm" />
            <NfField label="Mennyiség" value="6" helper="Enter = hozzáadás" />
          </div>

          <div className="mt-2 flex flex-wrap gap-2 items-center justify-between">
            <span className="inline-flex items-center rounded bg-[#0F7B6C] px-2 py-1 text-[8px] font-bold text-white">
              Pánthelyfúrás (6 db) — módosítás
            </span>
            <span className="inline-flex items-center rounded bg-black px-3 py-1 text-[9px] font-bold text-white">
              Hozzáadás
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="text-[10px] font-bold text-slate-900 px-3 pt-2.5 pb-1">
            Hozzáadott tételek
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[7.5px]">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-left">
                  {["Szín", "Felület", "Méret", "Db", "m²", "Ft/m²", "Bruttó", "Pánt"].map(
                    (h) => (
                      <th key={h} className="px-2 py-1 font-bold text-slate-700 whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-1.5 font-medium">Pure White</td>
                  <td className="px-2 py-1.5">
                    <NfMattBadge />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">720×396</td>
                  <td className="px-2 py-1.5">6</td>
                  <td className="px-2 py-1.5 text-right">1,70</td>
                  <td className="px-2 py-1.5 text-right">18 450</td>
                  <td className="px-2 py-1.5 text-right font-semibold">39 842</td>
                  <td className="px-2 py-1.5 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-2 py-1.5 font-medium">Lava Black</td>
                  <td className="px-2 py-1.5">
                    <NfMattBadge />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">280×396</td>
                  <td className="px-2 py-1.5">4</td>
                  <td className="px-2 py-1.5 text-right">0,44</td>
                  <td className="px-2 py-1.5 text-right">19 200</td>
                  <td className="px-2 py-1.5 text-right font-semibold">10 944</td>
                  <td className="px-2 py-1.5 text-center">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-3 py-1.5 text-[7px] text-slate-500 border-t border-slate-100">
            A sorár a front m² × színár. A pánthely és a végösszeg az „Ajánlat generálás”-ban
            jelenik meg.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded bg-[#D9730D] px-3 py-1.5 text-[9px] font-bold text-white">
            Ajánlat generálás
          </span>
          <span className="inline-flex rounded bg-black px-3 py-1.5 text-[9px] font-bold text-white">
            Árajánlat mentése
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2 flex flex-wrap gap-1 items-center">
          <NfChip label="VÉGÖSSZEG" tone="success" />
          <NfChip label="Nettó" tone="outline" />
          <NfChip label="ÁFA" tone="outline" />
          <NfChip label="Bruttó" tone="outline" />
          <span className="text-[9px] font-extrabold text-[#0F7B6C] ml-auto">63 486 Ft</span>
        </div>
      </div>
    </div>
  )
}
