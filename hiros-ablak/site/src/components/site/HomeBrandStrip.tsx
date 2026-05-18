import Link from "next/link"
import {
  fetchCatalogBrands,
  pickFeaturedCatalogBrands,
} from "@/lib/catalog-brands"
import { showroomFeaturedChipItems } from "@/lib/showroom-brands"
import { BrandChips } from "@/components/site/BrandChips"

export async function HomeBrandStrip() {
  const catalog = await fetchCatalogBrands()
  const catalogItems = pickFeaturedCatalogBrands(catalog, 8)
  const showroomItems = showroomFeaturedChipItems()

  if (catalogItems.length === 0 && showroomItems.length === 0) return null

  return (
    <div className="mt-10 space-y-6">
      {catalogItems.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-black/55 md:w-44 md:shrink-0">
            <span
              aria-hidden
              className="mr-2 inline-block h-2 w-6 rounded-full bg-[var(--color-brand)]/80 align-middle"
            />
            Bútorlap / munkalap
          </div>
          <BrandChips items={catalogItems} linked size="sm" />
        </div>
      ) : null}

      {showroomItems.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-black/55 md:w-44 md:shrink-0">
            <span
              aria-hidden
              className="mr-2 inline-block h-2 w-6 rounded-full bg-black/25 align-middle"
            />
            Áruház
          </div>
          <BrandChips items={showroomItems} linked size="sm" />
        </div>
      ) : null}

      <p className="text-center text-xs text-black/55 md:text-left">
        <Link
          href="/barkacsaruhaz-kecskemet"
          className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
        >
          További márkák a bemutatóteremben →
        </Link>
      </p>
    </div>
  )
}
