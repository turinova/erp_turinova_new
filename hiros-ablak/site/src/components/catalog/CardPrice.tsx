import { displayPriceGross, formatHuf, type PriceUnitKind } from "@/lib/catalog-price"

type Props = {
  priceGross: number | null | undefined
  kind: PriceUnitKind
  lengthMm: number
  widthMm?: number | null
  onStock: boolean
  compact?: boolean
}

/** Kártya ár: saját sor, alatta halk egység + méret. */
export function CardPrice({ priceGross, kind, lengthMm, widthMm, onStock, compact }: Props) {
  const price = displayPriceGross(priceGross)
  const unit = kind === "sheet" ? "egész tábla" : "egész szál"
  const size = kind === "sheet" ? `${lengthMm}×${widthMm ?? 0}` : `${lengthMm} mm`
  return (
    <div className="mt-auto pt-3">
      {price != null ? (
        <div
          className={[
            "font-semibold tabular-nums text-black",
            compact ? "text-base" : "text-lg",
          ].join(" ")}
        >
          {formatHuf(price)}
        </div>
      ) : (
        <div className="text-sm font-medium text-black/55">Ár egyeztetésre</div>
      )}
      <div className="mt-0.5 text-xs text-black/50">
        {unit} · {size}
        {onStock ? "" : " · rendelésre"}
      </div>
    </div>
  )
}
