import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerLoginForm } from '@/components/partner/partner-login-form'
import { PARTNER_HOST_LABEL, STAFF_HOST_LABEL } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Asztalos belépés'
}

type SearchParams = Promise<{ reason?: string }>

export default async function PartnerLoginPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const accountDeleted = params.reason === 'account_deleted'
  const disabled = params.reason === 'disabled'

  return (
    <PartnerAuthShell
      title="Asztalos belépés"
      description={`Partner portál · ${PARTNER_HOST_LABEL}. Nem a céges ERP (${STAFF_HOST_LABEL}).`}
    >
      {accountDeleted ? (
        <p
          className="mb-3 border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          A fiókodat töröltük.
        </p>
      ) : null}
      {disabled ? (
        <p
          className="mb-3 border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
          role="alert"
        >
          A partner fiókod ki van kapcsolva. Ha szerinted ez hiba, írj a
          szolgáltatóknak.
        </p>
      ) : null}
      <PartnerLoginForm />
    </PartnerAuthShell>
  )
}
