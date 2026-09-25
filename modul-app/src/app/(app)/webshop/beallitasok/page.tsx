import type { Metadata } from 'next'

import { WebshopSettingsClient } from '@/components/webshop/webshop-settings-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { getStorefrontSettings } from '@/lib/webshop/settings'

export const metadata: Metadata = { title: 'Bolt beállítások' }

export default async function WebshopBeallitasokPage() {
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

  const settings = await getStorefrontSettings(supabase, user.tenantId)
  return <WebshopSettingsClient initial={settings} canWrite={canWrite} />
}
