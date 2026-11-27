import {
  displayPriceGross,
  formatHuf,
  priceUnitLabel,
  type PriceUnitKind,
} from "@/lib/catalog-price"

type Props = {
  priceGross: number | null | undefined
  kind: PriceUnitKind
  directionsUrl: string
  primaryLabel?: string
}

/** Alsó sticky sáv mobilra: ár + útvonal (egy primary). */
export function MobilePriceCta({
  priceGross,
  kind,
  directionsUrl,
  primaryLabel = "Útvonal →",
}: Props) {
  const price = displayPriceGross(priceGross)
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          {price != null ? (
            <>
              <div className="truncate text-base font-semibold tabular-nums text-black">
                {formatHuf(price)}
              </div>
              <div className="truncate text-[11px] text-black/55">{priceUnitLabel(kind)}</div>
            </>
          ) : (
            <div className="text-sm font-semibold text-black/85">Ár egyeztetésre</div>
          )}
        </div>
        <a
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
        >
          {primaryLabel}
        </a>
      </div>
    </div>
  )
}
