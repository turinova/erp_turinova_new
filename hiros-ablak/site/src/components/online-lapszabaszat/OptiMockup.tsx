/**
 * Static, hand-built recreation of the customer-portal /opti page.
 *
 * Variants:
 *  - "input"  → hero: "Megrendelő adatai" strip + "Új panel hozzáadása" form
 *  - "result" → spotlight: optimalizálási eredmény (vágásterv) + Árajánlat
 *  - "full"   → legacy: cutting plan + quote (input nélkül)
 *
 * Style + Hungarian labels mirror customer-portal/app/(dashboard)/opti/OptiClient.tsx.
 */

type Variant = "input" | "result" | "full"

type Placement = {
  // Percentages 0..100 within the board container
  x: number
  y: number
  w: number
  h: number
  label: string
  area: number
}

// Landscape board (2800 × 2070): keeps the cutting plan card short.
const PLACEMENTS: Placement[] = [
  // Doors row 1 (3 across)
  { x: 1.0, y: 1.5, w: 25.4, h: 18.6, label: "720×396", area: 720 * 396 },
  { x: 27.0, y: 1.5, w: 25.4, h: 18.6, label: "720×396", area: 720 * 396 },
  { x: 53.0, y: 1.5, w: 25.4, h: 18.6, label: "720×396", area: 720 * 396 },
  // Doors row 2
  { x: 1.0, y: 20.7, w: 25.4, h: 18.6, label: "720×396", area: 720 * 396 },
  { x: 27.0, y: 20.7, w: 25.4, h: 18.6, label: "720×396", area: 720 * 396 },
  { x: 53.0, y: 20.7, w: 25.4, h: 18.6, label: "720×396", area: 720 * 396 },
  // Drawer fronts (2×2 grid in right strip)
  { x: 79.0, y: 1.5, w: 9.4, h: 18.6, label: "280×396", area: 280 * 396 },
  { x: 89.0, y: 1.5, w: 9.4, h: 18.6, label: "280×396", area: 280 * 396 },
  { x: 79.0, y: 20.7, w: 9.4, h: 18.6, label: "280×396", area: 280 * 396 },
  { x: 89.0, y: 20.7, w: 9.4, h: 18.6, label: "280×396", area: 280 * 396 },
  // Shelves bottom-left (3 across)
  { x: 1.0, y: 41.5, w: 20.5, h: 18.0, label: "580×380", area: 580 * 380 },
  { x: 22.0, y: 41.5, w: 20.5, h: 18.0, label: "580×380", area: 580 * 380 },
  { x: 43.0, y: 41.5, w: 20.5, h: 18.0, label: "580×380", area: 580 * 380 },
]

function panelColor(area: number) {
  if (area >= 1_000_000) return "#f1f3f4"
  if (area >= 500_000) return "#e8f0fe"
  if (area >= 250_000) return "#e6f4ea"
  if (area >= 100_000) return "#fef7e0"
  return "#fce7f3"
}

/* ======================================================================
 *  Shared atoms
 * ====================================================================== */

type ChipTone =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "outline"
  | "muted"

