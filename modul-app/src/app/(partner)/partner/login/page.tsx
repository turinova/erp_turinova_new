import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerLoginForm } from '@/components/partner/partner-login-form'

export const metadata: Metadata = {
  title: 'Belépés · Asztalos'
}

type SearchParams = Promise<{ reason?: string }>

export default async function PartnerLoginPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const accountDeleted = params.reason === 'account_deleted'

  return (
    <PartnerAuthShell
      title="Belépés"
      description="Asztalos fiók — nem a céges admin felület."
    >
      {accountDeleted ? (
        <p
          className="mb-3 border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          A fiókodat töröltük.
        </p>
      ) : null}
      <PartnerLoginForm />
    </PartnerAuthShell>
  )
}
