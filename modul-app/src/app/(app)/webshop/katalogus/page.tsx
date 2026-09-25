import type { Metadata } from 'next'

import { WebshopCatalogClient } from '@/components/webshop/webshop-catalog-client'
import { listAccessories } from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export const metadata: Metadata = { title: 'Bolt katalógus' }

export default async function WebshopKatalogusPage() {
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

  const rows = await listAccessories(supabase, user.tenantId)
  return <WebshopCatalogClient initialRows={rows} />
}