function ChipMock({
  label,
  tone = "muted",
}: {
  label: string
  tone?: ChipTone
}) {
  const styles: Record<ChipTone, string> = {
    primary: "bg-[#1976d2] text-white border-[#1565c0]",
    secondary: "bg-[#9c27b0] text-white border-[#7b1fa2]",
    success: "bg-[#2e7d32] text-white border-[#1b5e20]",
    warning: "bg-[#ed6c02] text-white border-[#e65100]",
    info: "bg-[#0288d1] text-white border-[#01579b]",
    outline: "bg-white text-slate-700 border-slate-300",
    muted: "bg-slate-100 text-slate-600 border-slate-200",
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-semibold border whitespace-nowrap ${styles[tone]}`}
    >
      {label}
    </span>
  )
}

function FieldMock({
  label,
  value,
  required = false,
  disabled = false,
  helper,
  withCaret = false,
}: {
  label: string
  value: string
  required?: boolean
  disabled?: boolean
  helper?: string
  withCaret?: boolean
}) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 mb-0.5 font-medium truncate">
        {label}
        {required ? " *" : ""}
      </p>
      <div
        className={`flex items-center justify-between rounded border px-2 py-1 ${
          disabled
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-300 bg-white text-slate-800"
        }`}
      >
        <span className="text-[10px] truncate pr-1">{value || "\u00A0"}</span>
        {withCaret && (
          <svg
            className="w-3 h-3 text-slate-400 shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
        )}
      </div>
      {helper && (
        <p className="mt-0.5 text-[7.5px] text-slate-500 truncate">{helper}</p>
      )}
    </div>
  )
}

function SwitchMock({
  label,
  checked = false,
}: {
  label: string
  checked?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`relative inline-flex w-7 h-3.5 rounded-full border ${
          checked
            ? "bg-[#1976d2] border-[#1565c0]"
            : "bg-slate-200 border-slate-300"
        }`}
      >
        <span
          className={`absolute top-[1px] w-3 h-3 rounded-full bg-white shadow-sm ${
            checked ? "left-[13px]" : "left-[1px]"
          }`}
        />
      </span>
      <span className="text-[9px] text-slate-700 font-medium">{label}</span>
    </span>
  )
}

function BrowserChrome({ url = "www.turinova.hu/opti" }: { url?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
      <span className="w-2.5 h-2.5 rounded-full bg-red-300 shrink-0" />
      <span className="w-2.5 h-2.5 rounded-full bg-amber-300 shrink-0" />
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shrink-0" />
      <div className="ml-2 min-w-0 flex-1 h-6 rounded-md bg-white border border-slate-200 px-2 flex items-center">
        <svg
          className="w-3 h-3 text-slate-400 mr-1 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 12.75v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        <span className="truncate text-[10px] text-slate-500 font-mono">
          {url}
        </span>
      </div>
    </div>
  )
}

function PageHeader({ title }: { title: string }) {
  return (
    <div className="px-4 pt-3 pb-2 border-b border-black/[0.08] bg-white">
      <p className="text-[10px] text-slate-500 mb-1">
        <span className="text-slate-400">Kezdőlap</span>
        <span className="mx-1 text-slate-300">/</span>
        <span className="text-slate-700 font-medium">Optimalizáló</span>
      </p>
      <p className="text-[12px] font-semibold text-slate-800">{title}</p>
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full max-w-[640px] rounded-2xl bg-white overflow-hidden"
      style={{
        border: "1px solid rgba(151,29,37,0.18)",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.45), 0 0 50px rgba(151,29,37,0.08)",
      }}
    >
      {children}
    </div>
  )
}

/* ======================================================================
 *  OptiInputCard: "Új panel hozzáadása"
 * ====================================================================== */

function OptiInputCard() {
  return (
    <div className="bg-[#fafbfc] p-3 space-y-2">
      {/* Megrendelő adatai */}
      <div className="rounded-md border border-slate-200 bg-white p-2.5">
        <p className="text-[11px] font-semibold text-slate-800 mb-1.5">
          Megrendelő adatai
        </p>
        <div className="grid grid-cols-[2fr_1fr] gap-1.5">
          <FieldMock
            label="Név"
            value="Kiss János / Asztalos Kft."
            required
            disabled
            helper="Bejelentkezett ügyfél"
          />
          <FieldMock label="Kedvezmény (%)" value="0" disabled />
        </div>
      </div>

      {/* Új panel hozzáadása */}
      <div className="rounded-md border border-slate-200 bg-white p-2.5">
        <p className="text-[11px] font-semibold text-slate-800 mb-1.5">
          Új panel hozzáadása
        </p>

        {/* Material selector */}
        <div className="mb-1.5">
          <FieldMock
            label="Táblás anyag választás:"
            value="F021 ST75 Triestino terrakotta • 18 mm"
            required
            withCaret
          />
        </div>

        {/* Material chip row */}
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span
            className="w-5 h-5 rounded border border-slate-300 shrink-0"
            style={{
              background:
                "linear-gradient(135deg, #c45d3e 0%, #8b3e2a 60%, #5e2818 100%)",
            }}
            aria-hidden
          />
          <ChipMock label="2070 × 2800 mm" tone="primary" />
          <ChipMock label="18 mm vastag" tone="secondary" />
          <ChipMock label="Szálirány" tone="warning" />
          <ChipMock label="Raktári" tone="success" />
          <ChipMock label="Szélezés: HF10 RB10 HA10 RJ10mm" tone="secondary" />
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          <FieldMock label="Szálirány (mm)" value="720" required />
          <FieldMock label="Keresztirány (mm)" value="396" required />
          <FieldMock label="Darab" value="6" required />
          <FieldMock label="Jelölés" value="Ajtó" />
        </div>

        {/* Élzárás élenként */}
        <p className="text-[10px] font-semibold text-[#1976d2] mb-1">
          Élzárás élenként
        </p>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          <FieldMock label="Hosszú felső" value="ABS 1 mm" withCaret />
          <FieldMock label="Hosszú alsó" value="ABS 1 mm" withCaret />
          <FieldMock label="Széles bal" value="ABS 1 mm" withCaret />
          <FieldMock label="Széles jobb" value="ABS 1 mm" withCaret />
        </div>

        {/* Élzárás körbe + Megmunkálás row */}
        <div className="grid grid-cols-[1fr_1.4fr] gap-2 mb-2">
          <div>
            <p className="text-[10px] font-semibold text-[#1976d2] mb-1">
              Élzárás körbe
            </p>
            <FieldMock label="Élzárás körbe" value="ABS 1 mm" withCaret />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#1976d2] mb-1">
              Megmunkálás
            </p>
            <div className="flex items-center gap-1.5 flex-wrap pt-[3px]">
              <button
                type="button"
                tabIndex={-1}
                className="rounded bg-[#2e7d32] text-white text-[9px] font-semibold px-2 py-1 shadow-sm"
              >
                Pánthelyfúrás
              </button>
              <SwitchMock label="Duplungolás" />
              <SwitchMock label="Szögvágás" checked />
            </div>
          </div>
        </div>

        {/* Submit row */}
        <div className="flex justify-end">
          <button
            type="button"
            tabIndex={-1}
            className="rounded bg-[#1976d2] hover:bg-[#1565c0] text-white text-[10px] font-semibold px-5 py-1.5 shadow-sm"
          >
            Hozzáadás
          </button>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
 *  OptiCuttingPlan: Szabásterv (blueprint)
 * ====================================================================== */

function OptiCuttingPlan() {
  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      {/* Accordion-like header with chip row */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[12px] font-semibold text-slate-900">
            F021 ST75 Triestino terrakotta
          </p>
          <ChipMock label="2070×2800mm" tone="outline" />
          <ChipMock label="Szálirányos" tone="warning" />
          <ChipMock label="1 tábla" tone="outline" />
          <ChipMock label="Vágási hossz: 14,2m" tone="secondary" />
        </div>
      </div>

      <div className="p-3 bg-white">
        <div
          className="relative w-full mx-auto"
          style={{
            aspectRatio: "2800 / 2070",
            border: "1px solid #000",
            backgroundColor: "#f0f8ff",
            fontFamily: "monospace",
            maxWidth: 560,
          }}
        >
          {/* Top trim strip */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: "1.6%",
              background: "rgba(158,158,158,0.12)",
              borderBottom: "1px dashed rgba(120,120,120,0.45)",
            }}
          />
          {/* Bottom trim strip */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              height: "1.6%",
              background: "rgba(158,158,158,0.12)",
              borderTop: "1px dashed rgba(120,120,120,0.45)",
            }}
          />
          {/* Left trim strip */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              left: 0,
              width: "1.0%",
              background: "rgba(158,158,158,0.12)",
              borderRight: "1px dashed rgba(120,120,120,0.45)",
            }}
          />
          {/* Right trim strip */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              right: 0,
              width: "1.0%",
              background: "rgba(158,158,158,0.12)",
              borderLeft: "1px dashed rgba(120,120,120,0.45)",
            }}
          />

          {/* Placements */}
          {PLACEMENTS.map((p, i) => (
            <div
              key={i}
              className="absolute border border-slate-700 flex items-center justify-center"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}%`,
                height: `${p.h}%`,
                backgroundColor: panelColor(p.area),
              }}
            >
              <span className="text-[6px] sm:text-[7px] font-mono text-slate-700/85">
                {p.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
          <span>1 tábla felhasználva • 13 panel elhelyezve</span>
          <span className="font-mono">2070 × 2800 mm</span>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
 *  OptiQuoteCard: Árajánlat
 * ====================================================================== */

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "info" | "warning" | "neutral" | "success"
}) {
  const styles = {
    info: "bg-[#e3f2fd] text-[#0d47a1]",
    warning: "bg-[#fff3e0] text-[#e65100]",
    neutral: "bg-slate-200 text-slate-800",
    success: "bg-[#2e7d32] text-white",
  }
  return (
    <span
      className={`inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded ${styles[tone]}`}
    >
      <span className="text-[7.5px] font-medium opacity-90 leading-tight">
        {label}
      </span>
      <span className="text-[10px] font-bold leading-tight whitespace-nowrap">
        {value}
      </span>
    </span>
  )
}

