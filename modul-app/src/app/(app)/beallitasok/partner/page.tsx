import type { Metadata } from 'next'
import Link from 'next/link'

import { PartnerSettingsForm } from '@/components/partner-settings/partner-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  getTenantPartnerSettings,
  partnerSearchKindsFromSettings
} from '@/lib/partner-settings/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Online partner'
}

export default async function PartnerSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let loadError: string | null = null
  let missingAddon = false
  let initial = partnerSearchKindsFromSettings(null)

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (!supabase) {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      const { data: entitlement } = await supabase
        .from('tenant_entitlements')
        .select('feature_key')
        .eq('tenant_id', user.tenantId)
        .eq('feature_key', 'partner_orders')
        .maybeSingle()

      if (!entitlement) {
        missingAddon = true
      } else {
        try {
          const settings = await getTenantPartnerSettings(
            supabase,
            user.tenantId
          )
          initial = partnerSearchKindsFromSettings(settings)
          if (!settings) {
            await supabase.from('tenant_partner_settings').upsert(
              {
                tenant_id: user.tenantId,
                search_sheet: true,
                search_linear: true,
                search_accessory: true
              },
              { onConflict: 'tenant_id' }
            )
          }
        } catch (err) {
          loadError =
            err instanceof Error
              ? err.message
              : 'Nem sikerült betölteni a beállításokat.'
        }
      }
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (missingAddon) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Online partner</h1>
        <p className="max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          Az Online partner rendelés add-on nincs bekapcsolva ennél a cégnél. A
          platform kapcsolhatja be.
        </p>
        <Link
          href="/beallitasok/cegadatok"
          className="text-hint text-ink no-underline hover:underline"
        >
          Vissza a cégadatokhoz
        </Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Online partner</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return <PartnerSettingsForm initial={initial} canWrite={canWrite} />
}
