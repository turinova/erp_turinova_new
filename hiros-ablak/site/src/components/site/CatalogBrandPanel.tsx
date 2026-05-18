import Link from "next/link"
import {
  catalogBrandChipItems,
  fetchCatalogBrands,
  mergeCatalogBrandNames,
} from "@/lib/catalog-brands"
import { BrandChipGroup } from "@/components/site/BrandChips"

type CatalogBrandPanelProps = {
  /** Section heading inside a group card */
  label?: string
  /** Max chips (undefined = all brands) */
  limit?: number
  className?: string
  showCatalogLinks?: boolean
}

export async function CatalogBrandPanel({
  label = "Bútorlap és munkalap",
  limit,
  className = "",
  showCatalogLinks = false,
}: CatalogBrandPanelProps) {
  const catalog = await fetchCatalogBrands()
  const allNames = mergeCatalogBrandNames(catalog)
  if (allNames.length === 0) return null

  const names = limit ? allNames.slice(0, limit) : allNames
  const items = catalogBrandChipItems(catalog, names)

  return (
    <div className={className}>
      {showCatalogLinks ? (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">
            {label}
          </h3>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
              href="/butorlap"
            >
              Bútorlap katalógus →
            </Link>
            <Link
              className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
              href="/munkalap"
            >
              Munkalap katalógus →
            </Link>
          </div>
        </div>
      ) : null}
      <BrandChipGroup label={showCatalogLinks ? "" : label} items={items} linked />
    </div>
  )
}