function OptiQuoteCard() {
  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b-2 border-emerald-500 bg-slate-50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[14px] font-bold text-slate-900">Árajánlat</p>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-700 mr-1">
              VÉGÖSSZEG
            </span>
            <SummaryChip label="Nettó" value="198 540 Ft" tone="info" />
            <span className="text-slate-500 text-[10px] font-bold">+</span>
            <SummaryChip label="ÁFA" value="53 606 Ft" tone="warning" />
            <span className="text-slate-500 text-[10px] font-bold">=</span>
            <SummaryChip label="Bruttó" value="252 146 Ft" tone="neutral" />
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <p className="text-[11px] font-bold text-[#1976d2]">
            F021 ST75 Triestino terrakotta
          </p>
          <ChipMock label="Raktári" tone="success" />
        </div>
        <div className="rounded border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-[9.5px] border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="py-1 px-2 font-semibold text-slate-700">
                  Tábla
                </th>
                <th className="py-1 px-2 font-semibold text-slate-700">
                  Kihasználtság
                </th>
                <th className="py-1 px-2 font-semibold text-slate-700 text-right">
                  Nettó
                </th>
                <th className="py-1 px-2 font-semibold text-slate-700 text-right">
                  ÁFA
                </th>
                <th className="py-1 px-2 font-semibold text-slate-700 text-right">
                  Bruttó
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200/90">
                <td className="py-1 px-2 text-slate-800">Tábla #1</td>
                <td className="py-1 px-2 text-slate-700">87,6 %</td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  36 240 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  9 785 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-900 font-bold font-mono">
                  46 025 Ft
                </td>
              </tr>
              <tr className="border-b border-slate-200/90 bg-slate-50/60">
                <td
                  className="py-1 px-2 text-slate-700 font-semibold"
                  colSpan={2}
                >
                  Élzárás (ABS 1 mm • 24,8 fm)
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  9 920 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  2 678 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-900 font-bold font-mono">
                  12 598 Ft
                </td>
              </tr>
              <tr className="border-b border-slate-200/90 bg-slate-50/60">
                <td
                  className="py-1 px-2 text-slate-700 font-semibold"
                  colSpan={2}
                >
                  Vágási díj
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  2 100 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  567 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-900 font-bold font-mono">
                  2 667 Ft
                </td>
              </tr>
              <tr className="bg-slate-50/60">
                <td
                  className="py-1 px-2 text-slate-700 font-semibold"
                  colSpan={2}
                >
                  Pánthelyfúrás (24 db)
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  3 600 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-800 font-mono">
                  972 Ft
                </td>
                <td className="py-1 px-2 text-right text-slate-900 font-bold font-mono">
                  4 572 Ft
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
 *  Main export
 * ====================================================================== */

export default function OptiMockup({
  variant = "input",
}: {
  variant?: Variant
}) {
  if (variant === "input") {
    return (
      <Frame>
        <BrowserChrome />
        <PageHeader title="Új ajánlat" />
        <OptiInputCard />
      </Frame>
    )
  }

  // "result" / "full" → optimalizálási eredmények
  return (
    <Frame>
      <BrowserChrome />
      <PageHeader title="Optimalizálási eredmények" />
      <div className="bg-[#fafbfc] p-3 space-y-3">
        <OptiCuttingPlan />
        <OptiQuoteCard />
      </div>
    </Frame>
  )
}
