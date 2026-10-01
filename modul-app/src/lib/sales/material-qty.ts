/** Eladási mennyiség (m² / m) és készlet-átváltás — P0 anyag eladás. */

export type SaleLineKind =
  | 'product'
  | 'fee'
  | 'sheet_material'
  | 'linear_material'

export type SaleCatalogKind = 'product' | 'sheet_material' | 'linear_material'

/** Anyag eladási qty: max 1 tizedes, ≥ 0,1. */
export function roundSaleMaterialQty(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.round(raw * 10) / 10
}

export function parseSaleMaterialQtyInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  const rounded = roundSaleMaterialQty(value)
  return rounded > 0 ? rounded : null
}

export function formatSaleQty(
  qty: number,
  kind: SaleCatalogKind | SaleLineKind
): string {
  if (kind === 'sheet_material' || kind === 'linear_material') {
    return qty.toLocaleString('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    })
  }
  if (Number.isInteger(qty)) return String(qty)
  return qty.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function saleUnitLabel(
  kind: SaleCatalogKind | SaleLineKind,
  unitShortform?: string | null
): string {
  if (kind === 'sheet_material') return 'm²'
  if (kind === 'linear_material') return 'm'
  return unitShortform?.trim() || 'db'
}

/** Tábla területe m²-ben. */
export function sheetAreaM2(lengthMm: number, widthMm: number): number {
  if (!(lengthMm > 0) || !(widthMm > 0)) return 0
  return (lengthMm * widthMm) / 1_000_000
}

/** Szál hossz méterben. */
export function linearLengthM(lengthMm: number): number {
  if (!(lengthMm > 0)) return 0
  return lengthMm / 1000
}

/** Eladott m² → tábla készlet qty. */
export function sheetStockOutFromSoldM2(
  soldM2: number,
  lengthMm: number,
  widthMm: number
): number {
  const area = sheetAreaM2(lengthMm, widthMm)
  if (area <= 0) return 0
  return Math.round((soldM2 / area) * 1_000_000) / 1_000_000
}

/** Eladott m → szál készlet (fm: 1:1; db: darab). */
export function linearStockOutFromSoldM(
  soldM: number,
  lengthMm: number,
  stockUnit: 'db' | 'fm'
): number {
  if (stockUnit === 'fm') return Math.round(soldM * 1000) / 1000
  const pieceM = linearLengthM(lengthMm)
  if (pieceM <= 0) return 0
  return Math.round((soldM / pieceM) * 1_000_000) / 1_000_000
}

/** Készlet (tábla/db/fm) → eladható m² / m. */
export function sellableFromStock(
  onHandStock: number,
  kind: 'sheet_material' | 'linear_material',
  factor: number
): number {
  if (!(factor > 0)) return 0
  if (kind === 'sheet_material') {
    return Math.round(onHandStock * factor * 10) / 10
  }
  // linear: factor = piece length m when stock_unit=db; 1 when fm
  return Math.round(onHandStock * factor * 10) / 10
}

export function isMaterialSaleKind(
  kind: string | null | undefined
): kind is 'sheet_material' | 'linear_material' {
  return kind === 'sheet_material' || kind === 'linear_material'
}

export function saleLineCartKey(line: {
  kind?: SaleCatalogKind | null
  accessoryId?: string | null
  sheetMaterialId?: string | null
  linearMaterialId?: string | null
  id?: string
}): string {
  const kind = line.kind ?? 'product'
  if (kind === 'sheet_material') {
    return `sheet:${line.sheetMaterialId ?? line.id ?? ''}`
  }
  if (kind === 'linear_material') {
    return `linear:${line.linearMaterialId ?? line.id ?? ''}`
  }
  return `product:${line.accessoryId ?? line.id ?? ''}`
}

export function materialSizeLabel(
  lengthMm: number,
  widthMm: number,
  thicknessMm: number
): string {
  const t =
    Number.isInteger(thicknessMm) || Math.abs(thicknessMm - Math.round(thicknessMm)) < 0.001
      ? String(Math.round(thicknessMm))
      : thicknessMm.toLocaleString('hu-HU', { maximumFractionDigits: 2 })
  return `${lengthMm}×${widthMm}×${t}`
}

/** Ledger qty formázás (tábla / db / fm) — max 3 tizedes. */
export function formatLedgerQty(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

/** Eladási / kimutatási qty (m² / m) — max 1 tizedes. */
export function formatDisplayAreaQty(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  })
}

/**
 * Dual egység: ledger (tábla/db) ↔ megjelenítés (m²/m).
 * - stock_view: primary m²/m, secondary ≈ tábla/db
 * - procurement_view: primary tábla/db, secondary ≈ m²/m
 */
export type DualQtyPrimary = 'display' | 'ledger'

export type DualQtyOpts = {
  factor: number
  ledgerLabel: string
  displayLabel: string
  primary: DualQtyPrimary
}

export function dualQtyParts(
  ledgerQty: number,
  opts: DualQtyOpts
): { primaryText: string; secondaryText: string | null } {
  const factor = opts.factor
  if (!(factor > 0) || !Number.isFinite(ledgerQty)) {
    return {
      primaryText: `${formatLedgerQty(ledgerQty)} ${opts.ledgerLabel}`,
      secondaryText: null
    }
  }
  const displayQty = ledgerQty * factor
  if (
    opts.ledgerLabel === opts.displayLabel &&
    Math.abs(factor - 1) < 0.0001
  ) {
    const label = opts.primary === 'display' ? opts.displayLabel : opts.ledgerLabel
    const text =
      opts.primary === 'display'
        ? `${formatDisplayAreaQty(displayQty)} ${label}`
        : `${formatLedgerQty(ledgerQty)} ${label}`
    return { primaryText: text, secondaryText: null }
  }
  if (opts.primary === 'display') {
    return {
      primaryText: `${formatDisplayAreaQty(displayQty)} ${opts.displayLabel}`,
      secondaryText: `≈ ${formatLedgerQty(ledgerQty)} ${opts.ledgerLabel}`
    }
  }
  return {
    primaryText: `${formatLedgerQty(ledgerQty)} ${opts.ledgerLabel}`,
    secondaryText: `≈ ${formatDisplayAreaQty(displayQty)} ${opts.displayLabel}`
  }
}

export function sheetDualQtyOpts(
  lengthMm: number,
  widthMm: number,
  primary: DualQtyPrimary
): DualQtyOpts | null {
  const factor = sheetAreaM2(lengthMm, widthMm)
  if (!(factor > 0)) return null
  return {
    factor,
    ledgerLabel: 'tábla',
    displayLabel: 'm²',
    primary
  }
}

export function linearDualQtyOpts(
  lengthMm: number,
  stockUnit: 'db' | 'fm',
  primary: DualQtyPrimary
): DualQtyOpts | null {
  if (stockUnit === 'fm') {
    // Ledger ≈ méter — nincs átváltás, egységes „m”.
    return {
      factor: 1,
      ledgerLabel: 'm',
      displayLabel: 'm',
      primary
    }
  }
  const factor = linearLengthM(lengthMm)
  if (!(factor > 0)) return null
  return {
    factor,
    ledgerLabel: 'db',
    displayLabel: 'm',
    primary
  }
}
