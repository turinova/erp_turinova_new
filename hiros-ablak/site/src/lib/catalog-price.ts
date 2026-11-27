/** Publikus katalógus ár + készlet — hiros-ablak weblap. */

const huf = new Intl.NumberFormat("hu-HU")

export function formatHuf(amount: number): string {
  return `${huf.format(Math.round(amount))} Ft`
}

/** null / ≤0 → nincs megjeleníthető ár */
export function displayPriceGross(priceGross: number | null | undefined): number | null {
  const n = Number(priceGross)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export function stockLabel(onStock: boolean): string {
  return onStock ? "Raktáron" : "Rendelésre"
}

export function stockSubLabel(onStock: boolean): string {
  return onStock ? "Most átvehető" : "Beszerezzük Önnek"
}

export function stockClass(onStock: boolean): string {
  return onStock
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-sky-200 bg-sky-50 text-sky-900"
}

export function reassuranceCardClass(onStock: boolean): string {
  return onStock
    ? "border-emerald-100 bg-emerald-50/40"
    : "border-sky-100 bg-sky-50/40"
}

export function stockMessage(onStock: boolean, city: string): string {
  if (onStock) {
    return `Raktáron: most átvehető a ${city.toLowerCase()}i áruházunkban.`
  }
  return "Rendelésre: most nincs raktáron, de Önnek beszerezzük. A beszerzési idő márkától és szállítótól függ; a pontos időt megrendeléskor egyeztetjük."
}

export type PriceUnitKind = "sheet" | "linear"

export function priceUnitLabel(kind: PriceUnitKind): string {
  return kind === "sheet" ? "bruttó · egész tábla" : "bruttó · egész szál"
}

export function priceHint(kind: PriceUnitKind): string {
  return kind === "sheet"
    ? "Méretre vágás és élzárás külön."
    : "Méretre vágás és élzárás külön."
}
