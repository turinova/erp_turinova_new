import type { Metadata } from 'next'

import { WebshopCatalogClient } from '@/components/webshop/webshop-catalog-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import {
  listShopCatalog,
  SHOP_CATALOG_FILTERS,
  type ShopCatalogFilter
} from '@/lib/webshop/product-queries'

export const metadata: Metadata = { title: 'Bolt katalógus' }

type PageProps = {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>
}

export default async function WebshopKatalogusPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filter = (
    SHOP_CATALOG_FILTERS as readonly string[]
  ).includes(sp.filter ?? '')
    ? (sp.filter as ShopCatalogFilter)
    : 'all'
  const q = (sp.q ?? '').slice(0, 80)
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <p className="text-body text-ink-secondary">
        Dev módban nincs tenant adatbázis.
      </p>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>
    )
  }

  const entitled = await tenantHasWebshop(supabase, user.tenantId)
  if (!entitled) {
    return (
      <p className="text-body text-ink-secondary">
        Az Online bolt add-on nincs bekapcsolva.
      </p>
    )
  }

  const data = await listShopCatalog(supabase, user.tenantId, { filter, q, page })
  return (
    <WebshopCatalogClient
      data={data}
      filter={filter}
      q={q}
      canWrite={Boolean(user.role && user.role !== 'viewer')}
    />
  )
}
