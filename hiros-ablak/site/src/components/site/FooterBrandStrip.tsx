import Link from "next/link"
import {
  catalogBrandChipItems,
  fetchCatalogBrands,
  mergeCatalogBrandNames,
} from "@/lib/catalog-brands"
import { flattenShowroomChipItems } from "@/lib/showroom-brands"
import { BrandChips } from "@/components/site/BrandChips"

const FOOTER_CATALOG_LIMIT = 14
const FOOTER_SHOWROOM_LIMIT = 18

export async function FooterBrandStrip() {
  const catalog = await fetchCatalogBrands()
  const allCatalog = mergeCatalogBrandNames(catalog)
  const catalogItems = catalogBrandChipItems(
    catalog,
    allCatalog.slice(0, FOOTER_CATALOG_LIMIT),
  )
  const showroomItems = flattenShowroomChipItems().slice(0, FOOTER_SHOWROOM_LIMIT)

  return (
    <div className="space-y-5">
      {catalogItems.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
          <div className="md:w-44 md:shrink-0 md:pt-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black/55">
              <span
                aria-hidden
                className="inline-block h-2 w-6 rounded-full bg-[var(--color-brand)]/80"
              />
              Bútorlap / munkalap
            </div>
            <p className="mt-1 hidden text-xs text-black/55 md:block">
              Online katalógus, méretre vágás
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <BrandChips items={catalogItems} linked size="sm" />
            {allCatalog.length > FOOTER_CATALOG_LIMIT ? (
              <Link
                href="/butorlap"
                className="mt-2 inline-block text-xs font-semibold text-[var(--color-brand)] underline underline-offset-4"
              >
                Összes dekor a katalógusban →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {showroomItems.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
          <div className="md:w-44 md:shrink-0 md:pt-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black/55">
              <span
                aria-hidden
                className="inline-block h-2 w-6 rounded-full bg-black/25"
              />
              Áruház
            </div>
            <p className="mt-1 hidden text-xs text-black/55 md:block">
              Vasalat, mosogató, szerszám
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <BrandChips items={showroomItems} linked size="sm" />
            <Link
              href="/barkacsaruhaz-kecskemet"
              className="mt-2 inline-block text-xs font-semibold text-[var(--color-brand)] underline underline-offset-4"
            >
              Bemutatóterem és készlet →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
