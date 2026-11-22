import type { Metadata } from 'next'

import { KioskSettingsClient } from '@/components/kiosk/kiosk-settings-client'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import {
  ensureKioskSettingsRow,
  getTenantSlugAndName,
  listKioskDevices,
  listKioskEdgeOptions,
  listKioskSheetOptions
} from '@/lib/kiosk/settings-queries'
import { DEFAULT_KIOSK_SETTINGS } from '@/lib/kiosk/settings-types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kiosk beállítások'
}

export default async function KioskSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let initial = { ...DEFAULT_KIOSK_SETTINGS }
  let devices: Awaited<ReturnType<typeof listKioskDevices>> = []
  let edges: Awaited<ReturnType<typeof listKioskEdgeOptions>> = []
  let sheets: Awaited<ReturnType<typeof listKioskSheetOptions>> = []
  let tenantSlug = 'demo'
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const hasLapszab = await tenantHasLapszabaszat(supabase, user.tenantId)
        if (!hasLapszab) {
          loadError =
            'A Lapszabászat modul nincs bekapcsolva ennél a cégnél. A kiosk a Lapszabászat része.'
        } else {
          const [settings, deviceRows, edgeRows, sheetRows, tenant] =
            await Promise.all([
              ensureKioskSettingsRow(supabase, user.tenantId),
              listKioskDevices(supabase, user.tenantId),
              listKioskEdgeOptions(supabase, user.tenantId),
              listKioskSheetOptions(supabase, user.tenantId),
              getTenantSlugAndName(supabase, user.tenantId)
            ])
          initial = settings
          devices = deviceRows
          edges = edgeRows
          sheets = sheetRows
          if (tenant?.slug) tenantSlug = tenant.slug
        }
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a kiosk beállításokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a 20261020_kiosk_settings migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Kiosk beállítások</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <KioskSettingsClient
      initial={initial}
      devices={devices}
      edges={edges}
      sheets={sheets}
      tenantSlug={tenantSlug}
      canWrite={canWrite}
    />
  )
}
