import { NextResponse, type NextRequest } from 'next/server'

import { listCategoryProducts } from '@/lib/storefront/catalog'
import { CATALOG_PARAM } from '@/lib/storefront/catalog-params'
import { getStorefrontShell } from '@/lib/storefront/shell'

const EMPTY = { total: 0, facets: [], priceBounds: null }

/** Szűrő panel élő darabszáma — a kategória oldallal azonos logika. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const slug = (sp.get('k') ?? '').trim().toLowerCase().slice(0, 200)
  if (!slug) return NextResponse.json(EMPTY, { status: 400 })

  const shell = await getStorefrontShell()
  if (!shell) return NextResponse.json(EMPTY, { status: 404 })
  const category = shell.categories.find((c) => c.slug === slug)
  if (!category) return NextResponse.json(EMPTY, { status: 404 })

  const params: Record<string, string | undefined> = {}
  for (const [k, v] of sp) {
    if (k === 'k' || k === CATALOG_PARAM.page || k === CATALOG_PARAM.sort) continue
    params[k] = v.slice(0, 120)
  }
  const { total, facets, priceBounds } = await listCategoryProducts(
    shell.admin,
    shell.tenant.id,
    shell.categories,
    category,
    params,
    1,
    { reviewsEnabled: false }
  )
  return NextResponse.json(
    { total, facets, priceBounds },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } }
  )
}
