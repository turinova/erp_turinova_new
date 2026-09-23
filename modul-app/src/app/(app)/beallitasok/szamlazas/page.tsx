import type { Metadata } from 'next'

import { InvoiceSettingsForm } from '@/components/invoicing/invoice-settings-form'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { getSessionUser } from '@/lib/auth/session'
import { getOrCreateInvoiceSettings } from '@/lib/invoicing/settings'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Számlázás'
}

export default async function SzamlazasSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Számlázás</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Számlázás</h1>
        <p className="text-body text-danger-ink">Nincs adatbázis kapcsolat.</p>
      </div>
    )
  }

  let settings
  try {
    settings = await getOrCreateInvoiceSettings(supabase, user.tenantId)
  } catch (err) {
    return (
      <div className="space-y-3">
        <PageHeader title="Számlázás" />
        <p className="rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink">
          {err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a beállításokat.'}
        </p>
        <p className="text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            20260526_szamlazas_alap.sql
          </code>{' '}
          migrációt.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Számlázás"
        description="Számlázz.hu Agent — kimenő díjbekérő, előleg, számla."
      />
      <InvoiceSettingsForm initial={settings} canWrite={canWrite} />
    </div>
  )
}
