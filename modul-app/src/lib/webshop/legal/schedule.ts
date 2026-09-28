import { after } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'
import { syncAllLegalVersions } from '@/lib/webshop/legal/versions'

/** Mentés után, a válasz elküldését követően rögzíti a jogi oldalak új változatait. */
export function scheduleLegalSync(tenantId: string): void {
  after(async () => {
    const admin = createServiceClient()
    if (!admin) return
    try {
      await syncAllLegalVersions(admin, tenantId)
    } catch (e) {
      console.error('scheduleLegalSync', e)
    }
  })
}
