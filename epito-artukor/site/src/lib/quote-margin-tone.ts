import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"

/** Fedezet % vizuális sáv — a cég minimumához igazítva. */
export type MarginToneBand = "critical" | "tight" | "ok" | "strong"

export function resolveMarginToneBand(
  marginPercent: number | null | undefined,
  minAcceptable: number = getMinAcceptableMarginPercent()
): MarginToneBand | null {
  if (marginPercent == null || !Number.isFinite(marginPercent)) return null
  if (marginPercent < minAcceptable) return "critical"
  if (marginPercent < minAcceptable + 6) return "tight"
  if (marginPercent < minAcceptable + 13) return "ok"
  return "strong"
}

/** Σ fedezet / % eredmény szöveg. */
export function marginResultToneClass(band: MarginToneBand | null): string {
  switch (band) {
    case "critical":
      return "font-medium !text-red-800"
    case "tight":
      return "font-medium !text-amber-900"
    case "ok":
      return "font-medium !text-emerald-900"
    case "strong":
      return "font-semibold !text-emerald-950"
    default:
      return "font-medium text-slate-700"
  }
}

/** Ráterhelés % input háttér — ugyanaz a sáv, enyhébb. */
export function marginInputToneClass(band: MarginToneBand | null): string {
  switch (band) {
    case "critical":
      return "bg-red-50"
    case "tight":
      return "bg-amber-50"
    case "ok":
      return "bg-emerald-50/80"
    case "strong":
      return "bg-emerald-100/90"
    default:
      return ""
  }
}

export function marginToneTitle(
  band: MarginToneBand | null,
  minAcceptable: number = getMinAcceptableMarginPercent()
): string | undefined {
  switch (band) {
    case "critical":
      return `Alacsony fedezet — cél: min. ${minAcceptable}%`
    case "tight":
      return `Szűk fedezet — cél: min. ${minAcceptable}%`
    case "ok":
      return "Egészséges fedezet"
    case "strong":
      return "Erős fedezet"
    default:
      return undefined
  }
}

/** Hero / státusz címke — építésvezetői nyelv. */
export function marginStatusLabel(band: MarginToneBand | null): string {
  switch (band) {
    case "critical":
      return "Emeld a fedezetet"
    case "tight":
      return "Szűk — figyeld"
    case "ok":
      return "Rendben"
    case "strong":
      return "Erős fedezet"
    default:
      return "Nincs szám"
  }
}

export function marginStatusBadgeClass(band: MarginToneBand | null): string {
  switch (band) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-900"
    case "tight":
      return "border-amber-300 bg-amber-50 text-amber-950"
    case "ok":
      return "border-emerald-300 bg-emerald-50 text-emerald-900"
    case "strong":
      return "border-emerald-400 bg-emerald-100 text-emerald-950"
    default:
      return "border-slate-300 bg-slate-50 text-slate-700"
  }
}

export function marginTdToneClass(band: MarginToneBand | null): string {
  switch (band) {
    case "critical":
      return "bg-red-50"
    case "tight":
      return "bg-amber-50"
    case "ok":
      return "bg-emerald-50"
    case "strong":
      return "bg-emerald-100"
    default:
      return ""
  }
}

export const MARGIN_LEGEND: {
  band: MarginToneBand
  label: string
  swatch: string
}[] = [
  { band: "critical", label: "Alacsony", swatch: "bg-red-400" },
  { band: "tight", label: "Szűk", swatch: "bg-amber-400" },
  { band: "ok", label: "Rendben", swatch: "bg-emerald-400" },
  { band: "strong", label: "Erős", swatch: "bg-emerald-600" },
]
