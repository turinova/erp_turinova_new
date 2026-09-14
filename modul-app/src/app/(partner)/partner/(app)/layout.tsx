import { redirect } from 'next/navigation'

import { PartnerShell } from '@/components/partner/partner-shell'
import { getPartnerImpersonation } from '@/lib/auth/partner-impersonation'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
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
    redirect(await partnerServerHref(PARTNER_LOGIN_PATH))
  }

  const [companyLabel, impersonation] = await Promise.all([
    resolvePartnerCompanyLabel(session.selectedTenantId),
    getPartnerImpersonation(session.id, session.email)
  ])

  return (
    <PartnerShell
      email={session.email}
      name={session.name}
      companyLabel={companyLabel}
      impersonation={impersonation}
    >
      {children}
    </PartnerShell>
  )
}
