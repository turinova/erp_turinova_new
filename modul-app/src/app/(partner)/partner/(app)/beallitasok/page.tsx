import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PartnerDeleteAccount } from '@/components/partner/partner-delete-account'
import { PartnerLinkedCompanyForm } from '@/components/partner/partner-linked-company-form'
import { PartnerPasswordForm } from '@/components/partner/partner-password-form'
import { PartnerSettingsProfileForm } from '@/components/partner/partner-settings-profile-form'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Beállítások · Asztalos portál'
}

export default async function PartnerSettingsPage() {
  const session = await getPartnerSession()
  if (!session) {
    redirect(await partnerServerHref(PARTNER_LOGIN_PATH))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h1 className="text-h1 text-ink">Beállítások</h1>
        <p className="text-hint text-ink-secondary">
          Profil, számlázás, kapcsolt cég és fiókbiztonság
        </p>
      </div>

      <PartnerLinkedCompanyForm
        selectedTenantId={session.selectedTenantId}
      />

      <div className="grid items-start gap-3 lg:grid-cols-[1fr_340px]">
        <PartnerSettingsProfileForm
          profile={session.profile}
          email={session.email}
        />
        <div className="flex flex-col gap-3">
          <PartnerPasswordForm />
          <PartnerDeleteAccount />
        </div>
      </div>
    </div>
  )
}
