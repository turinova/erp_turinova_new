import type { Metadata } from 'next'

import { WebshopAttributesClient } from '@/components/webshop/webshop-attributes-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { listProductAttributes } from '@/lib/webshop/queries'

export const metadata: Metadata = { title: 'Jellemzők' }

export default async function WebshopTulajdonsagokPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

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

  const rows = await listProductAttributes(supabase, user.tenantId)
  return <WebshopAttributesClient initialRows={rows} canWrite={canWrite} />
}
