import {
  displayPriceGross,
  formatHuf,
  type PriceUnitKind,
} from "@/lib/catalog-price"

type Props = {
  priceGross: number | null | undefined
  kind: PriceUnitKind
  lengthMm: number
  widthMm?: number | null
  onStock: boolean
  city: string
  className?: string
}

/** Ajánlat blokk: nagy ár + egy sor egység + egységár + készlet. */
export function ProductPriceBlock({ priceGross, kind, lengthMm, widthMm, onStock, city, className }: Props) {
  const price = displayPriceGross(priceGross)
  const isSheet = kind === "sheet"
  const unitLine = isSheet
    ? `egész tábla · ${lengthMm} × ${widthMm ?? 0} mm · bruttó`
    : `egész szál · ${lengthMm} mm · bruttó`
  const area = isSheet ? (lengthMm * Number(widthMm ?? 0)) / 1e6 : lengthMm / 1000
  const unitPrice = price != null && area > 0 ? `≈ ${formatHuf(price / area)}/${isSheet ? "m²" : "fm"}` : null

  return (
    <div className={className}>
      {price != null ? (
        <>
          <div className="text-4xl font-semibold tracking-tight text-black tabular-nums">{formatHuf(price)}</div>
          <div className="mt-1 text-sm text-black/60">{unitLine}</div>
          {unitPrice ? <div className="mt-0.5 text-xs text-black/45 tabular-nums">{unitPrice}</div> : null}
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold text-black/85">Ár egyeztetésre</div>
          <div className="mt-1 text-sm text-black/60">Hívjon minket a pontos árért.</div>
        </>
      )}
      <div
        className={[
          "mt-3 flex items-start gap-2 text-sm font-medium",
          onStock ? "text-emerald-800" : "text-sky-800",
        ].join(" ")}
      >
        <span aria-hidden>{onStock ? "✓" : "↻"}</span>
        <span>
          {onStock
            ? `Raktáron – átvehető ${city}en`
            : "Rendelésre – beszerezzük, az időpontot egyeztetjük"}
        </span>
      </div>
    </div>
  )
}

/** Méretre vágás upsell (nem figyelmeztetés). */
export function CuttingUpsellCard({ kind }: { kind: PriceUnitKind }) {
  return (
    <a
      href="/szolgaltatasok/lapszabaszat-es-elzaras"
      className="group mt-5 block rounded-2xl border border-black/10 bg-stone-50/70 p-4 hover:border-black/20"
    >
      <div className="text-sm font-semibold text-black/85">Méretre vágjuk és élzárjuk</div>
      <p className="mt-1 text-sm text-black/65">
        {kind === "sheet"
          ? "Hozza a méreteket, mi kiszabjuk és élzárjuk a lapot."
          : "Méretre vágjuk a szálat, élzárást is vállalunk."}
      </p>
      <div className="mt-2 text-sm font-semibold text-[var(--color-brand)] group-hover:underline">
        Lapszabászat és élzárás →
      </div>
    </a>
  )
}
