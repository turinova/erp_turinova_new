import type { Metadata } from 'next'

import { WebshopLegalClient, type LegalDocRow } from '@/components/webshop/webshop-legal-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { latestLegalVersions, loadAdminLegal } from '@/lib/webshop/legal/admin'
import { LEGAL_DOCS } from '@/lib/webshop/legal/constants'
import { LEGAL_DOC_KINDS } from '@/lib/webshop/legal/types'

export const metadata: Metadata = { title: 'Jogi oldalak' }

export default async function WebshopJogiPage() {
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

  const [admin, versions] = await Promise.all([
    loadAdminLegal(supabase, user.tenantId),
    latestLegalVersions(supabase, user.tenantId)
  ])
  const docs: LegalDocRow[] = LEGAL_DOC_KINDS.map((kind) => ({
    kind,
    title: LEGAL_DOCS[kind].title,
    url:
      kind === 'aszf' && admin.legal.termsUrl?.startsWith('http')
        ? admin.legal.termsUrl
        : kind === 'adatkezeles' && admin.legal.privacyUrl?.startsWith('http')
          ? admin.legal.privacyUrl
          : admin.docUrl(kind),
    external:
      (kind === 'aszf' && Boolean(admin.legal.termsUrl)) || (kind === 'adatkezeles' && Boolean(admin.legal.privacyUrl)),
    version: versions.get(kind) ?? null
  }))

  return (
    <WebshopLegalClient
      canWrite={canWrite}
      defaults={admin.defaults}
      legal={admin.legal}
      autoCounty={admin.autoCounty}
      missing={admin.missing}
      docs={docs}
    />
  )
}
