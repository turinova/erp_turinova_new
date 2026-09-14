import { redirect } from 'next/navigation'

import { PartnerShell } from '@/components/partner/partner-shell'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'

export default async function PartnerAppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await getPartnerSession()
  if (!session) {
    redirect(PARTNER_LOGIN_PATH)
  }

  const companyLabel = await resolvePartnerCompanyLabel(
    session.selectedTenantId
  )

  return (
    <PartnerShell
      email={session.email}
      name={session.name}
      companyLabel={companyLabel}
    >
      {children}
    </PartnerShell>
  )
}
