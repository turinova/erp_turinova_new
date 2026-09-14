import type { Metadata } from 'next'

import { CompanySettingsForm } from '@/components/company/company-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import { getOrCreateTenantCompany } from '@/lib/company/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Cégadatok'
}

export default async function CompanySettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let loadError: string | null = null
  let company: Awaited<ReturnType<typeof getOrCreateTenantCompany>> | null =
    null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        company = await getOrCreateTenantCompany(
          supabase,
          user.tenantId,
          user.companyName,
          { createIfMissing: canWrite }
        )
        if (!company) {
          loadError =
            'Még nincsenek cégadatok. Egy írási jogú felhasználónak kell először megnyitnia az oldalt.'
        }
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a cégadatokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (loadError || !company || !user?.tenantId) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Cégadatok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError ?? 'A cégadatok nem elérhetők.'}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260317_tenant_companies.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben.
        </p>
      </div>
    )
  }

  return (
    <CompanySettingsForm
      initial={company}
      tenantId={user.tenantId}
      canWrite={canWrite}
    />
  )
}
