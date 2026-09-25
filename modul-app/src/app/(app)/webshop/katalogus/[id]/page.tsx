import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ShopProductEditor } from '@/components/webshop/product-editor/shop-product-editor'
import { getSessionUser } from '@/lib/auth/session'
import { namedEntityTabTitle } from '@/lib/seo/tab-titles'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { getShopProduct } from '@/lib/webshop/product-queries'
import { listProductAttributes, listWebCategories } from '@/lib/webshop/queries'
import { getTenantWebshopSettings } from '@/lib/webshop/settings'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) return { title: 'Bolt adatok' }
  const supabase = await createClient()
  if (!supabase) return { title: 'Bolt adatok' }
  const label = await namedEntityTabTitle(supabase, 'accessories', user.tenantId, id)
  return { title: label ? `${label} · bolt adatok` : 'Bolt adatok' }
}

export default async function ShopProductPage({ params }: { params: Params }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()
  const supabase = await createClient()
  if (!supabase) notFound()

  if (!(await tenantHasWebshop(supabase, user.tenantId))) {
    return (
      <p className="text-body text-ink-secondary">Az Online bolt modul nincs bekapcsolva.</p>
    )
  }

  const [detail, categories, attributes, shippingDefaults] = await Promise.all([
    getShopProduct(supabase, user.tenantId, id),
    listWebCategories(supabase, user.tenantId),
    listProductAttributes(supabase, user.tenantId),
    getTenantWebshopSettings(supabase, user.tenantId)
  ])
  if (!detail) notFound()

  return (
    <ShopProductEditor
      key={id}
      detail={detail}
      categories={categories}
      attributes={attributes}
      shippingDefaults={shippingDefaults}
      tenantId={user.tenantId}
      canWrite={Boolean(user.role && user.role !== 'viewer')}
    />
  )
}
