import type { Metadata } from 'next'
import Link from 'next/link'

import { OptiWorkspaceClient } from '@/components/opti/opti-workspace-client'
import type { PartnerOptiCustomerSnapshot } from '@/components/opti/partner-opti-save-strip'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'
import {
  getCuttingFee,
  toOptiCuttingFeeConfig
} from '@/lib/cutting-fees/queries'
import {
  listOptiEdgeMaterials,
  listOptiSheetMaterials
} from '@/lib/opti/queries'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'
import { getQuoteForOptiEdit } from '@/lib/quotes/opti-edit'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Opti · Asztalos'
}

type SearchParams = Promise<{
  quote_id?: string
}>

export default async function PartnerOptiPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const quoteId = params.quote_id?.trim() || null
  const session = await getPartnerSession()

  if (!session) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Opti</h1>
        <p className="text-body text-ink-secondary">Nincs bejelentkezve.</p>
      </div>
    )
  }

  const tenantId = session.selectedTenantId
  if (!tenantId) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Opti</h1>
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          Nincs kapcsolt cég. Válassz céget a Beállításokban, majd gyere vissza.
        </p>
        <Link
          href={PARTNER_SETTINGS_PATH}
          className="text-hint text-ink no-underline hover:underline"
        >
          Beállítások → Kapcsolt cég
        </Link>
      </div>
    )
  }

  const companyLabel = await resolvePartnerCompanyLabel(tenantId)
  const partnerCustomer: PartnerOptiCustomerSnapshot = {
    name: session.profile.name,
    email: session.profile.email,
    mobile: session.profile.mobile ?? '',
    billingName: session.profile.billing_name ?? '',
    billingCity: session.profile.billing_city ?? '',
    billingPostalCode: session.profile.billing_postal_code ?? '',
    billingStreet: session.profile.billing_street ?? '',
    billingHouseNumber: session.profile.billing_house_number ?? '',
    billingTaxNumber: session.profile.billing_tax_number ?? ''
  }

  let loadError: string | null = null
  let sheetMaterials: Awaited<ReturnType<typeof listOptiSheetMaterials>> = []
  let edgeMaterials: Awaited<ReturnType<typeof listOptiEdgeMaterials>> = []
  let cuttingFee: ReturnType<typeof toOptiCuttingFeeConfig> = null
  let initialEdit: Awaited<ReturnType<typeof getQuoteForOptiEdit>> = null
  let editLoadError: string | null = null

  const supabase = await createClient()
  if (!supabase) {
    loadError = 'Az adatbázis kapcsolat nem elérhető.'
  } else {
    try {
      const [sheets, edges, feeRow] = await Promise.all([
        listOptiSheetMaterials(supabase, tenantId),
        listOptiEdgeMaterials(supabase, tenantId),
        getCuttingFee(supabase, tenantId)
      ])
      sheetMaterials = sheets
      edgeMaterials = edges
      cuttingFee = toOptiCuttingFeeConfig(feeRow)

      if (quoteId) {
        const edit = await getQuoteForOptiEdit(
          supabase,
          tenantId,
          quoteId,
          sheetMaterials,
          edgeMaterials,
          { partnerMode: true }
        )
        if (!edit) {
          editLoadError = 'Az ajánlat nem található, vagy nincs hozzáférésed.'
        } else if (!edit.editable) {
          editLoadError =
            edit.warnings[0] ?? 'Ez a dokumentum nem szerkeszthető.'
          initialEdit = edit
        } else {
          initialEdit = edit
        }
      }
    } catch (err) {
      loadError =
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni az Opti adatokat.'
    }
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Opti</h1>
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
    <OptiWorkspaceClient
      mode="partner"
      sheetMaterials={sheetMaterials}
      edgeMaterials={edgeMaterials}
      cuttingFee={cuttingFee}
      customers={[]}
      partnerCustomer={partnerCustomer}
      companyLabel={companyLabel}
      initialEdit={initialEdit}
      editLoadError={editLoadError}
      description={
        companyLabel
          ? `Lapszabászat — ${companyLabel} anyagai és árai.`
          : 'Lapszabászat a kapcsolt cég anyagaival és áraival.'
      }
    />
  )
}
