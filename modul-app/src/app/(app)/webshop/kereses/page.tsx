import type { Metadata } from 'next'

import { WebshopSearchClient } from '@/components/webshop/webshop-search-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { loadSearchAdmin } from '@/lib/webshop/search-admin'

export const metadata: Metadata = { title: 'Keresések' }

export default async function WebshopKeresesekPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return <p className="text-body text-ink-secondary">Dev módban nincs tenant adatbázis.</p>
  }
  const supabase = await createClient()
  if (!supabase) return <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>

  const entitled = await tenantHasWebshop(supabase, user.tenantId)
  if (!entitled) {
    return <p className="text-body text-ink-secondary">Az Online bolt add-on nincs bekapcsolva.</p>
  }

  const data = await loadSearchAdmin(supabase, user.tenantId)
  if (!data.ok) {
    return (
      <p className="max-w-xl text-body text-ink-secondary">
        {data.missingMigration
          ? 'A kereső statisztikához futtasd le a 20260552_storefront_search migrációt.'
          : 'Most nem sikerült betölteni a keresési adatokat. Frissítsd az oldalt.'}
      </p>
    )
  }
  return <WebshopSearchClient report={data.report} synonyms={data.synonyms} canWrite={canWrite} />
}
